# 👤 O Que um Usuário Básico Pode Fazer no Prompt

Este documento explica as capacidades de um usuário básico (sem permissões especiais) ao usar o prompt/chat.

## 🎯 Perfis Básicos do Sistema

### ⚙️ OPERACIONAL
- **Total de Roles**: 32
- **Tipo**: Perfil mais básico de operação
- **Foco**: Apenas consultas e operações básicas

---

## ✅ O Que um Usuário Básico PODE Fazer

### 1. 📋 Consultas e Listagens (SEM PERMISSÃO ESPECIAL)

Um usuário básico pode **consultar e listar informações** sem precisar de permissões específicas:

#### ✅ Consultar Usuários (`queryUsers`)
```
Exemplos:
- "Listar todos os usuários"
- "Mostrar usuários ativos"
- "Buscar usuário por email joao@exemplo.com"
- "Quais usuários estão bloqueados?"
- "Usuários da empresa Partner"
```

**O que retorna:**
- Lista de usuários com filtros (nome, email, login, status, empresa)
- Informações básicas (nome, email, login, status, empresa)
- Não permite modificar, apenas visualizar

#### ✅ Consultar Perfis (`queryProfiles`)
```
Exemplos:
- "Listar todos os perfis disponíveis"
- "Quais perfis existem no sistema?"
- "Mostrar perfis ativos"
```

**O que retorna:**
- Lista de todos os perfis do sistema
- Nome e status de cada perfil

#### ✅ Consultar Roles (`queryRoles`)
```
Exemplos:
- "Listar todas as roles"
- "Quais roles existem?"
- "Mostrar roles do perfil OPERACIONAL"
```

**O que retorna:**
- Lista de todas as roles disponíveis
- Relação entre perfis e roles

#### ✅ Consultar Grupos (`queryGroups`)
```
Exemplos:
- "Listar grupos"
- "Quais grupos existem?"
```

**O que retorna:**
- Lista de grupos disponíveis

#### ✅ Consultar Operações/Empresas (`queryOperations`)
```
Exemplos:
- "Listar empresas"
- "Quais operações existem?"
```

**O que retorna:**
- Lista de empresas/operações

#### ✅ Consultar Logs de Auditoria (`queryAuditLogs`)
```
Exemplos:
- "Mostrar logs de auditoria"
- "Logs de criação de usuários"
- "Auditoria do usuário ID 123"
```

**O que retorna:**
- Histórico de ações realizadas no sistema
- Quem fez o quê e quando

#### ✅ Gerar Relatórios Básicos (`generateReport`)
```
Exemplos:
- "Gerar relatório de usuários"
- "Exportar lista de usuários ativos"
- "Relatório CSV de usuários bloqueados"
```

**O que retorna:**
- Arquivo CSV para download
- Relatórios pré-configurados

---

## ❌ O Que um Usuário Básico NÃO PODE Fazer

### Ações que Requerem Permissões Específicas

#### ❌ Criar Usuário (`createUser`)
```
❌ Tentativa: "Criar usuário João Silva, CPF 123.456.789-00, login joao.silva..."
❌ Resposta: "Você não tem permissão para criar usuário."
```

**Permissão necessária:** `USER_CREATE` ou perfil MASTER

#### ❌ Editar Usuário (`findUserAndUpdate`)
```
❌ Tentativa: "Alterar email do usuário joao.silva para novo@email.com"
❌ Resposta: "Você não tem permissão para atualizar usuário."
```

**Permissão necessária:** `USER_UPDATE` ou perfil MASTER

#### ❌ Bloquear Usuário (`blockUser`)
```
❌ Tentativa: "Bloquear usuário teste@email.com"
❌ Resposta: "Você não tem permissão para bloquear usuário."
```

**Permissão necessária:** `USER_BLOCK` ou perfil MASTER

#### ❌ Desbloquear Usuário (`blockUser`)
```
❌ Tentativa: "Desbloquear usuário teste@email.com"
❌ Resposta: "Você não tem permissão para bloquear usuário."
```

**Permissão necessária:** `USER_BLOCK` ou perfil MASTER

#### ❌ Excluir Usuário (`deleteUser`)
```
❌ Tentativa: "Excluir usuário ID 123"
❌ Resposta: "Você não tem permissão para excluir usuário."
```

**Permissão necessária:** `USER_DELETE` ou perfil MASTER

#### ❌ Bloquear Todos de uma Empresa (`blockUsers`)
```
❌ Tentativa: "Bloquear todos os usuários da empresa Partner"
❌ Resposta: "Você não tem permissão para bloquear usuário."
```

**Permissão necessária:** `USER_BLOCK` ou perfil MASTER

#### ❌ Resetar Senhas (`resetPasswords`)
```
❌ Tentativa: "Resetar senhas da empresa Partner"
❌ Resposta: "Você não tem permissão para resetar usuário."
```

**Permissão necessária:** `USER_RESET` ou perfil MASTER

---

## 🔐 Como Funciona o Sistema de Permissões

### Verificação de Permissões

O sistema verifica permissões em duas etapas:

1. **Verifica se é MASTER** (bypass total)
   - Se for MASTER → ✅ Acesso concedido imediatamente

2. **Verifica role específica**
   - Se não for MASTER → Verifica se tem a role necessária
   - Exemplo: Para criar usuário, precisa da role `USER_CREATE`

### Código de Verificação

```javascript
// No servidor (server/index.js)
const permissionMap = {
    createUser: { action: 'CREATE', resource: 'USER' },
    findUserAndUpdate: { action: 'UPDATE', resource: 'USER' },
    blockUser: { action: 'BLOCK', resource: 'USER' },
    deleteUser: { action: 'DELETE', resource: 'USER' },
    blockUsers: { action: 'BLOCK', resource: 'USER' },
    resetPasswords: { action: 'RESET', resource: 'USER' }
    // queryUsers e outras queries NÃO requerem RBAC
};
```

### Ações Sem Verificação de Permissão

```javascript
// Consultas de leitura não requerem RBAC
// Apenas ações de escrita/modificação requerem
const readActions = [
    'queryUsers',      // ✅ SEM verificação
    'queryGroups',     // ✅ SEM verificação
    'queryOperations', // ✅ SEM verificação
    'queryProfiles',   // ✅ SEM verificação
    'queryRoles'       // ✅ SEM verificação
];
```

---

## 📊 Resumo Visual

| Ação | Usuário Básico | Requer Permissão |
|------|---------------|------------------|
| **📋 Consultar usuários** | ✅ Sim | ❌ Não |
| **📋 Listar perfis** | ✅ Sim | ❌ Não |
| **📋 Consultar roles** | ✅ Sim | ❌ Não |
| **📋 Ver logs de auditoria** | ✅ Sim | ❌ Não |
| **📋 Gerar relatórios básicos** | ✅ Sim | ❌ Não |
| **✏️ Criar usuário** | ❌ Não | ✅ USER_CREATE |
| **✏️ Editar usuário** | ❌ Não | ✅ USER_UPDATE |
| **🔒 Bloquear usuário** | ❌ Não | ✅ USER_BLOCK |
| **🗑️ Excluir usuário** | ❌ Não | ✅ USER_DELETE |
| **🔑 Resetar senha** | ❌ Não | ✅ USER_RESET |

---

## 💡 Exemplos Práticos

### ✅ Usuário Básico (OPERACIONAL) - O QUE FUNCIONA

```
Usuário: "Listar todos os usuários ativos"
Bot: ✅ Retorna lista de usuários

Usuário: "Buscar usuário com email joao@exemplo.com"
Bot: ✅ Retorna dados do usuário

Usuário: "Quais perfis existem no sistema?"
Bot: ✅ Retorna lista de perfis

Usuário: "Gerar relatório de usuários bloqueados"
Bot: ✅ Gera e faz download do CSV

Usuário: "Mostrar logs de auditoria dos últimos 10 registros"
Bot: ✅ Retorna logs de auditoria
```

### ❌ Usuário Básico (OPERACIONAL) - O QUE NÃO FUNCIONA

```
Usuário: "Criar usuário João Silva, CPF 123.456.789-00..."
Bot: ❌ "Você não tem permissão para criar usuário."

Usuário: "Alterar email do usuário joao.silva para novo@email.com"
Bot: ❌ "Você não tem permissão para atualizar usuário."

Usuário: "Bloquear usuário teste@email.com"
Bot: ❌ "Você não tem permissão para bloquear usuário."

Usuário: "Resetar senhas da empresa Partner"
Bot: ❌ "Você não tem permissão para resetar usuário."
```

---

## 🎯 Perfis e Suas Capacidades

### Perfis Mais Básicos

1. **OPERACIONAL** (32 roles)
   - ✅ Apenas consultas básicas
   - ❌ Não pode modificar dados

2. **VENDEDOR/DIGITADOR** (34 roles)
   - ✅ Consultas de propostas e clientes
   - ❌ Não pode gerenciar usuários

3. **FINANCEIRO** (142 roles)
   - ✅ Visualização financeira
   - ✅ Relatórios financeiros
   - ❌ Não pode gerenciar usuários

### Perfis com Mais Permissões

4. **GESTOR DE USUÁRIOS** (12 roles)
   - ✅ Criar, editar, bloquear usuários
   - ✅ Resetar senhas
   - ✅ Consultar usuários

5. **ADMIN** (255 roles)
   - ✅ Quase tudo (mas precisa de roles específicas)
   - ❌ Não tem bypass como MASTER

6. **MASTER** (92 roles + BYPASS TOTAL)
   - ✅ Tudo sem verificar roles
   - ✅ Único perfil com bypass

---

## 🔍 Como Verificar Suas Permissões

No prompt, você pode perguntar:

```
"Quais são minhas permissões?"
"O que eu posso fazer neste sistema?"
"Quais ações eu tenho acesso?"
```

O sistema pode consultar suas roles e informar o que você pode fazer.

---

## 📝 Notas Importantes

1. **Consultas são sempre permitidas** - Qualquer usuário logado pode consultar informações
2. **Modificações requerem permissões** - Criar, editar, bloquear, excluir requerem roles específicas
3. **MASTER tem bypass total** - MASTER não precisa de roles, tem acesso a tudo automaticamente
4. **Mensagens de erro são claras** - Se você tentar algo sem permissão, receberá uma mensagem explicando

---

## 🚀 Resumo Final

**Um usuário básico (OPERACIONAL) pode:**
- ✅ Consultar e listar informações
- ✅ Visualizar dados de usuários, perfis, roles
- ✅ Gerar relatórios básicos
- ✅ Ver logs de auditoria
- ✅ Obter informações sobre o sistema

**Um usuário básico NÃO pode:**
- ❌ Criar, editar, excluir usuários
- ❌ Bloquear ou desbloquear usuários
- ❌ Resetar senhas
- ❌ Modificar configurações do sistema

**Para fazer ações de modificação, o usuário precisa:**
- Ter um perfil com as roles necessárias (ex: GESTOR DE USUÁRIOS, ADMIN, MASTER)
- Ou ser MASTER (que tem bypass total)

