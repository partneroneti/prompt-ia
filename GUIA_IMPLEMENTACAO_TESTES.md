# 🧪 Guia de Implementação de Testes

Este guia explica como implementar os testes faltantes, passo a passo.

## 📁 Estrutura de Arquivos

```
server/tests/
├── setup.js                          # ✅ Criado
├── helpers/
│   └── testHelpers.js               # ✅ Criado
├── api/
│   ├── user-crud.test.js            # ✅ Criado (parcial)
│   ├── user-list.test.js            # ⏳ Criar
│   └── user-edit.test.js            # ⏳ Criar
├── rbac/
│   ├── permissions.test.js          # ⏳ Criar
│   └── role-assignment.test.js      # ⏳ Criar
├── security/
│   ├── authentication.test.js       # ⏳ Criar
│   ├── authorization.test.js        # ⏳ Criar
│   └── injection.test.js            # ⏳ Criar
└── validation/
    ├── fields.test.js               # ⏳ Criar
    └── formats.test.js              # ⏳ Criar
```

## 🔧 Configuração Necessária

### 1. Instalar Dependências

```bash
cd server
npm install --save-dev jest supertest @types/jest
```

### 2. Configurar Banco de Testes

Crie um arquivo `.env.test` ou use variáveis de ambiente separadas:

```env
DB_NAME=seu_banco_testes
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_HOST=localhost
DB_PORT=5442
```

## 📝 Template de Teste

Use este template para criar novos testes:

```javascript
const request = require('supertest');
const app = require('../../index');
const { createTestUser, cleanTestData, getMasterUser } = require('../helpers/testHelpers');

describe('📋 Descrição do Grupo de Testes', () => {
    let masterUser;
    let testUser;

    beforeAll(async () => {
        // Setup inicial
        masterUser = await getMasterUser();
    });

    beforeEach(async () => {
        // Antes de cada teste
        testUser = await createTestUser();
    });

    afterEach(async () => {
        // Limpar após cada teste
        await cleanTestData();
    });

    test('1.1 - Descrição do teste', async () => {
        const response = await request(app)
            .post('/api/endpoint')
            .set('x-user-id', masterUser.id_usuario.toString())
            .send({
                // dados de teste
            });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
    });
});
```

## 🎯 Prioridades de Implementação

### Prioridade 1: Testes Críticos ✅
- [x] CRUD básico de usuários
- [ ] Validações de campos obrigatórios
- [ ] Testes de RBAC/permissões

### Prioridade 2: Segurança 🚧
- [ ] Autenticação e autorização
- [ ] Bypass de validações
- [ ] Escalada de privilégios

### Prioridade 3: Funcionalidades ⏳
- [ ] Listagem e filtros
- [ ] Edição de usuários
- [ ] Exclusão de usuários

### Prioridade 4: Integrações ⏳
- [ ] Auditoria e logs
- [ ] Notificações
- [ ] Performance

## 📚 Exemplos de Testes por Categoria

### Teste de RBAC

```javascript
describe('RBAC - Permissões', () => {
    test('Usuário sem permissão não pode criar usuário', async () => {
        const userWithoutPermission = await createTestUser({
            profile: 'OPERACIONAL'
        });

        const response = await request(app)
            .post('/api/chat')
            .set('x-user-id', userWithoutPermission.id_usuario.toString())
            .send({
                message: 'Cadastrar novo usuário...'
            });

        expect(response.status).toBe(403);
        expect(response.body.message).toContain('permissão');
    });
});
```

### Teste de Segurança

```javascript
describe('Segurança - Autenticação', () => {
    test('Operação sem autenticação retorna 401', async () => {
        const response = await request(app)
            .post('/api/chat')
            .send({
                message: 'Listar todos os usuários'
            });

        expect(response.status).toBe(401);
    });
});
```

### Teste de Validação

```javascript
describe('Validação - Campos', () => {
    test('Email inválido retorna erro', async () => {
        const response = await request(app)
            .post('/api/chat')
            .set('x-user-id', masterUser.id_usuario.toString())
            .send({
                message: 'Cadastrar usuário com email: email-invalido'
            });

        expect(response.status).toBeGreaterThanOrEqual(400);
    });
});
```

## 🚀 Como Adicionar Novos Testes

1. **Identifique a categoria** (API, RBAC, Security, Validation)

2. **Crie o arquivo** seguindo o padrão de nomenclatura:
   ```
   categoria/funcionalidade.test.js
   ```

3. **Use os helpers** existentes:
   - `createTestUser()` - Criar usuário de teste
   - `getMasterUser()` - Obter usuário MASTER
   - `cleanTestData()` - Limpar dados de teste

4. **Siga o padrão**:
   - Use `describe()` para agrupar testes relacionados
   - Use `beforeAll()` para setup inicial
   - Use `beforeEach()` e `afterEach()` para limpeza
   - Use `test()` ou `it()` para cada caso de teste

5. **Execute o teste**:
   ```bash
   npm test categoria/funcionalidade.test.js
   ```

## 📊 Cobertura de Código

Para verificar a cobertura:

```bash
npm test -- --coverage
```

Meta: **80% de cobertura**

## 🔄 CI/CD

Adicione ao seu pipeline CI/CD:

```yaml
# .github/workflows/tests.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: cd server && npm install
      - run: cd server && npm test
```

## 💡 Dicas

1. **Isolamento**: Cada teste deve ser independente
2. **Limpeza**: Sempre limpe dados de teste após execução
3. **Mock**: Use mocks para dependências externas quando necessário
4. **Assertivas**: Seja específico nas verificações
5. **Nomes**: Use nomes descritivos para testes

## 🐛 Troubleshooting

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Database connection"
Verifique as variáveis de ambiente no `.env`

### Erro: "User not found"
Certifique-se de ter um usuário MASTER no banco

### Timeout nos testes
Aumente o timeout no `jest.config.js`:
```javascript
testTimeout: 60000 // 60 segundos
```

## 📖 Recursos

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
