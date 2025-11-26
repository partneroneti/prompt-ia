# 📋 Arquivos Não Utilizados no Projeto

## 🗑️ Arquivos que podem ser removidos:

### 1. Arquivos de Teste (não usados em produção)
- ✅ `test-api.cjs` - Script de teste da API (não referenciado)
- ✅ `test-date-filtering.cjs` - Script de teste de filtros de data (não referenciado)
- ✅ `test-date-filtering.js` - Script de teste de filtros de data (não referenciado)
- ✅ `server/helpers/testHelpers.js` - Script de teste standalone dos helpers

### 2. Arquivos SQL (scripts manuais não integrados)
- ✅ `server/buscar-login.sql` - Query SQL manual (não referenciado no código)
- ✅ `server/update-cpf.sql` - Query SQL manual (não referenciado no código)
- ✅ `server/update-email.sql` - Query SQL manual (não referenciado no código)

### 3. Arquivos de Exemplo/Documentação de Código
- ✅ `server/helpers/integrationExample.js` - Exemplo de integração (apenas documentação)
- ✅ `server/schema.sql` - Schema antigo/mock (usa tabela `users` que não existe, o sistema usa `tb_usuario`)

### 4. Arquivos de Mock Data (não importados)
- ✅ `src/data/mockData.js` - Dados mock não utilizados (não importado em nenhum lugar)

---

## 📚 Arquivos de Documentação (manter - são úteis)

Estes arquivos são documentação e devem ser mantidos:
- `README.md` - Documentação principal
- `EXEMPLOS_CHAT_COMPLETO.md` - Guia completo de exemplos
- `EXEMPLOS_TESTE_RBAC.md` - Exemplos de teste RBAC
- `DATABASE_FEATURES.md` - Documentação do banco de dados
- `ATUALIZAR_CPF.md` - Documentação de atualização de CPF
- `ATUALIZAR_DADOS_USUARIO.md` - Documentação de atualização de dados
- `REFATORACAO_SQL_GENERATOR.md` - Documentação de refatoração
- `QUERIES_PERFIS.sql` - Queries SQL úteis (documentação)
- `server/schema/README.md` - Documentação do schema

---

## ⚠️ Arquivos que PODEM ser úteis (verificar antes de remover)

- `server/scripts/createAndAssignProfiles.js` - Script de criação de perfis (pode ser útil para setup inicial)

---

## 🧹 Resumo para Limpeza

**Total de arquivos que podem ser removidos: 9**

1. `test-api.cjs`
2. `test-date-filtering.cjs`
3. `test-date-filtering.js`
4. `server/helpers/testHelpers.js`
5. `server/buscar-login.sql`
6. `server/update-cpf.sql`
7. `server/update-email.sql`
8. `server/helpers/integrationExample.js`
9. `server/schema.sql`
10. `src/data/mockData.js`

---

## ✅ Arquivos em Uso (NÃO REMOVER)

- `server/index.js` - Servidor principal
- `server/db.js` - Conexão com banco
- `server/services/openai.js` - Serviço OpenAI
- `server/services/sqlGenerator.js` - Gerador de SQL
- `server/helpers/dateHelper.js` - Helper de datas
- `server/helpers/entityHelper.js` - Helper de entidades
- `server/helpers/profileHelper.js` - Helper de perfis
- `server/helpers/rbacHelper.js` - Helper RBAC
- `server/middleware/confirmationStore.js` - Store de confirmações
- `server/routes/*.js` - Rotas da API
- `server/schema/*.js` - Schema registry
- `server/utils/security.js` - Utilitários de segurança
- `src/services/openai.js` - Serviço frontend (USADO - não remover)
- Todos os arquivos em `src/` (exceto `mockData.js`)

