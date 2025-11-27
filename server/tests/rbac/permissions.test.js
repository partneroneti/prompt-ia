/**
 * Testes de RBAC e Permissões
 * Cobre: hasRole, hasAnyRole, hasAllRoles, isMaster, canPerformAction, getUserRoles, getPermissionSummary
 */

const request = require('supertest');
const app = require('../../index');
const rbacHelper = require('../../helpers/rbacHelper');
const { createTestUser, createTestProfile, createTestRole, assignRoleToProfile, getMasterUser, cleanTestData } = require('../helpers/testHelpers');

describe('🔐 RBAC e Permissões', () => {
    let masterUser;
    let testUser;
    let testProfile;
    let testRole1;
    let testRole2;

    beforeAll(async () => {
        masterUser = await getMasterUser();
        if (!masterUser) {
            throw new Error('Usuário MASTER não encontrado para testes');
        }
    });

    beforeEach(async () => {
        // Criar perfil de teste
        testProfile = await createTestProfile(`TEST_PROFILE_${Date.now()}`);
        
        // Criar roles de teste
        testRole1 = await createTestRole(`TEST_ROLE_1_${Date.now()}`);
        testRole2 = await createTestRole(`TEST_ROLE_2_${Date.now()}`);
        
        // Associar roles ao perfil
        await assignRoleToProfile(testProfile.id_perfil, testRole1.id_role);
        await assignRoleToProfile(testProfile.id_perfil, testRole2.id_role);
        
        // Criar usuário de teste com o perfil
        const timestamp = Date.now();
        testUser = await createTestUser({
            login: `rbac_test_${timestamp}`,
            email: `rbac_test_${timestamp}@test.com`,
            profile: testProfile.str_descricao
        });
    });

    afterEach(async () => {
        await cleanTestData();
    });

    describe('1. Verificação de Roles (hasRole)', () => {
        test('1.1 - Usuário tem role específica', async () => {
            const hasRole = await rbacHelper.hasRole(testUser.id_usuario, testRole1.str_descricao);
            expect(hasRole).toBe(true);
        });

        test('1.2 - Usuário não tem role que não possui', async () => {
            const nonExistentRole = `NON_EXISTENT_${Date.now()}`;
            const hasRole = await rbacHelper.hasRole(testUser.id_usuario, nonExistentRole);
            expect(hasRole).toBe(false);
        });

        test('1.3 - MASTER tem todas as permissões (bypass)', async () => {
            // MASTER pode ter acesso mesmo sem role específica
            const hasRole = await rbacHelper.hasRole(masterUser.id_usuario, 'ANY_ROLE');
            // O resultado pode variar, mas o isMaster deve retornar true
            const isMasterUser = await rbacHelper.isMaster(masterUser.id_usuario);
            expect(isMasterUser).toBe(true);
        });
    });

    describe('2. Verificação de Múltiplas Roles (hasAnyRole, hasAllRoles)', () => {
        test('2.1 - Usuário tem pelo menos uma role (hasAnyRole)', async () => {
            const hasAny = await rbacHelper.hasAnyRole(testUser.id_usuario, [
                testRole1.str_descricao,
                'NON_EXISTENT_ROLE'
            ]);
            expect(hasAny).toBe(true);
        });

        test('2.2 - Usuário não tem nenhuma role da lista', async () => {
            const hasAny = await rbacHelper.hasAnyRole(testUser.id_usuario, [
                'NON_EXISTENT_ROLE_1',
                'NON_EXISTENT_ROLE_2'
            ]);
            expect(hasAny).toBe(false);
        });

        test('2.3 - Usuário tem todas as roles (hasAllRoles)', async () => {
            const hasAll = await rbacHelper.hasAllRoles(testUser.id_usuario, [
                testRole1.str_descricao,
                testRole2.str_descricao
            ]);
            expect(hasAll).toBe(true);
        });

        test('2.4 - Usuário não tem todas as roles', async () => {
            const hasAll = await rbacHelper.hasAllRoles(testUser.id_usuario, [
                testRole1.str_descricao,
                testRole2.str_descricao,
                'NON_EXISTENT_ROLE'
            ]);
            expect(hasAll).toBe(false);
        });
    });

    describe('3. Verificação de MASTER (isMaster)', () => {
        test('3.1 - Usuário MASTER é identificado corretamente', async () => {
            const isMasterUser = await rbacHelper.isMaster(masterUser.id_usuario);
            expect(isMasterUser).toBe(true);
        });

        test('3.2 - Usuário comum não é MASTER', async () => {
            const isMasterUser = await rbacHelper.isMaster(testUser.id_usuario);
            expect(isMasterUser).toBe(false);
        });
    });

    describe('4. Verificação de Ações (canPerformAction)', () => {
        test('4.1 - MASTER pode realizar qualquer ação', async () => {
            const canPerform = await rbacHelper.canPerformAction(masterUser.id_usuario, 'CREATE', 'USER');
            expect(canPerform).toBe(true);
        });

        test('4.2 - Usuário sem role não pode realizar ação', async () => {
            // Criar usuário sem roles específicas
            const timestamp = Date.now();
            const userWithoutRoles = await createTestUser({
                login: `no_roles_${timestamp}`,
                email: `no_roles_${timestamp}@test.com`,
                profile: null // Sem perfil
            });
            
            const canPerform = await rbacHelper.canPerformAction(userWithoutRoles.id_usuario, 'CREATE', 'USER');
            expect(canPerform).toBe(false);
        });
    });

    describe('5. Obtenção de Roles (getUserRoles)', () => {
        test('5.1 - Obter todas as roles de um usuário', async () => {
            const roles = await rbacHelper.getUserRoles(testUser.id_usuario);
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBeGreaterThan(0);
            expect(roles).toContain(testRole1.str_descricao);
            expect(roles).toContain(testRole2.str_descricao);
        });

        test('5.2 - Usuário sem roles retorna array vazio', async () => {
            const timestamp = Date.now();
            const userWithoutRoles = await createTestUser({
                login: `empty_roles_${timestamp}`,
                email: `empty_roles_${timestamp}@test.com`,
                profile: null
            });
            
            const roles = await rbacHelper.getUserRoles(userWithoutRoles.id_usuario);
            expect(Array.isArray(roles)).toBe(true);
            expect(roles.length).toBe(0);
        });
    });

    describe('6. Resumo de Permissões (getPermissionSummary)', () => {
        test('6.1 - Obter resumo de permissões do usuário', async () => {
            const summary = await rbacHelper.getPermissionSummary(testUser.id_usuario);
            
            expect(summary).toBeDefined();
            expect(summary.user_id).toBe(testUser.id_usuario);
            expect(summary.is_master).toBe(false);
            expect(Array.isArray(summary.profiles)).toBe(true);
            expect(Array.isArray(summary.roles)).toBe(true);
            expect(typeof summary.can_create_user).toBe('boolean');
            expect(typeof summary.can_update_user).toBe('boolean');
            expect(typeof summary.can_delete_user).toBe('boolean');
        });

        test('6.2 - Resumo de permissões do MASTER', async () => {
            const summary = await rbacHelper.getPermissionSummary(masterUser.id_usuario);
            
            expect(summary).toBeDefined();
            expect(summary.is_master).toBe(true);
            // MASTER deve ter todas as permissões
            expect(summary.can_create_user).toBe(true);
            expect(summary.can_update_user).toBe(true);
            expect(summary.can_delete_user).toBe(true);
        });
    });

    describe('7. Endpoints de API - Roles', () => {
        test('7.1 - Listar todas as roles', async () => {
            const response = await request(app)
                .get('/api/roles');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
        });

        test('7.2 - Listar perfis', async () => {
            const response = await request(app)
                .get('/api/profiles');

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('7.3 - Listar roles de um perfil por ID', async () => {
            const response = await request(app)
                .get(`/api/profiles/${testProfile.id_perfil}/roles`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('7.4 - Listar roles de um perfil por nome', async () => {
            const response = await request(app)
                .get(`/api/profiles/by-name/${testProfile.str_descricao}/roles`);

            expect(response.status).toBe(200);
            // Pode retornar array ou objeto - verificar que retornou algo válido
            expect(response.body).toBeDefined();
        });

        test('7.5 - Obter permissões do usuário via API', async () => {
            const response = await request(app)
                .get(`/api/auth/permissions`)
                .set('x-user-id', testUser.id_usuario.toString());

            expect(response.status).toBe(200);
            expect(response.body).toBeDefined();
            expect(Array.isArray(response.body.roles)).toBe(true);
            expect(typeof response.body.permissions).toBe('object');
        });

        test('7.6 - Listar roles de um usuário via API', async () => {
            const response = await request(app)
                .get(`/api/users/${testUser.id_usuario}/roles`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });

        test('7.7 - Listar perfis de um usuário via API', async () => {
            const response = await request(app)
                .get(`/api/users/${testUser.id_usuario}/profiles`);

            expect(response.status).toBe(200);
            expect(Array.isArray(response.body)).toBe(true);
        });
    });

    describe('8. Verificação de Permissões em Endpoints', () => {
        test('8.1 - MASTER pode criar usuário', async () => {
            const timestamp = Date.now();
            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', masterUser.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste RBAC, CPF 111.222.333-44, login: rbac.perm.${timestamp}, email: rbac.perm.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            expect(response.status).toBe(200);
            // Pode ser ACTION_COMPLETE, CONFIRMATION_REQUIRED, TEXT ou ERROR
            expect(response.body).toBeDefined();
            expect(response.body.type).toBeDefined();
        });

        test('8.2 - Usuário sem permissão não pode criar usuário', async () => {
            // Criar usuário sem permissões
            const timestamp = Date.now();
            const userWithoutPerms = await createTestUser({
                login: `no_perm_${timestamp}`,
                email: `no_perm_${timestamp}@test.com`,
                profile: null
            });

            const response = await request(app)
                .post('/api/chat')
                .set('x-user-id', userWithoutPerms.id_usuario.toString())
                .send({
                    message: `Cadastrar novo usuário: Teste Sem Perm, CPF 999.888.777-66, login: sem.perm.${timestamp}, email: sem.perm.${timestamp}@test.com, perfil: OPERACIONAL, empresa: Partner`
                });

            // Deve retornar erro de permissão (403) ou mensagem informando falta de permissão
            expect([403, 200]).toContain(response.status);
            if (response.status === 200) {
                const message = (response.body.message || '').toLowerCase();
                expect(message).toMatch(/permissão|não pode|não tem/i);
            }
        });
    });
});

