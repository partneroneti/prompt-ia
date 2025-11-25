const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/operations - Listar todas as operações ativas
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT id_operacao, str_descricao, str_documento, str_ativo, config 
             FROM tb_operacao 
             WHERE str_ativo = 'A' 
             ORDER BY str_descricao`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar operações:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/operations/stats - Estatísticas de operações
router.get('/stats', async (req, res) => {
    try {
        // Total de operações ativas
        const totalOps = await db.query("SELECT COUNT(*) as count FROM tb_operacao WHERE str_ativo = 'A'");

        // Distribuição de usuários por operação (Top 10)
        const userDist = await db.query(
            `SELECT o.str_descricao as name, COUNT(u.id_usuario) as value
             FROM tb_operacao o
             LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao AND u.str_ativo = 'A'
             WHERE o.str_ativo = 'A'
             GROUP BY o.id_operacao, o.str_descricao
             HAVING COUNT(u.id_usuario) > 0
             ORDER BY value DESC
             LIMIT 10`
        );

        res.json({
            totalActive: parseInt(totalOps.rows[0].count),
            userDistribution: userDist.rows
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas de operações:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/operations/:id/users - Listar usuários de uma operação
router.get('/:id/users', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await db.query(
            `SELECT id_usuario, str_descricao, str_login, email, str_ativo
             FROM tb_usuario
             WHERE id_operacao = $1 AND str_ativo = 'A'
             ORDER BY str_descricao`,
            [id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar usuários da operação:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
