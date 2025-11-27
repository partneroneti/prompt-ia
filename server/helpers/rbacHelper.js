const db = require('../db');

/**
 * RBAC (Role-Based Access Control) Helper Functions
 * Validates user permissions based on profiles and roles
 */

/**
 * Check if user has a specific role
 * @param {number} userId - User ID
 * @param {string} roleName - Role name (e.g., "USER_CREATE", "USER_DELETE")
 * @returns {Promise<boolean>} True if user has the role
 */
async function hasRole(userId, roleName) {
    try {
        const result = await db.query(
            `SELECT COUNT(*) as count
             FROM tb_usuario_perfil up
             JOIN tb_perfil_role pr ON up.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE up.id_usuario = $1 
               AND up.str_ativo = 'A'
               AND UPPER(r.str_descricao) = UPPER($2)
               AND r.str_ativo = 'A'`,
            [userId, roleName]
        );

        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        console.error('Error in hasRole:', error);
        return false;
    }
}

/**
 * Check if user has ANY of the specified roles
 * @param {number} userId - User ID
 * @param {Array<string>} roleNames - Array of role names
 * @returns {Promise<boolean>} True if user has at least one role
 */
async function hasAnyRole(userId, roleNames) {
    try {
        const result = await db.query(
            `SELECT COUNT(*) as count
             FROM tb_usuario_perfil up
             JOIN tb_perfil_role pr ON up.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE up.id_usuario = $1 
               AND up.str_ativo = 'A'
               AND UPPER(r.str_descricao) = ANY($2::text[])
               AND r.str_ativo = 'A'`,
            [userId, roleNames.map(r => r.toUpperCase())]
        );

        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        console.error('Error in hasAnyRole:', error);
        return false;
    }
}

/**
 * Check if user has ALL specified roles
 * @param {number} userId - User ID
 * @param {Array<string>} roleNames - Array of role names
 * @returns {Promise<boolean>} True if user has all roles
 */
async function hasAllRoles(userId, roleNames) {
    try {
        const result = await db.query(
            `SELECT COUNT(DISTINCT r.str_descricao) as count
             FROM tb_usuario_perfil up
             JOIN tb_perfil_role pr ON up.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE up.id_usuario = $1 
               AND up.str_ativo = 'A'
               AND UPPER(r.str_descricao) = ANY($2::text[])
               AND r.str_ativo = 'A'`,
            [userId, roleNames.map(r => r.toUpperCase())]
        );

        return parseInt(result.rows[0].count) === roleNames.length;
    } catch (error) {
        console.error('Error in hasAllRoles:', error);
        return false;
    }
}

/**
 * Get all roles for a user
 * @param {number} userId - User ID
 * @returns {Promise<Array<string>>} Array of role names
 */
async function getUserRoles(userId) {
    try {
        const result = await db.query(
            `SELECT DISTINCT r.str_descricao as role_name
             FROM tb_usuario_perfil up
             JOIN tb_perfil_role pr ON up.id_perfil = pr.id_perfil
             JOIN tb_role r ON pr.id_role = r.id_role
             WHERE up.id_usuario = $1 
               AND up.str_ativo = 'A'
               AND r.str_ativo = 'A'
             ORDER BY r.str_descricao`,
            [userId]
        );

        return result.rows.map(row => row.role_name);
    } catch (error) {
        console.error('Error in getUserRoles:', error);
        return [];
    }
}

/**
 * Check if user has access to a specific menu item
 * @param {number} userId - User ID
 * @param {string} menuPath - Menu path or identifier
 * @returns {Promise<boolean>} True if user has access
 */
async function hasMenuAccess(userId, menuPath) {
    try {
        const result = await db.query(
            `SELECT COUNT(*) as count
             FROM tb_usuario_perfil up
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             JOIN tb_menu m ON p.id_operacao = m.id_operacao
             WHERE up.id_usuario = $1
               AND up.str_ativo = 'A'
               AND (m.str_path = $2 OR m.str_descricao = $2)
               AND m.str_ativo = 'A'`,
            [userId, menuPath]
        );

        return parseInt(result.rows[0].count) > 0;
    } catch (error) {
        console.error('Error in hasMenuAccess:', error);
        return false;
    }
}

/**
 * Check if user is a MASTER profile (highest permission level)
 * @param {number} userId - User ID
 * @returns {Promise<boolean>} True if user has MASTER profile
 */
async function isMaster(userId) {
    try {
        const result = await db.query(
            `SELECT COUNT(*) as count
             FROM tb_usuario_perfil up
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             WHERE up.id_usuario = $1
               AND (up.str_ativo = 'A' OR up.str_ativo IS NULL)
               AND UPPER(p.str_descricao) = 'MASTER'
               AND p.str_ativo = 'A'`,
            [userId]
        );

        const isMasterUser = parseInt(result.rows[0].count) > 0;
        console.log(`[RBAC] isMaster(${userId}) = ${isMasterUser}`);
        return isMasterUser;
    } catch (error) {
        console.error('Error in isMaster:', error);
        return false;
    }
}

/**
 * Check if user can manage another user (based on hierarchy)
 * @param {number} managerId - Manager user ID
 * @param {number} targetUserId - Target user ID
 * @returns {Promise<boolean>} True if manager can manage target user
 */
async function canManageUser(managerId, targetUserId) {
    try {
        // Masters can manage anyone
        if (await isMaster(managerId)) {
            return true;
        }

        // Get both users' operation and group
        const result = await db.query(
            `SELECT 
                (SELECT id_operacao FROM tb_usuario WHERE id_usuario = $1) as manager_op,
                (SELECT id_grupo FROM tb_usuario WHERE id_usuario = $1) as manager_group,
                (SELECT id_operacao FROM tb_usuario WHERE id_usuario = $2) as target_op,
                (SELECT id_grupo FROM tb_usuario WHERE id_usuario = $2) as target_group`,
            [managerId, targetUserId]
        );

        const { manager_op, manager_group, target_op, target_group } = result.rows[0];

        // Must be in same operation
        if (manager_op !== target_op) {
            return false;
        }

        // Check group hierarchy (lower ordem value = higher hierarchy)
        const groupResult = await db.query(
            `SELECT 
                (SELECT ordem FROM tb_grupo WHERE id_grupo = $1) as manager_ordem,
                (SELECT ordem FROM tb_grupo WHERE id_grupo = $2) as target_ordem`,
            [manager_group, target_group]
        );

        const { manager_ordem, target_ordem } = groupResult.rows[0];

        // Manager must have lower or equal ordem (higher or equal hierarchy)
        return manager_ordem <= target_ordem;
    } catch (error) {
        console.error('Error in canManageUser:', error);
        return false;
    }
}

/**
 * Check if user can perform an action (simplified permission check)
 * @param {number} userId - User ID
 * @param {string} action - Action name (CREATE, READ, UPDATE, DELETE, MANAGE)
 * @param {string} resource - Resource type (USER, PROFILE, ENTITY, etc.)
 * @returns {Promise<boolean>} True if user can perform action
 */
async function canPerformAction(userId, action, resource) {
    // Masters can do anything
    const isMasterUser = await isMaster(userId);
    if (isMasterUser) {
        console.log(`[RBAC] Usuário ${userId} é MASTER - permissão ${action}/${resource} GRANTED`);
        return true;
    }

    // Mapeamento de ações para roles do banco (formato brasileiro)
    const roleMapping = {
        'USER': {
            'CREATE': ['USER_CREATE', 'USUARIO/SAVE', 'USUARIO/CREATE'],
            'UPDATE': ['USER_UPDATE', 'USUARIO/EDICAO', 'USUARIO/SAVE'],
            'DELETE': ['USER_DELETE', 'USUARIO/EXCLUIR'],
            'BLOCK': ['USER_BLOCK', 'USUARIO/BLOQUEIO'],
            'RESET': ['USER_RESET', 'USUARIO/RESET_SENHA'],
            'READ': ['USER_READ', 'USUARIO/CONSULT']
        },
        'PROFILE': {
            'UPDATE': ['PROFILE_UPDATE', 'PERFIL/SAVE'],
            'CREATE': ['PROFILE_CREATE', 'PERFIL/SAVE'],
            'DELETE': ['PROFILE_DELETE', 'PERFIL/EXCLUIR']
        }
    };

    const resourceUpper = resource.toUpperCase();
    const actionUpper = action.toUpperCase();

    // Buscar roles possíveis para esta ação
    const possibleRoles = roleMapping[resourceUpper]?.[actionUpper] || [];
    
    // Adicionar formato padrão também (ex: USER_CREATE)
    const defaultRole = `${resourceUpper}_${actionUpper}`;
    if (!possibleRoles.includes(defaultRole)) {
        possibleRoles.push(defaultRole);
    }

    // Verificar se o usuário tem alguma das roles possíveis
    for (const roleName of possibleRoles) {
        const hasRoleResult = await hasRole(userId, roleName);
        if (hasRoleResult) {
            console.log(`[RBAC] Usuário ${userId} - permissão ${action}/${resource} (${roleName}): GRANTED`);
            return true;
        }
    }
    
    console.log(`[RBAC] Usuário ${userId} - permissão ${action}/${resource} (roles tentadas: ${possibleRoles.join(', ')}): DENIED`);
    return false;
}

/**
 * Get user's permission summary
 * @param {number} userId - User ID
 * @returns {Promise<Object>} Permission summary object
 */
async function getPermissionSummary(userId) {
    try {
        const [roles, profiles, isMasterUser] = await Promise.all([
            getUserRoles(userId),
            getUserProfiles(userId),
            isMaster(userId)
        ]);

        return {
            user_id: userId,
            is_master: isMasterUser,
            profiles: profiles.map(p => p.str_descricao),
            roles: roles,
            can_create_user: await canPerformAction(userId, 'CREATE', 'USER'),
            can_update_user: await canPerformAction(userId, 'UPDATE', 'USER'),
            can_delete_user: await canPerformAction(userId, 'DELETE', 'USER')
        };
    } catch (error) {
        console.error('Error in getPermissionSummary:', error);
        return null;
    }
}

/**
 * Helper to get user profiles (imported from profileHelper concept)
 */
async function getUserProfiles(userId) {
    try {
        const result = await db.query(
            `SELECT p.id_perfil, p.str_descricao
             FROM tb_usuario_perfil up
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             WHERE up.id_usuario = $1 AND p.str_ativo = 'A'`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getUserProfiles:', error);
        return [];
    }
}

module.exports = {
    hasRole,
    hasAnyRole,
    hasAllRoles,
    getUserRoles,
    hasMenuAccess,
    isMaster,
    canManageUser,
    canPerformAction,
    getPermissionSummary
};
