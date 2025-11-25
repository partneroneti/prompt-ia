const db = require('../db');

/**
 * Profile Helper Functions
 * Manages user profiles and permissions
 */

/**
 * Find profile by name (case-insensitive)
 * @param {string} name - Profile name (e.g., "MASTER", "OPERACIONAL")
 * @returns {Promise<Object|null>} Profile object or null
 */
async function getProfileByName(name) {
    try {
        const result = await db.query(
            `SELECT id_perfil, str_descricao, id_operacao 
             FROM tb_perfil 
             WHERE UPPER(str_descricao) = UPPER($1) AND str_ativo = 'A'
             LIMIT 1`,
            [name]
        );
        return result.rows[0] || null;
    } catch (error) {
        console.error('Error in getProfileByName:', error);
        throw error;
    }
}

/**
 * Get all user's profiles
 * @param {number} userId - User ID
 * @returns {Promise<Array>} Array of profile objects
 */
async function getUserProfiles(userId) {
    try {
        const result = await db.query(
            `SELECT p.id_perfil, p.str_descricao, up.id as user_profile_id
             FROM tb_usuario_perfil up
             JOIN tb_perfil p ON up.id_perfil = p.id_perfil
             WHERE up.id_usuario = $1 AND up.str_ativo = 'A'`,
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getUserProfiles:', error);
        throw error;
    }
}

/**
 * Get user's primary (first) profile
 * @param {number} userId - User ID
 * @returns {Promise<Object|null>} Primary profile or null
 */
async function getPrimaryProfile(userId) {
    const profiles = await getUserProfiles(userId);
    return profiles.length > 0 ? profiles[0] : null;
}

/**
 * Assign profile to user
 * @param {number} userId - User ID
 * @param {number} profileId - Profile ID
 * @param {number} createdBy - ID of user creating the assignment
 * @returns {Promise<Object>} Created user_profile record
 */
async function assignProfile(userId, profileId, createdBy = 0) {
    try {
        // Check if already assigned
        const existing = await db.query(
            `SELECT id FROM tb_usuario_perfil 
             WHERE id_usuario = $1 AND id_perfil = $2 AND str_ativo = 'A'`,
            [userId, profileId]
        );

        if (existing.rows.length > 0) {
            return { already_exists: true, id: existing.rows[0].id };
        }

        // Assign new profile
        const result = await db.query(
            `INSERT INTO tb_usuario_perfil (id_usuario, id_perfil, id_usuarioinclui, str_ativo)
             VALUES ($1, $2, $3, 'A')
             RETURNING id, id_usuario, id_perfil`,
            [userId, profileId, createdBy]
        );

        return result.rows[0];
    } catch (error) {
        console.error('Error in assignProfile:', error);
        throw error;
    }
}

/**
 * Remove profile from user (soft delete)
 * @param {number} userId - User ID
 * @param {number} profileId - Profile ID
 * @returns {Promise<boolean>} Success status
 */
async function removeProfile(userId, profileId) {
    try {
        const result = await db.query(
            `UPDATE tb_usuario_perfil 
             SET str_ativo = 'E', dh_edita = NOW()
             WHERE id_usuario = $1 AND id_perfil = $2 AND str_ativo = 'A'
             RETURNING id`,
            [userId, profileId]
        );

        return result.rowCount > 0;
    } catch (error) {
        console.error('Error in removeProfile:', error);
        throw error;
    }
}

/**
 * Change user's profile (removes old, assigns new)
 * @param {number} userId - User ID
 * @param {number} newProfileId - New profile ID
 * @param {number} modifiedBy - ID of user making the change
 * @returns {Promise<Object>} Result object
 */
async function changeUserProfile(userId, newProfileId, modifiedBy = 0) {
    try {
        // Get current profiles
        const currentProfiles = await getUserProfiles(userId);

        // Remove all current profiles
        for (const profile of currentProfiles) {
            await removeProfile(userId, profile.id_perfil);
        }

        // Assign new profile
        const result = await assignProfile(userId, newProfileId, modifiedBy);

        return {
            success: true,
            removed_count: currentProfiles.length,
            new_profile_id: newProfileId
        };
    } catch (error) {
        console.error('Error in changeUserProfile:', error);
        throw error;
    }
}

/**
 * Get all available profiles
 * @returns {Promise<Array>} Array of all active profiles
 */
async function getAllProfiles() {
    try {
        const result = await db.query(
            `SELECT id_perfil, str_descricao, id_operacao
             FROM tb_perfil
             WHERE str_ativo = 'A'
             ORDER BY str_descricao`
        );
        return result.rows;
    } catch (error) {
        console.error('Error in getAllProfiles:', error);
        throw error;
    }
}

module.exports = {
    getProfileByName,
    getUserProfiles,
    getPrimaryProfile,
    assignProfile,
    removeProfile,
    changeUserProfile,
    getAllProfiles
};
