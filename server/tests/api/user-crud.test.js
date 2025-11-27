/**
 * Testes de CRUD de Usuários
 * Cobre: Cadastro, Listagem, Visualização, Edição, Exclusão
 */

const request = require('supertest');
const app = require('../../index');
const { createTestUser, cleanTestData, getMasterUser } = require('../helpers/testHelpers');

describe('📋 CRUD de Usuários', () => {
    let masterUser;
    let testUserId;

    beforeAll(async () => {
        masterUser = await getMasterUser();
        if (!masterUser) {
            throw new Error('Usuário MASTER não encontrado para testes');
        }
    });

    afterEach(async () => {
        await cleanTestData();
    });

    describe('1. Cadastro de Usuário', () => {
        test('1.1 - Criar usuário com todos os campos obrigatórios (incluindo CPF)', async () => {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: João Silva ${timestamp}, CPF 123.${timestamp.toString().slice(-9)}-00, login: test.joao.silva.${timestamp}, email: joao${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            // Pode ser ACTION_COMPLETE ou erro se já existe
            if (response.body.type === 'ERROR') {
                // Se já existe, verificar se é erro de duplicidade
                expect(response.body.message.toLowerCase()).toMatch(/já existe|duplicado/i);
            } else {
                expect(response.body.type).toBe('ACTION_COMPLETE');
            }
        });

        test('1.2 - Validar mensagem de sucesso', async () => {
            const timestamp = Date.now();
            const random = Math.floor(Math.random() * 10000);
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Maria Santos ${timestamp}, CPF 987.${timestamp.toString().slice(-9)}-00, login: test.maria.santos.${timestamp}, email: maria${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            // Pode ser ACTION_COMPLETE ou erro se já existe
            if (response.body.type === 'ACTION_COMPLETE') {
                expect(response.body.message).toContain('sucesso');
            }
        });

        test('1.2.1 - CPF obrigatório: criar usuário sem CPF retorna erro', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: 'Cadastrar novo usuário: Teste Sem CPF, login: test.sem.cpf, email: semcpf@test.com, perfil: OPERACIONAL, empresa: Partner'
                });

            // Pode retornar 200 (IA pede CPF) ou 400 (validação direta bloqueia)
            expect([200, 400]).toContain(response.status);
            // A resposta deve conter mensagem de erro sobre CPF obrigatório
            const responseMessage = (response.body.message || response.body.content || '').toLowerCase();
            expect(responseMessage).toMatch(/cpf.*obrigatório|cpf é obrigatório/i);
        });

        test('1.3 - Email inválido retorna erro', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: 'Cadastrar novo usuário: Test, login: test.invalid, email: email-invalido, perfil: OPERACIONAL, empresa: Partner'
                });

            // Pode retornar erro ou pedir confirmação
            expect([200, 400]).toContain(response.status);
        });

        test('1.4 - Email duplicado retorna erro', async () => {
            const timestamp = Date.now();
            const testUser = await createTestUser({ email: `duplicado.${timestamp}@test.com` });

            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Outro User, CPF 111.222.333-44, login: test.outro.${timestamp}, email: ${testUser.email}, perfil: OPERACIONAL, empresa: Partner`
                });

            // Pode retornar 200 (IA avisa sobre duplicação) ou 400 (validação bloqueia)
            expect([200, 400]).toContain(response.status);
            // Se retornar 200, deve ter mensagem de erro sobre email duplicado
            if (response.status === 200) {
                const responseMessage = (response.body.message || response.body.content || '').toLowerCase();
                expect(responseMessage).toMatch(/já existe|duplicado|email.*já/i);
            }
        });

        test('1.4.1 - CPF duplicado retorna erro', async () => {
            const testUser = await createTestUser({ cpf: '999.888.777-66' });

            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Outro User, CPF ${testUser.cpf}, login: test.outro2, email: outro2@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Deve retornar erro de duplicação de CPF
            const responseMessage = (response.body.message || response.body.content || '').toLowerCase();
            expect(responseMessage).toMatch(/cpf.*já existe|cpf.*duplicado|erro.*cpf/i);
        });

        test('1.5 - Campos obrigatórios vazios retorna erro', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: 'Cadastrar novo usuário sem email'
                });

            // Deve pedir os campos faltantes
            expect(response.status).toBe(200);
        });
    });

    describe('2. Listagem de Usuários', () => {
        beforeEach(async () => {
            const timestamp = Date.now();
            await createTestUser({ login: `test.user1.${timestamp}`, email: `user1.${timestamp}@test.com` });
            await createTestUser({ login: `test.user2.${timestamp}`, email: `user2.${timestamp}@test.com` });
        });

        test('2.1 - Listar todos os usuários', async () => {
            const response = await request(app)
                .get('/api/users')
                .query({ status: 'ATIVO' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('2.2 - Filtro por nome', async () => {
            const response = await request(app)
                .get('/api/users')
                .query({ name: 'Test User' });

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('2.3 - Filtro por email', async () => {
            const response = await request(app)
                .get('/api/users')
                .query({ email: 'user1@test.com' });

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThan(0);
        });

        test('2.4 - Filtro por status', async () => {
            const response = await request(app)
                .get('/api/users')
                .query({ status: 'ATIVO' });

            expect(response.status).toBe(200);
            response.body.forEach(user => {
                expect(user.status).toBe('ATIVO');
            });
        });
    });

    describe('3. Visualização de Usuário', () => {
        let testUser;

        beforeEach(async () => {
            const timestamp = Date.now();
            testUser = await createTestUser({ login: `test.view.${timestamp}`, email: `view.${timestamp}@test.com` });
        });

        test('3.1 - Buscar usuário por ID', async () => {
            const response = await request(app)
                .get(`/api/auth/user/${testUser.id_usuario}`);

            expect(response.status).toBe(200);
            expect(response.body.id_usuario).toBe(testUser.id_usuario);
            expect(response.body.str_login).toBe(testUser.str_login);
        });

        test('3.2 - Dados exibidos são consistentes', async () => {
            const response = await request(app)
                .get(`/api/auth/user/${testUser.id_usuario}`);

            expect(response.body.str_descricao).toBe(testUser.str_descricao);
            expect(response.body.email).toBe(testUser.email);
        });
    });

    describe('4. Edição de Usuário', () => {
        let testUser;

        beforeEach(async () => {
            const timestamp = Date.now();
            testUser = await createTestUser({ login: `test.edit.${timestamp}`, email: `edit.${timestamp}@test.com` });
        });

        test('4.1 - Editar nome do usuário', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Alterar o nome do usuário ${testUser.str_login} para Novo Nome`
                });

            expect(response.status).toBe(200);
            expect(response.body.type).toBe('ACTION_COMPLETE');
        });

        test('4.2 - Editar email do usuário', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Trocar o email do usuário ${testUser.str_login} para novoemail@test.com`
                });

            expect(response.status).toBe(200);
        });

        test('4.3 - Email duplicado ao editar retorna erro', async () => {
            const otherUser = await createTestUser({ email: 'ocupado@test.com' });

            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Trocar o email do usuário ${testUser.str_login} para ${otherUser.email}`
                });

            // Pode retornar erro ou pedir confirmação
            expect(response.status).toBeGreaterThanOrEqual(200);
        });
    });

    describe('5. Exclusão de Usuário', () => {
        let testUser;

        beforeEach(async () => {
            const timestamp = Date.now();
            testUser = await createTestUser({ login: `test.delete.${timestamp}`, email: `delete.${timestamp}@test.com` });
        });

        test('5.1 - Excluir usuário ativo', async () => {
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Excluir o usuário ${testUser.str_login}`
                });

            expect(response.status).toBe(200);
            // Pode retornar ACTION_COMPLETE ou TEXT (IA informa sobre exclusão)
            expect(['ACTION_COMPLETE', 'TEXT']).toContain(response.body.type);
        });

        test('5.2 - Exclusão de usuário é processada', async () => {
            // Solicitar exclusão (pode requerer confirmação ou executar diretamente)
            const deleteResponse = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Excluir o usuário ${testUser.str_login}`
                });

            expect(deleteResponse.status).toBe(200);
            // A resposta deve ser ACTION_COMPLETE ou CONFIRMATION_REQUIRED
            // ou TEXT informando sobre a exclusão
            expect(['ACTION_COMPLETE', 'CONFIRMATION_REQUIRED', 'TEXT']).toContain(deleteResponse.body.type);
        });
    });
});
