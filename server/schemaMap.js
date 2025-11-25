// Mapeamento entre o schema esperado e o schema real do banco
const SCHEMA_MAP = {
    table: 'tb_usuario',
    columns: {
        id: 'id_usuario',
        name: 'str_descricao',
        login: 'str_login',
        email: 'email',
        cpf: 'str_cpf',
        status: 'str_ativo', // 'S' = ATIVO, 'N' = BLOQUEADO
        blocked: 'bloqueado',
        lastModified: 'dh_edita'
    }
};

// Helper para construir queries adaptadas
const buildUserQuery = (filters = {}) => {
    let query = `SELECT 
    id_usuario as id,
    str_descricao as name,
    str_login as login,
    email,
    str_cpf as cpf,
    CASE WHEN bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status,
    dh_edita as last_modified
  FROM tb_usuario WHERE 1=1`;

    const params = [];
    let paramCount = 1;

    if (filters.status) {
        if (filters.status === 'ATIVO') {
            query += ` AND bloqueado = false`;
        } else if (filters.status === 'BLOQUEADO') {
            query += ` AND bloqueado = true`;
        }
    }

    if (filters.company) {
        // Se houver filtro de empresa, adaptar conforme necessário
        // Por enquanto, ignoramos pois não há coluna de empresa
    }

    query += ' ORDER BY dh_edita DESC NULLS LAST';

    return { query, params };
};

module.exports = { SCHEMA_MAP, buildUserQuery };
