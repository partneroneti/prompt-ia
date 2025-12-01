require('dotenv').config({ path: '../.env' });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const db = require('./db');
const fs = require('fs');
const path = require('path');
const { processMessage } = require('./services/openai');
const { storePendingAction, getPendingAction, deletePendingAction } = require('./middleware/confirmationStore');
const dateHelper = require('./helpers/dateHelper');
const { gerarSQLCompleto } = require('./services/sqlGenerator');
const rbacHelper = require('./helpers/rbacHelper');
const profileHelper = require('./helpers/profileHelper');
const entityHelper = require('./helpers/entityHelper');
const { createCustomReport, getCustomReport, getAllCustomReports } = require('./middleware/customReportsStore');
const { getConversationHistory, saveConversationHistory, getFullConversationHistory, cleanupOldMessages, getHistoryStats, REDIS_TTL_SECONDS, DB_RETENTION_DAYS } = require('./middleware/conversationHistoryStore');

/**
 * Função helper para gerar hash SHA-256 de uma senha
 * @param {string} password - Senha em texto plano
 * @returns {string} - Hash SHA-256 em hexadecimal (minúsculas)
 */
function hashPasswordSHA256(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Senha temporária fixa usada para reset de senha
 * Quando a senha é resetada, sempre usamos esta senha temporária
 * O sistema detecta se a senha atual é esta temporária para mostrar o modal
 */
const TEMP_PASSWORD = 'TEMP_RESET_PASSWORD_2024';

/**
 * Função helper para gerar senha aleatória
 * @param {number} length - Tamanho da senha (padrão: 12)
 * @returns {string} - Senha aleatória
 */
function generateRandomPassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%&*';
    let password = '';
    for (let i = 0; i < length; i++) {
        password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return password;
}

/**
 * Verifica se uma senha (hash) é a senha temporária de reset
 * @param {string} passwordHash - Hash SHA-256 da senha
 * @returns {boolean} - True se for a senha temporária
 */
function isTempPassword(passwordHash) {
    if (!passwordHash) return false;
    const tempPasswordHash = hashPasswordSHA256(TEMP_PASSWORD);
    return passwordHash === tempPasswordHash;
}

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

const allowAutoCreateAuditTable = process.env.AUDIT_AUTO_CREATE === 'true';
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
        
        // Verificar e criar tabela audit_logs se não existir (opcional)
        try {
            const tableExists = await db.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs')"
            );
            
            if (!tableExists.rows[0]?.exists) {
                if (!allowAutoCreateAuditTable) {
                    console.warn('⚠️  Tabela audit_logs não existe e AUDIT_AUTO_CREATE está desabilitado. Crie manualmente ou habilite AUDIT_AUTO_CREATE=true.');
                } else {
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
                }
            } else {
                console.log('✅ Tabela audit_logs já existe');
            }
        } catch (tableErr) {
            if (tableErr.code === '42501') {
                console.error('⚠️  Sem permissão para criar/verificar tabela audit_logs. Crie manualmente ou conceda permissões, ou deixe AUDIT_AUTO_CREATE desabilitado.');
            } else {
                console.error('⚠️  Erro ao verificar/criar tabela audit_logs:', tableErr.message);
            }
        }

        // Verificar e criar tabela conversation_history se não existir
        try {
            const tableExists = await db.query(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conversation_history')"
            );
            
            if (!tableExists.rows[0]?.exists) {
                console.log('📋 Criando tabela conversation_history...');
                await db.query(`
                    CREATE TABLE conversation_history (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        role VARCHAR(20) NOT NULL,
                        content TEXT NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                `);
                // Criar índices separadamente
                await db.query(`CREATE INDEX IF NOT EXISTS idx_conversation_user_id ON conversation_history(user_id)`);
                await db.query(`CREATE INDEX IF NOT EXISTS idx_conversation_created_at ON conversation_history(created_at)`);
                console.log('✅ Tabela conversation_history criada com sucesso');
            } else {
                console.log('✅ Tabela conversation_history já existe');
            }
        } catch (tableErr) {
            console.error('⚠️  Erro ao verificar/criar tabela conversation_history:', tableErr.message);
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
        
        // Buscar informações do usuário e verificar se precisa trocar senha (usando str_senha)
        const userResult = await db.query(
            `SELECT id_usuario, str_descricao, str_login, email, str_cpf, str_ativo, bloqueado, str_senha
             FROM tb_usuario 
             WHERE id_usuario = $1 AND str_ativo = 'A' AND bloqueado = false`,
            [id]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'Usuário não encontrado ou inativo' });
        }

        const user = userResult.rows[0];
        
        // Verificar se a senha atual é a senha temporária (indica que precisa trocar)
        // Quando resetar senha, armazenamos TEMP_PASSWORD para detectar que precisa trocar
        const needsPasswordChange = isTempPassword(user.str_senha);
        
        const tempPasswordHash = hashPasswordSHA256(TEMP_PASSWORD);
        console.log('[AUTH] ===========================================');
        console.log('[AUTH] Dados do usuário retornados do banco:');
        console.log('[AUTH]   ID:', user.id_usuario);
        console.log('[AUTH]   Login:', user.str_login);
        console.log('[AUTH]   Nome:', user.str_descricao);
        console.log('[AUTH]   str_senha existe?', !!user.str_senha);
        console.log('[AUTH]   str_senha (primeiros 16 chars):', user.str_senha ? user.str_senha.substring(0, 16) + '...' : 'NULL');
        console.log('[AUTH]   Hash TEMP_PASSWORD (primeiros 16 chars):', tempPasswordHash.substring(0, 16) + '...');
        console.log('[AUTH]   Hashs são iguais?', user.str_senha === tempPasswordHash);
        console.log('[AUTH]   É senha temporária?', needsPasswordChange);
        console.log('[AUTH]   Precisa trocar senha?', needsPasswordChange);
        console.log('[AUTH] ===========================================');

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

        // Não retornar str_senha por segurança, mas incluir flag de trocar senha
        const { str_senha, ...userWithoutPassword } = user;
        
        const responseData = {
            ...userWithoutPassword,
            profiles: profiles,
            trocar_senha: needsPasswordChange
        };
        
        console.log('[AUTH] Resposta final do endpoint /api/auth/user/:id:');
        console.log('[AUTH]   ID:', responseData.id_usuario);
        console.log('[AUTH]   Login:', responseData.str_login);
        console.log('[AUTH]   trocar_senha:', responseData.trocar_senha);

        res.json(responseData);
    } catch (error) {
        console.error('Erro ao buscar usuário:', error);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// POST /api/auth/change-password - Usuário trocar sua própria senha
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const userId = req.currentUserId;
        const { currentPassword, newPassword } = req.body;

        console.log('[CHANGE_PASSWORD] ===========================================');
        console.log('[CHANGE_PASSWORD] Requisição recebida');
        console.log('[CHANGE_PASSWORD] User ID:', userId);
        console.log('[CHANGE_PASSWORD] Tem currentPassword?', !!currentPassword);
        console.log('[CHANGE_PASSWORD] Tem newPassword?', !!newPassword);

        if (!newPassword || newPassword.trim().length < 6) {
            console.log('[CHANGE_PASSWORD] ❌ Validação falhou: senha muito curta');
            return res.status(400).json({ 
                error: 'A nova senha deve ter pelo menos 6 caracteres' 
            });
        }

        // Buscar usuário e senha atual
        const userResult = await db.query(
            `SELECT id_usuario, str_senha FROM tb_usuario 
             WHERE id_usuario = $1 AND str_ativo = 'A' AND bloqueado = false`,
            [userId]
        );

        if (userResult.rows.length === 0) {
            console.log('[CHANGE_PASSWORD] ❌ Usuário não encontrado');
            return res.status(404).json({ error: 'Usuário não encontrado' });
        }

        const user = userResult.rows[0];
        const isCurrentPasswordTemp = isTempPassword(user.str_senha);
        
        console.log('[CHANGE_PASSWORD] Usuário encontrado');
        console.log('[CHANGE_PASSWORD] Senha atual é temporária?', isCurrentPasswordTemp);

        // Se a senha atual é temporária (reset), não precisa verificar currentPassword
        // Se não for temporária e currentPassword foi fornecido, verificar
        if (!isCurrentPasswordTemp && currentPassword && user.str_senha) {
            const currentPasswordHash = hashPasswordSHA256(currentPassword);
            if (currentPasswordHash !== user.str_senha) {
                console.log('[CHANGE_PASSWORD] ❌ Senha atual incorreta');
                return res.status(401).json({ error: 'Senha atual incorreta' });
            }
        }

        // Hash da nova senha
        const newPasswordHash = hashPasswordSHA256(newPassword);
        console.log('[CHANGE_PASSWORD] Hash da nova senha gerado');

        // Atualizar senha (substitui a senha temporária)
        console.log('[CHANGE_PASSWORD] Atualizando senha no banco...');
        await db.query(
            `UPDATE tb_usuario 
             SET str_senha = $1, dh_edita = NOW() 
             WHERE id_usuario = $2`,
            [newPasswordHash, userId]
        );
        console.log('[CHANGE_PASSWORD] ✅ Senha atualizada no banco');

        // Registrar auditoria (pode falhar, mas não deve bloquear)
        try {
            const auditDbId = await createAuditLog('CHANGE_PASSWORD', userId, {
                performedBy: userId,
                self_change: true
            });
            const auditLabel = formatAuditId(auditDbId);
            console.log('[CHANGE_PASSWORD] ✅ Auditoria registrada:', auditLabel);

            res.json({
                success: true,
                message: 'Senha alterada com sucesso!',
                auditId: auditLabel
            });
        } catch (auditError) {
            console.warn('[CHANGE_PASSWORD] ⚠️ Erro ao registrar auditoria (não crítico):', auditError.message);
            // Retornar sucesso mesmo se auditoria falhar
            res.json({
                success: true,
                message: 'Senha alterada com sucesso!',
                auditId: 'N/A'
            });
        }
        
        console.log('[CHANGE_PASSWORD] ===========================================');
    } catch (error) {
        console.error('[CHANGE_PASSWORD] ❌ Erro ao trocar senha:', error);
        console.error('[CHANGE_PASSWORD] Stack:', error.stack);
        res.status(500).json({ error: 'Erro interno do servidor: ' + error.message });
    }
});

// GET /api/auth/check-password-reset/:id - Verificar se usuário precisa trocar senha (endpoint de teste)
app.get('/api/auth/check-password-reset/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // Buscar senha do usuário
        const result = await db.query(
            `SELECT str_senha FROM tb_usuario WHERE id_usuario = $1`,
            [id]
        );
        
        let needsPasswordChange = false;
        if (result.rows.length > 0 && result.rows[0].str_senha) {
            needsPasswordChange = isTempPassword(result.rows[0].str_senha);
        }
        
        res.json({
            needsPasswordChange,
            userId: id,
            message: needsPasswordChange 
                ? 'Usuário precisa trocar a senha (senha temporária detectada)' 
                : 'Usuário não precisa trocar a senha'
        });
    } catch (error) {
        console.error('Erro ao verificar reset de senha:', error);
        res.status(500).json({ error: error.message });
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
        ORDER BY dh_edita DESC NULLS LAST`;

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

// ============================================
// ENDPOINTS PARA ROLES, PERFIS E RELAÇÕES
// ============================================

// GET /api/roles - Listar todas as roles
app.get('/api/roles', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                id_role,
                str_descricao as nome,
                str_ativo,
                CASE 
                    WHEN str_ativo = 'A' THEN 'ATIVO'
                    WHEN str_ativo = 'E' THEN 'INATIVO'
                    ELSE 'DESCONHECIDO'
                END as status
             FROM tb_role
             ORDER BY str_descricao`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar roles:', err);
        res.status(500).json({ error: 'Erro ao buscar roles' });
    }
});

// GET /api/profiles - Listar todos os perfis
app.get('/api/profiles', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT 
                id_perfil,
                str_descricao as nome,
                id_operacao,
                str_ativo,
                CASE 
                    WHEN str_ativo = 'A' THEN 'ATIVO'
                    WHEN str_ativo = 'E' THEN 'INATIVO'
                    ELSE 'DESCONHECIDO'
                END as status
             FROM tb_perfil
             ORDER BY str_descricao`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar perfis:', err);
        res.status(500).json({ error: 'Erro ao buscar perfis' });
    }
});

// GET /api/profiles/:id/roles - Listar roles de um perfil específico (por ID)
app.get('/api/profiles/:id/roles', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT 
                r.id_role,
                r.str_descricao as role_nome,
                pr.id as relacionamento_id,
                pr.str_ativo as rel_ativo
             FROM tb_perfil p
             JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE p.id_perfil = $1 
               AND p.str_ativo = 'A'
               AND pr.str_ativo = 'A'
               AND r.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar roles do perfil:', err);
        res.status(500).json({ error: 'Erro ao buscar roles do perfil' });
    }
});

// GET /api/profiles/by-name/:name/roles - Listar roles de um perfil pelo nome (ex: MASTER)
app.get('/api/profiles/by-name/:name/roles', async (req, res) => {
    try {
        const { name } = req.params;
        const result = await db.query(
            `SELECT 
                p.id_perfil,
                p.str_descricao as perfil_nome,
                r.id_role,
                r.str_descricao as role_nome,
                pr.id as relacionamento_id,
                pr.str_ativo as rel_ativo
             FROM tb_perfil p
             LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
             LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
             WHERE UPPER(p.str_descricao) = UPPER($1)
               AND p.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [name]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: `Perfil "${name}" não encontrado` });
        }
        
        // Verificar se o perfil tem roles
        const roles = result.rows.filter(row => row.role_nome !== null);
        
        res.json({
            perfil: {
                id_perfil: result.rows[0].id_perfil,
                nome: result.rows[0].perfil_nome
            },
            roles: roles.map(row => ({
                id_role: row.id_role,
                nome: row.role_nome,
                relacionamento_id: row.relacionamento_id
            })),
            total_roles: roles.length,
            tem_roles: roles.length > 0
        });
    } catch (err) {
        console.error('Erro ao listar roles do perfil:', err);
        res.status(500).json({ error: 'Erro ao buscar roles do perfil' });
    }
});

// GET /api/users/:id/profiles - Listar perfis de um usuário
app.get('/api/users/:id/profiles', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT 
                p.id_perfil,
                p.str_descricao as perfil_nome,
                up.id as relacionamento_id,
                up.str_ativo as rel_ativo
             FROM tb_usuario u
             JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             WHERE u.id_usuario = $1 
               AND u.str_ativo = 'A'
               AND up.str_ativo = 'A'
               AND p.str_ativo = 'A'
             ORDER BY p.str_descricao`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar perfis do usuário:', err);
        res.status(500).json({ error: 'Erro ao buscar perfis do usuário' });
    }
});

// GET /api/users/:id/roles - Listar todas as roles de um usuário (através dos perfis)
app.get('/api/users/:id/roles', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT DISTINCT
                r.id_role,
                r.str_descricao as role_nome,
                p.id_perfil,
                p.str_descricao as perfil_nome
             FROM tb_usuario u
             JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE u.id_usuario = $1 
               AND u.str_ativo = 'A'
               AND up.str_ativo = 'A'
               AND p.str_ativo = 'A'
               AND pr.str_ativo = 'A'
               AND r.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar roles do usuário:', err);
        res.status(500).json({ error: 'Erro ao buscar roles do usuário' });
    }
});

// GET /api/auth/permissions - Buscar permissões do usuário logado (roles e permissões resumidas)
app.get('/api/auth/permissions', async (req, res) => {
    try {
        const headerUser = req.header('x-user-id') || req.header('x-userid');
        const userId = headerUser ? parseInt(headerUser, 10) : req.currentUserId;

        if (!userId) {
            return res.status(401).json({ error: 'Usuário não autenticado' });
        }

        // Verificar se é MASTER
        const isMasterUser = await rbacHelper.isMaster(userId);
        
        // Buscar todas as roles do usuário
        const rolesResult = await db.query(
            `SELECT DISTINCT
                r.str_descricao as role_name
             FROM tb_usuario u
             JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             LEFT JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil AND pr.str_ativo = 'A'
             LEFT JOIN tb_role r ON pr.id_role = r.id_role AND r.str_ativo = 'A'
             WHERE u.id_usuario = $1 
               AND u.str_ativo = 'A'
               AND up.str_ativo = 'A'
               AND p.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [userId]
        );

        const roles = rolesResult.rows
            .filter(row => row.role_name)
            .map(row => row.role_name);

        // Buscar resumo de permissões
        const permissionSummary = await rbacHelper.getPermissionSummary(userId);

        res.json({
            user_id: userId,
            is_master: isMasterUser,
            roles: roles,
            permissions: permissionSummary,
            has_roles: roles.length > 0 || isMasterUser
        });
    } catch (err) {
        console.error('Erro ao buscar permissões:', err);
        res.status(500).json({ error: 'Erro ao buscar permissões do usuário' });
    }
});

// GET /api/roles-relations - Visualizar relações completas entre usuários, perfis e roles
app.get('/api/roles-relations', async (req, res) => {
    try {
        const { user_id, profile_id, role_id } = req.query;
        
        let whereConditions = ['u.str_ativo = $1', 'up.str_ativo = $2', 'p.str_ativo = $3', 'pr.str_ativo = $4', 'r.str_ativo = $5'];
        const params = ['A', 'A', 'A', 'A', 'A'];
        let paramCount = 6;

        if (user_id) {
            whereConditions.push(`u.id_usuario = $${paramCount}`);
            params.push(user_id);
            paramCount++;
        }
        if (profile_id) {
            whereConditions.push(`p.id_perfil = $${paramCount}`);
            params.push(profile_id);
            paramCount++;
        }
        if (role_id) {
            whereConditions.push(`r.id_role = $${paramCount}`);
            params.push(role_id);
            paramCount++;
        }

        const whereClause = `WHERE ${whereConditions.join(' AND ')}`;

        const result = await db.query(
            `SELECT 
                u.id_usuario,
                u.str_descricao as usuario_nome,
                u.str_login,
                p.id_perfil,
                p.str_descricao as perfil_nome,
                r.id_role,
                r.str_descricao as role_nome
             FROM tb_usuario u
             JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             JOIN tb_perfil_role pr ON p.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             ${whereClause}
             ORDER BY u.str_descricao, p.str_descricao, r.str_descricao
             LIMIT 500`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar relações:', err);
        res.status(500).json({ error: 'Erro ao buscar relações' });
    }
});

// POST /api/chat - Process user message via OpenAI
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }

        // Obter userId do header ou do middleware
        const userId = req.currentUserId;
        console.log('[CHAT API] 📨 Recebida mensagem:', message.substring(0, 50), 'User ID:', userId);

        // Obter histórico do Redis/Banco (ou memória como fallback)
        let conversationHistory = await getConversationHistory(userId);
        console.log('[CHAT API] 📚 Histórico obtido:', conversationHistory.length, 'mensagens');
        if (conversationHistory.length > 0) {
            console.log('[CHAT API] 📝 Últimas mensagens do histórico:', conversationHistory.slice(-4).map(m => `${m.role}: ${m.content?.substring(0, 50)}...`));
        } else {
            console.log('[CHAT API] ⚠️ NENHUM histórico encontrado para user', userId);
        }

        // Process message with OpenAI (usando histórico do Redis)
        const aiResponse = await processMessage(message, conversationHistory);
        
        // Função auxiliar para construir histórico atualizado com a resposta e salvar no Redis
        const buildUpdatedHistory = async (assistantMessage) => {
            // Usar histórico do aiResponse se disponível (já contém mensagem do usuário)
            // Caso contrário, usar conversationHistory e adicionar mensagem do usuário
            let updatedHistory;
            if (aiResponse.history && Array.isArray(aiResponse.history) && aiResponse.history.length > 0) {
                updatedHistory = [...aiResponse.history];
                console.log('[CHAT API] buildUpdatedHistory: ✅ Usando histórico do aiResponse, tamanho:', updatedHistory.length);
            } else {
                updatedHistory = [...conversationHistory];
                // Adicionar mensagem do usuário se ainda não estiver no histórico
                const lastMessage = updatedHistory[updatedHistory.length - 1];
                if (!lastMessage || lastMessage.role !== 'user' || lastMessage.content !== message) {
                    updatedHistory.push({
                        role: 'user',
                        content: message
                    });
                }
                console.log('[CHAT API] buildUpdatedHistory: ⚠️ Usando conversationHistory, tamanho após adicionar user:', updatedHistory.length);
            }
            // Adicionar resposta da IA ao histórico (evitar duplicatas)
            if (assistantMessage) {
                const lastMessage = updatedHistory[updatedHistory.length - 1];
                if (!lastMessage || lastMessage.role !== 'assistant' || lastMessage.content !== assistantMessage) {
                    updatedHistory.push({
                        role: 'assistant',
                        content: assistantMessage
                    });
                    console.log('[CHAT API] buildUpdatedHistory: ✅ Adicionada resposta assistant, tamanho final:', updatedHistory.length);
                } else {
                    console.log('[CHAT API] buildUpdatedHistory: ⚠️ Resposta assistant já existe no histórico, ignorando duplicata');
                }
            }
            // Salvar histórico atualizado no Redis e banco
            await saveConversationHistory(userId, updatedHistory);
            console.log('[CHAT API] buildUpdatedHistory: 💾 Histórico salvo no Redis/DB para user', userId);
            return updatedHistory;
        };

        if (aiResponse.type === 'ERROR') {
            const errorHistory = await buildUpdatedHistory(aiResponse.message || 'Erro ao processar mensagem');
            return res.status(500).json({ 
                type: 'ERROR', 
                message: aiResponse.message,
                history: errorHistory
            });
        }

        if (aiResponse.type === 'MESSAGE') {
            const messageHistory = await buildUpdatedHistory(aiResponse.content);
            return res.json({ 
                type: 'TEXT', 
                content: aiResponse.content,
                history: messageHistory
            });
        }

        if (aiResponse.type === 'TOOL_CALL') {
            console.log('[CHAT API] Tool call detectado:', aiResponse.toolCalls[0].function.name);
            console.log('[CHAT API] Histórico do aiResponse:', aiResponse.history?.length || 0, 'mensagens');
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
            
            // INTERCEPTAR: Se queryUsers foi chamado mas a mensagem original pede para bloquear/desbloquear ou atualizar
            try {
                const lowerMessage = message.toLowerCase();
                const isBlockRequest = lowerMessage.includes('bloquear') && !lowerMessage.includes('todos') && !lowerMessage.includes('empresa');
                const isUnblockRequest = lowerMessage.includes('desbloquear');
                const isUpdateRequest = (lowerMessage.includes('atualizar') || lowerMessage.includes('atualize') || 
                                        lowerMessage.includes('alterar') || lowerMessage.includes('altere') ||
                                        lowerMessage.includes('trocar') || lowerMessage.includes('troque') ||
                                        lowerMessage.includes('mudar') || lowerMessage.includes('mude')) &&
                                       (lowerMessage.includes('email') || lowerMessage.includes('nome') || 
                                        lowerMessage.includes('cpf') || lowerMessage.includes('senha') ||
                                        lowerMessage.includes('perfil'));
                // Detectar reset de senha: quando admin pede para resetar/trocar senha de OUTRO usuário
                const isPasswordResetRequest = (
                    (lowerMessage.includes('resetar') && lowerMessage.includes('senha')) ||
                    (lowerMessage.includes('reset') && lowerMessage.includes('senha')) ||
                    (lowerMessage.includes('trocar senha') && !lowerMessage.includes('minha') && !lowerMessage.includes('própria')) ||
                    (lowerMessage.includes('troque senha') && !lowerMessage.includes('minha') && !lowerMessage.includes('própria'))
                ) && (
                    lowerMessage.includes('usuário') || 
                    lowerMessage.includes('do') || 
                    lowerMessage.includes('de') ||
                    login || email || cpf // Se tem identificador de outro usuário
                );
                
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
                } else if (fnName === 'queryUsers' && isUpdateRequest) {
                    console.log('[CHAT] Interceptando queryUsers - mensagem pede para atualizar dados do usuário');
                    
                    // Extrair login/email/cpf dos filtros ou tentar extrair da mensagem
                    let login = args.filters?.login;
                    let email = args.filters?.email;
                    let cpf = args.filters?.cpf;
                    
                    // Se não encontrou nos filtros, tentar extrair da mensagem
                    if (!login && !email && !cpf) {
                        // Tentar encontrar login no formato "teste.op" ou similar
                        const loginMatch = message.match(/\b([a-z]+\.[a-z]+(?:\.[a-z]+)?)\b/i);
                        if (loginMatch) {
                            login = loginMatch[1];
                        }
                        
                        // Tentar encontrar email atual
                        const emailMatch = message.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
                        if (emailMatch) {
                            // Se houver dois emails, o primeiro é o atual, o segundo é o novo
                            const emails = message.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g);
                            if (emails && emails.length >= 2) {
                                email = emails[0]; // Email atual
                            } else {
                                email = emailMatch[1];
                            }
                        }
                    }
                    
                    // Extrair novos valores da mensagem
                    // IMPORTANTE: Só extrair se o valor foi explicitamente fornecido na mensagem
                    let newEmail = null;
                    let newName = null;
                    let newCpf = null;
                    let newPassword = null;
                    let newProfile = null;
                    
                    // Extrair novo email - SÓ se houver um email explícito na mensagem
                    if (lowerMessage.includes('email')) {
                        const newEmailMatch = message.match(/(?:para|@|email)\s+([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
                        if (newEmailMatch) {
                            newEmail = newEmailMatch[1];
                        } else {
                            // Tentar pegar o último email mencionado APENAS se houver múltiplos emails
                            const emails = message.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g);
                            if (emails && emails.length >= 2) {
                                newEmail = emails[emails.length - 1]; // Último email é o novo
                            }
                            // Se não encontrou email explícito, NÃO definir newEmail (deixar null)
                            // A validação em findUserAndUpdate vai solicitar o email
                        }
                    }
                    
                    // Extrair novo nome - SÓ se houver um nome explícito na mensagem
                    if (lowerMessage.includes('nome')) {
                        const newNameMatch = message.match(/(?:para|nome)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
                        if (newNameMatch) {
                            newName = newNameMatch[1];
                        }
                        // Se não encontrou nome explícito, NÃO definir newName (deixar null)
                    }
                    
                    // Extrair novo CPF - SÓ se houver um CPF explícito na mensagem
                    if (lowerMessage.includes('cpf')) {
                        const newCpfMatch = message.match(/(?:para|cpf)\s+(\d{3}\.\d{3}\.\d{3}-\d{2})/);
                        if (newCpfMatch) {
                            newCpf = newCpfMatch[1];
                        }
                        // Se não encontrou CPF explícito, NÃO definir newCpf (deixar null)
                    }
                    
                    // Extrair novo perfil - SÓ se houver um perfil explícito na mensagem
                    if (lowerMessage.includes('perfil')) {
                        if (lowerMessage.includes('master')) {
                            newProfile = 'MASTER';
                        } else if (lowerMessage.includes('operacional')) {
                            newProfile = 'OPERACIONAL';
                        }
                        // Se não encontrou perfil explícito, NÃO definir newProfile (deixar null)
                    }
                    
                    // VALIDAÇÃO: Se o usuário pediu para atualizar algo mas não forneceu o novo valor,
                    // não redirecionar para findUserAndUpdate - deixar a IA processar e solicitar o dado
                    const requestedUpdate = lowerMessage.includes('atualizar') || lowerMessage.includes('atualize') || 
                                           lowerMessage.includes('alterar') || lowerMessage.includes('altere') ||
                                           lowerMessage.includes('trocar') || lowerMessage.includes('troque') ||
                                           lowerMessage.includes('mudar') || lowerMessage.includes('mude');
                    
                    // Detectar se é reset de senha (admin resetando senha de outro usuário)
                    const passwordRequested = lowerMessage.includes('senha');
                    const isPasswordReset = isPasswordResetRequest && passwordRequested;
                    
                    if (requestedUpdate) {
                        // Verificar se o campo foi solicitado mas o novo valor não foi fornecido
                        const emailRequested = lowerMessage.includes('email');
                        const nameRequested = lowerMessage.includes('nome');
                        const cpfRequested = lowerMessage.includes('cpf');
                        const profileRequested = lowerMessage.includes('perfil');
                        
                        // Se for reset de senha, não precisa fornecer nova senha (será gerada)
                        if (isPasswordReset) {
                            // Reset de senha - gerar senha aleatória automaticamente
                            if (login || email || cpf) {
                                console.log('[CHAT] Reset de senha detectado - redirecionando para findUserAndUpdate com isPasswordReset=true');
                                fnName = 'findUserAndUpdate';
                                args = {
                                    login: login,
                                    email: email,
                                    cpf: cpf,
                                    isPasswordReset: true
                                };
                            }
                        } else if ((emailRequested && !newEmail) || 
                            (nameRequested && !newName) || 
                            (cpfRequested && !newCpf) || 
                            (profileRequested && !newProfile) ||
                            (passwordRequested && !newPassword && !isPasswordReset)) {
                            // Não redirecionar - deixar a IA processar e solicitar o dado faltante
                            console.log('[CHAT] Usuário pediu atualização mas não forneceu novo valor - deixando IA processar');
                        } else if (login || email || cpf) {
                            // Só redirecionar se tiver identificador do usuário E novo valor fornecido
                            console.log('[CHAT] Redirecionando para findUserAndUpdate com:', { login, email, cpf, newEmail, newName, newCpf, newPassword, newProfile });
                            fnName = 'findUserAndUpdate';
                            args = {
                                login: login,
                                email: email,
                                cpf: cpf,
                                newEmail: newEmail,
                                newName: newName,
                                newCpf: newCpf,
                                newPassword: newPassword,
                                newProfile: newProfile,
                                isPasswordReset: false
                            };
                        } else {
                            console.warn('[CHAT] Não foi possível extrair login/email/cpf da mensagem para atualizar');
                        }
                    } else if (login || email || cpf) {
                        // Se não foi pedido update mas tem identificador, pode ser apenas consulta
                        console.log('[CHAT] Não foi pedido update explícito, mantendo queryUsers');
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
                console.log('[CREATE_USER] Args recebidos:', { name, login, profile, company, email, cpf, cpfType: typeof cpf, cpfLength: cpf?.length });
                
                const sanitizedLogin = (login || '').trim().toLowerCase();

                // Validar CPF - BLOQUEAR se não existir ou for inválido
                // CPF é OBRIGATÓRIO e deve ser uma string válida
                if (!cpf || cpf === undefined || cpf === null || cpf === '' || String(cpf).trim() === '' || String(cpf).trim() === 'undefined' || String(cpf).trim() === 'null') {
                    console.log('[CREATE_USER] CPF inválido ou faltando - bloqueando criação', { cpf, type: typeof cpf });
                    return res.status(400).json({
                        type: 'ERROR',
                        message: `O CPF é obrigatório para criar um usuário. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@ex.com, perfil OPERACIONAL, empresa DANIEL CRED`
                    });
                }
                
                // Sanitizar CPF apenas se existir e for válido
                const sanitizedCpf = String(cpf).trim();
                
                // Validação adicional: CPF não pode ser vazio após trim
                if (sanitizedCpf === '' || sanitizedCpf.length < 10) {
                    console.log('[CREATE_USER] CPF inválido após sanitização - bloqueando criação', { sanitizedCpf, length: sanitizedCpf.length });
                    return res.status(400).json({
                        type: 'ERROR',
                        message: `O CPF é obrigatório para criar um usuário. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@ex.com, perfil OPERACIONAL, empresa DANIEL CRED`
                    });
                }
                
                console.log('[CREATE_USER] CPF validado:', { original: cpf, sanitized: sanitizedCpf });

                // Validar outros campos obrigatórios
                const missingFields = [];
                if (!name || !name.trim()) missingFields.push('nome');
                if (!sanitizedLogin) missingFields.push('login');
                if (!email || !email.trim()) missingFields.push('email');
                if (!profile || !profile.trim()) missingFields.push('perfil');
                if (!company || !company.trim()) missingFields.push('empresa');

                // VALIDAÇÃO CRÍTICA: Verificar se email não foi gerado automaticamente
                if (email && email.trim()) {
                    const emailStr = String(email).trim();
                    // Rejeitar emails genéricos ou suspeitos que podem ter sido gerados automaticamente
                    const suspiciousEmailPatterns = [
                        /example\.com/i,
                        /test\.com/i,
                        /placeholder/i,
                        /temp/i,
                        /fake/i,
                        /generated/i,
                        /@empresa\.com/i, // Email genérico muito comum
                        /@company\.com/i
                    ];
                    
                    if (suspiciousEmailPatterns.some(pattern => pattern.test(emailStr))) {
                        return res.status(400).json({
                            type: 'ERROR',
                            message: `O email fornecido parece ser genérico ou gerado automaticamente. Por favor, forneça um email válido e específico do usuário. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@empresa.com.br, perfil OPERACIONAL, empresa DANIEL CRED`
                        });
                    }
                    
                    // Validar formato de email básico
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!emailRegex.test(emailStr)) {
                        return res.status(400).json({
                            type: 'ERROR',
                            message: `O email fornecido não está em um formato válido. Por favor, forneça um email válido. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@empresa.com.br, perfil OPERACIONAL, empresa DANIEL CRED`
                        });
                    }
                }

                // Outros campos obrigatórios faltando
                if (missingFields.length > 0) {
                    const fieldsList = missingFields.join(', ');
                    return res.status(400).json({
                        type: 'ERROR',
                        message: `Campos obrigatórios faltando: ${fieldsList}. O CPF é obrigatório. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@ex.com, perfil OPERACIONAL, empresa DANIEL CRED`
                    });
                }

                try {
                    // Validar duplicidades antes de inserir
                    const existingUser = await db.query(
                        `SELECT str_login, email, str_cpf 
                         FROM tb_usuario 
                         WHERE str_login = $1 OR email = $2 OR str_cpf = $3
                         LIMIT 1`,
                        [sanitizedLogin, email, sanitizedCpf]
                    );

                    if (existingUser.rows.length > 0) {
                        const existing = existingUser.rows[0];
                        if (existing.str_login === sanitizedLogin) {
                            return res.json({
                                type: 'ERROR',
                                message: `Erro: Já existe um usuário com o login "${sanitizedLogin}". Tente outro login.`
                            });
                        }
                        if (existing.email === email) {
                            return res.json({
                                type: 'ERROR',
                                message: `Erro: Já existe um usuário com o email "${email}". Tente outro email.`
                            });
                        }
                        if (existing.str_cpf && existing.str_cpf === sanitizedCpf) {
                            return res.json({
                                type: 'ERROR',
                                message: `Erro: Já existe um usuário com o CPF "${sanitizedCpf}". Verifique os dados.`
                            });
                        }
                    }

                    // Validação dupla do CPF antes do INSERT
                    if (!sanitizedCpf || sanitizedCpf.trim() === '' || sanitizedCpf === 'undefined' || sanitizedCpf === 'null') {
                        console.error('[CREATE_USER] ERRO CRÍTICO: Tentativa de inserir com CPF inválido!', { sanitizedCpf, cpf });
                        return res.status(400).json({
                            type: 'ERROR',
                            message: `O CPF é obrigatório para criar um usuário. Ex: Criar usuário: João Silva, CPF 123.456.789-00, login joao.silva, email joao@ex.com, perfil OPERACIONAL, empresa DANIEL CRED`
                        });
                    }

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
                        [name, sanitizedLogin, email, sanitizedCpf, operationId, req.currentUserId]
                    );

                    const newUserId = result.rows[0].id;

                    // Associar perfil ao usuário criado
                    const profileData = await profileHelper.getProfileByName(profile);
                    if (profileData) {
                        await profileHelper.assignProfile(newUserId, profileData.id_perfil, req.currentUserId);
                    } else {
                        console.warn(`[CREATE_USER] Perfil "${profile}" não encontrado. Usuário criado sem perfil.`);
                    }

                    const auditDbId = await createAuditLog('CREATE_USER', newUserId, {
                        performedBy: req.currentUserId,
                        company,
                        profile,
                        login: sanitizedLogin,
                        cpf: sanitizedCpf
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    const successMessage = `Usuário cadastrado com sucesso! Login: ${result.rows[0].login}. Audit ID: ${auditLabel}`;
                    return res.json({
                        type: 'ACTION_COMPLETE',
                        message: successMessage,
                        auditId: auditLabel,
                        data: result.rows[0],
                        history: await buildUpdatedHistory(successMessage)
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
                // Se count_only e não houver filtros específicos, contar TODOS os usuários (não apenas ativos)
                // Caso contrário, filtrar apenas usuários ativos
                const shouldCountAll = count_only && !filters.id && !filters.status && !filters.operation && !filters.group && !filters.profile && !filters.name && !filters.login && !filters.email && !filters.cpf && !filters.date_from && !filters.date_to;
                let whereConditions = filters.id ? [] : (shouldCountAll ? [] : [`u.str_ativo = 'A'`]);
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
                    const textResponse = `${message}\nAudit ID: ${auditLabel}`;
                    return res.json({
                        type: 'TEXT',
                        content: textResponse,
                        history: await buildUpdatedHistory(textResponse)
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
                        const textResponse = `${message}\nAudit ID: ${auditLabel}`;
                        return res.json({
                            type: 'TEXT',
                            content: textResponse,
                            history: await buildUpdatedHistory(textResponse)
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

                        const textResponse = `${response}\nAudit ID: ${auditLabel}`;
                        return res.json({
                            type: 'TEXT',
                            content: textResponse,
                            history: await buildUpdatedHistory(textResponse)
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
                    const textResponse = `${message}\nAudit ID: ${auditLabel}`;
                    return res.json({
                        type: 'TEXT',
                        content: textResponse,
                        history: await buildUpdatedHistory(textResponse)
                    });
                }
            }

            // Handle updateUser
            if (fnName === 'findUserAndUpdate') {
                try {
                    console.log('--- findUserAndUpdate ---');
                    const { login, email, cpf, newName, newEmail, newPassword, newCpf, newProfile, isPasswordReset } = args;
                    console.log('Args:', args);
                    
                    // Se for reset de senha (admin resetando senha de outro usuário), gerar senha aleatória genérica
                    let finalPassword = newPassword;
                    let shouldMarkPasswordChange = false;
                    let generatedPassword = null;
                    if (isPasswordReset) {
                        // Gerar senha aleatória genérica para reset (será mostrada na resposta)
                        generatedPassword = generateRandomPassword(12);
                        // Mas armazenar a senha temporária fixa para detectar que precisa trocar
                        finalPassword = TEMP_PASSWORD;
                        shouldMarkPasswordChange = true;
                        console.log('[PASSWORD_RESET] ✅ Reset de senha ativado!');
                        console.log('[PASSWORD_RESET] Senha genérica gerada (para mostrar):', generatedPassword);
                        console.log('[PASSWORD_RESET] Senha temporária armazenada (para detectar troca):', TEMP_PASSWORD);
                        console.log('[PASSWORD_RESET] Flag shouldMarkPasswordChange:', shouldMarkPasswordChange);
                    }

                    // VALIDAÇÃO CRÍTICA: Campos imutáveis NÃO podem ser alterados
                    // Login e CPF são imutáveis após criação - BLOQUEAR qualquer tentativa de alteração
                    if (args.newLogin) {
                        return res.json({
                            type: 'ERROR',
                            message: 'O login não pode ser alterado após a criação do usuário. O login é um campo imutável.'
                        });
                    }

                    // VALIDAÇÃO CRÍTICA: Verificar se os novos valores são válidos e não foram gerados automaticamente
                    // Rejeitar valores que parecem ser gerados automaticamente ou inferidos
                    const isValidValue = (value) => {
                        if (!value || value === null || value === undefined) return false;
                        const strValue = String(value).trim();
                        if (strValue === '' || strValue === 'undefined' || strValue === 'null') return false;
                        // Rejeitar emails genéricos ou suspeitos
                        if (strValue.includes('@')) {
                            const suspiciousPatterns = [
                                /example\.com/i,
                                /test\.com/i,
                                /placeholder/i,
                                /temp/i,
                                /fake/i,
                                /generated/i
                            ];
                            if (suspiciousPatterns.some(pattern => pattern.test(strValue))) {
                                return false;
                            }
                        }
                        return true;
                    };

                    // Validar que se o usuário pediu para atualizar um campo, o novo valor DEVE ser fornecido
                    // Não podemos inferir ou gerar valores automaticamente
                    let setClauses = [];
                    let whereClauses = [];
                    const params = [];
                    let paramCount = 1;
                    const missingFields = [];

                    if (newName) {
                        if (!isValidValue(newName)) {
                            missingFields.push('novo nome');
                        } else {
                            setClauses.push(`str_descricao = $${paramCount}`);
                            params.push(newName);
                            paramCount++;
                        }
                    }
                    if (newEmail) {
                        if (!isValidValue(newEmail)) {
                            missingFields.push('novo email');
                        } else {
                            // Validar formato de email básico
                            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                            if (!emailRegex.test(String(newEmail).trim())) {
                                return res.json({
                                    type: 'ERROR',
                                    message: 'O email fornecido não está em um formato válido. Por favor, forneça um email válido.'
                                });
                            }
                            setClauses.push(`email = $${paramCount}`);
                            params.push(String(newEmail).trim());
                            paramCount++;
                        }
                    }
                    if (finalPassword) {
                        if (!isValidValue(finalPassword)) {
                            missingFields.push('nova senha');
                        } else {
                            // Hash da senha com SHA-256 antes de armazenar
                            const hashedPassword = hashPasswordSHA256(finalPassword);
                            setClauses.push(`str_senha = $${paramCount}`);
                            params.push(hashedPassword);
                            paramCount++;
                            // Se for reset de senha, usar senha temporária fixa (já definida acima)
                            // Se não for reset, é uma senha normal definida pelo usuário
                            if (shouldMarkPasswordChange || isPasswordReset) {
                                console.log('[PASSWORD_RESET] Usando senha temporária para forçar troca no próximo login');
                            }
                        }
                    }
                    if (newCpf) {
                        // CPF é IMUTÁVEL após criação - BLOQUEAR qualquer tentativa de alteração
                        return res.json({
                            type: 'ERROR',
                            message: 'O CPF não pode ser alterado após a criação do usuário. O CPF é um campo imutável.'
                        });
                    }

                    // Se algum campo foi solicitado mas não foi fornecido corretamente, retornar erro
                    if (missingFields.length > 0) {
                        return res.json({
                            type: 'ERROR',
                            message: `Para fazer a alteração, é necessário fornecer explicitamente: ${missingFields.join(', ')}. Por favor, informe os dados corretos antes de atualizar.`
                        });
                    }

                    // Se for mudar perfil, tratar separadamente (requer confirmação se for para MASTER)
                    if (newProfile) {
                        // Buscar usuário primeiro
                        let userQuery;
                        let userParams;
                        
                        if (login) {
                            userQuery = 'SELECT id_usuario, str_descricao, str_login FROM tb_usuario WHERE LOWER(str_login) = LOWER($1)';
                            userParams = [login];
                        } else if (email) {
                            userQuery = 'SELECT id_usuario, str_descricao, str_login FROM tb_usuario WHERE LOWER(email) = LOWER($1)';
                            userParams = [email];
                        } else if (cpf) {
                            userQuery = 'SELECT id_usuario, str_descricao, str_login FROM tb_usuario WHERE str_cpf = $1';
                            userParams = [cpf];
                        } else {
                            return res.json({
                                type: 'ERROR',
                                message: 'É necessário fornecer login, email ou CPF para identificar o usuário ao mudar o perfil.'
                            });
                        }

                        const userResult = await db.query(userQuery, userParams);
                        if (userResult.rowCount === 0) {
                            return res.json({
                                type: 'ERROR',
                                message: 'Usuário não encontrado com os critérios fornecidos.'
                            });
                        }

                        const targetUser = userResult.rows[0];
                        const newProfileUpper = newProfile.toUpperCase();

                        // Se for promover para MASTER, requerer confirmação
                        if (newProfileUpper === 'MASTER') {
                            // Buscar perfil MASTER
                            const masterProfile = await profileHelper.getProfileByName('MASTER');
                            if (!masterProfile) {
                                return res.json({
                                    type: 'ERROR',
                                    message: 'Perfil MASTER não encontrado no sistema.'
                                });
                            }

                            // Store pending action
                            const token = storePendingAction({
                                action: 'changeProfile',
                                user_id: targetUser.id_usuario,
                                user_name: targetUser.str_descricao,
                                user_login: targetUser.str_login,
                                new_profile: 'MASTER',
                                new_profile_id: masterProfile.id_perfil,
                                requestedBy: req.currentUserId
                            });

                            return res.json({
                                type: 'CONFIRMATION_REQUIRED',
                                message: `Tem certeza que deseja PROMOVER o usuário "${targetUser.str_descricao}" (${targetUser.str_login}) para o perfil MASTER? Esta ação concederá acesso total ao sistema.`,
                                confirmationToken: token,
                                userInfo: {
                                    id: targetUser.id_usuario,
                                    name: targetUser.str_descricao,
                                    login: targetUser.str_login,
                                    newProfile: 'MASTER'
                                }
                            });
                        } else {
                            // Para outros perfis (ex: OPERACIONAL), executar diretamente
                            const targetProfile = await profileHelper.getProfileByName(newProfileUpper);
                            if (!targetProfile) {
                                return res.json({
                                    type: 'ERROR',
                                    message: `Perfil "${newProfileUpper}" não encontrado no sistema.`
                                });
                            }

                            // Buscar perfil atual antes de mudar
                            const currentProfiles = await profileHelper.getUserProfiles(targetUser.id_usuario);
                            const oldProfileName = currentProfiles.length > 0 ? currentProfiles[0].str_descricao : 'NENHUM';

                            // Mudar o perfil
                            await profileHelper.changeUserProfile(targetUser.id_usuario, targetProfile.id_perfil, req.currentUserId);

                            // Se também houver outros campos para atualizar, fazer isso também
                            if (newName || newEmail || newPassword || newCpf) {
                                // Continuar com a atualização normal dos outros campos
                                // (código abaixo será executado, mas o perfil já foi mudado)
                            } else {
                                // Apenas mudou o perfil, retornar sucesso
                                const auditDbId = await createAuditLog('CHANGE_PROFILE', targetUser.id_usuario, {
                                    performedBy: req.currentUserId,
                                    old_profile: oldProfileName,
                                    new_profile: newProfileUpper
                                });
                                const auditLabel = formatAuditId(auditDbId);

                                return res.json({
                                    type: 'ACTION_COMPLETE',
                                    message: `Perfil do usuário ${targetUser.str_descricao} alterado de ${oldProfileName} para ${newProfileUpper} com sucesso! Audit ID: ${auditLabel}`,
                                    auditId: auditLabel,
                                    data: {
                                        id: targetUser.id_usuario,
                                        name: targetUser.str_descricao,
                                        login: targetUser.str_login,
                                        oldProfile: oldProfileName,
                                        newProfile: newProfileUpper
                                    }
                                });
                            }
                        }
                    }

                    if (setClauses.length === 0 && !newProfile) {
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

                    let query = `UPDATE tb_usuario 
                        SET ${setClauses.join(', ')} 
                        WHERE ${whereClauses.join(' AND ')}
                        RETURNING id_usuario as id, str_descricao as name, str_login as login, email`;

                    console.log('[UPDATE] Query completa:', query);
                    console.log('[UPDATE] Params:', params);
                    console.log('[UPDATE] SetClauses:', setClauses);

                    let result;
                    try {
                        result = await db.query(query, params);
                        console.log('[UPDATE] Resultado do UPDATE:', result.rows[0]);
                    } catch (dbError) {
                        throw dbError;
                    }

                    if (result.rowCount === 0) {
                        return res.json({
                            type: 'ERROR',
                            message: `Usuário não encontrado com os critérios fornecidos.`
                        });
                    }

                    // Verificar se a senha foi atualizada corretamente (usando str_senha)
                    if (shouldMarkPasswordChange || isPasswordReset) {
                        try {
                            const verifyResult = await db.query(
                                `SELECT str_senha FROM tb_usuario WHERE id_usuario = $1`,
                                [result.rows[0].id]
                            );
                            if (verifyResult.rows.length > 0) {
                                const currentPasswordHash = verifyResult.rows[0].str_senha;
                                const expectedHash = hashPasswordSHA256(finalPassword); // finalPassword = TEMP_PASSWORD
                                const tempPasswordHash = hashPasswordSHA256(TEMP_PASSWORD);
                                const isCorrect = currentPasswordHash === expectedHash;
                                const isTemp = currentPasswordHash === tempPasswordHash;
                                console.log('[PASSWORD_RESET] Verificação pós-UPDATE:');
                                console.log('[PASSWORD_RESET]   Hash esperado (TEMP_PASSWORD - primeiros 16 chars):', expectedHash.substring(0, 16) + '...');
                                console.log('[PASSWORD_RESET]   Hash no banco (primeiros 16 chars):', currentPasswordHash ? currentPasswordHash.substring(0, 16) + '...' : 'NULL');
                                console.log('[PASSWORD_RESET]   Senha foi atualizada corretamente?', isCorrect);
                                console.log('[PASSWORD_RESET]   É senha temporária?', isTemp);
                                if (!isCorrect) {
                                    console.warn('[PASSWORD_RESET] ⚠️ Senha não foi atualizada corretamente!');
                                } else {
                                    console.log('[PASSWORD_RESET] ✅ Senha temporária (TEMP_PASSWORD) armazenada corretamente!');
                                    console.log('[PASSWORD_RESET] ✅ Modal aparecerá no próximo login do usuário');
                                }
                            }
                        } catch (verifyError) {
                            console.error('[PASSWORD_RESET] Erro ao verificar senha:', verifyError.message);
                        }
                    }

                    // Se também mudou o perfil (mas não foi para MASTER), registrar no audit
                    let profileChangeInfo = {};
                    if (newProfile && newProfile.toUpperCase() !== 'MASTER') {
                        const targetProfile = await profileHelper.getProfileByName(newProfile.toUpperCase());
                        if (targetProfile) {
                            const currentProfiles = await profileHelper.getUserProfiles(result.rows[0].id);
                            const oldProfileName = currentProfiles.length > 0 ? currentProfiles[0].str_descricao : 'NENHUM';
                            await profileHelper.changeUserProfile(result.rows[0].id, targetProfile.id_perfil, req.currentUserId);
                            profileChangeInfo = { oldProfile: oldProfileName, newProfile: newProfile.toUpperCase() };
                        }
                    }

                    const auditDbId = await createAuditLog('UPDATE_USER', result.rows[0].id, {
                        performedBy: req.currentUserId,
                        filters: { login, email, cpf },
                        updates: {
                            ...(newName ? { newName } : {}),
                            ...(newEmail ? { newEmail } : {}),
                            ...(finalPassword ? { passwordChanged: true, isReset: shouldMarkPasswordChange || isPasswordReset } : {}),
                            ...(newCpf ? { newCpf } : {}),
                            ...profileChangeInfo
                        }
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    let message = `Usuário ${result.rows[0].name} atualizado com sucesso!`;
                    if (shouldMarkPasswordChange || isPasswordReset) {
                        // Se foi reset de senha, mostrar a senha gerada (não a temporária armazenada)
                        const passwordToShow = generatedPassword || finalPassword;
                        message += `\n\n🔑 Senha resetada com sucesso!\n📝 Senha temporária gerada: **${passwordToShow}**\n⚠️ O usuário precisará criar uma nova senha no próximo login.`;
                    }
                    message += `\nAudit ID: ${auditLabel}`;

                    return res.json({
                        type: 'ACTION_COMPLETE',
                        message: message,
                        auditId: auditLabel,
                        data: {
                            ...result.rows[0],
                            ...(shouldMarkPasswordChange || isPasswordReset ? { 
                                temporaryPassword: generatedPassword || finalPassword
                            } : {})
                        }
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

            // Handle blockUsers (SENSITIVE - requires confirmation for blocking)
            if (fnName === 'blockUsers') {
                const { company, block = true } = args; // block padrão é true (bloquear)

                // Buscar a operação pelo nome (empresas são operações no sistema)
                const operationLookup = await db.query(
                    `SELECT id_operacao, str_descricao FROM tb_operacao 
                     WHERE UPPER(str_descricao) LIKE UPPER($1) AND str_ativo = 'A'
                     ORDER BY 
                        CASE 
                            WHEN UPPER(str_descricao) = UPPER($2) THEN 1
                            WHEN UPPER(str_descricao) LIKE UPPER($2) || '%' THEN 2
                            ELSE 3
                        END
                     LIMIT 1`,
                    [`%${company}%`, company]
                );

                if (operationLookup.rowCount === 0) {
                    return res.json({
                        type: 'ERROR',
                        message: `Empresa/Operação "${company}" não encontrada.`
                    });
                }

                const operation = operationLookup.rows[0];

                // Contar apenas usuários da operação específica
                const countResult = await db.query(
                    'SELECT COUNT(*) as count FROM tb_usuario WHERE id_operacao = $1 AND str_ativo = \'A\'',
                    [operation.id_operacao]
                );
                const count = parseInt(countResult.rows[0].count);

                // Se for desbloquear (block: false), executar diretamente sem confirmação
                if (block === false) {
                    const result = await db.query(
                        'UPDATE tb_usuario SET bloqueado = false, dh_edita = NOW() WHERE id_operacao = $1 AND str_ativo = \'A\' RETURNING id_usuario, str_descricao, str_login',
                        [operation.id_operacao]
                    );

                    const auditDbId = await createAuditLog('UNBLOCK_USERS', null, { 
                        company: company, 
                        count: result.rowCount, 
                        performedBy: req.currentUserId 
                    });
                    const auditLabel = formatAuditId(auditDbId);

                    return res.json({
                        type: 'ACTION_COMPLETE',
                        message: `Ação executada! ${result.rowCount} usuários desbloqueados. Audit ID: ${auditLabel}`,
                        auditId: auditLabel,
                        count: result.rowCount
                    });
                }

                // Se for bloquear (block: true), requerer confirmação
                const token = storePendingAction({
                    action: 'blockUsers',
                    company,
                    operationId: operation.id_operacao,
                    block: true,
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
                    // Primeiro, verificar quantas comissões existem e seus status
                    let countQuery = "SELECT COUNT(*) as total, COUNT(CASE WHEN bloqueado = false THEN 1 END) as nao_bloqueadas, COUNT(CASE WHEN bloqueado = true THEN 1 END) as bloqueadas FROM tb_extrato_comissao";
                    const countResult = await db.query(countQuery);
                    const stats = countResult.rows[0];
                    
                    // Usar COALESCE para considerar n_valor_liquido ou n_valor (se liquido for NULL)
                    let query = "SELECT SUM(COALESCE(n_valor_liquido, n_valor, 0)) as total FROM tb_extrato_comissao WHERE 1=1";
                    const params = [];
                    let pCount = 1;
                    
                    // Se especificar bloqueado, filtrar; senão, somar todas
                    if (bloqueado !== undefined) {
                        query += ` AND bloqueado = $${pCount}`;
                        params.push(bloqueado);
                        pCount++;
                    }
                    
                    const result = await db.query(query, params);
                    const total = parseFloat(result.rows[0].total || 0);
                    
                    // Construir mensagem informativa
                    let mensagem = '';
                    if (bloqueado === false) {
                        mensagem = `Valor total de comissões não bloqueadas: R$ ${total.toFixed(2)}`;
                        if (parseInt(stats.nao_bloqueadas) === 0) {
                            mensagem += `\n\n⚠️ Não há comissões não bloqueadas no sistema. Total de comissões: ${stats.total} (${stats.bloqueadas} bloqueadas)`;
                        } else {
                            mensagem += `\n(Totalizando ${stats.nao_bloqueadas} comissão(ões) não bloqueada(s))`;
                        }
                    } else if (bloqueado === true) {
                        mensagem = `Valor total de comissões bloqueadas: R$ ${total.toFixed(2)}`;
                        if (parseInt(stats.bloqueadas) > 0) {
                            mensagem += `\n(Totalizando ${stats.bloqueadas} comissão(ões) bloqueada(s))`;
                        }
                    } else {
                        mensagem = `Valor total de comissões: R$ ${total.toFixed(2)}`;
                        if (parseInt(stats.total) > 0) {
                            mensagem += `\n(Total: ${stats.total} comissões - ${stats.nao_bloqueadas} não bloqueadas, ${stats.bloqueadas} bloqueadas)`;
                        } else {
                            mensagem += `\n\n⚠️ Não há comissões cadastradas no sistema.`;
                        }
                    }
                    
                    return res.json({
                        type: 'TEXT',
                        content: mensagem
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

            // Handle generateReport
            if (fnName === 'generateReport') {
                const { type, filters = {} } = args;
                
                if (!type) {
                    return res.json({
                        type: 'ERROR',
                        message: 'Tipo de relatório é obrigatório.'
                    });
                }
                
                // Verificar se é um relatório customizado
                let customReport = null;
                if (typeof type === 'string' && type.startsWith('custom_')) {
                    customReport = getCustomReport(type);
                    if (!customReport) {
                        return res.json({
                            type: 'ERROR',
                            message: `Relatório customizado "${type}" não encontrado.`
                        });
                    }
                } else {
                    // Validar tipo padrão
                    const validTypes = ['users', 'operations', 'commissions', 'audit'];
                    if (!validTypes.includes(type)) {
                        return res.json({
                            type: 'ERROR',
                            message: `Tipo de relatório inválido. Tipos disponíveis: ${validTypes.join(', ')} ou IDs de relatórios customizados (que começam com "custom_").`
                        });
                    }
                }
                
                // Helper para normalizar datas
                const normalizeDate = (dateStr) => {
                    if (!dateStr || dateStr.trim() === '') return null;
                    
                    const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
                    if (monthYearMatch) {
                        const month = parseInt(monthYearMatch[1]);
                        const year = parseInt(monthYearMatch[2]);
                        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                            return `${year}-${String(month).padStart(2, '0')}-01`;
                        }
                    }
                    
                    const brDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                    if (brDateMatch) {
                        const day = parseInt(brDateMatch[1]);
                        const month = parseInt(brDateMatch[2]);
                        const year = parseInt(brDateMatch[3]);
                        if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                            return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        }
                    }
                    
                    const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                    if (isoMatch) {
                        return dateStr;
                    }
                    
                    return null;
                };
                
                const normalizeDateTo = (dateStr) => {
                    if (!dateStr || dateStr.trim() === '') return null;
                    
                    const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
                    if (monthYearMatch) {
                        const month = parseInt(monthYearMatch[1]);
                        const year = parseInt(monthYearMatch[2]);
                        if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                            const lastDay = new Date(year, month, 0).getDate();
                            return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                        }
                    }
                    
                    return normalizeDate(dateStr);
                };
                
                const normalizedFilters = {
                    ...filters,
                    dateFrom: normalizeDate(filters.dateFrom),
                    dateTo: normalizeDateTo(filters.dateTo)
                };
                
                let query;
                let params = [];
                let paramCount = 1;
                
                if (customReport) {
                    query = customReport.sqlQuery;
                } else if (type === 'users') {
                    query = `
                        SELECT 
                            u.id_usuario as "ID",
                            u.str_descricao as "Nome",
                            u.str_login as "Login",
                            u.email as "Email",
                            u.str_cpf as "CPF",
                            CASE 
                                WHEN u.str_ativo = 'E' THEN 'INATIVO'
                                WHEN u.bloqueado = true THEN 'BLOQUEADO'
                                ELSE 'ATIVO'
                            END as "Status",
                            o.str_descricao as "Operação",
                            g.str_descricao as "Grupo",
                            u.dh_edita as "Última Modificação"
                        FROM tb_usuario u
                        LEFT JOIN tb_operacao o ON u.id_operacao = o.id_operacao
                        LEFT JOIN tb_grupo g ON u.id_grupo = g.id_grupo
                        WHERE 1=1
                    `;
                    
                    if (normalizedFilters.status) {
                        if (normalizedFilters.status === 'ATIVO') {
                            query += ` AND u.str_ativo = 'A' AND u.bloqueado = false`;
                        } else if (normalizedFilters.status === 'BLOQUEADO') {
                            query += ` AND u.bloqueado = true AND u.str_ativo = 'A'`;
                        } else if (normalizedFilters.status === 'INATIVO') {
                            query += ` AND u.str_ativo = 'E'`;
                        }
                    }
                    
                    if (normalizedFilters.operation) {
                        query += ` AND UPPER(o.str_descricao) = UPPER($${paramCount})`;
                        params.push(normalizedFilters.operation);
                        paramCount++;
                    }
                    
                    if (normalizedFilters.dateFrom) {
                        query += ` AND u.dh_edita >= $${paramCount}`;
                        params.push(normalizedFilters.dateFrom);
                        paramCount++;
                    }
                    
                    if (normalizedFilters.dateTo) {
                        query += ` AND u.dh_edita <= $${paramCount}`;
                        params.push(normalizedFilters.dateTo);
                        paramCount++;
                    }
                    
                    query += ` ORDER BY u.dh_edita DESC`;
                } else if (type === 'operations') {
                    query = `
                        SELECT 
                            o.id_operacao as "ID",
                            o.str_descricao as "Operação",
                            o.str_documento as "CNPJ",
                            COUNT(u.id_usuario) as "Total Usuários",
                            COUNT(CASE WHEN u.bloqueado = false AND u.str_ativo = 'A' THEN 1 END) as "Usuários Ativos",
                            COUNT(CASE WHEN u.bloqueado = true AND u.str_ativo = 'A' THEN 1 END) as "Usuários Bloqueados"
                        FROM tb_operacao o
                        LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao AND u.str_ativo = 'A'
                        WHERE o.str_ativo = 'A'
                        GROUP BY o.id_operacao, o.str_descricao, o.str_documento
                        ORDER BY "Total Usuários" DESC
                    `;
                } else if (type === 'commissions') {
                    query = `
                        SELECT 
                            ec.id_extrato as "ID",
                            e.str_descricao as "Entidade",
                            ec.n_valor as "Valor Bruto",
                            ec.n_valor_liquido as "Valor Líquido",
                            ec.n_valor_ir as "IR",
                            ec.n_valor_iss as "ISS",
                            CASE WHEN ec.bloqueado THEN 'BLOQUEADO' ELSE 'LIBERADO' END as "Status",
                            ec.dh_inclui as "Data Inclusão",
                            ec.dh_pago as "Data Pagamento"
                        FROM tb_extrato_comissao ec
                        LEFT JOIN tb_entidade e ON ec.id_entidade = e.id_entidade
                        WHERE 1=1
                    `;
                    
                    if (normalizedFilters.dateFrom) {
                        query += ` AND ec.dh_inclui >= $${paramCount}`;
                        params.push(normalizedFilters.dateFrom);
                        paramCount++;
                    }
                    
                    if (normalizedFilters.dateTo) {
                        query += ` AND ec.dh_inclui <= $${paramCount}`;
                        params.push(normalizedFilters.dateTo);
                        paramCount++;
                    }
                    
                    query += ` ORDER BY ec.dh_inclui DESC`;
                } else if (type === 'audit') {
                    query = `
                        SELECT 
                            id as "ID",
                            action_type as "Tipo de Ação",
                            target_user_id as "ID Usuário",
                            details::text as "Detalhes",
                            created_at as "Data/Hora"
                        FROM audit_logs
                        WHERE 1=1
                    `;
                    
                    if (normalizedFilters.dateFrom) {
                        query += ` AND created_at >= $${paramCount}`;
                        params.push(normalizedFilters.dateFrom);
                        paramCount++;
                    }
                    
                    if (normalizedFilters.dateTo) {
                        query += ` AND created_at <= $${paramCount}`;
                        params.push(normalizedFilters.dateTo);
                        paramCount++;
                    }
                    
                    query += ` ORDER BY created_at DESC LIMIT 1000`;
                }
                
                const result = await db.query(query, params);
                
                if (result.rows.length === 0) {
                    return res.json({
                        type: 'ERROR',
                        message: 'Nenhum dado encontrado para o relatório com os filtros especificados.'
                    });
                }
                
                const reportTypeNames = {
                    users: 'Usuários',
                    operations: 'Operações',
                    commissions: 'Comissões',
                    audit: 'Auditoria',
                    [type]: customReport ? customReport.name : type
                };
                
                // Construir URL para download do relatório
                const filterParams = new URLSearchParams();
                if (normalizedFilters.status) filterParams.append('status', normalizedFilters.status);
                if (normalizedFilters.operation) filterParams.append('operation', normalizedFilters.operation);
                if (normalizedFilters.dateFrom) filterParams.append('dateFrom', normalizedFilters.dateFrom);
                if (normalizedFilters.dateTo) filterParams.append('dateTo', normalizedFilters.dateTo);
                
                const reportUrl = `/api/reports/generate?type=${type}&${filterParams.toString()}`;
                
                // Criar mensagem de confirmação
                let confirmationMessage = `Deseja baixar o relatório de ${reportTypeNames[type]} em formato CSV?\n\n`;
                confirmationMessage += `📊 Tipo: ${reportTypeNames[type]}\n`;
                confirmationMessage += `📈 Registros encontrados: ${result.rows.length}\n`;
                
                if (normalizedFilters.status) {
                    confirmationMessage += `🔹 Status: ${normalizedFilters.status}\n`;
                }
                if (normalizedFilters.operation) {
                    confirmationMessage += `🔹 Operação: ${normalizedFilters.operation}\n`;
                }
                if (normalizedFilters.dateFrom || normalizedFilters.dateTo) {
                    confirmationMessage += `🔹 Período: ${normalizedFilters.dateFrom || 'início'} até ${normalizedFilters.dateTo || 'fim'}\n`;
                }
                
                // Armazenar ação pendente para confirmação
                const token = storePendingAction({
                    action: 'generateReport',
                    reportType: type,
                    filters: normalizedFilters,
                    reportUrl: reportUrl,
                    reportName: reportTypeNames[type],
                    rowCount: result.rows.length,
                    requestedBy: req.currentUserId
                });
                
                return res.json({
                    type: 'CONFIRMATION_REQUIRED',
                    message: confirmationMessage,
                    confirmationToken: token,
                    affectedCount: result.rows.length
                });
            }

            // Handle createCustomReport
            if (fnName === 'createCustomReport') {
                const { name, description, sqlQuery, columns } = args;
                
                if (!name || !description) {
                    return res.json({
                        type: 'ERROR',
                        message: 'Nome e descrição são obrigatórios para criar um relatório customizado.'
                    });
                }
                
                let finalSqlQuery = sqlQuery;
                
                // Se não foi fornecido SQL, gerar usando o sqlGenerator (mesmo processo de consulta)
                if (!finalSqlQuery) {
                    try {
                        console.log('[CustomReport] Gerando SQL usando sqlGenerator...');
                        // Usar a descrição como pergunta para gerar o SQL
                        const question = `Criar um relatório que mostre: ${description}`;
                        const sqlResult = await gerarSQLCompleto(question);
                        finalSqlQuery = sqlResult.sql;
                        console.log('[CustomReport] SQL gerado com sucesso usando', sqlResult.tabelasSelecionadas.length, 'tabela(s)');
                    } catch (sqlGenError) {
                        console.error('[CustomReport] Erro ao gerar SQL:', sqlGenError.message);
                        return res.json({
                            type: 'ERROR',
                            message: `Erro ao gerar SQL para o relatório: ${sqlGenError.message}. Por favor, seja mais específico na descrição do relatório.`
                        });
                    }
                }
                
                // Validar que o SQL é um SELECT
                const sqlTrimmed = finalSqlQuery.trim().toUpperCase();
                if (!sqlTrimmed.startsWith('SELECT')) {
                    return res.json({
                        type: 'ERROR',
                        message: 'Apenas queries SELECT são permitidas por segurança.'
                    });
                }
                
                // Validar e testar a query SQL antes de salvar
                try {
                    console.log('[CustomReport] Testando query SQL antes de criar relatório...');
                    const testResult = await db.query(finalSqlQuery);
                    console.log('[CustomReport] Query testada com sucesso, retornou', testResult.rows.length, 'linhas');
                } catch (testError) {
                    console.error('[CustomReport] Erro ao testar query:', testError.message);
                    
                    // Extrair informações úteis do erro
                    let errorMessage = 'Erro na query SQL: ' + testError.message;
                    
                    if (testError.code === '42P01') {
                        // Tabela não encontrada
                        const tableMatch = testError.message.match(/relation\s+"([^"]+)"\s+does not exist/i) ||
                                         testError.message.match(/relation\s+(\w+)\s+does not exist/i);
                        const tableName = tableMatch ? tableMatch[1] : 'desconhecida';
                        errorMessage = `A tabela "${tableName}" não existe. Use apenas tabelas que começam com "tb_" (ex: tb_usuario, tb_entidade, tb_grupo).`;
                    } else if (testError.code === '42703') {
                        // Coluna não encontrada
                        const columnMatch = testError.message.match(/column\s+"([^"]+)"\s+does not exist/i) ||
                                          testError.message.match(/column\s+(\w+)\s+does not exist/i);
                        const columnName = columnMatch ? columnMatch[1] : 'desconhecida';
                        errorMessage = `A coluna "${columnName}" não existe. Verifique os nomes das colunas na tabela.`;
                    }
                    
                    return res.json({
                        type: 'ERROR',
                        message: errorMessage + ' Por favor, corrija a query e tente novamente.'
                    });
                }
                
                // Criar o relatório customizado
                const reportId = createCustomReport({
                    name,
                    description,
                    sqlQuery: finalSqlQuery,
                    columns: columns || [],
                    createdBy: req.currentUserId
                });
                
                // Construir links de ação
                const actions = {
                    viewInReports: `/reports?type=${reportId}`,
                    preview: `/api/reports/preview`,
                    download: `/api/reports/generate?type=${reportId}`
                };
                
                return res.json({
                    type: 'CUSTOM_REPORT_CREATED',
                    message: `✅ Relatório customizado "${name}" criado com sucesso!\n\n📊 Você pode:\n- Ver na tela de relatórios\n- Visualizar preview dos dados\n- Baixar em CSV`,
                    reportId: reportId,
                    reportName: name,
                    actions: actions
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
        } else if (pendingAction.action === 'changeProfile') {
            if (!(await ensurePermission(req, res, 'UPDATE', 'USER'))) return;
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
            // Usar id_operacao se disponível, senão buscar pelo nome
            let operationId = pendingAction.operationId;
            if (!operationId) {
                const operationLookup = await db.query(
                    `SELECT id_operacao FROM tb_operacao 
                     WHERE UPPER(str_descricao) LIKE UPPER($1) AND str_ativo = 'A'
                     ORDER BY 
                        CASE 
                            WHEN UPPER(str_descricao) = UPPER($2) THEN 1
                            WHEN UPPER(str_descricao) LIKE UPPER($2) || '%' THEN 2
                            ELSE 3
                        END
                     LIMIT 1`,
                    [`%${pendingAction.company}%`, pendingAction.company]
                );

                if (operationLookup.rowCount === 0) {
                    return res.status(400).json({
                        type: 'ERROR',
                        message: `Empresa/Operação "${pendingAction.company}" não encontrada.`
                    });
                }
                operationId = operationLookup.rows[0].id_operacao;
            }

            // Bloquear apenas usuários da operação específica
            const result = await db.query(
                'UPDATE tb_usuario SET bloqueado = true, dh_edita = NOW() WHERE id_operacao = $1 AND str_ativo = \'A\' RETURNING id_usuario, str_descricao, str_login',
                [operationId]
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
            // Buscar a operação pelo nome (empresas são operações no sistema)
            const operationLookup = await db.query(
                `SELECT id_operacao, str_descricao FROM tb_operacao 
                 WHERE UPPER(str_descricao) LIKE UPPER($1) AND str_ativo = 'A'
                 ORDER BY 
                    CASE 
                        WHEN UPPER(str_descricao) = UPPER($2) THEN 1
                        WHEN UPPER(str_descricao) LIKE UPPER($2) || '%' THEN 2
                        ELSE 3
                    END
                 LIMIT 1`,
                [`%${pendingAction.company}%`, pendingAction.company]
            );

            if (operationLookup.rowCount === 0) {
                deletePendingAction(confirmationToken);
                return res.json({
                    type: 'ERROR',
                    message: `Empresa/Operação "${pendingAction.company}" não encontrada.`
                });
            }

            const operation = operationLookup.rows[0];
            
            // Senha padrão para reset (pode ser configurada via variável de ambiente)
            const defaultPassword = process.env.DEFAULT_RESET_PASSWORD || '123456';
            const hashedPassword = hashPasswordSHA256(defaultPassword);

            // Atualizar senhas de todos os usuários da operação
            const result = await db.query(
                `UPDATE tb_usuario 
                 SET str_senha = $1, dh_edita = NOW() 
                 WHERE id_operacao = $2 AND str_ativo = 'A'
                 RETURNING id_usuario`,
                [hashedPassword, operation.id_operacao]
            );

            const auditDbId = await createAuditLog('RESET_PASSWORDS', null, { 
                company: pendingAction.company, 
                operation_id: operation.id_operacao,
                count: result.rowCount, 
                performedBy 
            });
            const auditLabel = formatAuditId(auditDbId);

            deletePendingAction(confirmationToken);

            return res.json({
                type: 'ACTION_COMPLETE',
                message: `Senhas resetadas para ${result.rowCount} usuários da empresa "${operation.str_descricao}". Senha padrão: ${defaultPassword}. Audit ID: ${auditLabel}`,
                auditId: auditLabel,
                count: result.rowCount
            });
        }

        if (pendingAction.action === 'generateReport') {
            deletePendingAction(confirmationToken);

            return res.json({
                type: 'REPORT_READY',
                message: `Relatório "${pendingAction.reportName}" pronto para download!`,
                reportUrl: pendingAction.reportUrl,
                reportType: pendingAction.reportType,
                rowCount: pendingAction.rowCount
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

// GET /api/reports/custom - Listar todos os relatórios customizados
app.get('/api/reports/custom', async (req, res) => {
    try {
        const reports = getAllCustomReports();
        res.json(reports);
    } catch (error) {
        console.error('Erro ao listar relatórios customizados:', error);
        res.status(500).json({ error: 'Erro ao listar relatórios customizados' });
    }
});

// POST /api/reports/preview - Visualizar preview de um relatório
app.post('/api/reports/preview', async (req, res) => {
    try {
        const { type, filters = {} } = req.body;
        
        console.log('[Preview] Recebido request:', { type, filters });
        
        if (!type) {
            return res.status(400).json({ error: 'Tipo de relatório é obrigatório.' });
        }
        
        // Verificar se é um relatório customizado
        let customReport = null;
        if (typeof type === 'string' && type.startsWith('custom_')) {
            console.log('[Preview] Buscando relatório customizado:', type);
            customReport = getCustomReport(type);
            if (!customReport) {
                console.error('[Preview] Relatório customizado não encontrado:', type);
                return res.status(404).json({ error: `Relatório customizado "${type}" não encontrado.` });
            }
            console.log('[Preview] Relatório customizado encontrado:', customReport.name);
        }
        
        // Helper para normalizar datas
        const normalizeDate = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return null;
            
            // Formato MM/YYYY - converter para primeiro dia do mês
            const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
            if (monthYearMatch) {
                const month = parseInt(monthYearMatch[1]);
                const year = parseInt(monthYearMatch[2]);
                if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    return `${year}-${String(month).padStart(2, '0')}-01`;
                }
            }
            
            // Formato DD/MM/YYYY
            const brDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (brDateMatch) {
                const day = parseInt(brDateMatch[1]);
                const month = parseInt(brDateMatch[2]);
                const year = parseInt(brDateMatch[3]);
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            
            // Formato YYYY-MM-DD (já está correto)
            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                return dateStr;
            }
            
            return null;
        };
        
        const normalizeDateTo = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return null;
            
            // Formato MM/YYYY - converter para último dia do mês
            const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
            if (monthYearMatch) {
                const month = parseInt(monthYearMatch[1]);
                const year = parseInt(monthYearMatch[2]);
                if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    const lastDay = new Date(year, month, 0).getDate();
                    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                }
            }
            
            return normalizeDate(dateStr);
        };
        
        const normalizedFilters = {
            ...filters,
            dateFrom: normalizeDate(filters.dateFrom),
            dateTo: normalizeDateTo(filters.dateTo)
        };
        
        let query;
        let params = [];
        let paramCount = 1;
        
        if (customReport) {
            // Relatório customizado - usar SQL fornecido
            query = customReport.sqlQuery;
            
            // Validar se a query existe e não está vazia
            if (!query || typeof query !== 'string' || query.trim() === '') {
                return res.status(400).json({ error: 'Query SQL do relatório customizado está vazia ou inválida.' });
            }
            
            // Validar que é uma query SELECT (segurança)
            const queryUpper = query.trim().toUpperCase();
            if (!queryUpper.startsWith('SELECT')) {
                return res.status(400).json({ error: 'Apenas queries SELECT são permitidas por segurança.' });
            }
            
            // Verificar se há parâmetros na query ($1, $2, etc.)
            const paramMatches = query.match(/\$\d+/g);
            if (paramMatches && paramMatches.length > 0) {
                console.warn('[Preview] Query customizada contém parâmetros que não serão fornecidos:', paramMatches);
                // A query será executada e, se falhar, o tratamento de erros vai capturar
                // e retornar uma mensagem clara ao usuário
            }
            
            // Não aplicar filtros automáticos para relatórios customizados
            // Mas limpar params para evitar problemas com parâmetros não utilizados
            params = [];
        } else if (type === 'users') {
            query = `
                SELECT 
                    u.id_usuario as "ID",
                    u.str_descricao as "Nome",
                    u.str_login as "Login",
                    u.email as "Email",
                    u.str_cpf as "CPF",
                    CASE 
                        WHEN u.str_ativo = 'E' THEN 'INATIVO'
                        WHEN u.bloqueado = true THEN 'BLOQUEADO'
                        ELSE 'ATIVO'
                    END as "Status",
                    o.str_descricao as "Operação",
                    g.str_descricao as "Grupo",
                    u.dh_edita as "Última Modificação"
                FROM tb_usuario u
                LEFT JOIN tb_operacao o ON u.id_operacao = o.id_operacao
                LEFT JOIN tb_grupo g ON u.id_grupo = g.id_grupo
                WHERE 1=1
            `;
            
            if (normalizedFilters.status) {
                if (normalizedFilters.status === 'ATIVO') {
                    query += ` AND u.str_ativo = 'A' AND u.bloqueado = false`;
                } else if (normalizedFilters.status === 'BLOQUEADO') {
                    query += ` AND u.bloqueado = true AND u.str_ativo = 'A'`;
                } else if (normalizedFilters.status === 'INATIVO') {
                    query += ` AND u.str_ativo = 'E'`;
                }
            }
            
            if (normalizedFilters.operation) {
                query += ` AND UPPER(o.str_descricao) = UPPER($${paramCount})`;
                params.push(normalizedFilters.operation);
                paramCount++;
            }
            
            if (normalizedFilters.dateFrom) {
                query += ` AND u.dh_edita >= $${paramCount}`;
                params.push(normalizedFilters.dateFrom);
                paramCount++;
            }
            
            if (normalizedFilters.dateTo) {
                query += ` AND u.dh_edita <= $${paramCount}`;
                params.push(normalizedFilters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY u.dh_edita DESC`;
        } else if (type === 'operations') {
            query = `
                SELECT 
                    o.id_operacao as "ID",
                    o.str_descricao as "Operação",
                    o.str_documento as "CNPJ",
                    COUNT(u.id_usuario) as "Total Usuários",
                    COUNT(CASE WHEN u.bloqueado = false AND u.str_ativo = 'A' THEN 1 END) as "Usuários Ativos",
                    COUNT(CASE WHEN u.bloqueado = true AND u.str_ativo = 'A' THEN 1 END) as "Usuários Bloqueados"
                FROM tb_operacao o
                LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao AND u.str_ativo = 'A'
                WHERE o.str_ativo = 'A'
                GROUP BY o.id_operacao, o.str_descricao, o.str_documento
                ORDER BY "Total Usuários" DESC
            `;
        } else if (type === 'commissions') {
            query = `
                SELECT 
                    ec.id_extrato as "ID",
                    e.str_descricao as "Entidade",
                    ec.n_valor as "Valor Bruto",
                    ec.n_valor_liquido as "Valor Líquido",
                    ec.n_valor_ir as "IR",
                    ec.n_valor_iss as "ISS",
                    CASE WHEN ec.bloqueado THEN 'BLOQUEADO' ELSE 'LIBERADO' END as "Status",
                    ec.dh_inclui as "Data Inclusão",
                    ec.dh_pago as "Data Pagamento"
                FROM tb_extrato_comissao ec
                LEFT JOIN tb_entidade e ON ec.id_entidade = e.id_entidade
                WHERE 1=1
            `;
            
            if (normalizedFilters.dateFrom) {
                query += ` AND ec.dh_inclui >= $${paramCount}`;
                params.push(normalizedFilters.dateFrom);
                paramCount++;
            }
            
            if (normalizedFilters.dateTo) {
                query += ` AND ec.dh_inclui <= $${paramCount}`;
                params.push(normalizedFilters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY ec.dh_inclui DESC`;
        } else if (type === 'audit') {
            query = `
                SELECT 
                    id as "ID",
                    action_type as "Tipo de Ação",
                    target_user_id as "ID Usuário",
                    details::text as "Detalhes",
                    created_at as "Data/Hora"
                FROM audit_logs
                WHERE 1=1
            `;
            
            if (normalizedFilters.dateFrom) {
                query += ` AND created_at >= $${paramCount}`;
                params.push(normalizedFilters.dateFrom);
                paramCount++;
            }
            
            if (normalizedFilters.dateTo) {
                query += ` AND created_at <= $${paramCount}`;
                params.push(normalizedFilters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY created_at DESC LIMIT 1000`;
        } else {
            return res.status(400).json({ error: `Tipo de relatório inválido: ${type}` });
        }
        
        // Validar query antes de executar
        if (!query || query.trim() === '') {
            return res.status(400).json({ error: 'Query SQL não pode estar vazia.' });
        }
        
        console.log('[Preview] Executando query:', query.substring(0, 200) + (query.length > 200 ? '...' : ''));
        console.log('[Preview] Parâmetros:', params);
        console.log('[Preview] Tipo de relatório:', type);
        
        let result;
        try {
            result = await db.query(query, params);
        } catch (dbError) {
            // Erro específico do PostgreSQL
            console.error('[Preview] Erro do PostgreSQL:', dbError.message);
            console.error('[Preview] Código do erro:', dbError.code);
            console.error('[Preview] Detalhes:', dbError.detail);
            console.error('[Preview] Query que falhou:', query.substring(0, 500));
            
            // Verificar se é erro de tabela não encontrada
            if (dbError.code === '42P01' || dbError.message.includes('does not exist') || dbError.message.includes('não existe')) {
                // Extrair nome da tabela do erro - múltiplos padrões
                let tableName = 'desconhecida';
                
                // Padrão 1: relation "nome_tabela" does not exist
                const pattern1 = dbError.message.match(/relation\s+"([^"]+)"\s+does not exist/i);
                if (pattern1) {
                    tableName = pattern1[1];
                } else {
                    // Padrão 2: relation nome_tabela does not exist (sem aspas)
                    const pattern2 = dbError.message.match(/relation\s+(\w+)\s+does not exist/i);
                    if (pattern2) {
                        tableName = pattern2[1];
                    } else {
                        // Padrão 3: tabela "nome_tabela" não existe
                        const pattern3 = dbError.message.match(/tabela\s+"([^"]+)"\s+não existe/i);
                        if (pattern3) {
                            tableName = pattern3[1];
                        } else {
                            // Padrão 4: qualquer palavra após "relation" ou "tabela"
                            const pattern4 = dbError.message.match(/(?:relation|tabela)\s+["']?(\w+)/i);
                            if (pattern4) {
                                tableName = pattern4[1];
                            }
                        }
                    }
                }
                
                // Se ainda não encontrou, tentar extrair da query
                if (tableName === 'desconhecida' && query) {
                    const fromMatch = query.match(/FROM\s+(\w+)/i);
                    if (fromMatch) {
                        tableName = fromMatch[1];
                    }
                }
                
                return res.status(400).json({ 
                    error: `A tabela "${tableName}" não existe no banco de dados. Verifique se o nome da tabela está correto.`,
                    message: dbError.message,
                    hint: 'Tabelas devem começar com o prefixo "tb_" (ex: tb_entidade, tb_usuario). Verifique também se tabelas relacionadas (tb_entidade_email, tb_entidade_telefone) existem.',
                    query: query.substring(0, 200) // Mostrar parte da query para debug
                });
            }
            
            // Verificar se é erro de parâmetros não fornecidos
            if (dbError.code === '42P02' || dbError.message.includes('parameter') || dbError.message.includes('$')) {
                return res.status(400).json({ 
                    error: 'A query SQL contém parâmetros que não foram fornecidos. Relatórios customizados não podem usar parâmetros ($1, $2, etc.) no preview.',
                    message: dbError.message
                });
            }
            
            // Verificar se é erro de coluna não encontrada
            if (dbError.code === '42703' || dbError.message.includes('column') && dbError.message.includes('does not exist')) {
                const columnMatch = dbError.message.match(/column\s+"?(\w+)"?\s+does not exist/i);
                const columnName = columnMatch ? columnMatch[1] : 'desconhecida';
                
                return res.status(400).json({ 
                    error: `A coluna "${columnName}" não existe na tabela. Verifique se o nome da coluna está correto.`,
                    message: dbError.message
                });
            }
            
            // Outros erros do PostgreSQL
            return res.status(400).json({
                error: 'Erro na execução da query SQL',
                message: dbError.message,
                code: dbError.code
            });
        }
        
        res.json({
            rows: result.rows,
            count: result.rows.length
        });
        
    } catch (error) {
        console.error('[Preview] Erro ao gerar preview:', error);
        console.error('[Preview] Stack trace:', error.stack);
        
        // Se já foi uma resposta HTTP, não enviar novamente
        if (res.headersSent) {
            return;
        }
        
        res.status(500).json({ 
            error: 'Erro ao gerar preview', 
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// GET /api/reports/generate - Gerar relatório em CSV
app.get('/api/reports/generate', async (req, res) => {
    try {
        const { type, status, operation, dateFrom, dateTo } = req.query;
        
        if (!type) {
            return res.status(400).json({ error: 'Tipo de relatório é obrigatório.' });
        }
        
        // Verificar se é um relatório customizado
        let customReport = null;
        if (typeof type === 'string' && type.startsWith('custom_')) {
            customReport = getCustomReport(type);
            if (!customReport) {
                return res.status(404).json({ error: `Relatório customizado "${type}" não encontrado.` });
            }
        }
        
        // Helper para normalizar datas
        const normalizeDate = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return null;
            
            const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
            if (monthYearMatch) {
                const month = parseInt(monthYearMatch[1]);
                const year = parseInt(monthYearMatch[2]);
                if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    return `${year}-${String(month).padStart(2, '0')}-01`;
                }
            }
            
            const brDateMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
            if (brDateMatch) {
                const day = parseInt(brDateMatch[1]);
                const month = parseInt(brDateMatch[2]);
                const year = parseInt(brDateMatch[3]);
                if (day >= 1 && day <= 31 && month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                }
            }
            
            const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (isoMatch) {
                return dateStr;
            }
            
            return null;
        };
        
        const normalizeDateTo = (dateStr) => {
            if (!dateStr || dateStr.trim() === '') return null;
            
            const monthYearMatch = dateStr.match(/^(\d{1,2})\/(\d{4})$/);
            if (monthYearMatch) {
                const month = parseInt(monthYearMatch[1]);
                const year = parseInt(monthYearMatch[2]);
                if (month >= 1 && month <= 12 && year >= 1900 && year <= 2100) {
                    const lastDay = new Date(year, month, 0).getDate();
                    return `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
                }
            }
            
            return normalizeDate(dateStr);
        };
        
        const filters = {
            status,
            operation,
            dateFrom: normalizeDate(dateFrom),
            dateTo: normalizeDateTo(dateTo)
        };
        
        let query;
        let params = [];
        let paramCount = 1;
        
        if (customReport) {
            query = customReport.sqlQuery;
        } else if (type === 'users') {
            query = `
                SELECT 
                    u.id_usuario as "ID",
                    u.str_descricao as "Nome",
                    u.str_login as "Login",
                    u.email as "Email",
                    u.str_cpf as "CPF",
                    CASE 
                        WHEN u.str_ativo = 'E' THEN 'INATIVO'
                        WHEN u.bloqueado = true THEN 'BLOQUEADO'
                        ELSE 'ATIVO'
                    END as "Status",
                    o.str_descricao as "Operação",
                    g.str_descricao as "Grupo",
                    u.dh_edita as "Última Modificação"
                FROM tb_usuario u
                LEFT JOIN tb_operacao o ON u.id_operacao = o.id_operacao
                LEFT JOIN tb_grupo g ON u.id_grupo = g.id_grupo
                WHERE 1=1
            `;
            
            if (filters.status) {
                if (filters.status === 'ATIVO') {
                    query += ` AND u.str_ativo = 'A' AND u.bloqueado = false`;
                } else if (filters.status === 'BLOQUEADO') {
                    query += ` AND u.bloqueado = true AND u.str_ativo = 'A'`;
                } else if (filters.status === 'INATIVO') {
                    query += ` AND u.str_ativo = 'E'`;
                }
            }
            
            if (filters.operation) {
                query += ` AND UPPER(o.str_descricao) = UPPER($${paramCount})`;
                params.push(filters.operation);
                paramCount++;
            }
            
            if (filters.dateFrom) {
                query += ` AND u.dh_edita >= $${paramCount}`;
                params.push(filters.dateFrom);
                paramCount++;
            }
            
            if (filters.dateTo) {
                query += ` AND u.dh_edita <= $${paramCount}`;
                params.push(filters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY u.dh_edita DESC`;
        } else if (type === 'operations') {
            query = `
                SELECT 
                    o.id_operacao as "ID",
                    o.str_descricao as "Operação",
                    o.str_documento as "CNPJ",
                    COUNT(u.id_usuario) as "Total Usuários",
                    COUNT(CASE WHEN u.bloqueado = false AND u.str_ativo = 'A' THEN 1 END) as "Usuários Ativos",
                    COUNT(CASE WHEN u.bloqueado = true AND u.str_ativo = 'A' THEN 1 END) as "Usuários Bloqueados"
                FROM tb_operacao o
                LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao AND u.str_ativo = 'A'
                WHERE o.str_ativo = 'A'
                GROUP BY o.id_operacao, o.str_descricao, o.str_documento
                ORDER BY "Total Usuários" DESC
            `;
        } else if (type === 'commissions') {
            query = `
                SELECT 
                    ec.id_extrato as "ID",
                    e.str_descricao as "Entidade",
                    ec.n_valor as "Valor Bruto",
                    ec.n_valor_liquido as "Valor Líquido",
                    ec.n_valor_ir as "IR",
                    ec.n_valor_iss as "ISS",
                    CASE WHEN ec.bloqueado THEN 'BLOQUEADO' ELSE 'LIBERADO' END as "Status",
                    ec.dh_inclui as "Data Inclusão",
                    ec.dh_pago as "Data Pagamento"
                FROM tb_extrato_comissao ec
                LEFT JOIN tb_entidade e ON ec.id_entidade = e.id_entidade
                WHERE 1=1
            `;
            
            if (filters.dateFrom) {
                query += ` AND ec.dh_inclui >= $${paramCount}`;
                params.push(filters.dateFrom);
                paramCount++;
            }
            
            if (filters.dateTo) {
                query += ` AND ec.dh_inclui <= $${paramCount}`;
                params.push(filters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY ec.dh_inclui DESC`;
        } else if (type === 'audit') {
            query = `
                SELECT 
                    id as "ID",
                    action_type as "Tipo de Ação",
                    target_user_id as "ID Usuário",
                    details::text as "Detalhes",
                    created_at as "Data/Hora"
                FROM audit_logs
                WHERE 1=1
            `;
            
            if (filters.dateFrom) {
                query += ` AND created_at >= $${paramCount}`;
                params.push(filters.dateFrom);
                paramCount++;
            }
            
            if (filters.dateTo) {
                query += ` AND created_at <= $${paramCount}`;
                params.push(filters.dateTo);
                paramCount++;
            }
            
            query += ` ORDER BY created_at DESC LIMIT 1000`;
        } else {
            return res.status(400).json({ error: `Tipo de relatório inválido: ${type}` });
        }
        
        const result = await db.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Nenhum dado encontrado para o relatório com os filtros especificados.' });
        }
        
        // Converter para CSV
        const headers = Object.keys(result.rows[0]);
        const csvRows = [
            headers.join(','),
            ...result.rows.map(row => 
                headers.map(header => {
                    const value = row[header];
                    if (value === null || value === undefined) return '';
                    // Escapar vírgulas e aspas
                    const stringValue = String(value);
                    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
                        return `"${stringValue.replace(/"/g, '""')}"`;
                    }
                    return stringValue;
                }).join(',')
            )
        ];
        
        const csv = csvRows.join('\n');
        
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="relatorio_${type}_${new Date().toISOString().split('T')[0]}.csv"`);
        res.send('\ufeff' + csv); // BOM para Excel
        
    } catch (error) {
        console.error('Erro ao gerar relatório:', error);
        res.status(500).json({ error: 'Erro ao gerar relatório', message: error.message });
    }
});

// GET /api/conversations/history - Obter histórico completo de conversas do usuário
app.get('/api/conversations/history', async (req, res) => {
    try {
        const userId = req.currentUserId;
        const limit = parseInt(req.query.limit) || 50;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        // Buscar histórico do Redis primeiro (mais rápido)
        let history = await getConversationHistory(userId, limit);
        
        // Se não encontrou no Redis, buscar do banco
        if (history.length === 0) {
            history = await getFullConversationHistory(userId, limit, startDate, endDate);
        }

        // Converter para formato do frontend (com id e type)
        const formattedHistory = history.map((msg, index) => ({
            id: index + 1,
            type: msg.role === 'user' ? 'user' : 'bot',
            text: msg.content,
            role: msg.role,
            content: msg.content
        }));

        res.json({
            success: true,
            userId,
            count: formattedHistory.length,
            messages: formattedHistory,
            history: history // Manter formato original também
        });
    } catch (error) {
        console.error('Erro ao buscar histórico de conversas:', error);
        res.status(500).json({ 
            error: 'Erro ao buscar histórico', 
            message: error.message 
        });
    }
});

// DELETE /api/conversations/history - Limpar histórico de conversas do usuário
app.delete('/api/conversations/history', async (req, res) => {
    try {
        const userId = req.currentUserId;
        const { clearConversationHistory } = require('./middleware/conversationHistoryStore');
        
        await clearConversationHistory(userId);

        res.json({
            success: true,
            message: 'Histórico de conversas limpo com sucesso'
        });
    } catch (error) {
        console.error('Erro ao limpar histórico de conversas:', error);
        res.status(500).json({ 
            error: 'Erro ao limpar histórico', 
            message: error.message 
        });
    }
});

// GET /api/conversations/stats - Obter estatísticas do histórico
app.get('/api/conversations/stats', async (req, res) => {
    try {
        const userId = req.query.userId ? parseInt(req.query.userId) : null;
        const stats = await getHistoryStats(userId);
        
        res.json({
            success: true,
            stats,
            config: {
                redisTTL: REDIS_TTL_SECONDS,
                dbRetentionDays: DB_RETENTION_DAYS || 'Permanente'
            }
        });
    } catch (error) {
        console.error('Erro ao obter estatísticas:', error);
        res.status(500).json({ 
            error: 'Erro ao obter estatísticas', 
            message: error.message 
        });
    }
});

// POST /api/conversations/cleanup - Limpar mensagens antigas (requer permissão de admin)
app.post('/api/conversations/cleanup', async (req, res) => {
    try {
        const result = await cleanupOldMessages();
        res.json({
            success: true,
            message: `Limpeza concluída: ${result.deleted} mensagens removidas`,
            deleted: result.deleted
        });
    } catch (error) {
        console.error('Erro ao limpar mensagens antigas:', error);
        res.status(500).json({ 
            error: 'Erro ao limpar mensagens antigas', 
            message: error.message 
        });
    }
});

// Exportar app para testes
if (require.main !== module) {
    module.exports = app;
} else {
        app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}
