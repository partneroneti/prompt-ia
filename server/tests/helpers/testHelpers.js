const db = require('../../db');
const profileHelper = require('../../helpers/profileHelper');
const rbacHelper = require('../../helpers/rbacHelper');

/**
 * Helpers para testes
 */

/**
 * Limpar dados de teste
 */
async function cleanTestData() {
    try {
        // Remover perfis de teste primeiro (FK constraint)
        await db.query(
            `DELETE FROM tb_usuario_perfil 
             WHERE id_usuario IN (SELECT id_usuario FROM tb_usuario WHERE str_login LIKE 'test_%' OR str_login LIKE 'test.%')`
        );
        
        // Remover usuários de teste (que começam com 'test_')
        await db.query(
            `DELETE FROM tb_usuario WHERE str_login LIKE 'test_%' OR str_login LIKE 'test.%'`
        );
        console.log('✅ Dados de teste limpos');
    } catch (error) {
        console.warn('⚠️ Erro ao limpar dados de teste:', error.message);
    }
}

/**
 * Criar usuário de teste
 */
async function createTestUser(data = {}) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    const defaultData = {
        name: 'Test User',
        login: `test_${timestamp}_${random}`, // Login único
        email: `test_${timestamp}_${random}@test.com`, // Email único
        cpf: `${timestamp.toString().slice(-11).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`, // CPF único baseado em timestamp
        company: 'Partner', // Usar empresa que existe
        profile: 'OPERACIONAL'
    };

    const userData = { ...defaultData, ...data };

    // Buscar id_operacao da empresa/operação
    let operationId = 1; // Default
    if (userData.company) {
        const operationLookup = await db.query(
            `SELECT id_operacao FROM tb_operacao WHERE UPPER(str_descricao) = UPPER($1) LIMIT 1`,
            [userData.company]
        );
        operationId = operationLookup.rows[0]?.id_operacao || 1;
    }

    // Criar usuário via query direta (para testes)
    const result = await db.query(
        `INSERT INTO tb_usuario (str_descricao, str_login, email, str_cpf, str_ativo, bloqueado, id_operacao, id_grupo)
         VALUES ($1, $2, $3, $4, 'A', false, $5, 1)
         RETURNING id_usuario, str_descricao, str_login, email, str_cpf`,
        [userData.name, userData.login, userData.email, userData.cpf, operationId]
    );

    // Associar perfil se fornecido
    if (userData.profile) {
        const profile = await profileHelper.getProfileByName(userData.profile);
        if (profile) {
            await profileHelper.assignProfile(result.rows[0].id_usuario, profile.id_perfil, 1);
        }
    }

    return { ...result.rows[0], cpf: userData.cpf };
}

/**
 * Criar perfil de teste
 */
async function createTestProfile(name, operationId = null) {
    // Buscar id_operacao se não fornecido
    let finalOperationId = operationId;
    if (!finalOperationId) {
        const operationLookup = await db.query(
            `SELECT id_operacao FROM tb_operacao WHERE str_ativo = 'A' LIMIT 1`
        );
        finalOperationId = operationLookup.rows[0]?.id_operacao || 1;
    }

    const result = await db.query(
        `INSERT INTO tb_perfil (str_descricao, str_ativo, id_operacao)
         VALUES ($1, 'A', $2)
         ON CONFLICT DO NOTHING
         RETURNING id_perfil, str_descricao, id_operacao`,
        [name, finalOperationId]
    );

    if (result.rows.length === 0) {
        // Se já existe, buscar
        return await profileHelper.getProfileByName(name);
    }

    return result.rows[0];
}

/**
 * Criar role de teste
 */
async function createTestRole(name) {
    const result = await db.query(
        `INSERT INTO tb_role (str_descricao, str_ativo)
         VALUES ($1, 'A')
         ON CONFLICT DO NOTHING
         RETURNING id_role, str_descricao`,
        [name]
    );

    if (result.rows.length === 0) {
        // Se já existe, buscar
        const roleResult = await db.query(
            `SELECT id_role, str_descricao FROM tb_role WHERE str_descricao = $1`,
            [name]
        );
        return roleResult.rows[0] || null;
    }

    return result.rows[0];
}

/**
 * Associar role a perfil
 */
async function assignRoleToProfile(profileId, roleId) {
    await db.query(
        `INSERT INTO tb_perfil_role (id_perfil, id_role, str_ativo)
         VALUES ($1, $2, 'A')
         ON CONFLICT DO NOTHING`,
        [profileId, roleId]
    );
}

/**
 * Buscar usuário MASTER para testes
 */
async function getMasterUser() {
    const result = await db.query(
        `SELECT u.id_usuario, u.str_descricao, u.str_login
         FROM tb_usuario u
         JOIN tb_usuario_perfil up ON u.id_usuario = up.id_usuario
         JOIN tb_perfil p ON up.id_perfil = p.id_perfil
         WHERE UPPER(p.str_descricao) = 'MASTER'
           AND u.str_ativo = 'A'
           AND u.bloqueado = false
         LIMIT 1`
    );

    return result.rows[0] || null;
}

/**
 * Verificar se usuário tem role
 */
async function userHasRole(userId, roleName) {
    return await rbacHelper.hasRole(userId, roleName);
}

module.exports = {
    cleanTestData,
    createTestUser,
    createTestProfile,
    createTestRole,
    assignRoleToProfile,
    getMasterUser,
    userHasRole
};
