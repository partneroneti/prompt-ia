/**
 * SQL Generator Service - Seleção Dinâmica de Esquema (2-step RAG)
 * 
 * Este serviço implementa a arquitetura de geração de SQL baseada em:
 * 1. Passo 1 (Triagem): Seleciona tabelas relevantes usando lista resumida
 * 2. Passo 2 (Geração): Gera SQL usando apenas DDLs das tabelas selecionadas
 * 
 * Isso economiza tokens e aumenta a precisão ao lidar com 50+ tabelas.
 */

const OpenAI = require('openai');
require('dotenv').config({ path: '../.env' });
const { getTableListForTriage, tableExists } = require('../schema/tableRegistry');
const { getDDLs } = require('../schema/ddlRegistry');

const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY
});

/**
 * PASSO 1: Seleciona as tabelas relevantes para a pergunta do usuário
 * 
 * @param {string} userQuestion - Pergunta do usuário em linguagem natural
 * @returns {Promise<string[]>} - Array com nomes das tabelas selecionadas
 */
async function selecionarTabelas(userQuestion) {
    try {
        const tableList = getTableListForTriage();
        
        const prompt = `Você é um assistente especializado em análise de banco de dados PostgreSQL.

Dada a seguinte pergunta do usuário e uma lista de tabelas disponíveis, identifique APENAS as tabelas necessárias para responder à pergunta.

PERGUNTA DO USUÁRIO:
${userQuestion}

TABELAS DISPONÍVEIS:
${tableList}

INSTRUÇÕES:
1. Analise a pergunta e identifique quais tabelas são necessárias
2. Retorne APENAS um JSON válido no formato: {"tabelas": ["nome_tabela1", "nome_tabela2"]}
3. Seja conservador - inclua apenas tabelas realmente necessárias
4. Retorne um array vazio [] se nenhuma tabela for necessária
5. Use exatamente os nomes das tabelas como aparecem na lista acima

Responda APENAS com o JSON, sem explicações adicionais.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Você é um assistente especializado em análise de esquemas de banco de dados. Você sempre retorna JSON válido conforme solicitado."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1 // Baixa temperatura para maior precisão na seleção
        });

        const responseContent = completion.choices[0].message.content;
        const parsedResponse = JSON.parse(responseContent);
        
        // Validar que a resposta contém um array de tabelas
        const tabelas = parsedResponse.tabelas || parsedResponse.tables || [];
        
        if (!Array.isArray(tabelas)) {
            throw new Error('Resposta da LLM não contém um array de tabelas válido');
        }
        
        // Validar que todas as tabelas existem no registro
        const tabelasValidas = tabelas.filter(tableName => tableExists(tableName));
        
        if (tabelasValidas.length === 0 && tabelas.length > 0) {
            console.warn('Nenhuma tabela válida encontrada. Tabelas solicitadas:', tabelas);
            throw new Error('Nenhuma tabela válida foi selecionada');
        }
        
        return tabelasValidas;
        
    } catch (error) {
        console.error('Erro ao selecionar tabelas:', error);
        throw error;
    }
}

/**
 * PASSO 2: Gera SQL usando apenas os DDLs das tabelas selecionadas
 * 
 * @param {string} userQuestion - Pergunta do usuário em linguagem natural
 * @param {string[]} selectedTables - Array com nomes das tabelas selecionadas no Passo 1
 * @returns {Promise<string>} - SQL query gerada
 */
async function gerarSQL(userQuestion, selectedTables) {
    try {
        if (!selectedTables || selectedTables.length === 0) {
            throw new Error('Nenhuma tabela foi selecionada para gerar o SQL');
        }
        
        const ddls = getDDLs(selectedTables);
        
        const prompt = `Você é um especialista em SQL PostgreSQL. 

Dada a seguinte pergunta do usuário e os esquemas DDL das tabelas relevantes, gere uma query SQL válida.

PERGUNTA DO USUÁRIO:
${userQuestion}

ESQUEMAS DDL DAS TABELAS RELEVANTES:
${ddls}

INSTRUÇÕES CRÍTICAS:
1. Gere APENAS a query SQL, sem markdown, sem explicações, sem comentários
2. Use os nomes exatos de colunas e tabelas como aparecem nos DDLs
3. Para filtros de data, use os campos de timestamp corretos (dh_edita, dh_inclui, etc)
4. Para status, considere que str_ativo = 'A' significa ativo
5. Use JOIN quando necessário para relacionar tabelas
6. Retorne uma query válida e executável
7. Se for uma consulta de contagem, use COUNT(*)
8. Se for uma consulta de listagem, use SELECT com LIMIT razoável (ex: 100)
9. Use parâmetros preparados ($1, $2, etc) apenas se necessário para valores dinâmicos
10. NÃO use markdown code blocks, retorne apenas o SQL puro

IMPORTANTE: Retorne APENAS a string SQL, sem backticks, sem markdown, sem nada além da query.`;

        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: "Você é um especialista em SQL PostgreSQL. Você sempre retorna APENAS a query SQL pura, sem formatação markdown, sem explicações."
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            temperature: 0.2 // Baixa temperatura para queries mais consistentes
        });

        let sql = completion.choices[0].message.content.trim();
        
        // Remover markdown code blocks se presente
        sql = sql.replace(/^```sql\s*/i, '');
        sql = sql.replace(/^```\s*/i, '');
        sql = sql.replace(/\s*```$/i, '');
        sql = sql.trim();
        
        // Validar que não está vazio
        if (!sql || sql.length === 0) {
            throw new Error('A LLM não retornou uma query SQL válida');
        }
        
        return sql;
        
    } catch (error) {
        console.error('Erro ao gerar SQL:', error);
        throw error;
    }
}

/**
 * Função principal que encadeia os dois passos
 * 
 * @param {string} userQuestion - Pergunta do usuário em linguagem natural
 * @returns {Promise<{sql: string, tabelasSelecionadas: string[]}>} - SQL gerado e tabelas usadas
 */
async function gerarSQLCompleto(userQuestion) {
    try {
        // Passo 1: Selecionar tabelas
        console.log('[SQL Generator] Passo 1: Selecionando tabelas relevantes...');
        const tabelasSelecionadas = await selecionarTabelas(userQuestion);
        
        if (tabelasSelecionadas.length === 0) {
            throw new Error('Não foi possível identificar tabelas relevantes para a pergunta. Por favor, reformule sua pergunta.');
        }
        
        console.log('[SQL Generator] Tabelas selecionadas:', tabelasSelecionadas);
        
        // Passo 2: Gerar SQL
        console.log('[SQL Generator] Passo 2: Gerando SQL...');
        const sql = await gerarSQL(userQuestion, tabelasSelecionadas);
        
        console.log('[SQL Generator] SQL gerado:', sql);
        
        return {
            sql,
            tabelasSelecionadas
        };
        
    } catch (error) {
        console.error('[SQL Generator] Erro no processo completo:', error);
        throw error;
    }
}

module.exports = {
    selecionarTabelas,
    gerarSQL,
    gerarSQLCompleto
};


