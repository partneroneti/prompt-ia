# Exemplos de Teste - RBAC (MASTER vs Outros Perfis)

## 📋 Resumo do Sistema RBAC

O sistema verifica permissões baseado em:
- **Perfil MASTER**: Acesso total a todas as funcionalidades (bypass completo do RBAC)
- **Outros Perfis**: Precisam ter roles específicas associadas ao perfil

### Estrutura de Permissões

As ações são mapeadas da seguinte forma:
- `CREATE` → Role: `USER_CREATE`
- `UPDATE` → Role: `USER_UPDATE`  
- `DELETE` → Role: `USER_DELETE`
- `BLOCK` → Role: `USER_BLOCK`
- `RESET` → Role: `USER_RESET`

## ✅ O QUE UM USUÁRIO MASTER PODE FAZER

Um usuário com perfil **MASTER** tem acesso total e pode executar **TODAS** as ações abaixo:

### 1. Criar Usuários
```
"Cadastrar novo usuário: João Silva, login: joao.silva, email: joao@empresa.com, perfil: OPERACIONAL, empresa: Partner"
```
✅ **MASTER**: Pode criar
❌ **Outros**: Precisa da role `USER_CREATE`

### 2. Atualizar Usuários
```
"Trocar o email do usuário luis.eri.santos para novoemail@empresa.com"
"Alterar o nome do usuário maria.santos para Maria Santos Silva"
```
✅ **MASTER**: Pode atualizar qualquer usuário
❌ **Outros**: Precisa da role `USER_UPDATE`

### 3. Bloquear Usuários (Individual)
```
"Bloquear o usuário joao.silva"
"Desbloquear o usuário maria.santos"
```
✅ **MASTER**: Pode bloquear/desbloquear
❌ **Outros**: Precisa da role `USER_BLOCK`

### 4. Bloquear Múltiplos Usuários (Ação Sensível)
```
"Bloquear todos os usuários da empresa DANIEL CRED"
```
✅ **MASTER**: Pode executar (requer confirmação)
❌ **Outros**: Precisa da role `USER_BLOCK` e confirmação

### 5. Resetar Senhas (Ação Sensível)
```
"Resetar senhas de todos os usuários da empresa Partner"
```
✅ **MASTER**: Pode executar (requer confirmação)
❌ **Outros**: Precisa da role `USER_RESET` e confirmação

### 6. Excluir Usuários (Soft Delete)
```
"Excluir o usuário teste123"
```
✅ **MASTER**: Pode excluir
❌ **Outros**: Precisa da role `USER_DELETE`

## ❌ O QUE OUTROS PERFIS NÃO PODEM FAZER (SEM PERMISSÃO)

### Perfil OPERACIONAL (sem roles)
Ao tentar qualquer ação de escrita, receberá:
```
"Você não tem permissão para criar usuário."
"Você não tem permissão para atualizar usuário."
```

### Ações que Funcionam para TODOS (sem RBAC)
✅ **Consultas de Leitura** - Funcionam para todos:
- "Quantos usuários ativos temos?"
- "Listar todos os usuários"
- "Quantos grupos existem?"
- "Mostrar operações cadastradas"
- "Consultar usuário joao.silva"

## 🧪 EXEMPLOS PRÁTICOS PARA TESTAR

### Cenário 1: Testar com MASTER
1. **Login**: Faça login com um usuário que tenha perfil MASTER
2. **Teste criar usuário**:
   ```
   "Cadastrar usuário: Teste Master, login: teste.master, email: teste@teste.com, perfil: OPERACIONAL, empresa: Teste"
   ```
   ✅ Deve funcionar e retornar sucesso + Audit ID

3. **Teste atualizar usuário**:
   ```
   "Trocar o email do usuário teste.master para novoteste@teste.com"
   ```
   ✅ Deve funcionar e retornar sucesso + Audit ID

4. **Teste bloquear usuário**:
   ```
   "Bloquear todos os usuários da empresa Teste"
   ```
   ✅ Deve solicitar confirmação, e ao confirmar, executar com sucesso

### Cenário 2: Testar com OPERACIONAL (sem permissões)
1. **Login**: Faça login com um usuário que tenha perfil OPERACIONAL (sem roles)
2. **Teste criar usuário**:
   ```
   "Cadastrar usuário: Teste Operacional, login: teste.op, email: teste@teste.com, perfil: OPERACIONAL, empresa: Teste"
   ```
   ❌ Deve retornar: "Você não tem permissão para criar usuário."

3. **Teste atualizar usuário**:
   ```
   "Trocar o email do usuário luis.eri.santos para teste@teste.com"
   ```
   ❌ Deve retornar: "Você não tem permissão para atualizar usuário."

4. **Teste consultar usuários** (deve funcionar):
   ```
   "Quantos usuários ativos temos?"
   ```
   ✅ Deve funcionar (consultas não requerem RBAC)

### Cenário 3: Testar com Perfil que tem role específica
1. **Configurar no banco**: 
   - Criar perfil "GESTOR"
   - Associar role "USER_UPDATE" ao perfil
   - Associar o perfil "GESTOR" a um usuário

2. **Login**: Faça login com esse usuário

3. **Teste criar usuário** (sem permissão):
   ```
   "Cadastrar usuário: Teste Gestor..."
   ```
   ❌ Deve retornar erro de permissão

4. **Teste atualizar usuário** (com permissão):
   ```
   "Trocar o email do usuário joao.silva para novoemail@teste.com"
   ```
   ✅ Deve funcionar (tem role USER_UPDATE)

## 📝 COMANDOS SQL PARA CONFIGURAR TESTES

### Criar Perfil e Role para Teste

```sql
-- 1. Criar perfil GESTOR
INSERT INTO tb_perfil (str_descricao, str_ativo) 
VALUES ('GESTOR', 'A') 
RETURNING id_perfil;

-- 2. Criar role USER_UPDATE
INSERT INTO tb_role (str_descricao, str_ativo) 
VALUES ('USER_UPDATE', 'A') 
RETURNING id_role;

-- 3. Associar role ao perfil (substitua os IDs retornados acima)
INSERT INTO tb_perfil_role (id_perfil, id_role)
VALUES (1, 1); -- Substitua pelos IDs corretos

-- 4. Associar perfil a um usuário (exemplo: usuário ID 306)
INSERT INTO tb_usuario_perfil (id_usuario, id_perfil)
VALUES (306, 1); -- Substitua pelos IDs corretos
```

### Criar Perfil MASTER para um Usuário

```sql
-- 1. Verificar se perfil MASTER existe
SELECT id_perfil FROM tb_perfil WHERE UPPER(str_descricao) = 'MASTER';

-- 2. Se não existir, criar
INSERT INTO tb_perfil (str_descricao, str_ativo) 
VALUES ('MASTER', 'A') 
RETURNING id_perfil;

-- 3. Associar MASTER a um usuário (exemplo: usuário ID 306)
INSERT INTO tb_usuario_perfil (id_usuario, id_perfil)
VALUES (306, <id_perfil_MASTER>);
```

## 🔍 VERIFICAR PERMISSÕES DO USUÁRIO ATUAL

Você pode verificar as permissões através do chat:

```
"Quais são minhas permissões?"
"Tenho permissão para criar usuários?"
"Tenho permissão para atualizar usuários?"
```

(Se essa funcionalidade estiver implementada no sistema)

## 📌 RESUMO RÁPIDO

| Ação | MASTER | OPERACIONAL (sem roles) | GESTOR (com USER_UPDATE) |
|------|--------|-------------------------|--------------------------|
| Criar usuário | ✅ | ❌ | ❌ |
| Atualizar usuário | ✅ | ❌ | ✅ |
| Bloquear usuário | ✅ | ❌ | ❌ |
| Resetar senhas | ✅ | ❌ | ❌ |
| Excluir usuário | ✅ | ❌ | ❌ |
| Consultar usuários | ✅ | ✅ | ✅ |
| Listar grupos | ✅ | ✅ | ✅ |

## ⚠️ IMPORTANTE

- **Consultas de leitura** (`queryUsers`, `queryGroups`, etc.) **NÃO** requerem RBAC e funcionam para todos
- Apenas **ações de escrita/modificação** são protegidas pelo RBAC
- Ações sensíveis (bloqueio em massa, reset de senhas) sempre requerem confirmação, mesmo para MASTER

