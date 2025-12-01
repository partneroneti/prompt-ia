# 🔌 Configuração do Redis para Histórico de Conversas

## 📋 Visão Geral

O sistema usa Redis para cache rápido do histórico de conversas. Você pode usar:
- **Redis Local**: Para desenvolvimento
- **Redis Remoto**: Da empresa ou cloud (produção)

## ⚙️ Configuração Básica

### 1. Adicionar no arquivo `.env`

```bash
# Redis Local (Desenvolvimento)
REDIS_URL=redis://localhost:6379

# Redis Remoto (Produção)
REDIS_URL=redis://usuario:senha@redis.empresa.com:6379
```

### 2. Reiniciar o servidor

Após configurar, reinicie o servidor:

```bash
cd server
npm start
```

## 🔐 Formatos de URL do Redis

### Sem Autenticação
```bash
REDIS_URL=redis://host:porta
REDIS_URL=redis://redis.empresa.com:6379
```

### Com Senha
```bash
REDIS_URL=redis://senha@host:porta
REDIS_URL=redis://minhasenha@redis.empresa.com:6379
```

### Com Usuário e Senha
```bash
REDIS_URL=redis://usuario:senha@host:porta
REDIS_URL=redis://admin:senha123@redis.empresa.com:6379
```

### Com SSL/TLS (rediss://)
```bash
REDIS_URL=rediss://usuario:senha@host:porta
REDIS_URL=rediss://admin:senha123@redis.empresa.com:6380
```

## ☁️ Exemplos por Provedor

### Redis Cloud (Redis Labs)
```bash
REDIS_URL=redis://default:senha@redis-12345.c1.us-east-1-1.ec2.cloud.redislabs.com:12345
```

### AWS ElastiCache
```bash
# Sem autenticação (modo antigo)
REDIS_URL=redis://master.abc123.0001.use1.cache.amazonaws.com:6379

# Com AUTH token (modo novo)
REDIS_URL=redis://senha@master.abc123.0001.use1.cache.amazonaws.com:6379
```

### Azure Cache for Redis
```bash
# Com SSL
REDIS_URL=rediss://:senha@nome-cache.redis.cache.windows.net:6380

# Sem SSL (não recomendado)
REDIS_URL=redis://:senha@nome-cache.redis.cache.windows.net:6379
```

### Google Cloud Memorystore
```bash
# IP interno da VPC
REDIS_URL=redis://10.0.0.1:6379

# Com AUTH (se configurado)
REDIS_URL=redis://senha@10.0.0.1:6379
```

### DigitalOcean Managed Redis
```bash
REDIS_URL=rediss://default:senha@redis-do-user-12345-0.db.ondigitalocean.com:25061
```

## 🔍 Verificar Conexão

### 1. Verificar logs do servidor

Ao iniciar o servidor, você verá:

```
[REDIS] 🔌 Tentando conectar ao Redis REMOTO: redis://****@redis.empresa.com:6379
[REDIS] ✅ Conectado ao Redis REMOTO com sucesso
[REDIS] ✅ Cliente Redis pronto para uso
```

### 2. Testar conexão manualmente

```bash
# Se tiver redis-cli instalado
redis-cli -u "redis://usuario:senha@redis.empresa.com:6379" ping
# Deve retornar: PONG
```

### 3. Verificar via API

```bash
curl http://localhost:3001/api/conversations/stats
```

A resposta mostrará se o Redis está funcionando.

## 🛠️ Troubleshooting

### Erro: "Connection refused"
- Verifique se o Redis está rodando
- Verifique se a porta está correta
- Verifique firewall/rede

### Erro: "NOAUTH Authentication required"
- Adicione a senha na URL: `redis://senha@host:porta`
- Ou configure AUTH no Redis

### Erro: "SSL/TLS required"
- Use `rediss://` ao invés de `redis://`
- Verifique se o certificado SSL está válido

### Erro: "Timeout"
- Verifique se o host está acessível
- Aumente o timeout na configuração
- Verifique firewall/rede

### Fallback para Memória
Se o Redis não conectar, o sistema usa memória local (apenas durante a sessão). Você verá:

```
[REDIS] ❌ Não foi possível conectar ao Redis: ...
[REDIS] ⚠️ Usando store em memória como fallback
```

**Nota**: O histórico ainda será salvo no banco de dados PostgreSQL.

## 🔒 Segurança

### ✅ Boas Práticas

1. **Não commite `.env` no Git**
   ```bash
   # Adicione no .gitignore
   .env
   ```

2. **Use variáveis de ambiente no servidor**
   ```bash
   export REDIS_URL=redis://senha@redis.empresa.com:6379
   ```

3. **Use SSL/TLS em produção**
   ```bash
   REDIS_URL=rediss://senha@redis.empresa.com:6380
   ```

4. **Rotacione senhas regularmente**

5. **Use Redis com AUTH habilitado**

### ❌ Evite

- URLs com senhas em texto plano no código
- Redis sem autenticação em produção
- Redis sem SSL em produção
- Compartilhar credenciais

## 📊 Monitoramento

### Verificar Status

```bash
# Via API
curl http://localhost:3001/api/conversations/stats

# Resposta:
{
  "success": true,
  "config": {
    "redisTTL": 86400,
    "dbRetentionDays": "Permanente"
  }
}
```

### Logs do Servidor

Os logs mostram:
- Tentativas de conexão
- Status da conexão
- Erros de reconexão
- Fallback para memória

## 🚀 Deploy

### Variáveis de Ambiente no Servidor

Configure no seu servidor de produção:

```bash
# Exemplo com PM2
pm2 start index.js --update-env

# Ou no Docker
docker run -e REDIS_URL=redis://senha@redis.empresa.com:6379 ...
```

### Docker Compose

```yaml
services:
  app:
    environment:
      - REDIS_URL=redis://senha@redis.empresa.com:6379
```

## 📝 Resumo

| Configuração | Valor |
|-------------|-------|
| **Variável** | `REDIS_URL` |
| **Formato Local** | `redis://localhost:6379` |
| **Formato Remoto** | `redis://usuario:senha@host:porta` |
| **Formato SSL** | `rediss://usuario:senha@host:porta` |
| **Fallback** | Memória local + PostgreSQL |

## 💡 Dicas

1. **Desenvolvimento**: Use Redis local (`redis://localhost:6379`)
2. **Produção**: Use Redis remoto da empresa com SSL
3. **Teste**: Sempre teste a conexão antes de fazer deploy
4. **Backup**: O PostgreSQL mantém backup permanente mesmo se Redis falhar

