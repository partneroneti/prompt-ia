# Atualização de Dados do Usuário - Instruções

## Problema Identificado

O usuário `luis.eri.santos` foi encontrado no banco de dados. A operação necessária é um **UPDATE** na tabela `tb_usuario` para alterar dados como CPF, email, nome, etc.

No entanto, há um problema de permissão: quando fazemos o UPDATE na tabela `tb_usuario`, existe um **TRIGGER** no banco de dados que automaticamente tenta fazer um **INSERT** em uma tabela de log (`log.tb_usuario`) para registrar o histórico da alteração. O usuário do banco de dados usado pela aplicação não tem permissão para fazer esse INSERT na tabela de log, causando a falha na operação.

**Resumo:**
- ✅ Operação desejada: **UPDATE** na tabela `tb_usuario` (correto)
- ❌ Operação que falha: **INSERT** automático na tabela `log.tb_usuario` (trigger sem permissão)

**Nota:** Este problema afeta **qualquer UPDATE** na tabela `tb_usuario`, incluindo atualizações de CPF, email, nome, senha, etc.

## Soluções

### Opção 1: Executar SQL diretamente no banco (Recomendado)

Execute o seguinte script SQL diretamente no banco de dados usando um usuário com permissões adequadas (como um DBA ou usuário com privilégios de UPDATE):

**Para atualizar CPF:**
```sql
UPDATE tb_usuario 
SET str_cpf = '412.229.618-81', 
    dh_edita = NOW() 
WHERE str_login = 'luis.eri.santos'
RETURNING id_usuario, str_descricao, str_login, email, str_cpf;
```

**Para atualizar Email:**
```sql
UPDATE tb_usuario 
SET email = 'novo.email@exemplo.com', 
    dh_edita = NOW() 
WHERE str_login = 'luis.eri.santos'
RETURNING id_usuario, str_descricao, str_login, email, str_cpf;
```

**Para atualizar CPF e Email juntos:**
```sql
UPDATE tb_usuario 
SET str_cpf = '412.229.618-81',
    email = 'novo.email@exemplo.com', 
    dh_edita = NOW() 
WHERE str_login = 'luis.eri.santos'
RETURNING id_usuario, str_descricao, str_login, email, str_cpf;
```

Os arquivos `server/update-cpf.sql` e `server/update-email.sql` contêm scripts SQL prontos para uso.

### Opção 2: Corrigir permissões do banco de dados

Se você tiver acesso de administrador ao banco, conceda as permissões necessárias ao usuário da aplicação para que o trigger possa fazer o INSERT na tabela de log:

```sql
-- Conceder permissão para inserir na tabela de log (necessário para o trigger funcionar)
GRANT INSERT ON log.tb_usuario TO [nome_do_usuario_da_aplicacao];

-- Ou, se o trigger usar uma função, conceder permissão na função:
GRANT EXECUTE ON FUNCTION log.tb_usuario() TO [nome_do_usuario_da_aplicacao];
```

**Nota:** O UPDATE em si funciona, mas o trigger que registra o log falha por falta de permissão.

### Opção 3: Usar a API após corrigir permissões

Após corrigir as permissões, você pode usar as novas rotas da API:

**Para atualizar CPF:**
```bash
curl -X PUT http://localhost:3000/api/users/luis.eri.santos/cpf \
  -H "Content-Type: application/json" \
  -d '{"cpf":"412.229.618-81"}'
```

**Para atualizar Email:**
```bash
curl -X PUT http://localhost:3000/api/users/luis.eri.santos/email \
  -H "Content-Type: application/json" \
  -d '{"email":"novo.email@exemplo.com"}'
```

**Nota:** Essas rotas também terão o mesmo problema de permissão até que as permissões do banco sejam corrigidas.

## Como Usar a IA para Atualizar Dados (Linguagem Natural)

**SIM!** A IA já está configurada para entender pedidos em linguagem natural e criar as queries automaticamente. Você não precisa criar queries manualmente.

### Exemplos de Pedidos que a IA Entende:

Você pode simplesmente digitar no chat:

- ✅ "Atualize o CPF do luis.eri.santos para 412.229.618-81"
- ✅ "Altere o email do usuário luis.eri.santos para novo.email@exemplo.com"
- ✅ "Mude o CPF do luis.eri.santos para 412.229.618-81"
- ✅ "Atualize o email e CPF do luis.eri.santos: email novo@email.com, CPF 412.229.618-81"

A IA vai:
1. Entender seu pedido
2. Identificar o usuário pelo login
3. Criar a query SQL automaticamente
4. Executar a atualização

### Como Funciona:

A IA usa a função `findUserAndUpdate` que:
- Aceita pedidos em português natural
- Identifica o usuário por login, email ou CPF
- Atualiza os campos solicitados (CPF, email, nome, senha, etc.)
- Cria e executa a query SQL automaticamente

### Problemas Atuais:

**1. Erro 500 da API OpenAI:**
O erro 500 na API `/api/chat` pode estar relacionado a:

- **Chave da API não configurada**: Verifique se a variável de ambiente `VITE_OPENAI_API_KEY` está configurada no arquivo `.env` na raiz do projeto.
- **Formato da chave**: Certifique-se de que a chave da API está no formato correto (começa com `sk-`).

Para verificar, crie ou edite o arquivo `.env` na raiz do projeto:

```
VITE_OPENAI_API_KEY=sk-sua-chave-aqui
```

**2. Problema de Permissão no Banco:**
Mesmo que a IA funcione corretamente, a atualização vai falhar por causa do problema de permissão no banco de dados (trigger tentando inserir na tabela de log). Veja a **Opção 2** acima para corrigir as permissões.

## Status Atual

- ✅ Usuário `luis.eri.santos` encontrado no banco
- ✅ CPF atual: `000.000.000-00`
- ✅ Novo CPF desejado: `412.229.618-81`
- ❌ Atualização bloqueada por problema de permissão no banco de dados

