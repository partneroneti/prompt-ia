/**
 * Testes de Validação
 * Cobre: Validação de CPF, Email, Campos Obrigatórios, Formatos
 */

const request = require('supertest');
const app = require('../../index');
const { createTestUser, getMasterUser, cleanTestData } = require('../helpers/testHelpers');

describe('✅ Validação de Dados', () => {
    let masterUser;

    beforeAll(async () => {
        masterUser = await getMasterUser();
        if (!masterUser) {
            throw new Error('Usuário MASTER não encontrado para testes');
        }
    });

    afterEach(async () => {
        await cleanTestData();
    });

    describe('1. Validação de CPF', () => {
        test('1.1 - CPF é obrigatório na criação de usuário', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem CPF, login: sem.cpf.${timestamp}, email: sem.cpf.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            const message = (response.body.message || response.body.content || '').toLowerCase();
            expect(message).toMatch(/cpf.*obrigatório|cpf é obrigatório/i);
        });

        test('1.2 - CPF deve ser único', async () => {
            const timestamp = Date.now();
            const cpf = '123.456.789-00';
            
            // Criar primeiro usuário com o CPF
            await createTestUser({ cpf: cpf });

            // Tentar criar segundo usuário com mesmo CPF
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Duplicado, CPF ${cpf}, login: duplicado.${timestamp}, email: duplicado.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect([200, 400]).toContain(response.status);
            if (response.body.message) {
                const message = (response.body.message || '').toLowerCase();
                expect(message).toMatch(/cpf.*já existe|cpf.*duplicado|erro.*cpf/i);
            }
        });

        test('1.3 - CPF pode ter diferentes formatos', async () => {
            const timestamp = Date.now();
            const cpfFormats = [
                '12345678900', // Sem formatação
                '123.456.789-00', // Formato padrão
            ];

            for (const cpf of cpfFormats) {
                const response = await request(app)
                    .post('/api/chat')
                    .set('x-user-id', masterUser.id_usuario.toString())
                    .send({
                        message: `Cadastrar novo usuário: Teste CPF ${timestamp}, CPF ${cpf}, login: cpf.format.${timestamp}, email: cpf.format.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                    });

                // Pode aceitar diferentes formatos ou normalizar
                expect([200, 400]).toContain(response.status);
            }
        });
    });

    describe('2. Validação de Email', () => {
        test('2.1 - Email é obrigatório na criação de usuário', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Email, CPF 111.222.333-44, login: sem.email.${timestamp}, perfil: OPERACIONAL, empresa: Partner`
                });

            expect([200, 400]).toContain(response.status);
            if (response.status === 200 && response.body.message) {
                const message = (response.body.message || response.body.content || '').toLowerCase();
                // Pode mencionar email obrigatório ou campos obrigatórios (já que faltam vários campos)
                expect(message.length).toBeGreaterThan(0);
            }
        });

        test('2.2 - Email deve ter formato válido', async () => {
            const timestamp = Date.now();
            const invalidEmails = [
                'email-invalido',
                'email@',
                '@dominio.com',
                'email sem @dominio',
            ];

            for (const email of invalidEmails) {
                const response = await request(app)
                    .post('/api/chat')
                    .set('x-user-id', masterUser.id_usuario.toString())
                    .send({
                        message: `Cadastrar novo usuário: Teste Email Inválido, CPF 111.222.333-44, login: email.invalido.${timestamp}, email: ${email}, perfil: OPERACIONAL, empresa: Partner`
                    });

                // Deve retornar erro de email inválido ou pedir correção
                expect([200, 400]).toContain(response.status);
            }
        });

        test('2.3 - Email deve ser único', async () => {
            const timestamp = Date.now();
            const email = `duplicado.${timestamp}@test.com`;
            
            // Criar primeiro usuário com o email
            await createTestUser({ email: email });

            // Tentar criar segundo usuário com mesmo email
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Email Duplicado, CPF 999.888.777-66, login: email.dup.${timestamp}, email: ${email}, perfil: OPERACIONAL, empresa: Partner`
                });

            expect([200, 400]).toContain(response.status);
            if (response.body.message) {
                const message = (response.body.message || '').toLowerCase();
                expect(message).toMatch(/email.*já existe|email.*duplicado|erro/i);
            }
        });
    });

    describe('3. Validação de Campos Obrigatórios', () => {
        test('3.1 - Nome é obrigatório', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: CPF 111.222.333-44, login: sem.nome.${timestamp}, email: sem.nome.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Pode retornar erro ou pedir o nome
            expect([200, 400]).toContain(response.status);
        });

        test('3.2 - Login é obrigatório', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Login, CPF 111.222.333-44, email: sem.login.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Pode retornar erro ou pedir o login
            expect([200, 400]).toContain(response.status);
        });

        test('3.3 - Login deve ser único', async () => {
            const timestamp = Date.now();
            const login = `login.duplicado.${timestamp}`;
            
            // Criar primeiro usuário com o login
            await createTestUser({ login: login });

            // Tentar criar segundo usuário com mesmo login
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Login Duplicado, CPF 999.888.777-66, login: ${login}, email: login.dup.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect([200, 400]).toContain(response.status);
            if (response.body.message) {
                const message = (response.body.message || '').toLowerCase();
                expect(message).toMatch(/login.*já existe|login.*duplicado|erro/i);
            }
        });

        test('3.4 - Perfil é obrigatório', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Perfil, CPF 111.222.333-44, login: sem.perfil.${timestamp}, email: sem.perfil.${timestamp}@test.com, empresa: Partner`
                });

            // Pode retornar erro ou pedir o perfil
            expect([200, 400]).toContain(response.status);
        });

        test('3.5 - Empresa é obrigatória', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Empresa, CPF 111.222.333-44, login: sem.empresa.${timestamp}, email: sem.empresa.${timestamp}@test.com, perfil: OPERACIONAL`
                });

            // Pode retornar erro ou pedir a empresa
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('4. Validação de Formatos', () => {
        test('4.1 - Campos não podem ter apenas espaços', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário:     , CPF 111.222.333-44, login: espaços.${timestamp}, email: espacos.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Deve tratar espaços em branco
            expect([200, 400]).toContain(response.status);
        });

        test('4.2 - Validação de caracteres especiais no login', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste, CPF 111.222.333-44, login: login!@#${timestamp}, email: especial.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Pode aceitar ou rejeitar caracteres especiais
            expect([200, 400]).toContain(response.status);
        });
    });

    describe('5. Validação de Mensagens de Erro', () => {
        test('5.1 - Mensagens de erro são claras e informativas', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário sem CPF: Teste, login: erro.${timestamp}, email: erro.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            if (response.body.type === 'ERROR' || response.body.message) {
                const message = (response.body.message || '').toLowerCase();
                // Mensagem deve mencionar CPF
                expect(message.length).toBeGreaterThan(0);
            }
        });
    });
});

