const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/groups - Listar todos os grupos
router.get('/', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT g.id_grupo, g.str_descricao, g.ordem, g.excecao, g.str_observacao, 
                    o.str_descricao as nome_operacao
             FROM tb_grupo g
             LEFT JOIN tb_operacao o ON g.id_operacao = o.id_operacao
             WHERE g.str_ativo = 'A'
             ORDER BY g.ordem, g.str_descricao`
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar grupos:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/groups/stats - Estatísticas de grupos
router.get('/stats', async (req, res) => {
    try {
        // Total de grupos
        const totalGroups = await db.query("SELECT COUNT(*) as count FROM tb_grupo WHERE str_ativo = 'A'");

        // Grupos de exceção
        const exceptionGroups = await db.query("SELECT COUNT(*) as count FROM tb_grupo WHERE str_ativo = 'A' AND excecao = true");

        // Usuários por grupo (Top 10)
        const userDist = await db.query(
            `SELECT g.str_descricao as name, COUNT(u.id_usuario) as value
             FROM tb_grupo g
             LEFT JOIN tb_usuario u ON g.id_grupo = u.id_grupo AND u.str_ativo = 'A'
             WHERE g.str_ativo = 'A'
             GROUP BY g.id_grupo, g.str_descricao
             HAVING COUNT(u.id_usuario) > 0
             ORDER BY value DESC
             LIMIT 10`
        );

        res.json({
            totalGroups: parseInt(totalGroups.rows[0].count),
            exceptionGroups: parseInt(exceptionGroups.rows[0].count),
            userDistribution: userDist.rows
        });
    } catch (err) {
        console.error('Erro ao buscar estatísticas de grupos:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

// GET /api/groups/by-operation/:operationId - Grupos de uma operação
router.get('/by-operation/:operationId', async (req, res) => {
    try {
        const { operationId } = req.params;
        const result = await db.query(
            `SELECT id_grupo, str_descricao, ordem, excecao
             FROM tb_grupo
             WHERE id_operacao = $1 AND str_ativo = 'A'
             ORDER BY ordem, str_descricao`,
            [operationId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar grupos da operação:', err);
        res.status(500).json({ error: 'Erro interno do servidor' });
    }
});

module.exports = router;
