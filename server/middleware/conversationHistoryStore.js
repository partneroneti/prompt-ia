// Redis store for conversation history + Database persistence
const redis = require('redis');
const db = require('../db');

// Criar cliente Redis (com fallback para Map em memória se Redis não estiver disponível)
let redisClient = null;
let memoryStore = new Map(); // Fallback em memória

// Tentar conectar ao Redis
const initRedis = async () => {
    try {
        redisClient = redis.createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379',
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > 3) {
                        console.log('[REDIS] Máximo de tentativas de reconexão atingido, usando store em memória');
                        return false; // Parar tentativas
                    }
                    return Math.min(retries * 100, 3000); // Esperar até 3 segundos
                }
            }
        });

        redisClient.on('error', (err) => {
            console.warn('[REDIS] Erro no cliente Redis:', err.message);
            console.log('[REDIS] Usando store em memória como fallback');
            redisClient = null;
        });

        redisClient.on('connect', () => {
            console.log('[REDIS] Conectado ao Redis com sucesso');
        });

        await redisClient.connect();
        console.log('[REDIS] Cliente Redis inicializado');
    } catch (error) {
        console.warn('[REDIS] Não foi possível conectar ao Redis:', error.message);
        console.log('[REDIS] Usando store em memória como fallback');
        redisClient = null;
    }
};

// Configurações de retenção (podem ser configuradas via variáveis de ambiente)
// Padrão: Redis 24 horas, Banco de Dados permanente
const REDIS_TTL_SECONDS = parseInt(process.env.REDIS_HISTORY_TTL_SECONDS) || (24 * 60 * 60); // Padrão: 24 horas (86400 segundos)
const DB_RETENTION_DAYS = parseInt(process.env.DB_HISTORY_RETENTION_DAYS) || null; // null = permanente (sem limpeza)

// Log da configuração de retenção
console.log('[HISTORY] 📋 Configuração de retenção:');
console.log(`[HISTORY]   - Redis TTL: ${REDIS_TTL_SECONDS} segundos (${Math.round(REDIS_TTL_SECONDS / 60)} minutos)`);
console.log(`[HISTORY]   - DB Retention: ${DB_RETENTION_DAYS ? `${DB_RETENTION_DAYS} dias` : 'Permanente (sem limpeza automática)'}`);

// Inicializar Redis na inicialização do módulo
initRedis();

/**
 * Obter histórico de conversa de um usuário
 * Prioridade: Redis > Memória > Banco de Dados
 * @param {number} userId - ID do usuário
 * @param {number} limit - Limite de mensagens (padrão: 20)
 * @returns {Promise<Array>} - Array de mensagens do histórico
 */
const getConversationHistory = async (userId, limit = 20) => {
    try {
        console.log(`[HISTORY] Buscando histórico para user ${userId}, limit: ${limit}`);
        
        // Tentar obter do Redis primeiro
        if (redisClient && redisClient.isOpen) {
            const key = `conversation:${userId}`;
            const historyJson = await redisClient.get(key);
            if (historyJson) {
                const history = JSON.parse(historyJson);
                console.log(`[HISTORY] ✅ Histórico encontrado no Redis: ${history.length} mensagens`);
                return history.slice(-limit);
            } else {
                console.log(`[HISTORY] ⚠️ Histórico não encontrado no Redis para user ${userId}`);
            }
        } else {
            // Fallback para memória
            const memoryHistory = memoryStore.get(`conversation:${userId}`);
            if (memoryHistory) {
                console.log(`[HISTORY] ✅ Histórico encontrado na memória: ${memoryHistory.length} mensagens`);
                return memoryHistory.slice(-limit);
            } else {
                console.log(`[HISTORY] ⚠️ Histórico não encontrado na memória para user ${userId}`);
            }
        }

        // Se não encontrou no Redis/memória, buscar no banco de dados
        try {
            console.log(`[HISTORY] 🔍 Buscando histórico no banco de dados para user ${userId}`);
            const result = await db.query(
                `SELECT role, content, created_at 
                 FROM conversation_history 
                 WHERE user_id = $1 
                 ORDER BY created_at DESC 
                 LIMIT $2`,
                [userId, limit]
            );
            
            console.log(`[HISTORY] 📊 Resultado do banco: ${result.rows.length} mensagens encontradas`);
            
            if (result.rows.length > 0) {
                // Converter para formato esperado e inverter ordem (mais antigo primeiro)
                const history = result.rows.reverse().map(row => ({
                    role: row.role,
                    content: row.content
                }));
                
                console.log(`[HISTORY] ✅ Histórico recuperado do banco: ${history.length} mensagens`);
                console.log(`[HISTORY] Primeiras mensagens:`, history.slice(0, 2).map(m => `${m.role}: ${m.content?.substring(0, 30)}...`));
                
                // Atualizar cache Redis/memória com dados do banco
                await saveConversationHistory(userId, history);
                return history;
            } else {
                console.log(`[HISTORY] ⚠️ Nenhuma mensagem encontrada no banco para user ${userId}`);
            }
        } catch (dbError) {
            console.error('[DB] ❌ Erro ao buscar histórico do banco:', dbError.message);
            console.error('[DB] Stack:', dbError.stack);
        }

        console.log(`[HISTORY] ⚠️ Retornando histórico vazio para user ${userId}`);
        return [];
    } catch (error) {
        console.error('[HISTORY] ❌ Erro ao obter histórico:', error);
        console.error('[HISTORY] Stack:', error.stack);
        return [];
    }
};

/**
 * Salvar histórico de conversa de um usuário
 * Salva tanto no Redis (cache) quanto no Banco de Dados (persistência)
 * @param {number} userId - ID do usuário
 * @param {Array} history - Array de mensagens do histórico
 * @param {number} ttl - Time to live em segundos para Redis (usa REDIS_TTL_SECONDS se não especificado)
 */
const saveConversationHistory = async (userId, history, ttl = REDIS_TTL_SECONDS) => {
    try {
        // Limitar histórico a 20 mensagens (10 pares user/assistant)
        const limitedHistory = history.slice(-20);
        
        // Salvar no Redis (cache rápido)
        if (redisClient && redisClient.isOpen) {
            const key = `conversation:${userId}`;
            await redisClient.setEx(key, ttl, JSON.stringify(limitedHistory));
        } else {
            // Fallback para memória
            memoryStore.set(`conversation:${userId}`, limitedHistory);
        }

        // Salvar no Banco de Dados (persistência permanente)
        // Salvar apenas as últimas mensagens que ainda não estão no banco (últimos 30 segundos para evitar duplicatas)
        try {
            console.log(`[HISTORY] 💾 Salvando ${limitedHistory.length} mensagens no banco para user ${userId}`);
            
            // Buscar últimas mensagens salvas no banco para este usuário (últimos 30 segundos para evitar duplicatas)
            const recentMessages = await db.query(
                `SELECT role, content FROM conversation_history 
                 WHERE user_id = $1 
                 AND created_at > NOW() - INTERVAL '30 seconds'
                 ORDER BY created_at DESC`,
                [userId]
            );

            console.log(`[HISTORY] 📊 Mensagens recentes no banco (últimos 30s): ${recentMessages.rows.length}`);

            let savedCount = 0;
            let skippedCount = 0;
            // Salvar apenas mensagens novas (não duplicar nos últimos 30 segundos)
            for (const message of limitedHistory) {
                const isDuplicate = recentMessages.rows.some(row => 
                    row.content === message.content && 
                    row.role === message.role
                );

                if (!isDuplicate) {
                    await db.query(
                        `INSERT INTO conversation_history (user_id, role, content) 
                         VALUES ($1, $2, $3)`,
                        [userId, message.role, message.content]
                    );
                    savedCount++;
                } else {
                    skippedCount++;
                }
            }
            
            console.log(`[HISTORY] ✅ ${savedCount} mensagens novas salvas, ${skippedCount} duplicadas ignoradas para user ${userId}`);
        } catch (dbError) {
            console.error('[DB] ❌ Erro ao salvar histórico no banco:', dbError.message);
            console.error('[DB] Stack:', dbError.stack);
            // Não falhar se o banco der erro, apenas logar
        }
    } catch (error) {
        console.error('[HISTORY] Erro ao salvar histórico:', error);
        // Fallback para memória
        const limitedHistory = history.slice(-20);
        memoryStore.set(`conversation:${userId}`, limitedHistory);
    }
};

/**
 * Adicionar mensagem ao histórico de conversa
 * @param {number} userId - ID do usuário
 * @param {Object} message - Mensagem a adicionar { role: 'user'|'assistant', content: string }
 * @returns {Promise<Array>} - Histórico atualizado
 */
const addMessageToHistory = async (userId, message) => {
    try {
        const history = await getConversationHistory(userId);
        history.push(message);
        await saveConversationHistory(userId, history);
        return history;
    } catch (error) {
        console.error('[REDIS] Erro ao adicionar mensagem:', error);
        return [];
    }
};

/**
 * Limpar histórico de conversa de um usuário
 * Limpa tanto do Redis quanto do Banco de Dados
 * @param {number} userId - ID do usuário
 */
const clearConversationHistory = async (userId) => {
    try {
        // Limpar do Redis
        if (redisClient && redisClient.isOpen) {
            const key = `conversation:${userId}`;
            await redisClient.del(key);
        } else {
            memoryStore.delete(`conversation:${userId}`);
        }

        // Limpar do Banco de Dados (opcional - comentado para manter histórico permanente)
        // await db.query('DELETE FROM conversation_history WHERE user_id = $1', [userId]);
    } catch (error) {
        console.error('[HISTORY] Erro ao limpar histórico:', error);
        memoryStore.delete(`conversation:${userId}`);
    }
};

/**
 * Obter histórico completo de um usuário do banco de dados
 * @param {number} userId - ID do usuário
 * @param {number} limit - Limite de mensagens (padrão: 50)
 * @param {Date} startDate - Data inicial (opcional)
 * @param {Date} endDate - Data final (opcional)
 * @returns {Promise<Array>} - Array de mensagens do histórico
 */
const getFullConversationHistory = async (userId, limit = 50, startDate = null, endDate = null) => {
    try {
        let query = `
            SELECT role, content, created_at 
            FROM conversation_history 
            WHERE user_id = $1
        `;
        const params = [userId];
        let paramCount = 1;

        if (startDate) {
            paramCount++;
            query += ` AND created_at >= $${paramCount}`;
            params.push(startDate);
        }

        if (endDate) {
            paramCount++;
            query += ` AND created_at <= $${paramCount}`;
            params.push(endDate);
        }

        query += ` ORDER BY created_at DESC LIMIT $${paramCount + 1}`;
        params.push(limit);

        const result = await db.query(query, params);
        
        return result.rows.reverse().map(row => ({
            role: row.role,
            content: row.content,
            created_at: row.created_at
        }));
    } catch (error) {
        console.error('[DB] Erro ao buscar histórico completo:', error);
        return [];
    }
};

/**
 * Limpar mensagens antigas do banco de dados (baseado em DB_RETENTION_DAYS)
 * Esta função pode ser chamada periodicamente (ex: via cron job)
 */
const cleanupOldMessages = async () => {
    if (!DB_RETENTION_DAYS || DB_RETENTION_DAYS <= 0) {
        console.log('[HISTORY] Limpeza automática desabilitada (DB_RETENTION_DAYS não configurado)');
        return { deleted: 0 };
    }

    try {
        const result = await db.query(
            `DELETE FROM conversation_history 
             WHERE created_at < NOW() - INTERVAL '${DB_RETENTION_DAYS} days'`
        );
        
        console.log(`[HISTORY] 🗑️ Limpeza automática: ${result.rowCount} mensagens antigas removidas (mais de ${DB_RETENTION_DAYS} dias)`);
        return { deleted: result.rowCount };
    } catch (error) {
        console.error('[HISTORY] ❌ Erro ao limpar mensagens antigas:', error);
        return { deleted: 0, error: error.message };
    }
};

/**
 * Obter estatísticas do histórico
 */
const getHistoryStats = async (userId = null) => {
    try {
        let query = 'SELECT COUNT(*) as total, MIN(created_at) as oldest, MAX(created_at) as newest FROM conversation_history';
        const params = [];
        
        if (userId) {
            query += ' WHERE user_id = $1';
            params.push(userId);
        }
        
        const result = await db.query(query, params);
        const stats = result.rows[0];
        
        return {
            total: parseInt(stats.total),
            oldest: stats.oldest,
            newest: stats.newest,
            retentionDays: DB_RETENTION_DAYS || 'Permanente',
            redisTTL: `${REDIS_TTL_SECONDS}s (${Math.round(REDIS_TTL_SECONDS / 60)} minutos)`
        };
    } catch (error) {
        console.error('[HISTORY] Erro ao obter estatísticas:', error);
        return null;
    }
};

module.exports = {
    getConversationHistory,
    saveConversationHistory,
    addMessageToHistory,
    clearConversationHistory,
    getFullConversationHistory,
    cleanupOldMessages,
    getHistoryStats,
    initRedis,
    // Exportar configurações para referência
    REDIS_TTL_SECONDS,
    DB_RETENTION_DAYS
};

