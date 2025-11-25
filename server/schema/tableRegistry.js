/**
 * Table Registry - Lista resumida de tabelas para triagem (Passo 1)
 * 
 * Este arquivo contém apenas o nome e descrição de cada tabela.
 * Usado na fase de seleção para economizar tokens na primeira chamada à LLM.
 */

const TABLE_REGISTRY = {
    // Módulo: Usuários e Acesso
    tb_usuario: "Tabela de usuários do sistema com informações de login, nome, email, CPF e permissões",
    tb_perfil: "Tabela de perfis de acesso (MASTER, OPERACIONAL, etc)",
    tb_usuario_perfil: "Tabela de relacionamento entre usuários e perfis (muitos para muitos)",
    tb_role: "Tabela de roles/permissões específicas do sistema",
    tb_perfil_role: "Tabela de relacionamento entre perfis e roles",
    
    // Módulo: Operações e Estrutura
    tb_operacao: "Tabela de operações financeiras/produtos de crédito",
    tb_grupo: "Tabela de grupos organizacionais com hierarquia e ordem",
    tb_grupo_operacao: "Tabela de relacionamento entre grupos e operações",
    
    // Módulo: Propostas e CRM
    tb_formalizacao_proposta: "Tabela principal de propostas de crédito com valores, prazos e status",
    tb_formalizacao: "Tabela de formalizações de propostas com fases de processamento",
    tb_status_proposta: "Tabela de status possíveis para propostas (aguardando, aprovada, cancelada, etc)",
    tb_formalizacao_historico: "Tabela de histórico de alterações e fases de formalizações",
    
    // Módulo: Financeiro/Comissões
    tb_extrato_comissao: "Tabela de extratos de comissão com valores, impostos e status de pagamento",
    tb_extrato_comissao_lote: "Tabela de lotes de pagamento de comissões",
    tb_tabela_comissao: "Tabela de tabelas de comissão configuradas",
    tb_tipo_comissao: "Tabela de tipos de comissão",
    
    // Módulo: Parceiros/Entidades
    tb_entidade: "Tabela de entidades/parceiros/correspondentes bancários",
    tb_entidade_email: "Tabela de emails das entidades (um para muitos)",
    tb_entidade_telefone: "Tabela de telefones das entidades (um para muitos)",
    tb_entidade_endereco: "Tabela de endereços das entidades (um para muitos)",
    
    // Módulo: Campanhas
    tb_campanha: "Tabela de campanhas de incentivo com vigências, metas e configurações",
    tb_campanha_apuracao: "Tabela de apuração de resultados de campanhas por entidade",
    tb_campanha_premio: "Tabela de prêmios/premiações das campanhas",
    
    // Módulo: Logs e Auditoria
    log_alteracoes: "Tabela de log de alterações em registros do sistema (triggers automáticos)",
    audit_logs: "Tabela de logs de auditoria de ações do sistema"
};

/**
 * Retorna uma lista resumida formatada para o prompt de triagem
 * @returns {string} - Lista formatada de tabelas
 */
function getTableListForTriage() {
    return Object.entries(TABLE_REGISTRY)
        .map(([tableName, description]) => `${tableName}: ${description}`)
        .join('\n');
}

/**
 * Retorna apenas os nomes das tabelas
 * @returns {string[]} - Array com nomes de todas as tabelas
 */
function getAllTableNames() {
    return Object.keys(TABLE_REGISTRY);
}

/**
 * Verifica se uma tabela existe no registro
 * @param {string} tableName - Nome da tabela
 * @returns {boolean}
 */
function tableExists(tableName) {
    return tableName in TABLE_REGISTRY;
}

module.exports = {
    TABLE_REGISTRY,
    getTableListForTriage,
    getAllTableNames,
    tableExists
};


