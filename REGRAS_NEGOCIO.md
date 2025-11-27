# Regras de Negócio – UserManagement AI

## ⚠️ **IMPORTANTE: Diferença Entre Perfis**

### 🔑 MASTER vs 👑 ADMIN vs 🏢 SIMPLIX

**MASTER**:
- ✅ **ÚNICO perfil com BYPASS TOTAL**
- ✅ Acesso garantido a tudo, sem verificar roles
- ✅ Se uma nova funcionalidade for criada, terá acesso automaticamente

**ADMIN e SIMPLIX**:
- ❌ **NÃO têm bypass**
- ⚠️ Precisam ter a role específica para cada ação
- ⚠️ Mesmo tendo muitas roles, precisam verificar cada uma
- ⚠️ Se uma nova funcionalidade for criada, precisarão receber a role correspondente

**Exemplo prático**:
```
MASTER cria usuário → Sistema: "É MASTER?" → ✅ SIM → Acesso concedido (não verifica roles)
ADMIN cria usuário → Sistema: "É MASTER?" → ❌ NÃO → Verifica role "USER_CREATE" → Se tiver: ✅ Acesso | Se não: ❌ Negado
```

---

## 1. Cadastro de Usuários

- **Campos obrigatórios**: nome (`str_descricao`), login (`str_login`, único e imutável), email, **CPF** (`str_cpf`), perfil de acesso, empresa/operação.
- **CPF é obrigatório** na criação e torna-se imutável após criação.
- Cada usuário deve estar ativo (`str_ativo = 'A'`) e desbloqueado (`bloqueado = false`) para acessar o sistema.
- Perfis são atribuídos via `tb_usuario_perfil`; é possível ter múltiplos perfis, mas pelo menos um ativo é obrigatório.
- Validações principais:
  - Email e login devem ser únicos.
  - **CPF é obrigatório e deve ser informado no momento da criação.**
  - Formatos (email, CPF) precisam seguir padrões reconhecidos.
  - Campos críticos não podem estar vazios; solicitações incompletas são rejeitadas pela IA.
  - A IA deve solicitar o CPF caso não seja informado durante o cadastro.

---

## 2. Perfis, Roles e RBAC

### 2.1 Sistema de Perfis

O sistema utiliza **RBAC (Role-Based Access Control)** onde perfis agregam roles específicas. Existem **15 perfis** no sistema:

### 2.2 Perfis Disponíveis e Suas Permissões

#### 🔑 MASTER
**Status**: Perfil com **BYPASS TOTAL** de permissões (único perfil com bypass)
**Total de Roles**: 92

**⚠️ DIFERENÇA CRÍTICA**:
- MASTER é o **ÚNICO** perfil que tem **bypass total** do sistema RBAC
- O sistema verifica primeiro se o usuário é MASTER e, se for, **concede acesso imediatamente sem verificar roles**
- Outros perfis (ADMIN, SIMPLIX, etc.) precisam ter roles específicas para cada ação

**Permissões Principais**:
- ✅ **Acesso Total com Bypass**: Não precisa verificar roles - acesso garantido a tudo
- ✅ Gerenciamento completo de usuários (criar, editar, excluir, bloquear) - **SEM verificar roles**
- ✅ Gerenciamento de perfis e roles - **SEM verificar roles**
- ✅ Consulta de propostas (todas as operações) - **SEM verificar roles**
- ✅ Dashboard completo com todos os filtros - **SEM verificar roles**
- ✅ Gerenciamento de entidades - **SEM verificar roles**
- ✅ Integração com propostas (criar, consultar, cancelar, atualizar, simular) - **SEM verificar roles**
- ✅ Acesso a todos os menus (Backoffice, Configuração, Dashboard, Empresa, Esteira, Proposta, Relatórios, Usuários) - **SEM verificar roles**
- ✅ Pesquisa avançada com todos os filtros - **SEM verificar roles**
- ✅ Geração e exportação de relatórios - **SEM verificar roles**

**O que pode fazer**:
- Criar, editar, excluir e bloquear qualquer usuário **SEM verificar permissões**
- Promover usuários para qualquer perfil (incluindo MASTER - requer confirmação)
- Acessar todas as funcionalidades do sistema **SEM verificar roles**
- Gerar relatórios de qualquer tipo **SEM verificar permissões**
- Resetar senhas de qualquer usuário **SEM verificar permissões**

**Como funciona o bypass**:
```javascript
// O sistema verifica primeiro se é MASTER
if (isMaster(userId)) {
    return true; // Acesso garantido, não verifica roles
}
// Só verifica roles se NÃO for MASTER
```

---

#### 👑 ADMIN
**Status**: Perfil administrativo com maior conjunto de permissões (mas **NÃO tem bypass**)
**Total de Roles**: 255

**⚠️ IMPORTANTE**:
- ADMIN **NÃO tem bypass** como o MASTER
- Precisa ter a role específica para cada ação
- Tem muitas roles (255), mas ainda precisa passar pelas verificações de RBAC
- Se uma role específica não estiver associada ao perfil ADMIN, a ação será negada

**Permissões Principais** (através de roles específicas):
- ✅ APIs de Consignado Privado (listar, simular) - precisa das roles correspondentes
- ✅ APIs de Propostas (consultar, deletar, importar, atualizar) - precisa das roles correspondentes
- ✅ Gestão de Campanhas - precisa da role `CAMPANHA / SALVAR`
- ✅ Gestão completa de Tickets (atendimento, documentos, histórico, SMS, WhatsApp) - precisa das roles correspondentes
- ✅ Gestão de Extratos e Comissões - precisa das roles correspondentes
- ✅ Gestão de Lotes de Pagamento - precisa das roles correspondentes
- ✅ Gestão de Tabelas de Comissão - precisa das roles correspondentes
- ✅ Gestão de Notificações - precisa da role `NOTIFICACAO/TICKET`
- ✅ Configurações avançadas (CBOS, Convênios, Seguro) - precisa das roles correspondentes
- ✅ Gerenciamento de Parceiros - precisa das roles correspondentes
- ✅ Gerenciamento de usuários - precisa das roles: `USUARIO/SAVE`, `USUARIO/EDICAO`, `USUARIO/EXCLUIR`, etc.

**Diferença CRÍTICA do MASTER**:
- ❌ **NÃO tem bypass** - precisa verificar roles para cada ação
- ✅ Tem mais roles específicas que o MASTER (inclui gestão de tickets e campanhas)
- ⚠️ Se uma nova funcionalidade for criada e o ADMIN não receber a role, ele **não terá acesso**
- ⚠️ MASTER terá acesso automaticamente (bypass), ADMIN não

**Exemplo prático**:
```
MASTER: Criar usuário → Sistema verifica: "É MASTER?" → ✅ SIM → Acesso concedido (sem verificar roles)
ADMIN: Criar usuário → Sistema verifica: "É MASTER?" → ❌ NÃO → Verifica role `USER_CREATE` → ✅ Tem a role → Acesso concedido
```

---

#### 🏢 SIMPLIX
**Status**: Perfil operacional completo (mas **NÃO tem bypass**)
**Total de Roles**: 231

**⚠️ IMPORTANTE**:
- SIMPLIX **NÃO tem bypass** como o MASTER
- Precisa ter a role específica para cada ação
- Tem muitas roles (231), mas ainda precisa passar pelas verificações de RBAC
- Similar ao ADMIN em estrutura, mas com conjunto diferente de roles

**Permissões Principais** (através de roles específicas):
- ✅ Gerenciamento de propostas e formalizações - precisa das roles correspondentes
- ✅ Dashboard completo - precisa das roles correspondentes
- ✅ Gestão de tickets - precisa das roles correspondentes
- ✅ APIs de integração - precisa das roles correspondentes
- ✅ Gerenciamento de campanhas - precisa das roles correspondentes
- ✅ Configurações e tabelas - precisa das roles correspondentes
- ✅ Gerenciamento de usuários (criar, editar, excluir) - precisa das roles: `USUARIO/SAVE`, `USUARIO/EDICAO`, `USUARIO/EXCLUIR`

**O que pode fazer**:
- Gerenciar propostas e operações comerciais (se tiver as roles)
- Atender tickets (se tiver as roles)
- Configurar campanhas e comissões (se tiver as roles)
- Gerenciar usuários do sistema (se tiver as roles)

**Diferença CRÍTICA do MASTER**:
- ❌ **NÃO tem bypass** - precisa verificar roles para cada ação
- ⚠️ Se uma nova funcionalidade for criada e o SIMPLIX não receber a role, ele **não terá acesso**
- ⚠️ MASTER terá acesso automaticamente (bypass), SIMPLIX não

**Diferença do ADMIN**:
- Tem menos roles (231 vs 255 do ADMIN)
- Algumas funcionalidades específicas podem não estar disponíveis

---

#### 💰 FINANCEIRO
**Status**: Perfil focado em operações financeiras
**Total de Roles**: 142

**Permissões Principais**:
- ✅ Consulta de propostas (visualização)
- ✅ Dashboard financeiro
- ✅ Gestão de tickets (visualização e edição)
- ✅ Integração com propostas (consultar, criar, cancelar, atualizar, simular)
- ✅ Menus: Backoffice, Configuração, Dashboard, Empresa, Esteira, Proposta, Relatórios
- ✅ Pesquisa com filtros específicos
- ✅ Geração de relatórios

**O que pode fazer**:
- Visualizar informações financeiras
- Gerar relatórios financeiros
- Consultar propostas e valores
- Gerenciar tickets relacionados a pagamentos
- **NÃO pode** gerenciar usuários diretamente

---

#### 🎯 MASTER SUBSTABELECIDO
**Status**: Perfil MASTER com limitações específicas
**Total de Roles**: 137

**Permissões Principais**:
- ✅ Similar ao MASTER, mas com algumas restrições
- ✅ Consulta de propostas
- ✅ Gestão de tickets completa
- ✅ Integração com propostas
- ✅ Menus principais (exceto alguns específicos)
- ✅ Gerenciamento de usuários

**Limitações em relação ao MASTER**:
- Não tem acesso a algumas funcionalidades de dashboard
- Alguns filtros de pesquisa podem estar limitados

---

#### 🔧 CORBAN INTEGRACAO (API)
**Status**: Perfil para integrações via API
**Total de Roles**: 28

**Permissões Principais**:
- ✅ APIs de integração (criar, atualizar, cancelar, consultar propostas)
- ✅ APIs de usuários (criar, atualizar, bloquear, excluir, resetar, listar)
- ✅ APIs de perfis (listar)
- ✅ Autenticação via API
- ✅ Simulação de propostas privadas

**O que pode fazer**:
- Integrar sistemas externos via API
- Gerenciar usuários via API
- Consultar e gerenciar propostas via API
- **Não tem acesso** à interface web completa

---

#### 📋 VENDEDOR/DIGITADOR LÍDER
**Status**: Perfil de liderança operacional
**Total de Roles**: 41

**Permissões Principais**:
- ✅ Consulta de propostas
- ✅ Integração de propostas (consultar, criar)
- ✅ Menus: Proposta, Relatórios, Usuários
- ✅ Visualização de todas as propostas
- ✅ Consulta de usuários
- ✅ Geração de relatórios

**O que pode fazer**:
- Cadastrar e consultar propostas
- Visualizar todas as propostas do sistema
- Consultar usuários
- Gerar relatórios
- Gerenciar equipe de vendedores/digitadores

**Limitações**:
- Não pode excluir usuários
- Acesso limitado a configurações

---

#### 📝 VENDEDOR/DIGITADOR
**Status**: Perfil operacional básico
**Total de Roles**: 34

**Permissões Principais**:
- ✅ Consulta de propostas
- ✅ Integração de propostas (consultar, criar)
- ✅ Menus: Proposta, Dashboard de Propostas
- ✅ Consulta de clientes

**O que pode fazer**:
- Cadastrar propostas
- Consultar propostas
- Consultar informações de clientes
- Visualizar dashboard de propostas

**Limitações**:
- Não pode ver todas as propostas (apenas próprias)
- Não pode gerenciar usuários
- Acesso limitado a relatórios

---

#### ⚙️ OPERACIONAL
**Status**: Perfil básico de operação
**Total de Roles**: 32

**Permissões Principais**:
- ✅ Consulta de propostas (campos limitados)
- ✅ Consulta de propostas via integração
- ✅ Menu de propostas (cadastrar, consultar)
- ✅ Consulta de clientes
- ✅ Relatórios básicos

**O que pode fazer**:
- Cadastrar e consultar propostas
- Consultar informações básicas de clientes
- Acessar menu de propostas

**Limitações**:
- Acesso muito limitado
- Não pode gerenciar usuários
- Não pode bloquear ou editar usuários

---

#### 👥 GESTOR DE USUÁRIOS
**Status**: Perfil específico para gestão de usuários
**Total de Roles**: 12

**Permissões Principais**:
- ✅ Menu de usuários
- ✅ Listagem de usuários
- ✅ Criar usuários (`USUARIO/SAVE`)
- ✅ Editar usuários (`USUARIO/EDICAO`)
- ✅ Consultar usuários (`USUARIO/CONSULT`)
- ✅ Bloquear usuários (`USUARIO/BLOQUEIO`)
- ✅ Resetar senha (`USUARIO/RESET_SENHA`)
- ✅ Relatórios

**O que pode fazer**:
- Gerenciar todos os aspectos de usuários
- Criar, editar, bloquear e resetar senhas
- Consultar e listar usuários
- Gerar relatórios de usuários

**Limitações**:
- Não pode excluir usuários
- Não pode alterar perfis críticos
- Acesso limitado a outras funcionalidades

---

#### 💼 GESTOR DE PRICING
**Status**: Perfil para gestão de preços e comissões
**Total de Roles**: 9

**Permissões Principais**:
- ✅ Menu de tabelas
- ✅ Gestão de tabelas de comissão
- ✅ Consulta de tabelas
- ✅ Listagem de tabelas
- ✅ Salvar tabelas
- ✅ Relatórios

**O que pode fazer**:
- Configurar tabelas de comissão
- Consultar e listar tabelas de preços
- Gerar relatórios relacionados a pricing
- Gerenciar configurações de comissão

**Limitações**:
- Acesso limitado apenas a funcionalidades de pricing
- Não pode gerenciar usuários
- Não pode gerenciar propostas

---

#### 🔗 INTEGRACAO
**Status**: Perfil para integrações básicas
**Total de Roles**: 6

**Permissões Principais**:
- ✅ APIs de integração de propostas
- ✅ Consultar documentos
- ✅ Listar tipos de documentos
- ✅ Simular propostas

**O que pode fazer**:
- Integrar sistemas externos
- Consultar informações via API
- Simular propostas
- Acessar documentos

**Limitações**:
- Acesso muito limitado
- Não pode criar ou modificar dados
- Apenas consultas e simulações

---

#### 🔌 SUBSTABELECIDO INTEGRACAO (API)
**Status**: Perfil para integrações de subestabelecidos
**Total de Roles**: 11

**Permissões Principais**:
- ✅ APIs de propostas (criar, atualizar, cancelar, consultar)
- ✅ Autenticação de propostas
- ✅ Simulação de propostas

**O que pode fazer**:
- Integrar como subestabelecido
- Gerenciar propostas via API
- Autenticar e simular propostas

**Limitações**:
- Acesso apenas via API
- Sem acesso à interface web

---

#### 🧪 Perfis de Teste
- **teste**: 1 role (API/UPDATE_PROPOSAL)
- **Teste 123**: 1 role (API/CONSULT_PROPOSAL)

**Nota**: Estes são perfis de teste e não devem ser usados em produção.

---

### 2.3 Estrutura de Permissões

**🔑 Diferença Fundamental: MASTER vs Outros Perfis**

1. **MASTER (Bypass Total)**:
   - O sistema verifica primeiro: `if (isMaster(userId)) return true;`
   - **Não precisa verificar roles** - acesso garantido a tudo
   - Se uma nova funcionalidade for criada, MASTER terá acesso automaticamente
   - Único perfil com bypass no sistema

2. **Outros Perfis (ADMIN, SIMPLIX, etc.)**:
   - Precisam ter a role específica para cada ação
   - O sistema verifica: `hasRole(userId, "USER_CREATE")`
   - Se não tiverem a role, a ação será negada
   - Mesmo tendo muitas roles, precisam verificar cada uma

**Como funciona**:
- Perfis (`tb_perfil`) agregam roles (`tb_role`) através de `tb_perfil_role`.
- O perfil **MASTER** possui bypass total de permissões (não precisa verificar roles).
- **ADMIN, SIMPLIX e outros perfis** precisam da role específica para cada ação, por exemplo:
  - `USUARIO_CREATE`, `USUARIO_UPDATE`, `USUARIO_DELETE`, `USUARIO_BLOCK`, `USUARIO_RESET`.
  - `MENU/DASHBOARD`, `MENU/USUARIO`, `MENU/RELATORIO`, etc.
- Regras sensíveis exigem confirmação (ex.: promover para MASTER, bloquear em massa, resetar senhas).
- O endpoint `/api/auth/permissions` retorna o resumo de permissões (roles, flags como `can_create_user`, etc.).

**Exemplo prático**:
```javascript
// Código do sistema (canPerformAction):
async function canPerformAction(userId, action, resource) {
    // 1. Primeiro verifica se é MASTER (bypass)
    const isMasterUser = await isMaster(userId);
    if (isMasterUser) {
        return true; // ✅ Acesso garantido, não verifica mais nada
    }
    
    // 2. Se não for MASTER, verifica a role específica
    const roleName = `${resource}_${action}`; // Ex: "USER_CREATE"
    return await hasRole(userId, roleName); // ❌ Pode ser negado se não tiver a role
}
```

---

### 3. Fluxos Principais

#### 3.1 Criação
- Fluxo guiado pela IA: coleta campos obrigatórios (incluindo CPF), valida duplicidades, executa o `createUser`.
- **CPF é obrigatório** - a IA deve solicitar se não for informado.
- Após a criação deve haver registro de auditoria com ID formatado `AUD-XXXXXX`.

#### 3.2 Atualização
- Via `findUserAndUpdate`. Campos permitidos: nome, email, senha, CPF, perfil.
- Alterar perfil para MASTER exige confirmação e validação de role existente.
- Alterações parciais devem preservar demais campos.

#### 3.3 Bloqueio / Desbloqueio
- `blockUser` com `block: true` requer confirmação; `block: false` é imediato.
- `blockUsers` afeta usuários por empresa; ações em massa também pedem confirmação.

#### 3.4 Exclusão
- Soft delete: `str_ativo` passa a `E`. Usuário não aparece nas listagens ativas e perde acesso.
- Não deve ser possível excluir o usuário logado ou perfis críticos (ex.: superadmin) sem validação adicional.

---

### 4. Auditoria e Logs

- Toda ação sensível (criar, editar, bloquear, excluir, resetar senha) gera log em `audit_logs`.
- O log deve armazenar: tipo da ação, usuário alvo, quem executou (`performedBy`) e detalhes em JSON.
- O identificador é retornado aos clientes para rastreabilidade.

---

### 5. Login e Sessão

- O login carrega dados do usuário via `/api/auth/user/:id`, incluindo perfis ativos.
- Usuários sem perfil ativo recebem perfil virtual "SEM PERFIL" e acesso limitado.
- O front salva `user`, `profiles`, `activeProfile` e `roles` no `localStorage`.
- Troca de perfil atualiza o estado na aplicação, mas não altera a atribuição no banco.

---

### 6. Regras Específicas da IA

- A IA só executa ações utilizando as funções expostas (createUser, findUserAndUpdate, blockUser, etc.).
- Inputs ambíguos geram perguntas para coletar dados ausentes antes de executar a ação.
- **A IA deve sempre solicitar CPF ao criar usuário** caso não seja informado.
- A IA recusa ações sem permissão (ex.: criar usuário sem `USER_CREATE`) e orienta o usuário.
- Para operações críticas, a IA pergunta "Deseja prosseguir? (SIM/NÃO)" e aguarda confirmação.
- A IA não deve revelar dados sensíveis (senha, tokens, etc.) nem executar SQL arbitrário fora dos limites seguros.

---

### 7. Status dos Usuários

- `str_ativo = 'A'` e `bloqueado = false`: usuário ativo.
- `bloqueado = true`: usuário aparece como "BLOQUEADO".
- `str_ativo = 'E'`: usuário inativo/excluído; não deve aparecer em dashboards padrão.

---

### 8. Integrações e Relatórios

- O sistema gera relatórios via `/api/reports/generate`, exigindo filtros válidos (status, operação, intervalo).
- Relatórios customizados exigem SQL sem parâmetros posicionais e passam por validação antes da execução.
- Para auditoria, o endpoint `/api/reports/custom` lista os relatórios disponíveis.

---

### 9. Segurança

- Toda rota sensível requer header `x-user-id`; sem ele, retorna 401.
- RBAC é aplicado no backend por `ensurePermission` usando `rbacHelper.canPerformAction`.
- Tentativas de bypass (acessar endpoints sem role) retornam 403.
- As requisições são sanitizadas (`sanitizeUserMessage`) para evitar prompt injection.

---

### 10. Notificações e Feedback

- Respostas ao usuário devem incluir status (sucesso/erro), resumo e `auditId` quando aplicável.
- Mensagens de erro precisam orientar o usuário (ex.: "Informe nome, login, e-mail, CPF, perfil e empresa").

---

## 📊 Resumo de Perfis

| Perfil | Total de Roles | Bypass Total | Gerenciar Usuários | Gerenciar Propostas | Gerenciar Tickets | APIs |
|--------|----------------|--------------|-------------------|---------------------|-------------------|------|
| **MASTER** | 92 | ✅ **SIM (único)** | ✅ Sim (bypass) | ✅ Sim (bypass) | ✅ Sim (bypass) | ✅ Sim (bypass) |
| **ADMIN** | 255 | ❌ Não | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) |
| **SIMPLIX** | 231 | ❌ Não | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) | ✅ Sim (se tiver roles) |
| **FINANCEIRO** | 142 | ❌ Não | ❌ Não | ⚠️ Consulta | ✅ Sim | ✅ Sim |
| **MASTER SUBSTABELECIDO** | 137 | ⚠️ Com roles | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim |
| **VENDEDOR/DIGITADOR LÍDER** | 41 | ❌ Não | ⚠️ Consulta | ✅ Sim | ❌ Não | ✅ Sim |
| **VENDEDOR/DIGITADOR** | 34 | ❌ Não | ❌ Não | ✅ Sim | ❌ Não | ✅ Sim |
| **OPERACIONAL** | 32 | ❌ Não | ❌ Não | ⚠️ Básico | ❌ Não | ⚠️ Básico |
| **GESTOR DE USUÁRIOS** | 12 | ❌ Não | ✅ Sim | ❌ Não | ❌ Não | ❌ Não |
| **GESTOR DE PRICING** | 9 | ❌ Não | ❌ Não | ❌ Não | ❌ Não | ❌ Não |
| **INTEGRACAO** | 6 | ❌ Não | ❌ Não | ⚠️ Consulta | ❌ Não | ✅ Sim |
| **CORBAN INTEGRACAO (API)** | 28 | ❌ Não | ✅ Sim (API) | ✅ Sim (API) | ❌ Não | ✅ Sim |
| **SUBSTABELECIDO INTEGRACAO (API)** | 11 | ❌ Não | ❌ Não | ✅ Sim (API) | ❌ Não | ✅ Sim |

---

## 🔑 Legenda

- ✅ **Sim**: Tem permissão completa
- ⚠️ **Limitado/Básico**: Tem permissão parcial ou limitada
- ❌ **Não**: Não tem permissão

---

## 📝 Notas Importantes

1. **MASTER é o ÚNICO perfil com bypass total** - não precisa verificar roles, acesso garantido a tudo
2. **ADMIN e SIMPLIX NÃO têm bypass** - mesmo tendo muitas roles, precisam verificar cada uma
3. **Se uma nova funcionalidade for criada**:
   - MASTER terá acesso automaticamente (bypass)
   - ADMIN e SIMPLIX precisarão receber a role correspondente
4. **CPF é obrigatório** em todas as criações de usuário
5. Cada perfil (exceto MASTER) herda permissões através de suas roles associadas
6. Um usuário pode ter múltiplos perfis simultaneamente
7. O sistema valida permissões em todas as ações sensíveis

## ⚠️ Diferença Crítica: MASTER vs ADMIN/SIMPLIX

| Aspecto | MASTER | ADMIN/SIMPLIX |
|---------|--------|---------------|
| **Bypass** | ✅ Sim - acesso imediato | ❌ Não - precisa verificar roles |
| **Verificação de Roles** | ❌ Não precisa | ✅ Precisa ter a role específica |
| **Nova Funcionalidade** | ✅ Acesso automático | ❌ Precisa receber a role |
| **Flexibilidade** | ✅ Total - sempre tem acesso | ⚠️ Limitada - depende das roles |
