const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { sanitizeUserMessage, redactSensitiveOutput } = require('../utils/security');

const ENV_CANDIDATES = [
    process.env.ROOT_ENV_PATH,
    path.resolve(__dirname, '../../.env'),
    path.resolve(__dirname, '../.env'),
    path.resolve(process.cwd(), '../.env'),
    path.resolve(process.cwd(), '.env')
].filter(Boolean);

let envLoaded = false;
for (const candidate of ENV_CANDIDATES) {
    if (fs.existsSync(candidate)) {
        dotenv.config({ path: candidate });
        envLoaded = true;
        break;
    }
}

if (!envLoaded) {
    dotenv.config();
}

const openai = new OpenAI({
    apiKey: process.env.VITE_OPENAI_API_KEY
});

const TOOLS = [
    {
        type: "function",
        function: {
            name: "createUser",
            description: "Cadastrar um novo usuário no sistema",
            parameters: {
                type: "object",
                properties: {
                    name: { type: "string", description: "Nome completo do usuário" },
                    login: { type: "string", description: "Login único (ex.: joao.silva). Imutável após criação." },
                    profile: { type: "string", enum: ["MASTER", "OPERACIONAL"], description: "Perfil de acesso" },
                    company: { type: "string", description: "Nome da empresa" },
                    email: { type: "string", description: "Email corporativo do usuário" },
                    cpf: { type: "string", description: "CPF do usuário (opcional, mas imutável após criação)" }
                },
                required: ["name", "login", "email", "profile", "company"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "findUserAndUpdate",
            description: "Encontra um usuário por login, email ou CPF e atualiza suas informações. Use esta função para qualquer pedido de modificação de usuário, incluindo mudança de perfil.",
            parameters: {
                type: "object",
                properties: {
                    login: { type: "string", description: "Login do usuário a ser atualizado" },
                    email: { type: "string", description: "Email atual do usuário a ser atualizado" },
                    cpf: { type: "string", description: "CPF do usuário a ser atualizado" },
                    newName: { type: "string", description: "Novo nome completo" },
                    newEmail: { type: "string", description: "Novo email" },
                    newPassword: { type: "string", description: "Nova senha" },
                    newCpf: { type: "string", description: "Novo CPF" },
                    newProfile: { type: "string", enum: ["MASTER", "OPERACIONAL"], description: "Novo perfil do usuário. IMPORTANTE: Promover para MASTER requer confirmação." }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "blockUser",
            description: "BLOQUEAR ou DESBLOQUEAR um usuário. Use esta função quando o usuário pedir para bloquear ou desbloquear. Você pode fornecer user_id OU login/email - o sistema buscará o usuário automaticamente. Bloquear requer confirmação, desbloquear é direto.",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "integer", description: "ID do usuário (use se tiver o ID)" },
                    login: { type: "string", description: "Login do usuário (use se não tiver o ID)" },
                    email: { type: "string", description: "Email do usuário (use se não tiver o ID nem login)" },
                    block: { type: "boolean", description: "true = bloquear (pede confirmação), false = desbloquear (executa direto)" }
                },
                required: ["block"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "deleteUser",
            description: "Marcar um usuário como excluído (soft delete, muda str_ativo para 'E')",
            parameters: {
                type: "object",
                properties: {
                    user_id: { type: "integer", description: "ID do usuário a ser excluído" }
                },
                required: ["user_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "blockUsers",
            description: "Bloquear ou desbloquear todos os usuários de uma empresa/operação específica. Use quando o usuário pedir para bloquear/desbloquear todos os usuários de uma empresa. Bloquear requer confirmação, desbloquear é direto.",
            parameters: {
                type: "object",
                properties: {
                    company: { type: "string", description: "Nome da empresa/operação" },
                    block: { type: "boolean", description: "true = bloquear (pede confirmação), false = desbloquear (executa direto). Padrão: true" }
                },
                required: ["company"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "resetPasswords",
            description: "Resetar senhas de todos os usuários de uma empresa",
            parameters: {
                type: "object",
                properties: {
                    company: { type: "string", description: "Nome da empresa" }
                },
                required: ["company"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryUsers",
            description: "Use esta função para buscar, listar ou contar usuários. Suporta filtros por data de modificação e por operação. Use quando a pergunta mencionar 'usuários da operação X', 'usuários da Partner', etc. Não use para modificações. NÃO use para perguntas sobre grupos ou operações isoladamente.",
            parameters: {
                type: "object",
                properties: {
                    filters: {
                        type: "object",
                        description: "Filtros para a consulta",
                        properties: {
                            id: { type: "integer", description: "Filtrar por ID do usuário (exato)" },
                            name: { type: "string", description: "Filtrar por nome (parcial, case-insensitive)" },
                            login: { type: "string", description: "Filtrar por login. Use busca exata se fornecer login completo (ex: 'luis.eri.santos'), ou parcial se fornecer parte do login." },
                            email: { type: "string", description: "Filtrar por email (parcial, case-insensitive)" },
                            cpf: { type: "string", description: "Filtrar por CPF (exato)" },
                            status: { type: "string", enum: ["ATIVO", "BLOQUEADO"], description: "Filtrar por status" },
                            operation: { type: "string", description: "Filtrar por nome da operação (parcial, case-insensitive). Ex: 'Partner', 'FGTS', etc. Usa JOIN com tb_operacao." },
                            operation_id: { type: "integer", description: "Filtrar por ID da operação (exato)" },
                            group: { type: "string", description: "Filtrar por nome do grupo (parcial, case-insensitive). Usa JOIN com tb_grupo." },
                            group_id: { type: "integer", description: "Filtrar por ID do grupo (exato)" },
                            profile: { type: "string", description: "Filtrar por nome do perfil (parcial, case-insensitive). Usa JOIN com tb_perfil via tb_usuario_perfil." },
                            profile_id: { type: "integer", description: "Filtrar por ID do perfil (exato). Usa JOIN com tb_perfil via tb_usuario_perfil." },
                            date_from: { type: "string", description: "Data inicial para filtro de modificação. Aceita linguagem natural em português: 'hoje', 'ontem', 'semana passada', 'mês passado', '01/11/2025', 'últimos 7 dias', etc." },
                            date_to: { type: "string", description: "Data final para filtro de modificação. Aceita linguagem natural em português." }
                        }
                    },
                    count_only: {
                        type: "boolean",
                        description: "Se true, retorna apenas a contagem. Se false, retorna os dados completos"
                    }
                },
                required: []
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryGroups",
            description: "Use esta função para buscar, listar ou contar GRUPOS. Use quando a pergunta mencionar 'grupos', 'grupo', 'group'. NÃO confunda com usuários.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar grupos por nome (parcial, case-insensitive)" },
                    operation: { type: "string", description: "Filtrar por nome da operação associada" },
                    action: { 
                        type: "string", 
                        enum: ["LIST", "HIERARCHY", "STATS"],
                        description: "LIST: listar grupos encontrados. HIERARCHY: mostrar hierarquia. STATS: contar total de grupos ativos."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryOperations",
            description: "Use esta função para buscar, listar ou contar OPERAÇÕES. Use quando a pergunta mencionar 'operações', 'operação', 'operation'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar operações por nome (parcial, case-insensitive)" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST", "COUNT_USERS"],
                        description: "STATS: contar total de operações ativas. LIST: listar operações. COUNT_USERS: contar usuários por operação."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryProfiles",
            description: "Use esta função para buscar, listar ou contar PERFIS. Use quando a pergunta mencionar 'perfis', 'perfil', 'profile'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar perfis por nome (parcial, case-insensitive)" },
                    operation: { type: "string", description: "Filtrar por nome da operação associada" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST"],
                        description: "STATS: contar total de perfis ativos. LIST: listar perfis."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryRoles",
            description: "Use esta função para buscar, listar ou contar ROLES/PERMISSÕES. Use quando a pergunta mencionar 'roles', 'role', 'permissões', 'permissão'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar roles por nome (parcial, case-insensitive)" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST"],
                        description: "STATS: contar total de roles ativas. LIST: listar roles."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryProposals",
            description: "Use esta função para buscar, listar ou contar PROPOSTAS. Use quando a pergunta mencionar 'propostas', 'proposta', 'proposal'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar propostas por número/proposta (parcial)" },
                    cpf: { type: "string", description: "Filtrar por CPF do cliente" },
                    status: { type: "string", description: "Filtrar por status da proposta" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST", "BY_STATUS"],
                        description: "STATS: contar total de propostas. LIST: listar propostas. BY_STATUS: contar propostas por status."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryStatusProposals",
            description: "Use esta função para listar STATUS DE PROPOSTAS disponíveis. Use quando a pergunta mencionar 'status de propostas', 'status disponíveis'.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["LIST"],
                        description: "LIST: listar todos os status disponíveis para propostas."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryCommissions",
            description: "Use esta função para buscar, listar ou contar COMISSÕES. Use quando a pergunta mencionar 'comissões', 'comissão', 'commission', 'extrato de comissão'.",
            parameters: {
                type: "object",
                properties: {
                    entidade: { type: "string", description: "Filtrar por nome da entidade" },
                    status: { type: "string", description: "Filtrar por status do pagamento" },
                    bloqueado: { type: "boolean", description: "Filtrar por bloqueado (true/false)" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST", "BY_STATUS", "TOTAL_VALUE"],
                        description: "STATS: contar comissões. LIST: listar comissões. BY_STATUS: contar por status. TOTAL_VALUE: somar valores."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryCommissionLots",
            description: "Use esta função para buscar, listar ou contar LOTES DE COMISSÃO. Use quando a pergunta mencionar 'lotes de comissão', 'lote de pagamento'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar lotes por descrição (parcial)" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST"],
                        description: "STATS: contar total de lotes. LIST: listar lotes."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryCommissionTables",
            description: "Use esta função para listar TABELAS DE COMISSÃO configuradas. Use quando a pergunta mencionar 'tabelas de comissão', 'tabela de comissão'.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["LIST"],
                        description: "LIST: listar tabelas de comissão ativas."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryCommissionTypes",
            description: "Use esta função para listar TIPOS DE COMISSÃO disponíveis. Use quando a pergunta mencionar 'tipos de comissão', 'tipo de comissão'.",
            parameters: {
                type: "object",
                properties: {
                    action: { 
                        type: "string", 
                        enum: ["LIST"],
                        description: "LIST: listar tipos de comissão ativos."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryEntities",
            description: "Use esta função para buscar, listar ou contar ENTIDADES/PARCEIROS. Use quando a pergunta mencionar 'entidades', 'entidade', 'parceiros', 'parceiro', 'correspondentes'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar entidades por nome ou documento (parcial)" },
                    tipo: { type: "string", description: "Filtrar por tipo de entidade" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST"],
                        description: "STATS: contar total de entidades ativas. LIST: listar entidades."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryCampaigns",
            description: "Use esta função para buscar, listar ou contar CAMPANHAS. Use quando a pergunta mencionar 'campanhas', 'campanha', 'campaign'.",
            parameters: {
                type: "object",
                properties: {
                    search: { type: "string", description: "Buscar campanhas por nome (parcial)" },
                    status: { type: "string", description: "Filtrar por status da campanha" },
                    action: { 
                        type: "string", 
                        enum: ["STATS", "LIST"],
                        description: "STATS: contar total de campanhas. LIST: listar campanhas."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "queryAuditLogs",
            description: "Use esta função para buscar LOGS DE AUDITORIA. Use quando a pergunta mencionar 'auditoria', 'logs de auditoria', 'audit logs'.",
            parameters: {
                type: "object",
                properties: {
                    action_type: { type: "string", description: "Filtrar por tipo de ação" },
                    target_user_id: { type: "integer", description: "Filtrar por ID do usuário alvo" },
                    limit: { type: "integer", description: "Limite de resultados (padrão: 10)" },
                    action: { 
                        type: "string", 
                        enum: ["LIST", "STATS"],
                        description: "LIST: listar logs de auditoria. STATS: contar logs."
                    }
                },
                required: ["action"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "generateReport",
            description: "Use esta função para GERAR RELATÓRIOS em CSV. Use quando o usuário pedir para 'gerar relatório', 'exportar relatório', 'baixar relatório', 'relatório CSV', 'relatório de usuários', 'relatório de comissões', etc.",
            parameters: {
                type: "object",
                properties: {
                    type: { 
                        type: "string", 
                        description: "Tipo de relatório: users, operations, commissions, audit, ou ID de relatório customizado (ex: custom_1234567890_abc123)"
                    },
                    filters: {
                        type: "object",
                        properties: {
                            status: { type: "string", description: "Filtrar por status (ATIVO, BLOQUEADO, INATIVO) - apenas para relatório de usuários" },
                            operation: { type: "string", description: "Filtrar por operação/empresa - apenas para relatório de usuários" },
                            dateFrom: { type: "string", description: "Data inicial (YYYY-MM-DD ou MM/YYYY)" },
                            dateTo: { type: "string", description: "Data final (YYYY-MM-DD ou MM/YYYY)" }
                        }
                    }
                },
                required: ["type"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "createCustomReport",
            description: "Use esta função para CRIAR UM NOVO TIPO DE RELATÓRIO que não existe na tela de relatórios. Use quando o usuário pedir para 'criar um relatório de X', 'adicionar relatório de Y', 'implementar relatório de Z'. Você deve gerar um SQL válido para o relatório solicitado.",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: "string",
                        description: "Nome do relatório (ex: 'Relatório de Propostas', 'Relatório de Entidades')"
                    },
                    description: {
                        type: "string",
                        description: "Descrição do que o relatório mostra"
                    },
                    sqlQuery: {
                        type: "string",
                        description: "Query SQL completa para gerar o relatório. Use aliases com aspas duplas para os nomes das colunas (ex: SELECT u.id_usuario as \"ID\", u.str_descricao as \"Nome\"). A query deve ser válida e segura."
                    },
                    columns: {
                        type: "array",
                        items: { type: "string" },
                        description: "Lista de nomes das colunas que serão exibidas (opcional, será extraído do SQL se não fornecido)"
                    }
                },
                required: ["name", "description", "sqlQuery"]
            }
        }
    }
];

const processMessage = async (message) => {
    const securityResult = sanitizeUserMessage(message);

    if (securityResult.blocked) {
        return {
            type: 'MESSAGE',
            content: securityResult.userFeedback
        };
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `Você é um assistente de Gestão de Usuários via IA. Execute ações apenas usando as funções disponíveis e siga TODAS as regras abaixo.

🚨 REGRA CRÍTICA - BLOQUEAR/DESBLOQUEAR USUÁRIO:
Quando o usuário pedir "bloquear [login/email]" ou "desbloquear [login/email]":
1. Use blockUser DIRETAMENTE com login ou email - NÃO precisa fazer queryUsers primeiro!
2. Exemplo: "bloquear teste.op" → blockUser({ login: "teste.op", block: true })
3. NUNCA apenas mostre os dados e pare - SEMPRE execute a ação!

---

## 1. Inclusão de Usuário (createUser)
- Só use \`createUser\` após coletar **nome, login, e-mail, perfil e empresa**.
- Campos obrigatórios do payload: \`name\`, \`login\`, \`email\`, \`profile\`, \`company\`. Sem um deles, peça ao solicitante.
- Gere o CPF apenas se o usuário não informar; depois de criado, **login e CPF são imutáveis**.
- Antes de criar, valide duplicidades (mesmo login ou e-mail já informado).
- Sempre retorne: status (sucesso/erro), resumo da operação e identificador de auditoria.

## 2. Alteração de Usuário (findUserAndUpdate / blockUser / blockUsers / resetPasswords)
- Só altere **nome**, **email**, **senha**, **CPF** ou **perfil** via \`findUserAndUpdate\`. Nunca tente alterar login.
- Para mudar perfil para **MASTER**: requer confirmação obrigatória (ação sensível).
- Para mudar perfil para **OPERACIONAL** ou outros: executa diretamente sem confirmação.
- Exemplo: "Trocar o perfil do usuário teste.op para MASTER" → \`findUserAndUpdate({ login: "teste.op", newProfile: "MASTER" })\` (solicitará confirmação).

- **REGRA CRÍTICA - BLOQUEAR/DESBLOQUEAR**: 
  Quando o usuário pedir "bloquear [login/email]" ou "desbloquear [login/email]":
  - **USE blockUser DIRETAMENTE** com login ou email - NÃO precisa fazer queryUsers primeiro!
  - Exemplo: "bloquear teste.op" → \`blockUser({ login: "teste.op", block: true })\`
  - Exemplo: "desbloquear teste.op" → \`blockUser({ login: "teste.op", block: false })\`
  - **NUNCA** apenas mostre os dados e pare - você DEVE executar a ação!

- Ações sensíveis:
  - \`blockUser\` com \`block: true\` (bloquear) **REQUER CONFIRMAÇÃO** - o sistema pedirá confirmação automaticamente.
  - \`blockUser\` com \`block: false\` (desbloquear) é executado diretamente sem confirmação.
  - \`blockUsers\` com \`block: true\` (bloquear todos) **REQUER CONFIRMAÇÃO** - o sistema pedirá confirmação automaticamente.
  - \`blockUsers\` com \`block: false\` (desbloquear todos) é executado diretamente sem confirmação.
  - \`resetPasswords\`, ou promover para perfil MASTER exigem aviso + confirmação (pergunte "Deseja prosseguir? (SIM/NÃO)" e aguarde token).
- Resets de senha devem registrar auditoria com a empresa/alcance.

## 3. Consultas de Usuários (queryUsers)
- Use \`queryUsers\` para contagens e listagens. Admitido filtros naturais: empresa (operation/company), período (\`date_from/date_to\` em PT-BR), perfil, grupo, status, login, CPF.
- Para “Usuários incluídos esta semana” use \`{ date_from: "semana atual" }\`.
- Sempre respeite RBAC: se o solicitante não puder ver certo escopo, retorne mensagem orientando a falta de permissão.
- Resultados devem trazer contagem total, resumo e, quando aplicável, auditId.

## 4. Relatórios
- Para gerar relatórios em CSV, use \`generateReport\` com o tipo e filtros apropriados.
- Tipos disponíveis: "users" (usuários), "operations" (operações), "commissions" (comissões), "audit" (auditoria).
- Filtros suportados: status (ATIVO/BLOQUEADO/INATIVO), operation (nome da operação), dateFrom, dateTo.
- Quando o usuário pedir "gerar relatório", "exportar CSV", "baixar relatório", use \`generateReport\` diretamente.
- **CRIAR NOVOS RELATÓRIOS**: Quando o usuário pedir para criar um relatório que não existe (ex: "criar relatório de propostas", "adicionar relatório de entidades"), use \`createCustomReport\` para criar um novo tipo de relatório. Você deve gerar um SQL SELECT válido e seguro. O relatório será adicionado automaticamente à tela de relatórios.

## 5. Regras Gerais
1. **Confirmação obrigatória** para ações em massa (bloquear todos, resetar senhas, alterar perfil MASTER).
2. **Valide parâmetros** antes de usar qualquer função. Se empresa/perfil/usuário não foi informado, peça.
3. Toda resposta deve conter: Status (sucesso/erro/parcial), Resumo da operação, Identificador de auditoria (ex.: AUD-XYZ123).
4. Registre auditoria (ou informe que será registrada) para qualquer ação de escrita.
5. Utilize linguagem clara, cite filtros aplicados e recomende próximos passos quando necessário.

## 6. Módulos e Funções Disponíveis
- **Usuários**: \`createUser\`, \`findUserAndUpdate\`, \`queryUsers\`, \`blockUser\`, \`deleteUser\`
- **Perfis/Roles**: \`queryProfiles\`, \`queryRoles\`
- **Operações/Grupos**: \`queryOperations\`, \`queryGroups\`
- **Ações em Massa**: \`blockUsers\`, \`resetPasswords\`
- **Consultas adicionais**: \`queryProposals\`, \`queryCommissions\`, \`queryEntities\`, \`queryCampaigns\`, etc.

## 7. Exemplos Guiados
- “Cadastrar João Silva, perfil OPERACIONAL, empresa DANIEL CRED, e-mail joao@ex.com” → validar dados e usar \`createUser\` com todos os campos obrigatórios.
- "Trocar o perfil do usuário teste.op para MASTER" → usar \`findUserAndUpdate({ login: "teste.op", newProfile: "MASTER" })\` (solicitará confirmação automática).
- "Trocar o perfil do usuário teste.op para OPERACIONAL" → usar \`findUserAndUpdate({ login: "teste.op", newProfile: "OPERACIONAL" })\` (executa diretamente).
- **"Atualize email do usuário luis.eri para luis.eri@partnergroup.com.br"** → \`findUserAndUpdate({ login: "luis.eri", newEmail: "luis.eri@partnergroup.com.br" })\` - Use diretamente, não precisa queryUsers!
- "Trocar o e-mail do usuário luis.eri.santos para luis@empresa.com" → validar permissão e usar \`findUserAndUpdate({ login: "luis.eri.santos", newEmail: "luis@empresa.com" })\`, retornando sempre algo como "Audit ID: 92ab1df4".
- **"Atualizar [qualquer campo] do usuário [login/email]"** → \`findUserAndUpdate({ login: "...", newEmail: "..." })\` ou \`findUserAndUpdate({ email: "...", newName: "..." })\` - Use diretamente!
- "Bloquear todos os usuários da empresa DANIEL CRED" → pedir confirmação e usar \`blockUsers({ company: "DANIEL CRED", block: true })\`.
- "Desbloquear todos os usuários da empresa Partner" → usar \`blockUsers({ company: "Partner", block: false })\` - executa diretamente sem confirmação!
- **"Bloquear usuário teste.op"** → \`blockUser({ login: "teste.op", block: true })\` - Use diretamente, não precisa queryUsers!
- **"Desbloquear usuário teste.op"** → \`blockUser({ login: "teste.op", block: false })\` - Use diretamente!
- **"Bloquear [qualquer login/email]"** → \`blockUser({ login: "...", block: true })\` ou \`blockUser({ email: "...", block: true })\` - Use diretamente!
- "Quero todos os usuários incluídos esta semana" → \`queryUsers({ filters: { date_from: "semana atual" } })\`.
- "Quantidade de usuários por empresa" → usar consulta agregada disponível ou usar \`generateReport({ type: "operations" })\` para relatório completo.
- **"Gerar relatório de usuários em CSV"** → \`generateReport({ type: "users" })\` - Gera e faz download do CSV!
- **"Exportar relatório de comissões"** → \`generateReport({ type: "commissions" })\` - Gera CSV de comissões!
- **"Baixar relatório de usuários ativos"** → \`generateReport({ type: "users", filters: { status: "ATIVO" } })\` - Gera CSV filtrado!
- **"Gerar relatório de auditoria"** → \`generateReport({ type: "audit" })\` - Gera CSV de logs de auditoria!

Seja extremamente rigoroso: valide permissão, confirme parâmetros, peça confirmação quando a ação for sensível e sempre retorne status + resumo + auditId.`
                },
                { role: "user", content: securityResult.sanitizedMessage }
            ],
            tools: TOOLS,
            tool_choice: "auto"
        });

        const responseMessage = completion.choices[0].message;

        if (responseMessage.tool_calls) {
            return {
                type: 'TOOL_CALL',
                toolCalls: responseMessage.tool_calls
            };
        }

        const safeContent = redactSensitiveOutput(responseMessage.content);

        return {
            type: 'MESSAGE',
            content: safeContent
        };

    } catch (error) {
        console.error("OpenAI Error:", error);
        return {
            type: 'ERROR',
            message: error.message
        };
    }
};

module.exports = { processMessage };
