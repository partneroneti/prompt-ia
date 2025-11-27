# 🔐 Sistema de Permissões Baseado em Roles

Este documento explica como o sistema de permissões funciona e como usar no código.

## 📋 Visão Geral

O sistema utiliza **RBAC (Role-Based Access Control)** onde:
- **Perfis** são associados a **Roles**
- **Usuários** têm um ou mais **Perfis**
- As **Roles** definem quais funcionalidades o usuário pode acessar
- O perfil **MASTER** tem acesso total (bypass completo)

## 🏗️ Arquitetura

### Backend
- `server/helpers/rbacHelper.js` - Funções de verificação de permissões
- `server/index.js` - Endpoints de API para permissões
- Banco de dados:
  - `tb_perfil` - Perfis (MASTER, OPERACIONAL, etc.)
  - `tb_role` - Roles/permissões (USUARIO/SAVE, MENU/DASHBOARD, etc.)
  - `tb_perfil_role` - Relação entre perfis e roles
  - `tb_usuario_perfil` - Relação entre usuários e perfis

### Frontend
- `src/hooks/usePermissions.js` - Hook para verificar permissões
- `src/utils/permissions.js` - Mapeamento de roles para funcionalidades
- `src/components/RequirePermission.jsx` - Componente para proteger conteúdo
- `src/components/ProtectedRoute.jsx` - Rota protegida com permissões

## 🔑 Mapeamento de Roles

### Roles para Menus

| Menu | Roles Necessárias |
|------|-------------------|
| Dashboard | `DASHBOARD`, `MENU/DASHBOARD`, `SISTEMA/AUTENTICACAO` |
| Operações | `MENU/EMPRESA`, `MENU/EMPRESA/LISTA`, `ENTIDADE/CONSULTA` |
| Grupos | `MENU/EMPRESA`, `MENU/EMPRESA/LISTA` |
| Auditoria | `SISTEMA/AUTENTICACAO` (padrão para todos) |
| Relatórios | `RELATORIO`, `MENU/RELATORIO`, `RELATORIO/CONSULTAR` |
| Prompt Manager | `MENU/CONFIGURACAO`, `MENU/CONFIGURACAO/OPERACAO` |

### Roles para Ações de Usuários

| Ação | Role Necessária |
|------|-----------------|
| Criar Usuário | `USUARIO/SAVE` |
| Editar Usuário | `USUARIO/EDICAO` |
| Visualizar Usuário | `USUARIO/CONSULT` |
| Bloquear Usuário | `USUARIO/BLOQUEIO` |
| Resetar Senha | `USUARIO/RESET_SENHA` |

## 💻 Como Usar

### 1. No Hook usePermissions

```jsx
import { usePermissions } from '../hooks/usePermissions';

function MinhaComponente() {
    const { canAccess, hasFeatureAccess, isMaster, roles } = usePermissions();

    // Verificar acesso a menu
    if (canAccess('dashboard')) {
        // Mostrar dashboard
    }

    // Verificar permissão específica
    if (hasFeatureAccess('users.create')) {
        // Mostrar botão de criar usuário
    }

    // Verificar se é MASTER
    if (isMaster()) {
        // Acesso total
    }

    return <div>Conteúdo</div>;
}
```

### 2. Proteger Rotas

```jsx
import ProtectedRoute from '../components/ProtectedRoute';

<Route path="/reports" element={
    <ProtectedRoute requiredPermission="reports">
        <Reports />
    </ProtectedRoute>
} />
```

### 3. Proteger Componentes/Conteúdo

```jsx
import RequirePermission from '../components/RequirePermission';

<RequirePermission permission="users.create">
    <button onClick={handleCreate}>Criar Usuário</button>
</RequirePermission>

// Com fallback
<RequirePermission 
    permission="users.create"
    fallback={<p>Você não tem permissão para criar usuários</p>}
>
    <button onClick={handleCreate}>Criar Usuário</button>
</RequirePermission>
```

### 4. Verificar Múltiplas Permissões

```jsx
// Qualquer uma das permissões (OR)
<RequirePermission permission={['users.create', 'users.edit']}>
    <Form />
</RequirePermission>

// Todas as permissões (AND)
<RequirePermission 
    permission={['users.create', 'users.edit']}
    requireAll={true}
>
    <AdvancedForm />
</RequirePermission>
```

### 5. No Sidebar (já implementado)

O Sidebar já filtra os menus automaticamente baseado nas permissões do usuário.

## 🔍 Exemplos Práticos

### Exemplo 1: Botão Condicional

```jsx
import { usePermissions } from '../hooks/usePermissions';

function UserList() {
    const { hasFeatureAccess, isMaster } = usePermissions();

    return (
        <div>
            <h1>Usuários</h1>
            {hasFeatureAccess('users.create') && (
                <button>Novo Usuário</button>
            )}
            {isMaster() && (
                <button>Configurações Avançadas</button>
            )}
        </div>
    );
}
```

### Exemplo 2: Formulário com Campos Condicionais

```jsx
function UserForm() {
    const { hasFeatureAccess } = usePermissions();

    return (
        <form>
            <input name="name" />
            <input name="email" />
            
            <RequirePermission permission="users.edit">
                <input name="perfil" />
                <select name="status">
                    <option>Ativo</option>
                    <option>Bloqueado</option>
                </select>
            </RequirePermission>
        </form>
    );
}
```

### Exemplo 3: Dashboard com Cards Condicionais

```jsx
function Dashboard() {
    const { canAccess } = usePermissions();

    return (
        <div className="grid grid-cols-3 gap-4">
            <Card>Estatísticas Gerais</Card>
            
            {canAccess('reports') && (
                <Card>Relatórios</Card>
            )}
            
            {canAccess('operations') && (
                <Card>Operações</Card>
            )}
        </div>
    );
}
```

## 🔧 Adicionando Novas Permissões

### 1. Adicionar Role no Banco de Dados

```sql
INSERT INTO tb_role (str_descricao, str_ativo)
VALUES ('NOVA_FUNCIONALIDADE', 'A');
```

### 2. Associar ao Perfil

```sql
INSERT INTO tb_perfil_role (id_perfil, id_role, str_ativo)
SELECT 
    (SELECT id_perfil FROM tb_perfil WHERE str_descricao = 'MASTER'),
    (SELECT id_role FROM tb_role WHERE str_descricao = 'NOVA_FUNCIONALIDADE'),
    'A';
```

### 3. Mapear no Código

Edite `src/utils/permissions.js`:

```javascript
export const ROLE_MAPPING = {
    // ... outras roles
    'NOVA_FUNCIONALIDADE': ['nova-funcionalidade'],
};

export const MENU_PERMISSIONS = {
    // ... outros menus
    'nova-funcionalidade': {
        roles: ['NOVA_FUNCIONALIDADE'],
        default: false
    }
};
```

### 4. Usar no Código

```jsx
<ProtectedRoute requiredPermission="nova-funcionalidade">
    <NovaFuncionalidadePage />
</ProtectedRoute>
```

## 📊 Verificar Permissões do Usuário

### Via API

```bash
GET /api/auth/permissions
Headers: x-user-id: {userId}
```

Retorna:
```json
{
    "user_id": 123,
    "is_master": false,
    "roles": ["USUARIO/CONSULT", "MENU/DASHBOARD"],
    "permissions": {
        "can_create_user": false,
        "can_update_user": false,
        "can_delete_user": false
    }
}
```

### Via Script Node.js

```bash
node server/scripts/checkProfileRoles.js MASTER
```

## ⚠️ Importante

1. **MASTER sempre tem acesso total** - Não é necessário verificar roles para MASTER
2. **Roles são case-insensitive** - O sistema normaliza para uppercase
3. **Cache** - As permissões são carregadas no login e podem ser recarregadas usando `reload()` do hook
4. **Fallback** - Sempre forneça fallback adequado quando ocultar conteúdo

## 🔄 Recarregar Permissões

```jsx
const { reload } = usePermissions();

// Após mudar perfil ou atualizar permissões
await reload();
```

## 📝 Notas

- O sistema já filtra menus no Sidebar automaticamente
- Todas as rotas podem ser protegidas com `ProtectedRoute`
- Use `RequirePermission` para proteger partes específicas de componentes
- MASTER sempre bypassa todas as verificações de permissão
