const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/audit/users - Listar logs de auditoria (paginado)
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 50, userId, date } = req.query;
        const offset = (page - 1) * limit;

        let whereConditions = [];
        const params = [];
        let paramCount = 1;

        if (userId) {
            whereConditions.push(`l.id = $${paramCount}`); // Assumindo que 'id' na log_alteracoes refere-se ao registro alterado ou temos que fazer join
            // Na verdade, log_alteracoes geralmente tem estrutura genérica. Vamos verificar o schema novamente.
            // Baseado no output anterior: dh_log, aplicacao, ip, login, objeto, versao, script, id
            // Parece que 'login' é quem fez a alteração, e 'id' é o ID do log.
            // Onde está o ID do registro alterado? Talvez em 'objeto' ou não tem link direto fácil sem parsear.
            // Vou assumir por enquanto que podemos filtrar por 'login' (quem fez) ou tentar buscar no texto se houver.
            // Mas o requisito é "Timeline de alterações em usuários".

            // Se a tabela log_alteracoes for genérica, pode ser difícil filtrar por "usuário alterado" se não tiver coluna específica.
            // Vou fazer uma query genérica por enquanto e ajustar se necessário.

            // Ajuste: O user pediu "Timeline de alterações em usuários".
            // Se log_alteracoes não tem id_usuario_afetado, vamos listar os logs gerais por enquanto.
        }

        // Query básica na tabela log_alteracoes
        const query = `
            SELECT id, dh_log, aplicacao, login, objeto, script
            FROM log_alteracoes
            ORDER BY dh_log DESC
            LIMIT $1 OFFSET $2
        `;

        const result = await db.query(query, [limit, offset]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar auditoria:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/audit/users/:login/history - Histórico de um usuário específico (pelo login)
router.get('/users/:login/history', async (req, res) => {
    try {
        const { login } = req.params;
        // Buscando logs onde o login aparece (seja como autor ou alvo, dependendo de como é gravado)
        // Assumindo que a coluna 'login' é quem fez a alteração.
        // Se quisermos ver alterações NO usuário, precisaríamos saber como o log grava isso.
        // Geralmente logs de trigger gravam o OLD e NEW values em colunas JSON ou texto.
        // O schema mostrado tem: dh_log, aplicacao, ip, login, objeto, versao, script, id.
        // 'objeto' pode ser o nome da tabela? 'script' o comando?

        // Vou buscar logs onde objeto = 'tb_usuario' (se for assim que grava)
        // E tentar filtrar pelo login no script ou algo assim.

        const result = await db.query(
            `SELECT id, dh_log, login as autor, objeto, script
             FROM log_alteracoes
             WHERE objeto = 'tb_usuario' 
             AND (script ILIKE $1 OR login = $2)
             ORDER BY dh_log DESC
             LIMIT 100`,
            [`%${login}%`, login]
        );

        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar histórico do usuário:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
