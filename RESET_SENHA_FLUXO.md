# Fluxo de Reset de Senha - Implementação Completa

## ✅ O que está implementado:

### 1. **Backend - Reset de Senha**
- ✅ Detecção automática de "resetar senha" no prompt
- ✅ Geração de senha aleatória (12 caracteres)
- ✅ Hash SHA-256 antes de armazenar na coluna `str_senha`
- ✅ Marcação do campo `trocar_senha = true` (quando o campo existir)
- ✅ Retorno da senha temporária para o admin

### 2. **Backend - Endpoint de Login**
- ✅ Retorna flag `trocar_senha` do usuário
- ✅ Trata caso o campo não exista (retorna `false`)

### 3. **Frontend - Modal de Troca de Senha**
- ✅ Modal obrigatório quando `trocar_senha = true`
- ✅ Validação de senha (mínimo 6 caracteres)
- ✅ Confirmação de senha
- ✅ Integração com endpoint `/api/auth/change-password`

### 4. **Frontend - AuthContext**
- ✅ Verifica flag `trocar_senha` após login
- ✅ Mostra modal automaticamente se `trocar_senha = true`
- ✅ Atualiza flag após troca bem-sucedida

## ⚠️ O que precisa ser feito:

### **Criar campo `trocar_senha` no banco de dados**

O servidor não tem permissão para criar o campo automaticamente. Execute este SQL manualmente:

```sql
ALTER TABLE tb_usuario 
ADD COLUMN IF NOT EXISTS trocar_senha BOOLEAN DEFAULT false;
```

**Arquivo criado:** `server/create_trocar_senha_field.sql`

## 🔄 Fluxo Completo:

1. **Admin pede reset de senha:**
   - Prompt: "Resetar senha do usuário luis.eri.santos"
   - Sistema detecta `isPasswordReset = true`
   - Gera senha aleatória (ex: `CZG99lE@Ghg8`)
   - Hash SHA-256: `8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92`
   - Atualiza `str_senha` com o hash
   - Marca `trocar_senha = true`
   - Retorna: "🔑 Senha temporária gerada: CZG99lE@Ghg8"

2. **Usuário faz login:**
   - Sistema busca dados do usuário
   - Verifica `trocar_senha = true`
   - Modal aparece automaticamente

3. **Usuário troca senha:**
   - Digita nova senha no modal
   - Sistema valida (mínimo 6 caracteres)
   - Hash SHA-256 da nova senha
   - Atualiza `str_senha` com novo hash
   - Limpa `trocar_senha = false`
   - Modal fecha

## 📝 Como testar:

1. Execute o SQL para criar o campo `trocar_senha`
2. No chat, digite: "Resetar senha do usuário [login]"
3. Anote a senha temporária retornada
4. Faça logout e login com o usuário que teve a senha resetada
5. O modal deve aparecer automaticamente
6. Digite uma nova senha e confirme
7. O modal deve fechar e você pode usar o sistema normalmente

## 🔍 Logs para debug:

O sistema tem logs detalhados:
- `[PASSWORD_RESET]` - Logs de reset de senha
- `[UPDATE]` - Logs de atualização
- `[AUTH]` - Logs de autenticação
- `[AuthContext]` - Logs do frontend

Verifique os logs do servidor e do navegador (F12) para debug.

