# UserManagement AI - Gestor Inteligente de Usuários

Sistema de gerenciamento de usuários com IA integrada, permitindo consultas em linguagem natural e operações CRUD através de chat interativo.

---

## 📊 Banco de Dados

### Conexão

**Configuração no arquivo `.ENV`:**
```env
DB_USER=esteira_dev_hub_teste
DB_HOST=172.19.61.24
DB_NAME=esteira_dev_hub_teste
DB_PASSWORD=GQRsWsPd
DB_PORT=5442
```

### Tabela Principal: `tb_usuario`

A aplicação utiliza a tabela `tb_usuario` existente no banco PostgreSQL.

#### Estrutura de Colunas

| Coluna | Tipo | Descrição | Mapeamento AI |
|--------|------|-----------|---------------|
| `id_usuario` | Integer (PK) | ID único do usuário | `id` |
| `str_descricao` | String | Nome completo do usuário | `name` |
| `str_login` | String (Unique) | Login de acesso (único) | `login` |
| `email` | String | Email do usuário | `email` |
| `str_cpf` | String | CPF formatado | `cpf` |
| `str_ativo` | Char | Status do registro ('A'=Ativo, 'E'=Excluído) | `status` |
| `bloqueado` | Boolean | Indica se usuário está bloqueado | `blocked` |
| `dh_edita` | Timestamp | Data/hora da última modificação | `lastModified` |
| `id_operacao` | Integer | ID da operação relacionada | - |
| `id_grupo` | Integer | ID do grupo do usuário | - |
| `id_usuarioinclui` | Integer | ID do usuário que criou o registro | - |

#### Estados do Usuário

- **Ativo**: `str_ativo = 'A'` e `bloqueado = false`
- **Bloqueado**: `str_ativo = 'A'` e `bloqueado = true`
- **Excluído**: `str_ativo = 'E'` (soft delete)

---

## 🚀 Como Executar

### 1. Instalar Dependências

```bash
# Instalar dependências do frontend
npm install

# Instalar dependências do backend
cd server
npm install
```

### 2. Configurar Variáveis de Ambiente

Crie o arquivo `.ENV` na raiz do projeto com as credenciais do banco e a chave da OpenAI:

```env
# OpenAI API
VITE_OPENAI_API_KEY=sua-chave-aqui

# Database Configuration
DB_USER=esteira_dev_hub_teste
DB_HOST=172.19.61.24
DB_NAME=esteira_dev_hub_teste
DB_PASSWORD=GQRsWsPd
DB_PORT=5442
```

### 3. Iniciar os Servidores

**Terminal 1 - Backend (porta 3001):**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend (porta 5174):**
```bash
npm run dev
```

Acesse: **http://localhost:5174/**

---

## 🤖 Usando o Gestor AI

O sistema possui uma interface de chat alimentada por IA que compreende linguagem natural e executa operações no banco de dados automaticamente.

### 📖 Exemplos de Consultas

#### Buscar Todos os Usuários
```
Mostre todos os usuários
Listar usuários
Quais usuários temos cadastrados?
```

#### Buscar por Nome
```
Procure usuários com nome Ana
Buscar usuário João
Encontre Maria Silva
```

#### Buscar por Login
```
Busque o usuário com login ana.silva
Qual usuário tem o login joao.oliveira?
```

#### Buscar por Email
```
Encontre o usuário com email ana@email.com
Qual usuário possui o email joao@empresa.com?
```

#### Buscar por CPF
```
Busque o usuário com CPF 123.456.789-00
Qual usuário tem o CPF 987.654.321-11?
```

#### Buscar por ID
```
Mostre o usuário com ID 42
Busque informações do usuário ID 100
```

#### Contar Usuários
```
Quantos usuários temos?
Conte todos os usuários
Qual o total de usuários cadastrados?
```

#### Filtrar por Status
```
Mostre usuários bloqueados
Liste apenas usuários ativos
Quantos usuários estão bloqueados?
```

---

### ✏️ Exemplos de Alterações

#### Atualizar Nome
```
Altere o nome do usuário ana.silva para Ana Paula Silva
Mude o nome de joao.oliveira para João Pedro Oliveira
```

#### Atualizar Email
```
Atualize o email do usuário ana.silva para ana.nova@email.com
Troque o email de joao.oliveira para joao@novodominio.com
```

#### Atualizar CPF
```
Altere o CPF do usuário ana.silva para 111.222.333-44
Mude o CPF de joao.oliveira para 555.666.777-88
```

#### Bloquear Usuário
```
Bloqueie o usuário com ID 42
Bloquear usuário ID 100
```

#### Desbloquear Usuário
```
Desbloqueie o usuário com ID 42
Desbloquear usuário ID 100
```

---

### ➕ Exemplos de Criação

#### Criar Novo Usuário
```
Crie um usuário chamado Maria Silva
Cadastre o usuário Pedro Santos
Adicione um novo usuário: Carlos Oliveira
```

**O sistema automaticamente:**
- Gera login a partir do nome (ex: "Maria Silva" → `maria.silva`)
- Cria email padrão: `login@email.com` (se não especificado)
- Define CPF padrão: `000.000.000-00` (se não especificado)
- Define como ativo e não bloqueado

#### Criar com Dados Completos
```
Crie usuário Maria Silva com email maria@empresa.com e CPF 123.456.789-00
Cadastre Pedro Santos, email pedro@gmail.com, CPF 987.654.321-11
```

---

### 🗑️ Exemplos de Exclusão

> **Nota:** O sistema faz exclusão lógica (soft delete), marcando `str_ativo = 'E'` ao invés de deletar fisicamente.

```
Exclua o usuário com ID 42
Delete o usuário ID 100
Remova o usuário com ID 55
```

---

## 🎯 Recursos Principais

### 1. Chat Inteligente (PromptManager)
- Compreensão de linguagem natural
- Sugestões de comandos
- Histórico de conversas
- Respostas formatadas

### 2. Dashboard Gerencial
- KPIs de usuários (Total, Ativos, Bloqueados)
- Gráficos de distribuição
- Atividades recentes
- Métricas em tempo real

### 3. Lista de Usuários
- Visualização completa
- Filtros dinâmicos
- Edição inline de email e CPF
- Indicadores visuais de status

---

## 🔧 API REST (Backend)

O backend também expõe endpoints REST tradicionais:

### `GET /api/users`
Lista usuários com filtros opcionais.

**Query Parameters:**
- `name` - Filtrar por nome (ILIKE)
- `login` - Filtrar por login (ILIKE)
- `email` - Filtrar por email (ILIKE)
- `cpf` - Filtrar por CPF (exato)
- `status` - Filtrar por status (`ATIVO` ou `BLOQUEADO`)

**Exemplo:**
```bash
curl "http://localhost:3000/api/users?name=Ana&status=ATIVO"
```

### `POST /api/chat`
Endpoint principal para interação com IA.

**Body:**
```json
{
  "message": "Mostre todos os usuários"
}
```

**Tipos de Resposta:**
- `TEXT` - Texto formatado
- `ACTION_COMPLETE` - Ação executada com sucesso
- `ERROR` - Erro na operação
- `CONFIRMATION_REQUIRED` - Requer confirmação do usuário

### `PUT /api/users/:login/cpf`
Atualiza CPF de um usuário específico.

**Body:**
```json
{
  "cpf": "123.456.789-00"
}
```

### `PUT /api/users/:login/email`
Atualiza email de um usuário específico.

**Body:**
```json
{
  "email": "novo@email.com"
}
```

---

## 🧠 Como Funciona a IA

1. **Processamento de Linguagem Natural**: A OpenAI GPT-4 analisa a mensagem do usuário e identifica a intenção
2. **Mapeamento de Funções**: A IA decide qual função executar (queryUsers, createUser, updateUser, etc.)
3. **Extração de Parâmetros**: Extrai automaticamente os filtros e dados necessários
4. **Construção de Query**: Gera SQL dinâmico baseado nos parâmetros
5. **Execução Segura**: Executa a query usando prepared statements (proteção contra SQL injection)
6. **Formatação de Resposta**: Retorna dados formatados e legíveis

### Funções Disponíveis para IA

| Função | Objetivo | Parâmetros |
|--------|----------|------------|
| `queryUsers` | Buscar usuários | `filters`, `count_only` |
| `createUser` | Criar novo usuário | `name`, `email`, `cpf` |
| `findUserAndUpdate` | Atualizar dados | `login/email/cpf`, `newName`, `newEmail`, `newCpf` |
| `blockUser` | Bloquear/desbloquear | `user_id`, `block` |
| `deleteUser` | Excluir (soft delete) | `user_id` |

---

## 📁 Estrutura do Projeto

```
LUI/
├── src/                          # Frontend React
│   ├── components/               # Componentes reutilizáveis
│   │   ├── Layout.jsx           # Layout principal
│   │   └── ...
│   ├── context/                  # Context API
│   │   └── UserContext.jsx      # Estado global de usuários
│   ├── pages/                    # Páginas da aplicação
│   │   ├── Dashboard.jsx        # Dashboard com KPIs e gráficos
│   │   ├── PromptManager.jsx    # Interface de chat AI
│   │   └── UserList.jsx         # Lista e gerenciamento de usuários
│   ├── index.css                # Estilos globais
│   └── main.jsx                 # Entry point
│
├── server/                       # Backend Node.js
│   ├── services/
│   │   └── openai.js            # Integração OpenAI
│   ├── middleware/
│   │   └── confirmationStore.js # Gerenciamento de confirmações
│   ├── db.js                    # Conexão PostgreSQL
│   ├── index.js                 # Servidor Express + rotas
│   ├── schemaMap.js             # Mapeamento de schema
│   └── package.json             # Dependências backend
│
├── .ENV                          # Variáveis de ambiente
├── package.json                  # Dependências frontend
├── vite.config.js               # Configuração Vite
└── README.md                     # Este arquivo
```

---

## 🛡️ Segurança

- **SQL Injection**: Proteção via prepared statements
- **Validação de Dados**: Validação de inputs no backend
- **Soft Delete**: Exclusões lógicas preservam dados
- **Confirmações**: Operações sensíveis requerem confirmação

---

## 🎨 Tecnologias Utilizadas

### Frontend
- **React** 18.3 - Framework UI
- **Vite** 5.3 - Build tool e dev server
- **React Router** 7.9 - Roteamento
- **Recharts** 3.5 - Gráficos e visualizações
- **Lucide React** - Ícones modernos
- **TailwindCSS** 3.4 - Estilização

### Backend
- **Node.js** - Runtime JavaScript
- **Express** 4.18 - Framework web
- **PostgreSQL** (pg 8.11) - Banco de dados
- **OpenAI** 6.9 - API de IA
- **CORS** - Cross-origin resource sharing
- **dotenv** - Gerenciamento de variáveis

---

## 📝 Notas Importantes

1. **Formato de Login**: Gerado automaticamente como `nome.sobrenome` (minúsculas, sem espaços)
2. **Unicidade**: O campo `str_login` deve ser único no banco
3. **Status Padrão**: Novos usuários são criados como Ativos (`str_ativo = 'A'`, `bloqueado = false`)
4. **Timestamps**: `dh_edita` é automaticamente atualizado em modificações
5. **IDs de Relação**: `id_operacao`, `id_grupo` são definidos como 1 por padrão

---

## 🤝 Suporte

Para dúvidas ou problemas:
1. Verifique se os servidores estão rodando (backend na 3000, frontend na 5173)
2. Confirme as credenciais do banco no arquivo `.ENV`
3. Verifique logs do backend para erros de conexão
4. Teste endpoints REST diretamente para isolar problemas

---

## 🚧 Próximas Melhorias

- [ ] Adicionar filtros por `id_operacao` e `id_grupo`
- [ ] Dashboard com métricas por operação/grupo
- [ ] Exportação de dados (CSV, Excel)
- [ ] Relatórios customizados via IA
- [ ] Histórico de auditoria detalhado
- [ ] Autenticação e controle de acesso
