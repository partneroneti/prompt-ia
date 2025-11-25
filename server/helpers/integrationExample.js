/**
 * INTEGRATION EXAMPLE: Using Phase 1 Helpers in Conversational AI
 * 
 * This file demonstrates how to integrate the helper modules into 
 * the AI conversation handler (server/index.js or services/openai.js)
 */

// Import all helpers
const profileHelper = require('./helpers/profileHelper');
const entityHelper = require('./helpers/entityHelper');
const dateHelper = require('./helpers/dateHelper');
const rbacHelper = require('./helpers/rbacHelper');

// ============================================
// Example 1: Profile Management Commands
// ============================================

/**
 * Handle: "Mude o perfil do João para OPERACIONAL"
 * Handle: "Qual perfil do usuário Maria?"
 */
async function handleProfileCommand(args) {
    const { userId, profileName, action } = args;

    if (action === 'CHANGE') {
        // Find the target profile
        const targetProfile = await profileHelper.getProfileByName(profileName);

        if (!targetProfile) {
            return {
                type: 'ERROR',
                message: `Perfil "${profileName}" não encontrado.`
            };
        }

        // Change user profile
        const result = await profileHelper.changeUserProfile(
            userId,
            targetProfile.id_perfil,
            0 // Current user ID (should come from auth)
        );

        return {
            type: 'ACTION_COMPLETE',
            message: `Perfil do usuário alterado para ${profileName} com sucesso!`,
            data: result
        };
    }

    if (action === 'GET') {
        // Get user's current profiles
        const profiles = await profileHelper.getUserProfiles(userId);

        if (profiles.length === 0) {
            return {
                type: 'TEXT',
                content: 'Usuário não possui perfis atribuídos.'
            };
        }

        const profileList = profiles.map(p => p.str_descricao).join(', ');
        return {
            type: 'TEXT',
            content: `Perfis do usuário: ${profileList}`
        };
    }
}

// ============================================
// Example 2: Entity-Based Queries
// ============================================

/**
 * Handle: "Mostre usuários da empresa XPTO"
 * Handle: "Quantos usuários temos por empresa?"
 */
async function handleEntityQuery(args) {
    const { entityName, action } = args;

    if (action === 'LIST_USERS') {
        // Find entity (fuzzy search)
        const entity = await entityHelper.getEntityByName(entityName);

        if (!entity) {
            return {
                type: 'ERROR',
                message: `Empresa "${entityName}" não encontrada.`
            };
        }

        // Get all users from this entity
        const users = await entityHelper.getUsersByEntity(entity.id_entidade);

        if (users.length === 0) {
            return {
                type: 'TEXT',
                content: `A empresa ${entity.str_descricao} não possui usuários cadastrados.`
            };
        }

        const userList = users.map(u => `- ${u.name} (${u.login})`).join('\n');
        return {
            type: 'TEXT',
            content: `Usuários da empresa ${entity.str_descricao} (${users.length}):\n${userList}`
        };
    }

    if (action === 'COUNT_BY_ENTITY') {
        // Get user distribution by entity
        const distribution = await entityHelper.getUserCountByEntity();

        const distList = distribution.map(d =>
            `- ${d.entity_name}: ${d.user_count} usuário${d.user_count > 1 ? 's' : ''}`
        ).join('\n');

        return {
            type: 'TEXT',
            content: `Distribuição de usuários por empresa:\n${distList}`
        };
    }
}

// ============================================
// Example 3: Date-Filtered Queries
// ============================================

/**
 * Handle: "Mostre usuários criados nos últimos 7 dias"
 * Handle: "Usuários editados ontem"
 * Handle: "Listar alterações entre 01/11 e 15/11"
 */
async function handleDateFilteredQuery(args, db) {
    const { dateExpression, field } = args; // field: 'created' or 'modified'

    // Parse natural language date
    let startDate, endDate;

    // Try parsing as range first
    const range = dateHelper.parseDateRange(dateExpression);
    if (range) {
        startDate = range.start;
        endDate = range.end;
    } else {
        // Parse as single date
        const singleDate = dateHelper.parseNaturalDate(dateExpression);
        if (!singleDate) {
            return {
                type: 'ERROR',
                message: `Não consegui entender a data "${dateExpression}".`
            };
        }
        startDate = singleDate;
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(singleDate);
        endDate.setHours(23, 59, 59, 999);
    }

    // Convert to PostgreSQL format
    const startPg = dateHelper.toPostgresDate(startDate);
    const endPg = dateHelper.toPostgresDate(endDate);

    // Build query
    const dateField = field === 'created' ? 'dh_inclui' : 'dh_edita';
    const query = `
        SELECT 
            id_usuario as id,
            str_descricao as name,
            str_login as login,
            email,
            dh_edita as last_modified
        FROM tb_usuario
        WHERE ${dateField}::date BETWEEN $1 AND $2
          AND str_ativo = 'A'
        ORDER BY ${dateField} DESC
        LIMIT 100
    `;

    const result = await db.query(query, [startPg, endPg]);

    if (result.rows.length === 0) {
        return {
            type: 'TEXT',
            content: `Nenhum usuário encontrado entre ${dateHelper.formatBRDate(startDate)} e ${dateHelper.formatBRDate(endDate)}.`
        };
    }

    const userList = result.rows.map(u => {
        const relativeTime = dateHelper.getRelativeTime(new Date(u.last_modified));
        return `- ${u.name} (modificado ${relativeTime})`;
    }).join('\n');

    return {
        type: 'TEXT',
        content: `Usuários entre ${dateHelper.formatBRDate(startDate)} e ${dateHelper.formatBRDate(endDate)} (${result.rows.length}):\n${userList}`
    };
}

// ============================================
// Example 4: RBAC Permission Checks
// ============================================

/**
 * Middleware to check permissions before executing actions
 */
async function checkPermissionBeforeAction(currentUserId, action, resource, targetUserId = null) {
    // Check if user can perform the action
    const canPerform = await rbacHelper.canPerformAction(currentUserId, action, resource);

    if (!canPerform) {
        return {
            allowed: false,
            message: `Você não tem permissão para ${action.toLowerCase()} ${resource.toLowerCase()}.`
        };
    }

    // If targeting another user, check hierarchy
    if (targetUserId) {
        const canManage = await rbacHelper.canManageUser(currentUserId, targetUserId);

        if (!canManage) {
            return {
                allowed: false,
                message: 'Você não tem permissão hierárquica para gerenciar este usuário.'
            };
        }
    }

    return { allowed: true };
}

/**
 * Handle: "Tenho permissão para criar usuários?"
 * Handle: "Mostre minhas permissões"
 */
async function handlePermissionQuery(args) {
    const { userId, action } = args;

    if (action === 'CHECK') {
        const { permission, resource } = args;
        const hasPermission = await rbacHelper.canPerformAction(userId, permission, resource);

        return {
            type: 'TEXT',
            content: hasPermission
                ? `✅ Sim, você tem permissão para ${permission.toLowerCase()} ${resource.toLowerCase()}.`
                : `❌ Não, você não tem permissão para ${permission.toLowerCase()} ${resource.toLowerCase()}.`
        };
    }

    if (action === 'GET_SUMMARY') {
        const summary = await rbacHelper.getPermissionSummary(userId);

        const response = [
            '🔐 Resumo de Permissões',
            '─────────────────────────',
            `Status: ${summary.is_master ? '👑 MASTER (todas permissões)' : 'Usuário regular'}`,
            '',
            `Perfis: ${summary.profiles.join(', ')}`,
            '',
            `Permissões:`,
            `  - Criar usuário: ${summary.can_create_user ? '✅' : '❌'}`,
            `  - Editar usuário: ${summary.can_update_user ? '✅' : '❌'}`,
            `  - Excluir usuário: ${summary.can_delete_user ? '✅' : '❌'}`,
            '',
            `Roles (${summary.roles.length}):`,
            ...summary.roles.map(r => `  - ${r}`)
        ].join('\n');

        return {
            type: 'TEXT',
            content: response
        };
    }
}

// ============================================
// Integration into main chat handler
// ============================================

/**
 * Add this to your /api/chat endpoint in server/index.js
 */
async function enhancedChatHandler(message, currentUserId, db) {
    // ... existing OpenAI processing ...

    // After getting AI tool call, add permission check
    if (toolCall.function.name === 'blockUser') {
        const { user_id } = JSON.parse(toolCall.function.arguments);

        // Check permission using RBAC helper
        const permCheck = await checkPermissionBeforeAction(
            currentUserId,
            'UPDATE',
            'USER',
            user_id
        );

        if (!permCheck.allowed) {
            return {
                type: 'ERROR',
                message: permCheck.message
            };
        }

        // Proceed with blocking...
    }

    // Add new tool handlers
    if (toolCall.function.name === 'changeUserProfile') {
        return await handleProfileCommand(JSON.parse(toolCall.function.arguments));
    }

    if (toolCall.function.name === 'getUsersByEntity') {
        return await handleEntityQuery(JSON.parse(toolCall.function.arguments));
    }

    if (toolCall.function.name === 'queryUsersByDate') {
        return await handleDateFilteredQuery(JSON.parse(toolCall.function.arguments), db);
    }

    if (toolCall.function.name === 'checkPermission') {
        return await handlePermissionQuery(JSON.parse(toolCall.function.arguments));
    }
}

// ============================================
// New OpenAI Function Definitions to Add
// ============================================

const newFunctionDefinitions = [
    {
        name: 'changeUserProfile',
        description: 'Muda o perfil de um usuário',
        parameters: {
            type: 'object',
            properties: {
                userId: { type: 'number', description: 'ID do usuário' },
                profileName: { type: 'string', description: 'Nome do novo perfil (MASTER, OPERACIONAL, etc)' },
                action: { type: 'string', enum: ['CHANGE', 'GET'] }
            },
            required: ['userId', 'action']
        }
    },
    {
        name: 'getUsersByEntity',
        description: 'Busca usuários de uma empresa/entidade específica',
        parameters: {
            type: 'object',
            properties: {
                entityName: { type: 'string', description: 'Nome da empresa/entidade' },
                action: { type: 'string', enum: ['LIST_USERS', 'COUNT_BY_ENTITY'] }
            },
            required: ['action']
        }
    },
    {
        name: 'queryUsersByDate',
        description: 'Busca usuários filtrados por data de criação ou modificação',
        parameters: {
            type: 'object',
            properties: {
                dateExpression: {
                    type: 'string',
                    description: 'Expressão de data em português (hoje, ontem, últimos 7 dias, entre 01/11 e 15/11, etc)'
                },
                field: {
                    type: 'string',
                    enum: ['created', 'modified'],
                    description: 'Campo de data para filtrar'
                }
            },
            required: ['dateExpression', 'field']
        }
    },
    {
        name: 'checkPermission',
        description: 'Verifica permissões do usuário ou mostra resumo de permissões',
        parameters: {
            type: 'object',
            properties: {
                userId: { type: 'number', description: 'ID do usuário' },
                action: { type: 'string', enum: ['CHECK', 'GET_SUMMARY'] },
                permission: { type: 'string', description: 'Permissão para verificar (CREATE, UPDATE, DELETE)' },
                resource: { type: 'string', description: 'Recurso (USER, PROFILE, etc)' }
            },
            required: ['userId', 'action']
        }
    }
];

// ============================================
// Export for use
// ============================================

module.exports = {
    handleProfileCommand,
    handleEntityQuery,
    handleDateFilteredQuery,
    handlePermissionQuery,
    checkPermissionBeforeAction,
    enhancedChatHandler,
    newFunctionDefinitions
};
