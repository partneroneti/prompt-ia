# 🧪 Testes Implementados

Este documento lista todos os testes implementados e como executá-los.

## 📁 Estrutura de Testes

```
server/tests/
├── setup.js                    # Configuração global
├── helpers/
│   └── testHelpers.js         # Funções auxiliares
├── api/
│   └── user-crud.test.js      # Testes de CRUD
├── rbac/
│   └── permissions.test.js    # Testes de permissões
├── security/
│   └── security.test.js       # Testes de segurança
└── validation/
    └── validation.test.js     # Testes de validações
```

## 🚀 Como Executar

### Instalar Dependências

```bash
cd server
npm install
```

### Executar Todos os Testes

```bash
npm test
```

### Executar Testes Específicos

```bash
# Apenas testes de API
npm run test:api

# Apenas testes de RBAC
npm run test:rbac

# Apenas testes de segurança
npm run test:security

# Apenas testes de validação
npm run test:validation
```

### Modo Watch (desenvolvimento)

```bash
npm run test:watch
```

## ✅ Testes Implementados

### 1. CRUD de Usuários ✅ (18/18 testes passando)

#### Cadastro
- [x] Criar usuário com todos os campos obrigatórios (incluindo CPF)
- [x] Validar mensagem de sucesso
- [x] CPF obrigatório: criar usuário sem CPF retorna erro
- [x] Email inválido retorna erro
- [x] Email duplicado retorna erro
- [x] CPF duplicado retorna erro
- [x] Campos obrigatórios vazios retorna erro

#### Listagem
- [x] Listar todos os usuários
- [x] Filtro por nome
- [x] Filtro por email
- [x] Filtro por status

#### Visualização
- [x] Buscar usuário por ID
- [x] Dados exibidos são consistentes

#### Edição
- [x] Editar nome do usuário
- [x] Editar email do usuário
- [x] Email duplicado ao editar retorna erro

#### Exclusão
- [x] Excluir usuário ativo
- [x] Exclusão de usuário é processada corretamente

### 2. RBAC e Permissões 🚧 (Em progresso)

### 3. Segurança 🚧 (Em progresso)

### 4. Validações 🚧 (Em progresso)

## 📝 Notas

- Os testes usam dados de teste que são limpos após cada execução
- É necessário ter um usuário MASTER no banco para os testes funcionarem
- Os testes conectam ao banco de dados real (configurado no .env)
- Use um banco de testes separado em produção

## 🔧 Configuração

Certifique-se de ter o arquivo `.env` configurado com:
```env
DB_USER=seu_usuario
DB_HOST=seu_host
DB_NAME=seu_banco
DB_PASSWORD=sua_senha
DB_PORT=5442
```

## 📊 Coverage

Para ver a cobertura de código:

```bash
npm test -- --coverage
```

Os relatórios serão gerados em `server/coverage/`.
