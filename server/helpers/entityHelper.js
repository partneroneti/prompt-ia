const db = require('../db');

/**
 * Entity/Company Helper Functions
 * Manages entities (companies/partners/correspondentes)
 */

/**
 * Find entity by name (case-insensitive, partial match)
 * @param {string} name - Entity name
 * @returns {Promise<Object|null>} Entity object or null
 */
async function getEntityByName(name) {
    try {
        const result = await db.query(
            `SELECT id_entidade, str_descricao, str_documento, id_tipo
             FROM tb_entidade
             WHERE UPPER(str_descricao) LIKE UPPER($1) AND str_ativo = 'A'
             ORDER BY 
                CASE 
                    WHEN UPPER(str_descricao) = UPPER($2) THEN 1
                    WHEN UPPER(str_descricao) LIKE UPPER($2) || '%' THEN 2
                    ELSE 3
                END
             LIMIT 1`,
            [`%${name}%`, name]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error in getEntityByName:', error);
        throw error;
    }
}

/**
 * Get all users from a specific entity/company
 * @param {number} entityId - Entity ID
 * @returns {Promise<Array>} Array of users
 */
async function getUsersByEntity(entityId) {
    try {
        const result = await db.query(
            `SELECT 
                id_usuario as id,
                str_descricao as name,
                str_login as login,
                email,
                str_cpf as cpf,
                bloqueado,
                CASE WHEN bloqueado = true THEN 'BLOQUEADO' ELSE 'ATIVO' END as status
             FROM tb_usuario
             WHERE id_entidade = $1 AND str_ativo = 'A'
             ORDER BY str_descricao`,
            [entityId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getUsersByEntity:', error);
        throw error;
    }
}

/**
 * Update user's entity/company
 * @param {number} userId - User ID
 * @param {number} entityId - New entity ID
 * @returns {Promise<Object>} Updated user record
 */
async function updateUserEntity(userId, entityId) {
    try {
        const result = await db.query(
            `UPDATE tb_usuario 
             SET id_entidade = $1, dh_edita = NOW()
             WHERE id_usuario = $2
             RETURNING id_usuario as id, str_descricao as name, id_entidade`,
            [entityId, userId]
        );

        if (result.rowCount === 0) {
            throw new Error(`User with ID ${userId} not found`);
        }

        return result.rows[0];
    } catch (error) {
        console.error('Error in updateUserEntity:', error);
        throw error;
    }
}

/**
 * Get all active entities
 * @returns {Promise<Array>} Array of entities
 */
async function getAllEntities() {
    try {
        const result = await db.query(
            `SELECT id_entidade, str_descricao, str_documento, id_tipo
             FROM tb_entidade
             WHERE str_ativo = 'A'
             ORDER BY str_descricao
             LIMIT 100`
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getAllEntities:', error);
        throw error;
    }
}

/**
 * Count users by entity
 * @returns {Promise<Array>} Array of {entity_name, user_count}
 */
async function getUserCountByEntity() {
    try {
        const result = await db.query(
            `SELECT 
                e.str_descricao as entity_name,
                e.id_entidade,
                COUNT(u.id_usuario) as user_count
             FROM tb_entidade e
             LEFT JOIN tb_usuario u ON e.id_entidade = u.id_entidade AND u.str_ativo = 'A'
             WHERE e.str_ativo = 'A'
             GROUP BY e.id_entidade, e.str_descricao
             HAVING COUNT(u.id_usuario) > 0
             ORDER BY user_count DESC, e.str_descricao`
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getUserCountByEntity:', error);
        throw error;
    }
}

module.exports = {
    getEntityByName,
    getUsersByEntity,
    updateUserEntity,
    getAllEntities,
    getUserCountByEntity
};
