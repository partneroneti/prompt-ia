# Arquitetura de Seleção Dinâmica de Esquema (2-step RAG)

Esta arquitetura foi implementada para otimizar a geração de SQL em bancos com muitas tabelas (50+), economizando tokens e aumentando a precisão.

## Estrutura

### 1. `ddlRegistry.js`
Contém os DDLs completos (`CREATE TABLE`) de todas as tabelas do banco.

**Como adicionar novas tabelas:**
```javascript
const DDL_REGISTRY = {
    nome_tabela: `CREATE TABLE nome_tabela (
        id SERIAL PRIMARY KEY,
        campo VARCHAR(255),
        ...
    );`,
    // ... adicionar mais tabelas
};
```

### 2. `tableRegistry.js`
Contém apenas uma lista resumida (`nome: descrição`) para a fase de triagem.

**Como adicionar novas tabelas:**
```javascript
const TABLE_REGISTRY = {
    nome_tabela: "Descrição breve do que a tabela armazena",
    // ... adicionar mais tabelas
};
```

## Fluxo de Funcionamento

### Passo 1: Triagem (Selector)
- **Entrada**: Pergunta do usuário + lista resumida de tabelas
- **Processo**: LLM analisa a pergunta e seleciona apenas as tabelas relevantes
- **Saída**: Array de nomes de tabelas (ex: `["tb_usuario", "tb_operacao"]`)
- **Economia**: Usa apenas lista resumida, não todos os DDLs

### Passo 2: Geração SQL
- **Entrada**: Pergunta do usuário + DDLs das tabelas selecionadas
- **Processo**: LLM gera SQL usando apenas o contexto relevante
- **Saída**: String SQL válida
- **Precisão**: Contexto focado aumenta a qualidade do SQL gerado

## Uso

```javascript
const { gerarSQLCompleto } = require('./services/sqlGenerator');

// Gerar SQL completo
const resultado = await gerarSQLCompleto("Quantos usuários temos por operação?");
console.log(resultado.sql); // SQL gerado
console.log(resultado.tabelasSelecionadas); // ["tb_usuario", "tb_operacao"]
```

## API Endpoints

### `POST /api/generate-sql`
Gera SQL a partir de uma pergunta em linguagem natural.

**Request:**
```json
{
  "question": "Quantos usuários temos por operação?"
}
```

**Response:**
```json
{
  "success": true,
  "sql": "SELECT o.str_descricao, COUNT(u.id_usuario) as count FROM tb_operacao o LEFT JOIN tb_usuario u ON o.id_operacao = u.id_operacao WHERE u.str_ativo = 'A' GROUP BY o.str_descricao",
  "tabelasSelecionadas": ["tb_usuario", "tb_operacao"],
  "message": "SQL gerado usando 2 tabela(s)"
}
```

### `POST /api/execute-sql`
Executa um SQL gerado (apenas SELECT por segurança).

**Request:**
```json
{
  "sql": "SELECT COUNT(*) FROM tb_usuario WHERE str_ativo = 'A'"
}
```

**Response:**
```json
{
  "success": true,
  "rows": [{"count": "150"}],
  "rowCount": 1
}
```

## Vantagens da Arquitetura

1. **Economia de Tokens**: Não precisa enviar todos os DDLs de uma vez
2. **Maior Precisão**: Contexto focado apenas nas tabelas relevantes
3. **Escalável**: Fácil adicionar novas tabelas sem impacto na performance
4. **Separação de Responsabilidades**: Triagem e geração são processos distintos e otimizados

## Adicionando Novas Tabelas

Para adicionar uma nova tabela ao sistema:

1. **Adicionar DDL completo** em `ddlRegistry.js`:
```javascript
nova_tabela: `CREATE TABLE nova_tabela (
    id SERIAL PRIMARY KEY,
    campo VARCHAR(255),
    ...
);`
```

2. **Adicionar descrição resumida** em `tableRegistry.js`:
```javascript
nova_tabela: "Descrição breve do propósito da tabela"
```

Pronto! A tabela estará disponível para geração de SQL automaticamente.


