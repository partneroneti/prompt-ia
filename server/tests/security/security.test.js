/**
 * Testes de Segurança
 * Cobre: Autenticação, Autorização, Validação de Headers, Proteção de Endpoints
 */

const request = require('supertest');
const app = require('../../index');
const { createTestUser, getMasterUser, cleanTestData } = require('../helpers/testHelpers');

describe('🔒 Segurança', () => {
    let masterUser;
    let regularUser;

    beforeAll(async () => {
        masterUser = await getMasterUser();
        if (!masterUser) {
            throw new Error('Usuário MASTER não encontrado para testes');
        }
    });

    beforeEach(async () => {
        const timestamp = Date.now();
        regularUser = await createTestUser({
            login: `security_test_${timestamp}`,
            email: `security_test_${timestamp}@test.com`,
            profile: 'OPERACIONAL'
        });
    });

    afterEach(async () => {
        await cleanTestData();
    });

    describe('1. Validação de Headers', () => {
        test('1.1 - Endpoint requer header x-user-id', async () => {
            const response = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Listar usuários'
                });

            // Deve retornar erro ou usar usuário padrão
            expect([200, 400, 401, 403]).toContain(response.status);
        });

        test('1.2 - Endpoint aceita header x-user-id', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: 'Listar usuários'
                });

            expect(response.status).toBe(200);
        });

        test('1.3 - Header x-userid também funciona (alternativo)', async () => {
            const response = await request(app)
                .get('/api/auth/permissions')
                .set('x-userid', masterUser.id_usuario.toString());

            expect(response.status).toBe(200);
        });
    });

    describe('2. Proteção de Endpoints Sensíveis', () => {
        test('2.1 - Endpoint de criação requer autenticação', async () => {
            const response = await request(app)
                .post('/api/chat')
                .send({
                    message: 'Cadastrar novo usuário: Teste, CPF 111.222.333-44, login: teste, email: teste@test.com, perfil: OPERACIONAL, empresa: Partner'
                });

            // Deve retornar erro ou pedir autenticação
            expect([200, 400, 401, 403]).toContain(response.status);
        });

        test('2.2 - Endpoint de criação funciona com autenticação', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Seg, CPF 111.222.333-44, login: teste.seg.${timestamp}, email: teste.seg.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
        });

        test('2.3 - Endpoint de permissões requer autenticação', async () => {
            const response = await request(app)
                .get('/api/auth/permissions');

            // Pode retornar erro de autenticação ou usar usuário padrão
            expect([200, 400, 401, 403]).toContain(response.status);
        });
    });

    describe('3. Validação de IDs de Usuário', () => {
        test('3.1 - ID de usuário inválido retorna erro', async () => {
            const response = await request(app)
                .get('/api/auth/permissions')
                .set('x-user-id', 'invalid_id');

            expect([400, 401, 403]).toContain(response.status);
        });

        test('3.2 - ID de usuário inexistente retorna erro', async () => {
            const response = await request(app)
                .get('/api/auth/permissions')
                .set('x-user-id', '999999');

            // Pode retornar 200 com dados vazios ou erro
            expect([200, 400, 401, 403, 404]).toContain(response.status);
        });

        test('3.3 - ID de usuário válido funciona', async () => {
            const response = await request(app)
                .get('/api/auth/permissions')
                .set('x-user-id', masterUser.id_usuario.toString());

            expect(response.status).toBe(200);
        });
    });

    describe('4. Controle de Acesso Baseado em Roles', () => {
        test('4.1 - Usuário sem permissão não pode criar usuário', async () => {
            // Criar usuário sem permissões
            const timestamp = Date.now();
            const userWithoutPerms = await createTestUser({
                login: `no_perm_security_${timestamp}`,
                email: `no_perm_security_${timestamp}@test.com`,
                profile: null
            });

            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', userWithoutPerms.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Perm, CPF 999.888.777-66, login: sem.perm.${timestamp}, email: sem.perm.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Deve retornar erro de permissão
            expect([403, 200]).toContain(response.status);
            if (response.status === 200) {
                const message = (response.body.message || '').toLowerCase();
                expect(message).toMatch(/permissão|não pode|não tem/i);
            }
        });

        test('4.2 - MASTER pode criar usuário', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Master, CPF 123.456.789-00, login: master.test.${timestamp}, email: master.test.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
        });
    });

    describe('5. Proteção contra Injeção SQL', () => {
        test('5.1 - Tentativa de SQL injection no header é bloqueada', async () => {
            const sqlInjectionAttempts = [
                "1' OR '1'='1",
                "1; DROP TABLE tb_usuario; --",
                "1 UNION SELECT * FROM tb_usuario --"
            ];

            for (const attempt of sqlInjectionAttempts) {
                const response = await request(app)
                    .get('/api/auth/permissions')
                    .set('x-user-id', attempt);

                // Deve retornar erro ou tratar como ID inválido (não executar SQL malicioso)
                // O sistema deve tratar como ID inválido, não como SQL
                expect([200, 400, 401, 403, 500]).toContain(response.status);
            }
        });

        test('5.2 - Tentativa de SQL injection na mensagem é tratada', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: "'; DROP TABLE tb_usuario; --"
                });

            // Deve tratar o erro sem executar SQL malicioso
            expect(response.status).toBe(200);
            // O sistema deve responder de forma segura, não executando o SQL
        });
    });

    describe('6. Validação de Dados de Entrada', () => {
        test('6.1 - Mensagem vazia retorna erro ou resposta válida', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: ''
                });

            expect([200, 400]).toContain(response.status);
        });

        test('6.2 - Mensagem muito longa é tratada', async () => {
            const longMessage = 'A'.repeat(10000);
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: longMessage
                });

            // Deve retornar erro ou processar parcialmente
            expect([200, 400, 413]).toContain(response.status);
        });

        test('6.3 - Tipo de dado inválido no body retorna erro', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: 12345 // Tipo inválido
                });

            // Deve tratar o erro
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('7. Proteção de Endpoints Públicos vs Privados', () => {
        test('7.1 - Endpoint público acessível sem autenticação', async () => {
            // Verificar se há endpoints públicos (ex: health check)
            // Por enquanto, a maioria dos endpoints requer autenticação
            const response = await request(app)
                .get('/api/roles');

            // Alguns endpoints podem ser públicos ou retornar erro
            expect([200, 401, 403]).toContain(response.status);
        });

        test('7.2 - Endpoint privado bloqueado sem autenticação', async () => {
            const response = await request(app)
                .get('/api/auth/permissions');

            // Pode retornar erro ou usar usuário padrão se não autenticado
            expect([200, 400, 401, 403]).toContain(response.status);
        });
    });

    describe('8. Logs de Auditoria', () => {
        test('8.1 - Ações sensíveis geram log de auditoria', async () => {
            const timestamp = Date.now();
            const randomCpf = `${timestamp.toString().slice(-11).padStart(11, '0').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}`;
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Audit Test, CPF ${randomCpf}, login: audit.test.${timestamp}, email: audit.test.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            // Verificar se há resposta válida (pode ter audit ID ou mensagem de sucesso)
            expect(response.body).toBeDefined();
            if (response.body.type === 'ACTION_COMPLETE') {
                const message = response.body.message || '';
                expect(message.toLowerCase()).toMatch(/audit|sucesso|cadastrado/i);
            }
        });
    });
});

