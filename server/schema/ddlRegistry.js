/**
 * DDL Registry - Registro completo de DDLs (CREATE TABLE) de todas as tabelas
 * 
 * Este arquivo contém os DDLs completos de todas as tabelas do banco de dados.
 * Para escalar para 50+ tabelas, basta adicionar novos DDLs aqui seguindo o mesmo padrão.
 */

const DDL_REGISTRY = {
    // ============================================
    // MÓDULO: Usuários e Acesso
    // ============================================
    
    tb_usuario: `CREATE TABLE tb_usuario (
    id_usuario SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_login VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL,
    str_cpf VARCHAR(20) NOT NULL,
    str_senha VARCHAR(255),
    bloqueado BOOLEAN DEFAULT false,
    str_ativo CHAR(1) DEFAULT 'A' CHECK (str_ativo IN ('A', 'E', 'I')),
    id_operacao INTEGER,
    id_grupo INTEGER,
    id_usuarioinclui INTEGER,
    id_usuarioedita INTEGER,
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dh_edita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_operacao) REFERENCES tb_operacao(id_operacao),
    FOREIGN KEY (id_grupo) REFERENCES tb_grupo(id_grupo)
);`,

    tb_perfil: `CREATE TABLE tb_perfil (
    id_perfil SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    id_operacao INTEGER,
    str_ativo CHAR(1) DEFAULT 'A',
    FOREIGN KEY (id_operacao) REFERENCES tb_operacao(id_operacao)
);`,

    tb_usuario_perfil: `CREATE TABLE tb_usuario_perfil (
    id SERIAL PRIMARY KEY,
    id_usuario INTEGER NOT NULL,
    id_perfil INTEGER NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES tb_usuario(id_usuario),
    FOREIGN KEY (id_perfil) REFERENCES tb_perfil(id_perfil),
    UNIQUE(id_usuario, id_perfil)
);`,

    tb_role: `CREATE TABLE tb_role (
    id_role SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL UNIQUE,
    str_ativo CHAR(1) DEFAULT 'A'
);`,

    tb_perfil_role: `CREATE TABLE tb_perfil_role (
    id SERIAL PRIMARY KEY,
    id_perfil INTEGER NOT NULL,
    id_role INTEGER NOT NULL,
    FOREIGN KEY (id_perfil) REFERENCES tb_perfil(id_perfil),
    FOREIGN KEY (id_role) REFERENCES tb_role(id_role),
    UNIQUE(id_perfil, id_role)
);`,

    // ============================================
    // MÓDULO: Operações e Estrutura
    // ============================================
    
    tb_operacao: `CREATE TABLE tb_operacao (
    id_operacao SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_documento VARCHAR(20),
    str_ativo CHAR(1) DEFAULT 'A' CHECK (str_ativo IN ('A', 'E', 'I')),
    config JSONB,
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dh_edita TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

    tb_grupo: `CREATE TABLE tb_grupo (
    id_grupo SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    id_operacao INTEGER,
    excecao BOOLEAN DEFAULT false,
    ordem INTEGER DEFAULT 0,
    str_observacao TEXT,
    str_ativo CHAR(1) DEFAULT 'A',
    FOREIGN KEY (id_operacao) REFERENCES tb_operacao(id_operacao)
);`,

    tb_grupo_operacao: `CREATE TABLE tb_grupo_operacao (
    id SERIAL PRIMARY KEY,
    id_grupo INTEGER NOT NULL,
    id_operacao INTEGER NOT NULL,
    FOREIGN KEY (id_grupo) REFERENCES tb_grupo(id_grupo),
    FOREIGN KEY (id_operacao) REFERENCES tb_operacao(id_operacao),
    UNIQUE(id_grupo, id_operacao)
);`,

    // ============================================
    // MÓDULO: Propostas e CRM
    // ============================================
    
    tb_formalizacao_proposta: `CREATE TABLE tb_formalizacao_proposta (
    id_proposta SERIAL PRIMARY KEY,
    str_proposta VARCHAR(100) NOT NULL UNIQUE,
    n_valorliquido DECIMAL(18,2),
    n_valorcontrato DECIMAL(18,2),
    n_valorparcela DECIMAL(18,2),
    n_prazo INTEGER,
    id_status INTEGER,
    id_produto INTEGER,
    id_convenio INTEGER,
    id_entidade INTEGER,
    str_matricula VARCHAR(100),
    str_cpf VARCHAR(20),
    dt_averbacao DATE,
    dh_concluido TIMESTAMP,
    dh_cancelado TIMESTAMP,
    dh_pago TIMESTAMP,
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dh_edita TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_status) REFERENCES tb_status_proposta(id_status),
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade)
);`,

    tb_formalizacao: `CREATE TABLE tb_formalizacao (
    id_formalizacao SERIAL PRIMARY KEY,
    id_proposta INTEGER,
    id_fase INTEGER,
    str_ativo CHAR(1) DEFAULT 'A',
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proposta) REFERENCES tb_formalizacao_proposta(id_proposta)
);`,

    tb_status_proposta: `CREATE TABLE tb_status_proposta (
    id_status SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_ativo CHAR(1) DEFAULT 'A'
);`,

    tb_formalizacao_historico: `CREATE TABLE tb_formalizacao_historico (
    id SERIAL PRIMARY KEY,
    id_formalizacao INTEGER NOT NULL,
    id_fase INTEGER,
    str_observacao TEXT,
    dh_historico TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_formalizacao) REFERENCES tb_formalizacao(id_formalizacao)
);`,

    // ============================================
    // MÓDULO: Financeiro/Comissões
    // ============================================
    
    tb_extrato_comissao: `CREATE TABLE tb_extrato_comissao (
    id_extrato SERIAL PRIMARY KEY,
    id_proposta INTEGER,
    id_entidade INTEGER,
    id_tipo_comissao INTEGER,
    n_valor DECIMAL(18,2),
    pct_comissao DECIMAL(5,2),
    n_valor_liquido DECIMAL(18,2),
    n_valor_ir DECIMAL(18,2),
    n_valor_iss DECIMAL(18,2),
    id_status INTEGER,
    bloqueado BOOLEAN DEFAULT false,
    dh_pago TIMESTAMP,
    id_lote INTEGER,
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_proposta) REFERENCES tb_formalizacao_proposta(id_proposta),
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade),
    FOREIGN KEY (id_lote) REFERENCES tb_extrato_comissao_lote(id_lote)
);`,

    tb_extrato_comissao_lote: `CREATE TABLE tb_extrato_comissao_lote (
    id_lote SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255),
    dt_pagamento DATE,
    id_status INTEGER,
    n_valor_total DECIMAL(18,2),
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

    tb_tabela_comissao: `CREATE TABLE tb_tabela_comissao (
    id_tabela SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_ativo CHAR(1) DEFAULT 'A',
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

    tb_tipo_comissao: `CREATE TABLE tb_tipo_comissao (
    id_tipo_comissao SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_ativo CHAR(1) DEFAULT 'A'
);`,

    // ============================================
    // MÓDULO: Parceiros/Entidades
    // ============================================
    
    tb_entidade: `CREATE TABLE tb_entidade (
    id_entidade SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    str_documento VARCHAR(20),
    id_tipo INTEGER,
    str_logo VARCHAR(500),
    str_icone VARCHAR(500),
    str_cor VARCHAR(7),
    custom JSONB,
    str_ativo CHAR(1) DEFAULT 'A',
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dh_edita TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

    tb_entidade_email: `CREATE TABLE tb_entidade_email (
    id SERIAL PRIMARY KEY,
    id_entidade INTEGER NOT NULL,
    str_email VARCHAR(255) NOT NULL,
    str_ativo CHAR(1) DEFAULT 'A',
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade)
);`,

    tb_entidade_telefone: `CREATE TABLE tb_entidade_telefone (
    id SERIAL PRIMARY KEY,
    id_entidade INTEGER NOT NULL,
    str_telefone VARCHAR(20) NOT NULL,
    id_tipo_telefone INTEGER,
    str_ativo CHAR(1) DEFAULT 'A',
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade)
);`,

    tb_entidade_endereco: `CREATE TABLE tb_entidade_endereco (
    id SERIAL PRIMARY KEY,
    id_entidade INTEGER NOT NULL,
    str_cep VARCHAR(10),
    str_logradouro VARCHAR(255),
    str_numero VARCHAR(20),
    str_complemento VARCHAR(100),
    str_bairro VARCHAR(100),
    str_cidade VARCHAR(100),
    str_estado CHAR(2),
    str_ativo CHAR(1) DEFAULT 'A',
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade)
);`,

    // ============================================
    // MÓDULO: Campanhas
    // ============================================
    
    tb_campanha: `CREATE TABLE tb_campanha (
    id_campanha SERIAL PRIMARY KEY,
    str_descricao VARCHAR(255) NOT NULL,
    id_status INTEGER,
    id_tipo INTEGER,
    dt_vigencia_ini DATE,
    dt_vigencia_fim DATE,
    periodo_apuracao VARCHAR(50),
    metas JSONB,
    convenios JSONB,
    produtos JSONB,
    entidades JSONB,
    n_prioridade_pagamento INTEGER DEFAULT 0,
    dh_inclui TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dh_edita TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,

    tb_campanha_apuracao: `CREATE TABLE tb_campanha_apuracao (
    id SERIAL PRIMARY KEY,
    id_campanha INTEGER NOT NULL,
    id_entidade INTEGER,
    dt_apuracao DATE,
    n_valor_apurado DECIMAL(18,2),
    n_meta DECIMAL(18,2),
    FOREIGN KEY (id_campanha) REFERENCES tb_campanha(id_campanha),
    FOREIGN KEY (id_entidade) REFERENCES tb_entidade(id_entidade)
);`,

    tb_campanha_premio: `CREATE TABLE tb_campanha_premio (
    id SERIAL PRIMARY KEY,
    id_campanha INTEGER NOT NULL,
    str_descricao VARCHAR(255),
    n_valor DECIMAL(18,2),
    n_posicao_rank INTEGER,
    FOREIGN KEY (id_campanha) REFERENCES tb_campanha(id_campanha)
);`,

    // ============================================
    // MÓDULO: Logs e Auditoria
    // ============================================
    
    log_alteracoes: `CREATE TABLE log_alteracoes (
    id SERIAL PRIMARY KEY,
    dh_log TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    aplicacao VARCHAR(100),
    login VARCHAR(255),
    objeto VARCHAR(100),
    script TEXT,
    acao VARCHAR(50),
    id_objeto INTEGER,
    dados_antigos JSONB,
    dados_novos JSONB
);`,

    audit_logs: `CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    action_type VARCHAR(100) NOT NULL,
    target_user_id INTEGER,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`
};

/**
 * Retorna o DDL completo de uma tabela específica
 * @param {string} tableName - Nome da tabela
 * @returns {string|null} - DDL da tabela ou null se não encontrada
 */
function getDDL(tableName) {
    return DDL_REGISTRY[tableName] || null;
}

/**
 * Retorna os DDLs de múltiplas tabelas
 * @param {string[]} tableNames - Array de nomes de tabelas
 * @returns {string} - DDLs concatenados das tabelas solicitadas
 */
function getDDLs(tableNames) {
    return tableNames
        .map(tableName => getDDL(tableName))
        .filter(ddl => ddl !== null)
        .join('\n\n');
}

module.exports = {
    DDL_REGISTRY,
    getDDL,
    getDDLs
};
