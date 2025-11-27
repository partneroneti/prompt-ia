/**
 * Configuração global para testes
 */

// Carregar variáveis de ambiente de teste
require('dotenv').config({ path: '../.env' });

// Mock do console para reduzir ruído nos testes
global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
};

// Timeout padrão aumentado para testes de API
jest.setTimeout(30000);
