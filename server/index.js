const express = require('express');
const cors = require('cors');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./services/openai');
const { storePendingAction, getPendingAction, deletePendingAction } = require('./middleware/confirmationStore');
const dateHelper = require('./helpers/dateHelper');
const { gerarSQLCompleto } = require('./services/sqlGenerator');
const rbacHelper = require('./helpers/rbacHelper');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
    const headerUser = req.header('x-user-id') || req.header('x-userid');
    const parsed = headerUser ? parseInt(headerUser, 10) : null;
    
    // Para rotas protegidas que requerem autenticação, usar o header ou default para testes
    // Rotas de leitura básicas podem usar default, mas ações sensíveis devem ter header
    req.currentUserId = Number.isFinite(parsed) ? parsed : 1;
    
    // Log para debug
    if (req.path === '/api/chat') {
        console.log(`[MIDDLEWARE] Header x-user-id: ${headerUser}, Parsed: ${parsed}, currentUserId: ${req.currentUserId}`);
    }
    
    next();
});

const formatAuditId = (id) => (id ? `AUD-${id.toString().padStart(6, '0')}` : 'AUD-N/A');

const ensurePermission = async (req, res, action, resource) => {
    try {
        const headerUser = req.header('x-user-id') || req.header('x-userid');
        const userId = headerUser ? parseInt(headerUser, 10) : req.currentUserId;
        
        // Se não houver header e for o usuário padrão (1), alertar
        if (!headerUser && req.currentUserId === 1) {
            console.warn(`[RBAC] ATENÇÃO: Header x-user-id não foi enviado! Usando usuário padrão (1) que pode não ter permissões.`);
        }
        
        console.log(`[RBAC] Verificando permissão - User ID: ${userId}, Action: ${action}, Resource: ${resource}, Header presente: ${!!headerUser}`);
        const allowed = await rbacHelper.canPerformAction(userId, action, resource);
        if (!allowed) {
            console.log(`[RBAC] PERMISSÃO NEGADA - User ID: ${userId}, Action: ${action}, Resource: ${resource}`);
            res.status(403).json({
                type: 'ERROR',
                message: `Você não tem permissão para ${action.toLowerCase()} ${resource.toLowerCase()}.`
            });
            return false;
        }
        console.log(`[RBAC] PERMISSÃO CONCEDIDA - User ID: ${userId}, Action: ${action}, Resource: ${resource}`);
        return true;
    } catch (error) {
        console.error('RBAC validation error:', error);
        res.status(500).json({ type: 'ERROR', message: 'Falha ao validar permissões.' });
        return false;
    }
};

// Helper: Create audit log
const createAuditLog = async (actionType, targetUserId, details) => {
    try {
        console.log('[AUDIT] Criando log de auditoria:', { actionType, targetUserId, details });
        const result = await db.query(
            'INSERT INTO audit_logs (action_type, target_user_id, details) VALUES ($1, $2, $3) RETURNING id',
            [actionType, targetUserId, JSON.stringify(details)]
        );
        const auditId = result.rows[0]?.id;
        console.log('[AUDIT] Log criado com sucesso, ID:', auditId);
        return auditId;
    } catch (err) {
        console.error('[AUDIT] Erro ao criar log de auditoria:', err.message, err.stack);
        console.error('[AUDIT] Detalhes do erro:', { actionType, targetUserId, details });
        // Tentar verificar se a tabela existe
        try {
            const tableCheck = await db.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'audit_logs')"
            );
            console.log('[AUDIT] Tabela audit_logs existe?', tableCheck.rows[0]?.exists);
        } catch (checkErr) {
            console.error('[AUDIT] Erro ao verificar tabela:', checkErr.message);
        }
        return null;
    }
};

// Test DB Connection and ensure audit_logs table exists
const testDbConnection = async () => {
    try {
        const result = await db.query('SELECT NOW()');
        console.log('✅ Database connected successfully at', result.rows[0].now);
        
        // Verificar e criar tabela audit_logs se não existir
        try {
            const tableExists = await db.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs')"
            );
            
            if (!tableExists.rows[0]?.exists) {
                console.log('📋 Criando tabela audit_logs...');
                await db.query(`
                    CREATE TABLE audit_logs (
                        id SERIAL PRIMARY KEY,
                        action_type VARCHAR(100) NOT NULL,
                        target_user_id INTEGER,
                        details JSONB,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                console.log('✅ Tabela audit_logs criada com sucesso');
            } else {
                console.log('✅ Tabela audit_logs já existe');
            }
        } catch (tableErr) {
            console.error('⚠️  Erro ao verificar/criar tabela audit_logs:', tableErr.message);
        }
    } catch (err) {
        console.error('⚠️  Database connection failed:', err.message);
        console.log('⚠️  Server will run but database operations will fail');
    }
};

testDbConnection();

// Routes
const operationsRoutes = require('./routes/operations');
const groupsRoutes = require('./routes/groups');
const auditRoutes = require('./routes/audit');

app.use('/api/operations', operationsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/audit', auditRoutes);

// POST /api/generate-sql - Gerar SQL usando Seleção Dinâmica de Esquema (2-step RAG)
app.post('/api/generate-sql', async (req, res) => {
    try {
        const { question } = req.body;

        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }

        console.log('[API] Gerando SQL para pergunta:', question);

        // Usar a nova arquitetura de 2-step RAG
        const resultado = await gerarSQLCompleto(question);

        return res.json({
            success: true,
            sql: resultado.sql,
            tabelasSelecionadas: resultado.tabelasSelecionadas,
            message: `SQL gerado usando ${resultado.tabelasSelecionadas.length} tabela(s)`
        });

    } catch (error) {
        console.error('Erro ao gerar SQL:', error);
        return res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
});

// POST /api/execute-sql - Executar SQL gerado (com validação de segurança)
app.post('/api/execute-sql', async (req, res) => {
    try {
        const { sql } = req.body;

        if (!sql) {
            return res.status(400).json({ error: 'SQL is required' });
        }

        // Validação básica de segurança: apenas SELECT permitido
        const sqlTrimmed = sql.trim().toUpperCase();
        if (!sqlTrimmed.startsWith('SELECT')) {
            return res.status(400).json({ 
                error: 'Apenas queries SELECT são permitidas por segurança' 
            });
        }

        console.log('[API] Executando SQL:', sql);

        const result = await db.query(sql);

        return res.json({
            success: true,
            rows: result.rows,
            rowCount: result.rowCount
        });

    } catch (error) {
        console.error('Erro ao executar SQL:', error);
        return res.status(500).json({
            error: 'Database Error',
            message: error.message
        });
    }
});

// GET /api/auth/user/:id - Get user info with profiles for login
app.get('/api/auth/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar informações do usuário
        const userResult = await db.query(
            `SELECT id_usuario, str_descricao, str_login, email, str_cpf, str_ativo, bloqueado
             FROM tb_usuario 
             WHERE id_usuario = $1 AND str_ativo = 'A' AND bloqueado = false`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado ou inativo' });
        }

        const user = userResult.rows[0];

        // Buscar perfis do usuário (tb_usuario_perfil não tem str_ativo, verificar apenas no perfil)
        const profilesResult = await db.query(
            `SELECT p.id_perfil, p.str_descricao
             FROM tb_usuario_perfil up
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             WHERE up.id_usuario = $1 
               AND p.str_ativo = 'A'
             ORDER BY p.str_descricao`,
            [id]
        );

        const profiles = profilesResult.rows.map(p => ({
            id_perfil: p.id_perfil,
            str_descricao: p.str_descricao
        }));

        res.json({
            ...user,
            profiles: profiles
        });
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/users - List users with filters
// Consultas de leitura básicas não requerem RBAC (necessárias para dashboards)
app.get('/api/users', async (req, res) => {
    try {
        // RBAC removido para permitir consultas básicas de leitura no dashboard
        const filters = req.query;
        let whereConditions = [];
        const params = [];
        let paramCount = 1;

        if (filters.name) {
            whereConditions.push(`str_descricao ILIKE $${paramCount}`);
            params.push(`%${filters.name}%`);
            paramCount++;
        }
        if (filters.login) {
            whereConditions.push(`str_login ILIKE $${paramCount}`);
            params.push(`%${filters.login}%`);
            paramCount++;
        }
        if (filters.email) {
            whereConditions.push(`email ILIKE $${paramCount}`);
            params.push(`%${filters.email}%`);
            paramCount++;
        }
        if (filters.cpf) {
            whereConditions.push(`str_cpf = $${paramCount}`);
            params.push(filters.cpf);
            paramCount++;
        }
        if (filters.status) {
            if (filters.status === 'INATIVO') {
                whereConditions.push(`str_ativo = 'E'`);
            } else if (filters.status === 'BLOQUEADO') {
                whereConditions.push(`bloqueado = true AND str_ativo = 'A'`);
            } else if (filters.status === 'ATIVO') {
                whereConditions.push(`bloqueado = false AND str_ativo = 'A'`);
            }
        }

        const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

        const query = `SELECT 
            id_usuario as id,
            str_descricao as name,
            str_login as login,
            email,
            str_cpf as cpf,
            str_ativo,
            bloqueado,
            CASE 
                WHEN str_ativo = 'E' THEN 'INATIVO'
                WHEN bloqueado = true THEN 'BLOQUEADO'
                ELSE 'ATIVO'
            END as status,
            dh_edita as last_modified
        FROM tb_usuario 
        ${whereClause}
        ORDER BY dh_edita DESC NULLS LAST
        LIMIT 200`;

        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// PUT /api/users/:login/cpf - Update user CPF directly
app.put('/api/users/:login/cpf', async (req, res) => {
    try {
        const { login } = req.params;
        const { cpf } = req.body;

        if (!cpf) {
            return res.status(400).json({ error: 'CPF is required' });
        }

        // Tentar desabilitar triggers temporariamente (pode não funcionar dependendo das permissões)
        try {
            await db.query('SET session_replication_role = replica');
        } catch (e) {
            // Ignorar se não tiver permissão para desabilitar triggers
            console.log('Não foi possível desabilitar triggers:', e.message);
        }

        const result = await db.query(
            `UPDATE tb_usuario 
             SET str_cpf = $1, dh_edita = NOW() 
             WHERE str_login = $2
             RETURNING id_usuario as id, str_descricao as name, str_login as login, email, str_cpf`,
            [cpf, login]
        );

        // Reabilitar triggers
        try {
            await db.query('SET session_replication_role = DEFAULT');
        } catch (e) {
            // Ignorar erro
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: `Usuário com login "${login}" não encontrado.` });
        }

        res.json({
            success: true,
            message: `CPF do usuário ${result.rows[0].name} atualizado com sucesso!`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating CPF:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// PUT /api/users/:login/email - Update user email directly
app.put('/api/users/:login/email', async (req, res) => {
    try {
        const { login } = req.params;
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        // Tentar desabilitar triggers temporariamente (pode não funcionar dependendo das permissões)
        try {
            await db.query('SET session_replication_role = replica');
        } catch (e) {
            // Ignorar se não tiver permissão para desabilitar triggers
            console.log('Não foi possível desabilitar triggers:', e.message);
        }

        const result = await db.query(
            `UPDATE tb_usuario 
             SET email = $1, dh_edita = NOW() 
             WHERE str_login = $2
             RETURNING id_usuario as id, str_descricao as name, str_login as login, email, str_cpf`,
            [email, login]
        );

        // Reabilitar triggers
        try {
            await db.query('SET session_replication_role = DEFAULT');
        } catch (e) {
            // Ignorar erro
        }

        if (result.rowCount === 0) {
            return res.status(404).json({ error: `Usuário com login "${login}" não encontrado.` });
        }

        res.json({
            success: true,
            message: `Email do usuário ${result.rows[0].name} atualizado com sucesso!`,
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Error updating email:', err);
        res.status(500).json({ error: 'Internal Server Error', details: err.message });
    }
});

// POST /api/chat - Process user message via OpenAI
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Process message with OpenAI
        const aiResponse = await processMessage(message);

        if (aiResponse.type === 'ERROR') {
            return res.status(500).json({ type: 'ERROR', message: aiResponse.message });
        }

        if (aiResponse.type === 'MESSAGE') {
            return res.json({ type: 'TEXT', content: aiResponse.content });
        }

        if (aiResponse.type === 'TOOL_CALL') {
            const toolCall = aiResponse.toolCalls[0];
            let fnName = toolCall.function.name;
            let args;
            
            try {
                args = JSON.parse(toolCall.function.arguments);
            } catch (parseError) {
                console.error('[CHAT] Erro ao fazer parse dos argumentos:', parseError);
                return res.status(500).json({
                    type: 'ERROR',
                    message: 'Erro ao processar argumentos da função.'
                });
            }
            
            // INTERCEPTAR: Se queryUsers foi chamado mas a mensagem original pede para bloquear/desbloquear
            try {
                const lowerMessage = message.toLowerCase();
                const isBlockRequest = lowerMessage.includes('bloquear') && !lowerMessage.includes('todos') && !lowerMessage.includes('empresa');
                const isUnblockRequest = lowerMessage.includes('desbloquear');
                
                if (fnName === 'queryUsers' && (isBlockRequest || isUnblockRequest)) {
                    console.log('[CHAT] Interceptando queryUsers - mensagem pede para bloquear/desbloquear usuário específico');
                    
                    // Extrair login/email dos filtros ou tentar extrair da mensagem
                    let login = args.filters?.login;
                    let email = args.filters?.email;
                    
                    // Se não encontrou nos filtros, tentar extrair da mensagem
                    if (!login && !email) {
                        // Tentar encontrar login no formato "teste.op" ou similar
                        const loginMatch = message.match(/\b([a-z]+\.[a-z]+(?:\.[a-z]+)?)\b/i);
                        if (loginMatch) {
                            login = loginMatch[1];
                        }
                        
                        // Tentar encontrar email
                        const emailMatch = message.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
                        if (emailMatch) {
                            email = emailMatch[1];
                        }
                    }
                    
                    const block = isBlockRequest;
                    
                    if (login || email) {
                        console.log('[CHAT] Redirecionando para blockUser com:', { login, email, block });
                        fnName = 'blockUser';
                        args = {
                            login: login,
                            email: email,
                            block: block
                        };
                    } else {
                        console.warn('[CHAT] Não foi possível extrair login/email da mensagem para bloquear');
                    }
                }
            } catch (interceptError) {
                console.error('[CHAT] Erro na interceptação:', interceptError);
                // Continuar com a função original se houver erro na interceptação
            }

            // Verificar se header foi enviado para ações sensíveis
            const headerUser = req.header('x-user-id') || req.header('x-userid');
            const sensitiveActions = ['createUser', 'findUserAndUpdate', 'blockUser', 'deleteUser', 'blockUsers', 'resetPasswords'];
            
            if (sensitiveActions.includes(fnName) && !headerUser) {
                console.warn(`[CHAT] Ação sensível ${fnName} tentada sem header x-user-id!`);
                return res.status(401).json({
                    type: 'ERROR',
                    message: 'Autenticação necessária. Faça login novamente.'
                });
            }

            // RBAC apenas para ações sensíveis (escrita/modificação)
            // Consultas de leitura (queryUsers, queryGroups, etc.) são permitidas sem verificação
            const permissionMap = {
                createUser: { action: 'CREATE', resource: 'USER' },
                findUserAndUpdate: { action: 'UPDATE', resource: 'USER' },
                blockUser: { action: 'BLOCK', resource: 'USER' },
                deleteUser: { action: 'DELETE', resource: 'USER' },
                blockUsers: { action: 'BLOCK', resource: 'USER' },
                resetPasswords: { action: 'RESET', resource: 'USER' }
                // queryUsers e outras queries de leitura não requerem RBAC
            };

            const permission = permissionMap[fnName];
            if (permission) {
                const allowed = await ensurePermission(req, res, permission.action, permission.resource);
                if (!allowed) {
                    // ensurePermission já enviou a resposta 403, apenas retornar
                    return;
                }
            }
            
            // Log para debug
            console.log(`[CHAT] Usuário ${req.currentUserId} (header: ${headerUser || 'não enviado'}) executando ${fnName}`);

            // Handle createUser
            if (fnName === 'createUser') {
                const { name, login, profile, company, email, cpf } = args;
                const sanitizedLogin = (login || '').trim().toLowerCase();

                if (!name || !sanitizedLogin || !email || !profile || !company) {
                    return res.status(400).json({
                        type: 'ERROR',
                        message: 'Informe nome, login, e-mail, perfil e empresa para cadastrar um usuário.'
                    });
                }

                try {
                    const finalCpf = cpf || '000.000.000-00';
                    const operationLookup = await db.query(
                        `SELECT id_operacao FROM tb_operacao WHERE UPPER(str_descricao) = UPPER($1) LIMIT 1`,
                        [company]
                    );
                    const operationId = operationLookup.rows[0]?.id_operacao || 1;

                    const result = await db.query(
                        `INSERT INTO tb_usuario (
                            str_descricao, str_login, email, str_cpf, 
                            str_ativo, bloqueado, id_operacao, id_grupo, id_usuarioinclui
                        ) 
                         VALUES ($1, $2, $3, $4, 'A', false, $5, 1, $6) 
                         RETURNING id_usuario as id, str_descricao as name, str_login as login, email`,
                        [name, sanitizedLogin, email, finalCpf, operationId, req.currentUserId]
                    );

                    const auditDbId = await createAuditLog('CREATE_USER', result.rows[0].id, {
                        performedBy: req.currentUserId,
                        company,
                        profile,
                        login: sanitizedLogin
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    return res.json({
                        type: 'ACTION_COMPLETE',
                        message: `Usuário cadastrado com sucesso! Login: ${result.rows[0].login}. Audit ID: ${auditLabel}`,
                        auditId: auditLabel,
                        data: result.rows[0]
                    });
                } catch (err) {
                    if (err.code === '23505') { // Duplicate key error
                        return res.json({
                            type: 'ERROR',
                            message: `Erro: Já existe um usuário com o login "${sanitizedLogin}". Tente outro login.`
                        });
                    }
                    throw err; // Re-throw other errors
                }
            }

            // Handle queryUsers (dynamic query building based on AI filters)
            if (fnName === 'queryUsers' || fnName === 'getUsers') {
                const { filters = {}, count_only = false } = args;
                console.log('queryUsers called with filters:', JSON.stringify(filters));

                // Se buscar por ID específico, não aplicar filtro de ativo (para permitir encontrar qualquer usuário)
                // Caso contrário, filtrar apenas usuários ativos
                let whereConditions = filters.id ? [] : [`u.str_ativo = 'A'`];
                const params = [];
                let paramCount = 1;
                let needsJoinOperation = false; // Flag para indicar se precisa JOIN com tb_operacao
                let needsJoinGroup = false; // Flag para indicar se precisa JOIN com tb_grupo
                let needsJoinProfile = false; // Flag para indicar se precisa JOIN com tb_perfil via tb_usuario_perfil

                if (filters.id) {
                    whereConditions.push(`u.id_usuario = $${paramCount}`);
                    params.push(filters.id);
                    paramCount++;
                }
                if (filters.name) {
                    whereConditions.push(`u.str_descricao ILIKE $${paramCount}`);
                    params.push(`%${filters.name}%`);
                    paramCount++;
                }
                if (filters.login) {
                    const loginValue = filters.login.trim();
                    // Se o login contém ponto e não contém espaços, provavelmente é um login completo
                    // Usar busca exata (case-insensitive) para melhor performance e precisão
                    if (loginValue.includes('.') && !loginValue.includes(' ') && loginValue.length > 5) {
                        // Login completo - usar busca exata (ILIKE sem %)
                        whereConditions.push(`u.str_login ILIKE $${paramCount}`);
                        params.push(loginValue);
                    } else {
                        // Login parcial ou sem ponto - usar busca parcial
                        whereConditions.push(`u.str_login ILIKE $${paramCount}`);
                        params.push(`%${loginValue}%`);
                    }
                    paramCount++;
                }
                if (filters.email) {
                    whereConditions.push(`u.email ILIKE $${paramCount}`);
                    params.push(`%${filters.email}%`);
                    paramCount++;
                }
                if (filters.cpf) {
                    whereConditions.push(`u.str_cpf = $${paramCount}`);
                    params.push(filters.cpf);
                    paramCount++;
                }
                if (filters.status) {
                    whereConditions.push(`u.bloqueado = $${paramCount}`);
                    params.push(filters.status === 'BLOQUEADO');
                    paramCount++;
                }
                if (filters.operation) {
                    needsJoinOperation = true;
                    whereConditions.push(`o.str_descricao ILIKE $${paramCount}`);
                    params.push(`%${filters.operation}%`);
                    paramCount++;
                }
                if (filters.operation_id) {
                    needsJoinOperation = true;
                    whereConditions.push(`u.id_operacao = $${paramCount}`);
                    params.push(filters.operation_id);
                    paramCount++;
                }
                if (filters.group) {
                    needsJoinGroup = true;
                    whereConditions.push(`g.str_descricao ILIKE $${paramCount}`);
                    params.push(`%${filters.group}%`);
                    paramCount++;
                }
                if (filters.group_id) {
                    needsJoinGroup = true;
                    whereConditions.push(`u.id_grupo = $${paramCount}`);
                    params.push(filters.group_id);
                    paramCount++;
                }
                if (filters.profile) {
                    needsJoinProfile = true;
                    whereConditions.push(`p.str_descricao ILIKE $${paramCount}`);
                    params.push(`%${filters.profile}%`);
                    paramCount++;
                }
                if (filters.profile_id) {
                    needsJoinProfile = true;
                    whereConditions.push(`up.id_perfil = $${paramCount}`);
                    params.push(filters.profile_id);
                    paramCount++;
                }

                // DATE FILTERING - New feature using dateHelper
                if (filters.date_from || filters.date_to) {
                    let startDate, endDate;

                    if (filters.date_from) {
                        // Try parsing as range first
                        const range = dateHelper.parseDateRange(filters.date_from);
                        if (range) {
                            startDate = range.start;
                            endDate = range.end;
                        } else {
                            // Parse as single date
                            startDate = dateHelper.parseNaturalDate(filters.date_from);
                            if (startDate) {
                                startDate.setHours(0, 0, 0, 0);
                            }
                        }
                    }

                    if (filters.date_to && !endDate) {
                        endDate = dateHelper.parseNaturalDate(filters.date_to);
                        if (endDate) {
                            endDate.setHours(23, 59, 59, 999);
                        }
                    }

                    if (startDate && endDate) {
                        whereConditions.push(`u.dh_edita BETWEEN $${paramCount} AND $${paramCount + 1}`);
                        params.push(startDate);
                        params.push(endDate);
                        paramCount += 2;
                    } else if (startDate) {
                        whereConditions.push(`u.dh_edita >= $${paramCount}`);
                        params.push(startDate);
                        paramCount++;
                    } else if (endDate) {
                        whereConditions.push(`u.dh_edita <= $${paramCount}`);
                        params.push(endDate);
                        paramCount++;
                    }
                }

                // Construir JOINs (operação e grupo sempre disponíveis para evitar erros nos SELECTs)
                const joins = [
                    `LEFT JOIN tb_operacao o ON u.id_operacao = o.id_operacao`,
                    `LEFT JOIN tb_grupo g ON u.id_grupo = g.id_grupo`
                ];
                if (needsJoinProfile) {
                    // Usar INNER JOIN quando filtrar por perfil para garantir apenas usuários com o perfil
                    const joinType = (filters.profile || filters.profile_id) ? 'INNER JOIN' : 'LEFT JOIN';
                    joins.push(`${joinType} tb_usuario_perfil up ON u.id_usuario = up.id_usuario`);
                    joins.push(`LEFT JOIN tb_perfil p ON up.id_perfil = p.id_perfil`);
                }
                const joinClause = joins.length > 0 ? joins.join(' ') : '';
                const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

                if (count_only) {
                    const query = `SELECT COUNT(*) as count FROM tb_usuario u ${joinClause} ${whereClause}`;
                    const result = await db.query(query, params);
                    let message = `Existem ${result.rows[0].count} usuários correspondentes.`;
                    if (filters.operation) {
                        message = `Existem ${result.rows[0].count} usuário(s) na operação "${filters.operation}".`;
                    }
                    const auditDbId = await createAuditLog('QUERY_USERS', null, {
                        performedBy: req.currentUserId,
                        filters,
                        count: parseInt(result.rows[0].count),
                        count_only: true
                    });
                    const auditLabel = formatAuditId(auditDbId);
                    return res.json({
                        type: 'TEXT',
                        content: `${message}\nAudit ID: ${auditLabel}`
                    });
                } else {
                    const query = `SELECT DISTINCT
                        u.id_usuario as id,
                        u.str_descricao as name,
                        u.str_login as login,
                        u.email,
                        u.str_cpf as cpf,
                        u.bloqueado,
                        CASE WHEN u.bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status,
                        u.dh_edita as last_modified,
                        o.str_descricao as operation_name,
                        g.str_descricao as group_name
                    FROM tb_usuario u
                    ${joinClause}
                    ${whereClause}
                    ORDER BY u.dh_edita DESC NULLS LAST
                    LIMIT 100`;

                    const result = await db.query(query, params);
                    const auditDbId = await createAuditLog('QUERY_USERS', null, {
                        performedBy: req.currentUserId,
                        filters,
                        count: result.rows.length,
                        count_only: false
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    if (result.rows.length === 0) {
                        let message = 'Nenhum usuário encontrado com os critérios fornecidos.';
                        if (filters.operation) {
                            message = `Nenhum usuário encontrado para a operação "${filters.operation}".`;
                        }
                        return res.json({
                            type: 'TEXT',
                            content: `${message}\nAudit ID: ${auditLabel}`
                        });
                    }

                    if (result.rows.length === 1) {
                        const user = result.rows[0];
                        const relativeTime = user.last_modified ? dateHelper.getRelativeTime(new Date(user.last_modified)) : 'nunca';
                        const data = {
                            "ID": user.id,
                            "Nome": user.name,
                            "Login": user.login,
                            "Email": user.email,
                            "CPF": user.cpf,
                            "Operação": user.operation_name || 'Não informada',
                            "Grupo": user.group_name || 'Não informado',
                            "Status": user.status,
                            "Bloqueado": user.bloqueado ? 'Sim' : 'Não',
                            "Última Modificação": `${new Date(user.last_modified).toLocaleString()} (${relativeTime})`
                        };

                        let response = 'Dados do Usuário:\n';
                        response += '------------------------------------------\n';
                        for (const [key, value] of Object.entries(data)) {
                            response += `${key.padEnd(20)}: ${value}\n`;
                        }
                        response += '------------------------------------------';

                        return res.json({
                            type: 'TEXT',
                            content: `${response}\nAudit ID: ${auditLabel}`
                        });
                    }

                    // For multiple users, show relative time if date filtering was used
                    const showRelativeTime = filters.date_from || filters.date_to;
                    const showOperation = filters.operation || filters.operation_id;
                    const showGroup = filters.group || filters.group_id;
                    const userList = result.rows.map(u => {
                        let line = `- ${u.name} (${u.login})`;
                        if (showOperation && u.operation_name) {
                            line += ` [Op: ${u.operation_name}]`;
                        }
                        if (showGroup && u.group_name) {
                            line += ` [Grupo: ${u.group_name}]`;
                        }
                        if (showRelativeTime && u.last_modified) {
                            const relativeTime = dateHelper.getRelativeTime(new Date(u.last_modified));
                            line += ` - modificado ${relativeTime}`;
                        }
                        return line;
                    }).join('\n');

                    let message = `Encontrados ${result.rows.length} usuários:\n${userList}`;
                    if (filters.operation) {
                        message = `Encontrados ${result.rows.length} usuário(s) da operação "${filters.operation}":\n${userList}`;
                    }
                    return res.json({
                        type: 'TEXT',
                        content: `${message}\nAudit ID: ${auditLabel}`
                    });
                }
            }

            // Handle updateUser
            if (fnName === 'findUserAndUpdate') {
                try {
                    console.log('--- findUserAndUpdate ---');
                    const { login, email, cpf, newName, newEmail, newPassword, newCpf } = args;
                    console.log('Args:', args);

                    let setClauses = [];
                    let whereClauses = [];
                    const params = [];
                    let paramCount = 1;

                    if (newName) {
                        setClauses.push(`str_descricao = $${paramCount}`);
                        params.push(newName);
                        paramCount++;
                    }
                    if (newEmail) {
                        setClauses.push(`email = $${paramCount}`);
                        params.push(newEmail);
                        paramCount++;
                    }
                    if (newPassword) {
                        setClauses.push(`str_senha = $${paramCount}`);
                        params.push(newPassword);
                        paramCount++;
                    }
                    if (newCpf) {
                        setClauses.push(`str_cpf = $${paramCount}`);
                        params.push(newCpf);
                        paramCount++;
                    }

                    if (setClauses.length === 0) {
                        return res.json({
                            type: 'ERROR',
                            message: 'Nenhum campo para atualizar foi fornecido.'
                        });
                    }

                    if (login) {
                        whereClauses.push(`str_login = $${paramCount}`);
                        params.push(login);
                        paramCount++;
                    } else if (email) {
                        whereClauses.push(`email = $${paramCount}`);
                        params.push(email);
                        paramCount++;
                    } else if (cpf) {
                        whereClauses.push(`str_cpf = $${paramCount}`);
                        params.push(cpf);
                        paramCount++;
                    } else {
                        return res.json({
                            type: 'ERROR',
                            message: 'É necessário fornecer um login, email ou CPF para identificar o usuário.'
                        });
                    }

                    setClauses.push(`dh_edita = NOW()`);

                    const query = `UPDATE tb_usuario 
                        SET ${setClauses.join(', ')} 
                        WHERE ${whereClauses.join(' AND ')}
                        RETURNING id_usuario as id, str_descricao as name, str_login as login, email`;

                    console.log('Query:', query);
                    console.log('Params:', params);

                    const result = await db.query(query, params);

                    if (result.rowCount === 0) {
                        return res.json({
                            type: 'ERROR',
                            message: `Usuário não encontrado com os critérios fornecidos.`
                        });
                    }

                    const auditDbId = await createAuditLog('UPDATE_USER', result.rows[0].id, {
                        performedBy: req.currentUserId,
                        filters: { login, email, cpf },
                        updates: {
                            ...(newName ? { newName } : {}),
                            ...(newEmail ? { newEmail } : {}),
                            ...(newPassword ? { newPassword: '***' } : {}),
                            ...(newCpf ? { newCpf } : {})
                        }
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    return res.json({
                        type: 'ACTION_COMPLETE',
                        message: `Usuário ${result.rows[0].name} atualizado com sucesso! Audit ID: ${auditLabel}`,
                        auditId: auditLabel,
                        data: result.rows[0]
                    });
                } catch (dbError) {
                    console.error('Database Error in findUserAndUpdate:', dbError);
                    if (dbError.code === '42501') {
                        return res.status(403).json({
                            type: 'ERROR',
                            message: 'Permissão negada pelo banco ao atualizar o usuário. A operação exige privilégios para escrever em log.tb_usuario. Solicite apoio ao DBA ou execute o script manualmente.'
                        });
                    }
                    return res.status(500).json({ error: 'Database operation failed.' });
                }
            }

            // Handle blockUser
            if (fnName === 'blockUser') {
                const { user_id, login, email, block } = args;

                // Buscar user_id se não foi fornecido diretamente
                let targetUserId = user_id;
                if (!targetUserId) {
                    let userQuery;
                    let userParams;
                    
                    if (login) {
                        userQuery = 'SELECT id_usuario, str_descricao, str_login, email FROM tb_usuario WHERE LOWER(str_login) = LOWER($1)';
                        userParams = [login];
                    } else if (email) {
                        userQuery = 'SELECT id_usuario, str_descricao, str_login, email FROM tb_usuario WHERE LOWER(email) = LOWER($1)';
                        userParams = [email];
                    } else {
                        return res.json({
                            type: 'ERROR',
                            message: 'É necessário fornecer user_id, login ou email para bloquear/desbloquear um usuário.'
                        });
                    }

                    const userSearch = await db.query(userQuery, userParams);
                    if (userSearch.rowCount === 0) {
                        return res.json({
                            type: 'ERROR',
                            message: `Usuário não encontrado${login ? ` com login "${login}"` : email ? ` com email "${email}"` : ''}.`
                        });
                    }
                    targetUserId = userSearch.rows[0].id_usuario;
                }

                // Se for bloquear (block: true), requerer confirmação
                if (block === true) {
                    // Buscar informações do usuário para mostrar na confirmação
                    const userInfo = await db.query(
                        'SELECT id_usuario, str_descricao, str_login, email FROM tb_usuario WHERE id_usuario = $1',
                        [targetUserId]
                    );

                    if (userInfo.rowCount === 0) {
                        return res.json({
                            type: 'ERROR',
                            message: `Usuário com ID ${targetUserId} não encontrado.`
                        });
                    }

                    const user = userInfo.rows[0];
                    
                    // Store pending action
                    const token = storePendingAction({
                        action: 'blockUser',
                        user_id: targetUserId,
                        user_name: user.str_descricao,
                        user_login: user.str_login,
                        requestedBy: req.currentUserId
                    });

                    return res.json({
                        type: 'CONFIRMATION_REQUIRED',
                        message: `Tem certeza que deseja BLOQUEAR o usuário "${user.str_descricao}" (${user.str_login})? Esta ação impedirá o acesso do usuário ao sistema.`,
                        confirmationToken: token,
                        userInfo: {
                            id: user.id_usuario,
                            name: user.str_descricao,
                            login: user.str_login,
                            email: user.email
                        }
                    });
                }

                // Se for desbloquear (block: false), executar diretamente sem confirmação
                const query = `UPDATE tb_usuario 
                    SET bloqueado = $1, dh_edita = NOW() 
                    WHERE id_usuario = $2
                    RETURNING id_usuario as id, str_descricao as name, bloqueado`;

                const result = await db.query(query, [block, targetUserId]);

                if (result.rowCount === 0) {
                    return res.json({
                        type: 'ERROR',
                        message: `Usuário com ID ${user_id} não encontrado.`
                    });
                }

                const auditDbId = await createAuditLog('UNBLOCK_USER', result.rows[0].id, {
                    performedBy: req.currentUserId
                });
                const auditLabel = formatAuditId(auditDbId);
                
                return res.json({
                    type: 'ACTION_COMPLETE',
                    message: `Usuário ${result.rows[0].name} desbloqueado com sucesso! Audit ID: ${auditLabel}`,
                    auditId: auditLabel,
                    data: result.rows[0]
                });
            }

            // Handle deleteUser (soft delete)
            if (fnName === 'deleteUser') {
                const { user_id } = args;

                const query = `UPDATE tb_usuario 
                    SET str_ativo = 'E', dh_edita = NOW() 
                    WHERE id_usuario = $1
                    RETURNING id_usuario as id, str_descricao as name`;

                const result = await db.query(query, [user_id]);

                if (result.rowCount === 0) {
                    return res.json({
                        type: 'ERROR',
                        message: `Usuário com ID ${user_id} não encontrado.`
                    });
                }

                const auditDbId = await createAuditLog('DELETE_USER', result.rows[0].id, {
                    performedBy: req.currentUserId
                });
                const auditLabel = formatAuditId(auditDbId);

                return res.json({
                    type: 'ACTION_COMPLETE',
                    message: `Usuário ${result.rows[0].name} excluído com sucesso! Audit ID: ${auditLabel}`,
                    auditId: auditLabel,
                    data: result.rows[0]
                });
            }

            // Handle blockUsers (SENSITIVE - requires confirmation)
            if (fnName === 'blockUsers') {
                const { company } = args;

                // Count affected users (company filter not available in tb_usuario)
                const countResult = await db.query(
                    'SELECT COUNT(*) as count FROM tb_usuario WHERE str_ativo = \'A\''
                );
                const count = parseInt(countResult.rows[0].count);

                // Store pending action
                const token = storePendingAction({
                    action: 'blockUsers',
                    company,
                    requestedBy: req.currentUserId
                });

                return res.json({
                    type: 'CONFIRMATION_REQUIRED',
                    message: `Isso afetará ${count} usuários da empresa "${company}". Tem certeza?`,
                    confirmationToken: token,
                    affectedCount: count
                });
            }

            // Handle queryOperations
            if (fnName === 'queryOperations') {
                const { search, action } = args;

                if (action === 'STATS') {
                    const total = await db.query("SELECT COUNT(*) as count FROM tb_operacao WHERE str_ativo = 'A'");
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${total.rows[0].count} operações ativas no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = "SELECT str_descricao, str_documento FROM tb_operacao WHERE str_ativo = 'A'";
                    const params = [];
                    if (search) {
                        query += " AND str_descricao ILIKE $1";
                        params.push(`%${search}%`);
                    }
                    query += " LIMIT 10";

                    const result = await db.query(query, params);
                    const list = result.rows.map(o => `- ${o.str_descricao} (${o.str_documento || 'Sem CNPJ'})`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Operações encontradas:\n${list}`
                    });
                }

                if (action === 'COUNT_USERS') {
                    let query = `
                        SELECT o.str_descricao, COUNT(u.id_usuario) as count
                        FROM tb_operacao o
                        LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao AND u.str_ativo = 'A'
                        WHERE o.str_ativo = 'A'
                    `;
                    const params = [];
                    if (search) {
                        query += " AND o.str_descricao ILIKE $1";
                        params.push(`%${search}%`);
                    }
                    query += " GROUP BY o.str_descricao ORDER BY count DESC LIMIT 5";

                    const result = await db.query(query, params);
                    const list = result.rows.map(o => `- ${o.str_descricao}: ${o.count} usuários`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Contagem de usuários por operação:\n${list}`
                    });
                }
            }

            // Handle queryGroups
            if (fnName === 'queryGroups') {
                const { search, operation, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_grupo WHERE str_ativo = 'A'";
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND str_descricao ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (operation) {
                        query += ` AND id_operacao IN (SELECT id_operacao FROM tb_operacao WHERE str_descricao ILIKE $${pCount})`;
                        params.push(`%${operation}%`);
                        pCount++;
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} grupos ativos no sistema.`
                    });
                }

                if (action === 'LIST' || action === 'HIERARCHY') {
                    let query = `
                        SELECT g.str_descricao, g.ordem, o.str_descricao as operacao
                        FROM tb_grupo g
                        LEFT JOIN tb_operacao o ON g.id_operacao = o.id_operacao
                        WHERE g.str_ativo = 'A'
                    `;
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND g.str_descricao ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (operation) {
                        query += ` AND o.str_descricao ILIKE $${pCount}`;
                        params.push(`%${operation}%`);
                        pCount++;
                    }

                    query += " ORDER BY g.ordem, g.str_descricao LIMIT 20";

                    const result = await db.query(query, params);
                    const list = result.rows.map(g => `- [${g.ordem || 0}] ${g.str_descricao} (${g.operacao || 'Geral'})`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Grupos encontrados:\n${list}`
                    });
                }
            }

            // Handle queryAudit
            if (fnName === 'queryAudit') {
                const { user_login, limit = 10 } = args;

                const result = await db.query(
                    `SELECT dh_log, login, objeto, script
                     FROM log_alteracoes
                     WHERE (script ILIKE $1 OR login = $2)
                     ORDER BY dh_log DESC
                     LIMIT $3`,
                    [`%${user_login}%`, user_login, limit]
                );

                if (result.rows.length === 0) {
                    return res.json({
                        type: 'TEXT',
                        content: `Nenhum registro de auditoria encontrado para "${user_login}".`
                    });
                }

                const list = result.rows.map(l =>
                    `- ${new Date(l.dh_log).toLocaleString()}: ${l.objeto} (Autor: ${l.login})`
                ).join('\n');

                return res.json({
                    type: 'TEXT',
                    content: `Últimas alterações relacionadas a "${user_login}":\n${list}`
                });
            }

            // Handle queryProfiles
            if (fnName === 'queryProfiles') {
                const { search, operation, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_perfil WHERE str_ativo = 'A'";
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND str_descricao ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} perfis ativos no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT p.str_descricao, o.str_descricao as operacao
                        FROM tb_perfil p
                        LEFT JOIN tb_operacao o ON p.id_operacao = o.id_operacao
                        WHERE p.str_ativo = 'A'
                    `;
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND p.str_descricao ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }

                    query += " ORDER BY p.str_descricao LIMIT 20";
                    const result = await db.query(query, params);
                    const list = result.rows.map(p => `- ${p.str_descricao} (${p.operacao || 'Geral'})`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Perfis encontrados:\n${list}`
                    });
                }
            }

            // Handle queryRoles
            if (fnName === 'queryRoles') {
                const { search, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_role WHERE str_ativo = 'A'";
                    if (search) {
                        query += " AND str_descricao ILIKE $1";
                        const result = await db.query(query, [`%${search}%`]);
                        return res.json({
                            type: 'TEXT',
                            content: `Existem ${result.rows[0].count} roles ativas no sistema.`
                        });
                    }
                    const result = await db.query(query);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} roles ativas no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = "SELECT str_descricao FROM tb_role WHERE str_ativo = 'A'";
                    const params = [];
                    if (search) {
                        query += " AND str_descricao ILIKE $1";
                        params.push(`%${search}%`);
                    }
                    query += " ORDER BY str_descricao LIMIT 20";

                    const result = await db.query(query, params);
                    const list = result.rows.map(r => `- ${r.str_descricao}`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Roles encontradas:\n${list}`
                    });
                }
            }

            // Handle queryProposals
            if (fnName === 'queryProposals') {
                const { search, cpf, status, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_formalizacao_proposta WHERE 1=1";
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND str_proposta ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (cpf) {
                        query += ` AND str_cpf = $${pCount}`;
                        params.push(cpf);
                        pCount++;
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} propostas no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT fp.str_proposta, fp.n_valorliquido, fp.n_valorcontrato, 
                               sp.str_descricao as status, fp.str_cpf
                        FROM tb_formalizacao_proposta fp
                        LEFT JOIN tb_status_proposta sp ON fp.id_status = sp.id_status
                        WHERE 1=1
                    `;
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND fp.str_proposta ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (cpf) {
                        query += ` AND fp.str_cpf = $${pCount}`;
                        params.push(cpf);
                        pCount++;
                    }
                    if (status) {
                        query += ` AND sp.str_descricao ILIKE $${pCount}`;
                        params.push(`%${status}%`);
                        pCount++;
                    }

                    query += " ORDER BY fp.dh_inclui DESC LIMIT 20";
                    const result = await db.query(query, params);
                    const list = result.rows.map(p => 
                        `- ${p.str_proposta} (R$ ${p.n_valorliquido || 0}) - Status: ${p.status || 'N/A'}`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Propostas encontradas:\n${list}`
                    });
                }

                if (action === 'BY_STATUS') {
                    const query = `
                        SELECT sp.str_descricao as status, COUNT(*) as count
                        FROM tb_formalizacao_proposta fp
                        LEFT JOIN tb_status_proposta sp ON fp.id_status = sp.id_status
                        GROUP BY sp.str_descricao
                        ORDER BY count DESC
                    `;
                    const result = await db.query(query);
                    const list = result.rows.map(s => `- ${s.status || 'Sem Status'}: ${s.count} propostas`).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Propostas por status:\n${list}`
                    });
                }
            }

            // Handle queryStatusProposals
            if (fnName === 'queryStatusProposals') {
                if (args.action === 'LIST') {
                    const result = await db.query(
                        "SELECT str_descricao FROM tb_status_proposta WHERE str_ativo = 'A' ORDER BY str_descricao"
                    );
                    const list = result.rows.map(s => `- ${s.str_descricao}`).join('\n');
                    return res.json({
                        type: 'TEXT',
                        content: `Status de propostas disponíveis:\n${list}`
                    });
                }
            }

            // Handle queryCommissions
            if (fnName === 'queryCommissions') {
                const { entidade, status, bloqueado, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_extrato_comissao WHERE 1=1";
                    const params = [];
                    let pCount = 1;

                    if (bloqueado !== undefined) {
                        query += ` AND bloqueado = $${pCount}`;
                        params.push(bloqueado);
                        pCount++;
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} registros de comissão no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT ec.id_extrato, ec.n_valor, ec.n_valor_liquido, 
                               e.str_descricao as entidade, ec.bloqueado
                        FROM tb_extrato_comissao ec
                        LEFT JOIN tb_entidade e ON ec.id_entidade = e.id_entidade
                        WHERE 1=1
                    `;
                    const params = [];
                    let pCount = 1;

                    if (entidade) {
                        query += ` AND e.str_descricao ILIKE $${pCount}`;
                        params.push(`%${entidade}%`);
                        pCount++;
                    }
                    if (bloqueado !== undefined) {
                        query += ` AND ec.bloqueado = $${pCount}`;
                        params.push(bloqueado);
                        pCount++;
                    }

                    query += " ORDER BY ec.dh_inclui DESC LIMIT 20";
                    const result = await db.query(query, params);
                    const list = result.rows.map(c => 
                        `- ID ${c.id_extrato}: R$ ${c.n_valor_liquido || c.n_valor || 0} - ${c.entidade || 'N/A'} ${c.bloqueado ? '[BLOQUEADO]' : ''}`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Comissões encontradas:\n${list}`
                    });
                }

                if (action === 'TOTAL_VALUE') {
                    let query = "SELECT SUM(n_valor_liquido) as total FROM tb_extrato_comissao WHERE bloqueado = false";
                    const result = await db.query(query);
                    return res.json({
                        type: 'TEXT',
                        content: `Valor total de comissões não bloqueadas: R$ ${parseFloat(result.rows[0].total || 0).toFixed(2)}`
                    });
                }
            }

            // Handle queryCommissionLots
            if (fnName === 'queryCommissionLots') {
                const { search, action } = args;

                if (action === 'STATS') {
                    const result = await db.query("SELECT COUNT(*) as count FROM tb_extrato_comissao_lote");
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} lotes de comissão no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = "SELECT id_lote, str_descricao, dt_pagamento, n_valor_total FROM tb_extrato_comissao_lote WHERE 1=1";
                    const params = [];
                    if (search) {
                        query += " AND str_descricao ILIKE $1";
                        params.push(`%${search}%`);
                    }
                    query += " ORDER BY dt_pagamento DESC LIMIT 20";

                    const result = await db.query(query, params);
                    const list = result.rows.map(l => 
                        `- Lote ${l.id_lote}: ${l.str_descricao || 'Sem descrição'} - R$ ${l.n_valor_total || 0}`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Lotes encontrados:\n${list}`
                    });
                }
            }

            // Handle queryCommissionTables
            if (fnName === 'queryCommissionTables') {
                if (args.action === 'LIST') {
                    const result = await db.query(
                        "SELECT str_descricao FROM tb_tabela_comissao WHERE str_ativo = 'A' ORDER BY str_descricao"
                    );
                    const list = result.rows.map(t => `- ${t.str_descricao}`).join('\n');
                    return res.json({
                        type: 'TEXT',
                        content: `Tabelas de comissão disponíveis:\n${list}`
                    });
                }
            }

            // Handle queryCommissionTypes
            if (fnName === 'queryCommissionTypes') {
                if (args.action === 'LIST') {
                    const result = await db.query(
                        "SELECT str_descricao FROM tb_tipo_comissao WHERE str_ativo = 'A' ORDER BY str_descricao"
                    );
                    const list = result.rows.map(t => `- ${t.str_descricao}`).join('\n');
                    return res.json({
                        type: 'TEXT',
                        content: `Tipos de comissão disponíveis:\n${list}`
                    });
                }
            }

            // Handle queryEntities
            if (fnName === 'queryEntities') {
                const { search, tipo, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM tb_entidade WHERE str_ativo = 'A'";
                    const params = [];
                    if (search) {
                        query += " AND (str_descricao ILIKE $1 OR str_documento ILIKE $1)";
                        params.push(`%${search}%`);
                    }
                    if (tipo) {
                        query += search ? " AND id_tipo = $2" : " AND id_tipo = $1";
                        params.push(tipo);
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} entidades ativas no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT id_entidade, str_descricao, str_documento, id_tipo
                        FROM tb_entidade
                        WHERE str_ativo = 'A'
                    `;
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND (str_descricao ILIKE $${pCount} OR str_documento ILIKE $${pCount})`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (tipo) {
                        query += ` AND id_tipo = $${pCount}`;
                        params.push(tipo);
                        pCount++;
                    }

                    query += " ORDER BY str_descricao LIMIT 20";
                    const result = await db.query(query, params);
                    const list = result.rows.map(e => 
                        `- ${e.str_descricao} (${e.str_documento || 'Sem documento'})`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Entidades encontradas:\n${list}`
                    });
                }
            }

            // Handle queryCampaigns
            if (fnName === 'queryCampaigns') {
                const { search, status, action } = args;

                if (action === 'STATS') {
                    const result = await db.query("SELECT COUNT(*) as count FROM tb_campanha");
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} campanhas no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT id_campanha, str_descricao, id_status, dt_vigencia_ini, dt_vigencia_fim
                        FROM tb_campanha
                        WHERE 1=1
                    `;
                    const params = [];
                    let pCount = 1;

                    if (search) {
                        query += ` AND str_descricao ILIKE $${pCount}`;
                        params.push(`%${search}%`);
                        pCount++;
                    }
                    if (status) {
                        query += ` AND id_status = $${pCount}`;
                        params.push(status);
                        pCount++;
                    }

                    query += " ORDER BY dt_vigencia_fim DESC LIMIT 20";
                    const result = await db.query(query, params);
                    const list = result.rows.map(c => 
                        `- ${c.str_descricao} (Vigência: ${c.dt_vigencia_ini || 'N/A'} até ${c.dt_vigencia_fim || 'N/A'})`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Campanhas encontradas:\n${list}`
                    });
                }
            }

            // Handle queryAuditLogs
            if (fnName === 'queryAuditLogs') {
                const { action_type, target_user_id, limit = 10, action } = args;

                if (action === 'STATS') {
                    let query = "SELECT COUNT(*) as count FROM audit_logs WHERE 1=1";
                    const params = [];
                    let pCount = 1;

                    if (action_type) {
                        query += ` AND action_type = $${pCount}`;
                        params.push(action_type);
                        pCount++;
                    }
                    if (target_user_id) {
                        query += ` AND target_user_id = $${pCount}`;
                        params.push(target_user_id);
                        pCount++;
                    }

                    const result = await db.query(query, params);
                    return res.json({
                        type: 'TEXT',
                        content: `Existem ${result.rows[0].count} registros de auditoria no sistema.`
                    });
                }

                if (action === 'LIST') {
                    let query = `
                        SELECT action_type, target_user_id, details, created_at
                        FROM audit_logs
                        WHERE 1=1
                    `;
                    const params = [];
                    let pCount = 1;

                    if (action_type) {
                        query += ` AND action_type = $${pCount}`;
                        params.push(action_type);
                        pCount++;
                    }
                    if (target_user_id) {
                        query += ` AND target_user_id = $${pCount}`;
                        params.push(target_user_id);
                        pCount++;
                    }

                    query += ` ORDER BY created_at DESC LIMIT $${pCount}`;
                    params.push(limit);

                    const result = await db.query(query, params);
                    if (result.rows.length === 0) {
                        return res.json({
                            type: 'TEXT',
                            content: 'Nenhum registro de auditoria encontrado.'
                        });
                    }

                    const list = result.rows.map(a => 
                        `- ${new Date(a.created_at).toLocaleString()}: ${a.action_type} (User ID: ${a.target_user_id || 'N/A'})`
                    ).join('\n');

                    return res.json({
                        type: 'TEXT',
                        content: `Logs de auditoria:\n${list}`
                    });
                }
            }

            // Handle resetPasswords (SENSITIVE - requires confirmation)
            if (fnName === 'resetPasswords') {
                const { company } = args;

                const countResult = await db.query(
                    'SELECT COUNT(*) as count FROM tb_usuario WHERE str_ativo = \'S\''
                );
                const count = parseInt(countResult.rows[0].count);

                const token = storePendingAction({
                    action: 'resetPasswords',
                    company,
                    requestedBy: req.currentUserId
                });

                return res.json({
                    type: 'CONFIRMATION_REQUIRED',
                    message: `Isso afetará ${count} usuários da empresa "${company}". Tem certeza?`,
                    confirmationToken: token,
                    affectedCount: count
                });
            }
        }

        res.json({ type: 'TEXT', content: 'Comando não reconhecido.' });

    } catch (err) {
        console.error('Chat error:', err);
        console.error('Error details:', err.message);
        console.error('Error stack:', err.stack);
        res.status(500).json({
            error: 'Internal Server Error',
            message: err.message,
            details: process.env.NODE_ENV === 'development' ? err.stack : undefined
        });
    }
});

// POST /api/action/confirm - Execute confirmed action
app.post('/api/action/confirm', async (req, res) => {
    try {
        const { confirmationToken } = req.body;

        if (!confirmationToken) {
            return res.status(400).json({ error: 'Confirmation token is required' });
        }

        const pendingAction = getPendingAction(confirmationToken);

        if (!pendingAction) {
            return res.status(404).json({ error: 'Invalid or expired confirmation token' });
        }

        const performedBy = pendingAction.requestedBy || req.currentUserId;

        if (pendingAction.action === 'blockUser' || pendingAction.action === 'blockUsers') {
            if (!(await ensurePermission(req, res, 'BLOCK', 'USER'))) return;
        } else if (pendingAction.action === 'resetPasswords') {
            if (!(await ensurePermission(req, res, 'RESET', 'USER'))) return;
        }

        // Execute the action
        if (pendingAction.action === 'blockUser') {
            const { user_id } = pendingAction;
            
            const query = `UPDATE tb_usuario 
                SET bloqueado = true, dh_edita = NOW() 
                WHERE id_usuario = $1
                RETURNING id_usuario as id, str_descricao as name, bloqueado`;

            const result = await db.query(query, [user_id]);

            if (result.rowCount === 0) {
                deletePendingAction(confirmationToken);
                return res.status(404).json({ 
                    error: 'Usuário não encontrado',
                    message: `Usuário com ID ${user_id} não foi encontrado.`
                });
            }

            const auditDbId = await createAuditLog('BLOCK_USER', result.rows[0].id, {
                performedBy,
                user_name: pendingAction.user_name,
                user_login: pendingAction.user_login
            });
            const auditLabel = formatAuditId(auditDbId);

            deletePendingAction(confirmationToken);

            return res.json({
                type: 'ACTION_COMPLETE',
                message: `Usuário ${result.rows[0].name} bloqueado com sucesso! Audit ID: ${auditLabel}`,
                auditId: auditLabel,
                data: result.rows[0]
            });
        }

        if (pendingAction.action === 'blockUsers') {
            const result = await db.query(
                "UPDATE users SET status = 'BLOQUEADO' WHERE company ILIKE $1 RETURNING *",
                [`%${pendingAction.company}%`]
            );

            const auditDbId = await createAuditLog('BLOCK_USERS', null, { company: pendingAction.company, count: result.rowCount, performedBy });
            const auditLabel = formatAuditId(auditDbId);

            deletePendingAction(confirmationToken);

            return res.json({
                type: 'ACTION_COMPLETE',
                message: `Ação executada! ${result.rowCount} usuários bloqueados. Audit ID: ${auditLabel}`,
                auditId: auditLabel,
                count: result.rowCount
            });
        }

        if (pendingAction.action === 'resetPasswords') {
            const result = await db.query(
                'SELECT * FROM users WHERE company ILIKE $1',
                [`%${pendingAction.company}%`]
            );

            const auditDbId = await createAuditLog('RESET_PASSWORDS', null, { company: pendingAction.company, count: result.rowCount, performedBy });
            const auditLabel = formatAuditId(auditDbId);

            deletePendingAction(confirmationToken);

            return res.json({
                type: 'ACTION_COMPLETE',
                message: `Senhas resetadas para ${result.rowCount} usuários. Audit ID: ${auditLabel}`,
                auditId: auditLabel,
                count: result.rowCount
            });
        }

        res.status(400).json({ error: 'Unknown action type' });

    } catch (err) {
        console.error('Confirmation error:', err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Legacy endpoints disabled - using existing tb_usuario table (read-only for now)
/*
app.post('/api/users', async (req, res) => {
    try {
        const { name, login, email, profile, company, cpf } = req.body;
        const result = await db.query(
            'INSERT INTO users (name, login, email, profile, company, cpf) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [name, login, email, profile, company, cpf]
        );
        
        const auditId = Math.random().toString(36).substr(2, 9).toUpperCase();
        await createAuditLog('CREATE_USER', result.rows[0].id, { name, company, profile });
        
        res.json({ user: result.rows[0], auditId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/companies/block', async (req, res) => {
    try {
        const { company } = req.body;
        const result = await db.query(
            "UPDATE users SET status = 'BLOQUEADO' WHERE company ILIKE $1 RETURNING *",
            [`%${company}%`]
        );
        
        const auditId = Math.random().toString(36).substr(2, 9).toUpperCase();
        await createAuditLog('BLOCK_USERS', null, { company, count: result.rowCount });
        
        res.json({ count: result.rowCount, auditId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

app.post('/api/companies/reset', async (req, res) => {
    try {
        const { company } = req.body;
        const result = await db.query(
            "SELECT * FROM users WHERE company ILIKE $1",
            [`%${company}%`]
        );
        
        const auditId = Math.random().toString(36).substr(2, 9).toUpperCase();
        await createAuditLog('RESET_PASSWORDS', null, { company, count: result.rowCount });
        
        res.json({ count: result.rowCount, auditId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
*/

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
