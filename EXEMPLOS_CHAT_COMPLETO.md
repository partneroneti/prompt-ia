# 📚 Guia Completo de Exemplos - Chat AI

Este documento contém **TODOS** os exemplos de comandos que podem ser utilizados no chat do sistema.

---

## 📊 CONSULTAS E BUSCAS

### Contar Usuários
```
Quantos usuários temos?
Conte todos os usuários
Qual o total de usuários cadastrados?
Quantos usuários ativos temos?
Quantos usuários estão bloqueados?
Quantos usuários inativos existem?
```

### Listar Todos os Usuários
```
Mostre todos os usuários
Listar usuários
Quais usuários temos cadastrados?
Liste todos os usuários do sistema
```

### Buscar por Nome
```
Procure usuários com nome Ana
Buscar usuário João
Encontre Maria Silva
Mostre usuários que têm "Silva" no nome
Liste todos os usuários chamados Carlos
```

### Buscar por Login
```
Busque o usuário com login ana.silva
Qual usuário tem o login joao.oliveira?
Encontre o usuário teste.op
Mostre dados do usuário maria.santos
```

### Buscar por Email
```
Encontre o usuário com email ana@email.com
Qual usuário possui o email joao@empresa.com?
Busque por email maria@gmail.com
Mostre o usuário com email teste@teste.com
```

### Buscar por CPF
```
Busque o usuário com CPF 123.456.789-00
Qual usuário tem o CPF 987.654.321-11?
Encontre o usuário com CPF 111.222.333-44
```

### Buscar por ID
```
Mostre o usuário com ID 42
Busque informações do usuário ID 100
Encontre o usuário de ID 50
Mostre dados do usuário número 200
```

### Filtrar por Status
```
Mostre usuários bloqueados
Liste apenas usuários ativos
Quantos usuários estão bloqueados?
Liste todos os usuários inativos
Mostre apenas usuários ativos
```

### Buscar por Operação/Empresa
```
Mostre usuários da operação Partner
Liste usuários da empresa DANIEL CRED
Quantos usuários temos na operação FGTS?
Mostre todos os usuários da Partner
Liste usuários da operação X
```

### Buscar por Grupo
```
Mostre usuários do grupo Administrativo
Liste usuários do grupo Operacional
Quantos usuários estão no grupo X?
```

### Buscar por Perfil
```
Mostre usuários com perfil MASTER
Liste usuários com perfil OPERACIONAL
Quantos usuários têm perfil MASTER?
```

### Buscar por Data
```
Mostre usuários criados esta semana
Liste usuários modificados hoje
Quais usuários foram alterados na última semana?
Mostre usuários incluídos este mês
Liste usuários modificados nos últimos 7 dias
```

### Buscar por Múltiplos Filtros
```
Mostre usuários ativos da operação Partner
Liste usuários bloqueados da empresa DANIEL CRED
Quantos usuários ativos temos na operação X?
Mostre usuários do grupo Y que estão ativos
```

---

## ➕ CRIAÇÃO DE USUÁRIOS

### Criar Usuário Básico
```
Crie um usuário chamado Maria Silva
Cadastre o usuário Pedro Santos
Adicione um novo usuário: Carlos Oliveira
Criar usuário João da Silva
```

### Criar Usuário com Dados Completos
```
Crie usuário Maria Silva com email maria@empresa.com e CPF 123.456.789-00
Cadastre Pedro Santos, email pedro@gmail.com, CPF 987.654.321-11, perfil OPERACIONAL, empresa Partner
Criar usuário: João Silva, login: joao.silva, email: joao@teste.com, CPF: 111.222.333-44, perfil: OPERACIONAL, empresa: DANIEL CRED
Cadastre novo usuário: Ana Paula, email: ana@empresa.com, CPF: 555.666.777-88, perfil: MASTER, empresa: Partner
```

**Nota:** O sistema automaticamente:
- Gera login a partir do nome (ex: "Maria Silva" → `maria.silva`)
- Cria email padrão: `login@email.com` (se não especificado)
- Define CPF padrão: `000.000.000-00` (se não especificado)
- Define como ativo e não bloqueado

---

## ✏️ ALTERAÇÕES E ATUALIZAÇÕES

### Atualizar Nome
```
Altere o nome do usuário ana.silva para Ana Paula Silva
Mude o nome de joao.oliveira para João Pedro Oliveira
Atualize o nome do usuário maria.santos para Maria Santos Silva
Troque o nome de teste.op para Teste Operacional
```

### Atualizar Email
```
Atualize o email do usuário ana.silva para ana.nova@email.com
Troque o email de joao.oliveira para joao@novodominio.com
Mude o email do usuário maria.santos para maria.nova@gmail.com
Atualize o email de teste.op para novoemail@teste.com
```

### Atualizar CPF
```
Altere o CPF do usuário ana.silva para 111.222.333-44
Mude o CPF de joao.oliveira para 555.666.777-88
Atualize o CPF do usuário maria.santos para 999.888.777-66
Troque o CPF de teste.op para 123.456.789-00
```

### Atualizar Perfil
```
Troque o perfil do usuário teste.op para MASTER
Mude o perfil de joao.silva para OPERACIONAL
Atualize o perfil do usuário maria.santos para MASTER
Altere o perfil de ana.silva para OPERACIONAL
```

**Nota:** 
- Promover para **MASTER** requer confirmação (ação sensível)
- Mudar para **OPERACIONAL** executa diretamente

### Atualizar Senha
```
Altere a senha do usuário teste.op
Mude a senha de joao.silva
Atualize a senha do usuário maria.santos
```

---

## 🔒 BLOQUEAR E DESBLOQUEAR

### Bloquear Usuário Individual
```
Bloqueie o usuário com ID 42
Bloquear usuário ID 100
Bloqueie o usuário teste.op
Bloquear usuário ana.silva
Bloqueie o usuário com login joao.oliveira
Bloquear o usuário com email maria@email.com
```

### Desbloquear Usuário Individual
```
Desbloqueie o usuário com ID 42
Desbloquear usuário ID 100
Desbloqueie o usuário teste.op
Desbloquear usuário ana.silva
Desbloqueie o usuário com login joao.oliveira
Desbloquear o usuário com email maria@email.com
```

### Bloquear Múltiplos Usuários (por Empresa)
```
Bloquear todos os usuários da empresa Partner
Bloqueie todos os usuários da operação DANIEL CRED
Bloquear usuários da empresa X
```

**Nota:** Esta ação requer confirmação antes de executar.

### Desbloquear Múltiplos Usuários (por Empresa)
```
Desbloquear todos os usuários da empresa Partner
Desbloqueie todos os usuários da operação DANIEL CRED
Desbloquear usuários da empresa X
```

**Nota:** Esta ação executa diretamente sem confirmação.

---

## 🔑 RESETAR SENHAS

### Resetar Senhas em Massa
```
Resetar senhas de todos os usuários da empresa Partner
Resete as senhas dos usuários da operação DANIEL CRED
Resetar senhas da empresa X
```

**Nota:** Esta ação requer confirmação antes de executar.

---

## 🗑️ EXCLUSÃO DE USUÁRIOS

### Excluir Usuário
```
Exclua o usuário com ID 42
Delete o usuário ID 100
Remova o usuário com ID 55
Excluir usuário teste.op
Delete o usuário ana.silva
Remova o usuário com login joao.oliveira
```

**Nota:** O sistema faz exclusão lógica (soft delete), marcando `str_ativo = 'E'` ao invés de deletar fisicamente.

---

## 📈 CONSULTAS DE OPERAÇÕES

### Listar Operações
```
Liste todas as operações
Mostre as operações cadastradas
Quais operações temos?
Quantas operações existem?
```

### Contar Usuários por Operação
```
Quantos usuários temos na operação Partner?
Conte usuários da operação DANIEL CRED
Quantos usuários estão na operação X?
```

### Estatísticas de Operações
```
Mostre estatísticas das operações
Quantos usuários temos por operação?
Liste operações com mais usuários
```

---

## 👥 CONSULTAS DE GRUPOS

### Listar Grupos
```
Liste todos os grupos
Mostre os grupos cadastrados
Quais grupos existem?
Quantos grupos temos?
```

### Buscar Grupos por Operação
```
Mostre grupos da operação Partner
Liste grupos da empresa DANIEL CRED
Quais grupos pertencem à operação X?
```

### Contar Usuários por Grupo
```
Quantos usuários temos no grupo X?
Conte usuários do grupo Y
```

---

## 🎭 CONSULTAS DE PERFIS E ROLES

### Listar Perfis
```
Liste todos os perfis
Mostre os perfis disponíveis
Quais perfis existem?
Quantos perfis temos?
```

### Listar Roles
```
Liste todas as roles
Mostre as roles disponíveis
Quais roles existem?
Quantas roles temos?
```

### Verificar Permissões
```
Quais são minhas permissões?
Tenho permissão para criar usuários?
Tenho permissão para atualizar usuários?
Posso bloquear usuários?
```

---

## 💰 CONSULTAS DE COMISSÕES

### Contar Comissões
```
Quantas comissões temos?
Conte todas as comissões
Quantos registros de comissão existem?
```

### Listar Comissões
```
Liste as comissões
Mostre comissões cadastradas
Liste comissões bloqueadas
Mostre comissões desbloqueadas
```

### Filtrar Comissões por Entidade
```
Mostre comissões da entidade X
Liste comissões do parceiro Y
```

### Valor Total de Comissões
```
Qual o valor total de comissões?
Quanto temos em comissões?
Mostre o total de comissões
```

---

## 🏢 CONSULTAS DE ENTIDADES

### Listar Entidades
```
Liste todas as entidades
Mostre as entidades cadastradas
Quais entidades existem?
Quantas entidades temos?
```

### Buscar Entidade
```
Busque a entidade Partner
Encontre a entidade X
Mostre dados da entidade Y
```

---

## 📋 CONSULTAS DE PROPOSTAS

### Contar Propostas
```
Quantas propostas temos?
Conte todas as propostas
Quantos registros de proposta existem?
```

### Listar Propostas
```
Liste as propostas
Mostre propostas cadastradas
Liste propostas por status
```

### Filtrar Propostas
```
Mostre propostas do CPF 123.456.789-00
Liste propostas da operação X
Busque proposta número Y
```

### Estatísticas de Propostas
```
Mostre estatísticas de propostas
Quantas propostas temos por status?
Liste distribuição de propostas
```

---

## 🎯 CONSULTAS DE CAMPANHAS

### Listar Campanhas
```
Liste todas as campanhas
Mostre as campanhas cadastradas
Quais campanhas existem?
Quantas campanhas temos?
```

---

## 📊 RELATÓRIOS E ESTATÍSTICAS

### Relatórios Gerais
```
Gere um relatório de usuários
Mostre estatísticas do sistema
Quais são os KPIs de usuários?
Mostre métricas gerais
```

### Relatórios por Período
```
Mostre usuários criados este mês
Liste usuários modificados na última semana
Quantos usuários foram criados este ano?
Mostre atividade dos últimos 30 dias
```

### Relatórios por Operação
```
Mostre relatório da operação Partner
Gere relatório da empresa DANIEL CRED
Liste estatísticas da operação X
```

---

## 🔍 BUSCAS AVANÇADAS

### Busca Combinada
```
Mostre usuários ativos da operação Partner criados este mês
Liste usuários bloqueados do grupo X modificados na última semana
Encontre usuários MASTER da empresa Y que foram criados este ano
```

### Busca com Múltiplos Critérios
```
A
Liste usuários bloqueados da empresa X criados nos últimos 30 dias
Encontre usuários com perfil OPERACIONAL do grupo Y
```

---

## ⚠️ AÇÕES QUE REQUEREM CONFIRMAÇÃO

As seguintes ações solicitam confirmação antes de executar:

1. **Bloquear usuário individual** (`block: true`)
2. **Bloquear múltiplos usuários** de uma empresa
3. **Promover usuário para perfil MASTER**
4. **Resetar senhas** em massa
5. **Excluir usuário**

Exemplo de fluxo:
```
Usuário: "Bloquear todos os usuários da empresa Partner"
Sistema: "Isso afetará 9 usuários da empresa 'Partner'. Tem certeza?"
Usuário: [Confirma]
Sistema: "Ação executada! 9 usuários bloqueados. Audit ID: AUD-123456"
```

---

## ✅ AÇÕES QUE EXECUTAM DIRETAMENTE

As seguintes ações executam sem pedir confirmação:

1. **Desbloquear usuário individual** (`block: false`)
2. **Desbloquear múltiplos usuários** de uma empresa
3. **Mudar perfil para OPERACIONAL** (não MASTER)
4. **Atualizar nome, email, CPF**
5. **Criar novo usuário**
6. **Todas as consultas** (buscar, listar, contar)

---

## 📝 FORMATO DE RESPOSTAS

### Resposta de Sucesso
```
Ação executada! [detalhes da ação]
Audit ID: AUD-123456
```

### Resposta de Erro
```
Erro: [descrição do erro]
```

### Resposta de Confirmação
```
Isso afetará X usuários da empresa "Y". Tem certeza?
[Token de confirmação será gerado]
```

### Resposta de Consulta
```
Encontrados X usuários:
- Nome (login) [Op: Operação] [Grupo: Grupo]
- ...
Audit ID: AUD-123456
```

---

## 🎯 DICAS DE USO

1. **Seja específico**: Quanto mais detalhes você fornecer, melhor será o resultado
   - ✅ "Bloquear usuário teste.op"
   - ❌ "Bloquear teste"

2. **Use login ou email**: Para ações em usuários específicos, use login ou email
   - ✅ "Bloquear usuário ana.silva"
   - ✅ "Desbloquear usuário com email ana@teste.com"

3. **Para empresas/operações**: Use o nome exato da operação
   - ✅ "Bloquear todos os usuários da empresa Partner"
   - ✅ "Liste usuários da operação DANIEL CRED"

4. **Consultas combinadas**: Você pode combinar múltiplos filtros
   - ✅ "Mostre usuários ativos da operação Partner criados este mês"

5. **Confirmações**: Quando o sistema pedir confirmação, responda "SIM" ou "NÃO"

---

## 🔐 PERMISSÕES E RBAC

### Usuários MASTER
- ✅ Podem executar **TODAS** as ações
- ✅ Não precisam de roles específicas
- ⚠️ Ações sensíveis ainda requerem confirmação

### Outros Perfis
- ✅ Podem fazer **consultas** (buscar, listar, contar)
- ❌ Precisam de **roles específicas** para ações de escrita:
  - `USER_CREATE` - Para criar usuários
  - `USER_UPDATE` - Para atualizar usuários
  - `USER_BLOCK` - Para bloquear/desbloquear
  - `USER_DELETE` - Para excluir usuários
  - `USER_RESET` - Para resetar senhas

---

## 📞 EXEMPLOS PRÁTICOS COMPLETOS

### Cenário 1: Criar e Gerenciar Usuário
```
1. "Cadastrar usuário: João Silva, email: joao@teste.com, CPF: 123.456.789-00, perfil: OPERACIONAL, empresa: Partner"
2. "Busque o usuário joao.silva"
3. "Atualize o email do usuário joao.silva para joao.novo@teste.com"
4. "Bloquear usuário joao.silva"
5. "Desbloquear usuário joao.silva"
```

### Cenário 2: Consultas e Relatórios
```
1. "Quantos usuários temos?"
2. "Mostre usuários da operação Partner"
3. "Liste usuários bloqueados"
4. "Quantos usuários foram criados este mês?"
5. "Mostre estatísticas da operação Partner"
```

### Cenário 3: Ações em Massa
```
1. "Bloquear todos os usuários da empresa Partner"
   [Sistema pede confirmação]
   [Usuário confirma]
2. "Desbloquear todos os usuários da empresa Partner"
   [Executa diretamente]
3. "Resetar senhas de todos os usuários da empresa DANIEL CRED"
   [Sistema pede confirmação]
```

---

## 🚀 COMANDOS RÁPIDOS

### Mais Usados
```
Quantos usuários temos?
Liste todos os usuários
Bloquear usuário [login]
Desbloquear usuário [login]
Cadastrar usuário [nome], email [email], empresa [empresa]
Mostre usuários da operação [nome]
```

---

**Última atualização:** Dezembro 2024
**Versão do Sistema:** 1.0

