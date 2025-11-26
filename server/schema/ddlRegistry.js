/**
 * DDL Registry - agora carregado de variáveis de ambiente para evitar
 * exposição do esquema completo do banco no repositório.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const ENV_CANDIDATES = [
    process.env.ROOT_ENV_PATH,
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '.env')
].filter(Boolean);

let envLoaded = false;
for (const candidate of ENV_CANDIDATES) {
    if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    dotenv.config(); // tenta variáveis já presentes no ambiente
}

let registryCache = null;

function decodeRegistryFromEnv() {
    const base64Payload = process.env.DDL_REGISTRY_BASE64;
    const jsonPayload = process.env.DDL_REGISTRY_JSON;

    if (base64Payload) {
        const decoded = Buffer.from(base64Payload, 'base64').toString('utf-8');
        return JSON.parse(decoded);
    }

    if (jsonPayload) {
        return JSON.parse(jsonPayload);
    }

    throw new Error(
        'DDL registry não configurado. Defina DDL_REGISTRY_BASE64 ou DDL_REGISTRY_JSON no .env'
    );
}

function getRegistry() {
    if (!registryCache) {
        registryCache = decodeRegistryFromEnv();
    }

    return registryCache;
}

/**
 * Retorna o DDL completo de uma tabela específica
 * @param {string} tableName - Nome da tabela
 * @returns {string|null} - DDL da tabela ou null se não encontrada
 */
function getDDL(tableName) {
    const registry = getRegistry();
    return registry[tableName] || null;
}

/**
 * Retorna os DDLs de múltiplas tabelas
 * @param {string[]} tableNames - Array de nomes de tabelas
 * @returns {string} - DDLs concatenados das tabelas solicitadas
 */
function getDDLs(tableNames = []) {
    if (!Array.isArray(tableNames)) {
        return '';
    }

    return tableNames
        .map(tableName => getDDL(tableName))
        .filter(Boolean)
        .join('\n\n');
}

function clearRegistryCache() {
    registryCache = null;
}

module.exports = {
    getDDL,
    getDDLs,
    clearRegistryCache
};
