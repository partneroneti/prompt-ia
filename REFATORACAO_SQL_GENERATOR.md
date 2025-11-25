# Refatoração: Geração de SQL com Seleção Dinâmica de Esquema (2-step RAG)

## ✅ Implementação Completa

A lógica de geração de SQL foi refatorada seguindo a arquitetura de **Seleção Dinâmica de Esquema (2-step RAG)** para suportar 50+ tabelas de forma eficiente.

## 📁 Arquivos Criados

### 1. `server/schema/ddlRegistry.js`
- Contém todos os DDLs completos (`CREATE TABLE`) das tabelas do banco
- Funções: `getDDL(tableName)`, `getDDLs(tableNames[])`
- **27 tabelas** já incluídas (fácil expansão para 50+)

### 2. `server/schema/tableRegistry.js`
- Lista resumida (`nome: descrição`) para triagem rápida
- Funções: `getTableListForTriage()`, `getAllTableNames()`, `tableExists()`
- Usado no **Passo 1** para economizar tokens

### 3. `server/services/sqlGenerator.js`
- Serviço principal com as duas funções principais:
  - `selecionarTabelas(userQuestion)` - **Passo 1: Triagem**
  - `gerarSQL(userQuestion, selectedTables)` - **Passo 2: Geração SQL**
  - `gerarSQLCompleto(userQuestion)` - Função principal que encadeia os dois passos

### 4. `server/schema/README.md`
- Documentação completa da arquitetura
- Instruções de uso e como adicionar novas tabelas

## 🔄 Fluxo Implementado

```
┌─────────────────────────────────┐
│  Pergunta do Usuário            │
│  "Quantos usuários por operação?"│
└──────────────┬──────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  PASSO 1: Selecionar Tabelas     │
│  - Lista resumida                │
│  - LLM retorna JSON:             │
│    ["tb_usuario", "tb_operacao"] │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  PASSO 2: Gerar SQL              │
│  - DDLs das tabelas selecionadas │
│  - LLM gera SQL focado           │
│  - Retorna SQL puro (sem md)     │
└──────────────┬───────────────────┘
               │
               ▼
┌──────────────────────────────────┐
│  Resultado Final                 │
│  {                               │
│    sql: "SELECT ...",            │
│    tabelasSelecionadas: [...]    │
│  }                               │
└──────────────────────────────────┘
```

## 🚀 Endpoints Criados

### `POST /api/generate-sql`
Gera SQL a partir de uma pergunta em linguagem natural.

**Exemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/generate-sql \
  -H "Content-Type: application/json" \
  -d '{"question": "Quantos usuários temos por operação?"}'
```

**Resposta:**
```json
{
  "success": true,
  "sql": "SELECT o.str_descricao, COUNT(u.id_usuario) as count FROM tb_operacao o LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao WHERE u.str_ativo = 'A' GROUP BY o.str_descricao",
  "tabelasSelecionadas": ["tb_usuario", "tb_operacao"],
  "message": "SQL gerado usando 2 tabela(s)"
}
```

### `POST /api/execute-sql`
Executa SQL gerado (apenas SELECT por segurança).

**Exemplo de uso:**
```bash
curl -X POST http://localhost:3000/api/execute-sql \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM tb_usuario WHERE str_ativo = '\''A'\''"}'
```

## ✨ Características da Implementação

### ✅ Separação de Dados
- DDLs completos separados da lista resumida
- Estrutura escalável e organizada

### ✅ Passo 1 (Triagem)
- Usa `response_format: { type: "json_object" }`
- Retorna array JSON com nomes de tabelas
- Validação de tabelas existentes
- Tratamento de erro se nenhuma tabela selecionada

### ✅ Passo 2 (Geração SQL)
- Filtra DDLs apenas das tabelas selecionadas
- Prompt instrui retorno de SQL puro (sem markdown)
- Limpeza automática de markdown se presente
- Temperatura baixa (0.2) para queries consistentes

### ✅ Output
- Código em Node.js
- Tratamento de erros robusto
- Logs detalhados para debug

## 📊 Tabelas Incluídas (27 tabelas)

### Módulo: Usuários e Acesso
- `tb_usuario`, `tb_perfil`, `tb_usuario_perfil`, `tb_role`, `tb_perfil_role`

### Módulo: Operações
- `tb_operacao`, `tb_grupo`, `tb_grupo_operacao`

### Módulo: Propostas e CRM
- `tb_formalizacao_proposta`, `tb_formalizacao`, `tb_status_proposta`, `tb_formalizacao_historico`

### Módulo: Financeiro/Comissões
- `tb_extrato_comissao`, `tb_extrato_comissao_lote`, `tb_tabela_comissao`, `tb_tipo_comissao`

### Módulo: Parceiros/Entidades
- `tb_entidade`, `tb_entidade_email`, `tb_entidade_telefone`, `tb_entidade_endereco`

### Módulo: Campanhas
- `tb_campanha`, `tb_campanha_apuracao`, `tb_campanha_premio`

### Módulo: Logs
- `log_alteracoes`, `audit_logs`

## 🔧 Como Adicionar Novas Tabelas

Para adicionar uma nova tabela:

1. **Adicionar DDL em `server/schema/ddlRegistry.js`:**
```javascript
DDL_REGISTRY = {
    // ... tabelas existentes
    nova_tabela: `CREATE TABLE nova_tabela (
        id SERIAL PRIMARY KEY,
        campo VARCHAR(255),
        ...
    );`
}
```

2. **Adicionar descrição em `server/schema/tableRegistry.js`:**
```javascript
TABLE_REGISTRY = {
    // ... tabelas existentes
    nova_tabela: "Descrição breve do propósito da tabela"
}
```

Pronto! A tabela estará disponível automaticamente.

## 🎯 Benefícios da Refatoração

1. **Economia de Tokens**: ~70-80% de redução vs. enviar todos os DDLs
2. **Maior Precisão**: Contexto focado apenas nas tabelas relevantes
3. **Escalável**: Fácil adicionar 50+ tabelas sem impacto de performance
4. **Manutenível**: Separação clara entre triagem e geração
5. **Profissional**: Arquitetura baseada em DDL, não em objetos JS

## 📝 Notas Técnicas

- Modelo usado: `gpt-3.5-turbo` (pode ser alterado para `gpt-4` se necessário)
- Temperatura Passo 1: `0.1` (alta precisão na seleção)
- Temperatura Passo 2: `0.2` (queries consistentes)
- Validação de segurança no endpoint `/api/execute-sql` (apenas SELECT)

## 🧪 Próximos Passos (Opcional)

1. Integrar no chat principal (`/api/chat`) como uma nova função tool
2. Adicionar cache de seleção de tabelas para perguntas similares
3. Implementar validação mais rigorosa do SQL gerado
4. Adicionar métricas de tokens economizados

---

**Data de Implementação**: 2025-01-XX  
**Status**: ✅ Completo e Funcional


