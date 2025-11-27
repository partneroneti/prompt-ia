/**
 * Mapeamento de Roles para Funcionalidades do Sistema
 * Este arquivo mapeia as roles do banco de dados para as funcionalidades disponíveis no sistema
 */

// Mapeamento de roles para funcionalidades/menus
export const ROLE_MAPPING = {
    // Menu Dashboard
    'DASHBOARD': ['dashboard', 'menu/dashboard'],
    'MENU/DASHBOARD': ['dashboard', 'menu/dashboard'],
    
    // Menu Usuários
    'USUARIO': ['users', 'menu/usuario'],
    'MENU/USUARIO': ['users', 'menu/usuario'],
    'MENU/USUARIO/LISTA': ['users', 'menu/usuario/lista'],
    'USUARIO/SAVE': ['users.create', 'users.edit'],
    'USUARIO/EDICAO': ['users.edit'],
    'USUARIO/CONSULT': ['users.view'],
    'USUARIO/BLOQUEIO': ['users.block', 'users.unblock'],
    'USUARIO/RESET_SENHA': ['users.reset_password'],
    
    // Menu Operações
    'MENU/EMPRESA': ['operations', 'menu/empresa'],
    'MENU/EMPRESA/LISTA': ['operations', 'menu/empresa/lista'],
    
    // Menu Grupos (não há role específica, usar operações)
    'MENU/EMPRESA': ['groups'],
    
    // Menu Relatórios
    'RELATORIO': ['reports', 'menu/relatorio'],
    'MENU/RELATORIO': ['reports', 'menu/relatorio'],
    'RELATORIO/CONSULTAR': ['reports.view'],
    'RELATORIO/EXPORTAR': ['reports.export'],
    
    // Menu Auditoria (geralmente disponível para todos logados)
    'SISTEMA/AUTENTICACAO': ['audit'],
    
    // Menu Prompt Manager (geralmente apenas para admins)
    'MENU/CONFIGURACAO': ['prompt-manager'],
    
    // Funcionalidades específicas
    'PROPOSTA/CONSULTA CLIENTE': ['proposals.view'],
    'CONSULTA PROPOSTA/CPF': ['proposals.view'],
    'CONSULTA PROPOSTA/NOME': ['proposals.view'],
    
    // Entidades
    'ENTIDADE/CONSULTA': ['entities.view'],
    'ENTIDADE/LISTA': ['entities.view'],
    'ENTIDADE/SALVAR': ['entities.create', 'entities.edit'],
    'MENU/EMPRESA': ['entities'],
};

/**
 * Verifica se o usuário tem acesso a uma funcionalidade
 * @param {Array<string>} userRoles - Lista de roles do usuário
 * @param {boolean} isMaster - Se o usuário é MASTER
 * @param {string|Array<string>} requiredFeature - Funcionalidade ou array de funcionalidades requeridas
 * @returns {boolean}
 */
export function hasAccess(userRoles = [], isMaster = false, requiredFeature) {
    // MASTER tem acesso a tudo
    if (isMaster) {
        return true;
    }

    // Se não há roles, não tem acesso
    if (!userRoles || userRoles.length === 0) {
        return false;
    }

    // Normalizar roles para uppercase
    const normalizedRoles = userRoles.map(role => role.toUpperCase());

    // Se requiredFeature é array, verificar se tem acesso a pelo menos uma
    const features = Array.isArray(requiredFeature) ? requiredFeature : [requiredFeature];

    // Para cada funcionalidade requerida
    for (const feature of features) {
        // Verificar diretamente nas roles
        if (normalizedRoles.includes(feature.toUpperCase())) {
            return true;
        }

        // Verificar no mapeamento
        for (const [role, roleFeatures] of Object.entries(ROLE_MAPPING)) {
            if (normalizedRoles.includes(role.toUpperCase())) {
                if (roleFeatures.includes(feature) || roleFeatures.some(f => feature.startsWith(f))) {
                    return true;
                }
            }
        }
    }

    return false;
}

/**
 * Verifica se o usuário tem qualquer uma das roles especificadas
 * @param {Array<string>} userRoles - Lista de roles do usuário
 * @param {boolean} isMaster - Se o usuário é MASTER
 * @param {Array<string>} requiredRoles - Lista de roles requeridas
 * @returns {boolean}
 */
export function hasAnyRole(userRoles = [], isMaster = false, requiredRoles = []) {
    if (isMaster) return true;
    if (!userRoles || userRoles.length === 0) return false;
    
    const normalizedUserRoles = userRoles.map(r => r.toUpperCase());
    const normalizedRequired = requiredRoles.map(r => r.toUpperCase());
    
    return normalizedRequired.some(role => normalizedUserRoles.includes(role));
}

/**
 * Mapeamento simplificado de menus para roles
 */
export const MENU_PERMISSIONS = {
    dashboard: {
        roles: ['DASHBOARD', 'MENU/DASHBOARD', 'SISTEMA/AUTENTICACAO'],
        default: true // Disponível por padrão para usuários logados
    },
    operations: {
        roles: ['MENU/EMPRESA', 'MENU/EMPRESA/LISTA', 'ENTIDADE/CONSULTA', 'ENTIDADE/LISTA'],
        default: false
    },
    groups: {
        roles: ['MENU/EMPRESA', 'MENU/EMPRESA/LISTA'],
        default: false
    },
    audit: {
        roles: ['SISTEMA/AUTENTICACAO'],
        default: true // Disponível por padrão para usuários logados
    },
    reports: {
        roles: ['RELATORIO', 'MENU/RELATORIO', 'RELATORIO/CONSULTAR'],
        default: false
    },
    'prompt-manager': {
        roles: ['MENU/CONFIGURACAO', 'MENU/CONFIGURACAO/OPERACAO'],
        default: true // Disponível para todos os usuários logados
    }
};

/**
 * Verifica se o usuário pode acessar um menu específico
 * @param {Array<string>} userRoles - Lista de roles do usuário
 * @param {boolean} isMaster - Se o usuário é MASTER
 * @param {string} menuPath - Caminho do menu (ex: 'dashboard', 'users')
 * @returns {boolean}
 */
export function canAccessMenu(userRoles = [], isMaster = false, menuPath) {
    if (isMaster) return true;

    // Prompt Manager é sempre acessível para usuários logados
    if (menuPath === 'prompt-manager') {
        return true;
    }

    const menu = MENU_PERMISSIONS[menuPath];
    if (!menu) return false;

    // Se é default, permite acesso
    if (menu.default) return true;

    // Verifica se tem alguma das roles necessárias
    return hasAnyRole(userRoles, false, menu.roles);
}
