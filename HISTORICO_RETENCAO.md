# 📚 Configuração de Retenção do Histórico de Conversas

## ⏱️ Duração Atual das Mensagens

### Redis (Cache Rápido)
- **Duração**: 1 hora (3600 segundos)
- **Propósito**: Cache rápido para acesso imediato
- **O que acontece**: Após 1 hora, o cache expira, mas as mensagens permanecem no banco de dados

### Banco de Dados (Persistência)
- **Duração**: **PERMANENTE** (sem expiração automática)
- **Propósito**: Armazenamento permanente de todas as conversas
- **O que acontece**: As mensagens ficam salvas indefinidamente até serem removidas manualmente

## ⚙️ Como Configurar a Retenção

### 1. Configurar TTL do Redis (Cache)

Adicione no arquivo `.env`:

```bash
# TTL do Redis em segundos (padrão: 3600 = 1 hora)
REDIS_HISTORY_TTL_SECONDS=3600

# Exemplos:
# 30 minutos: REDIS_HISTORY_TTL_SECONDS=1800
# 2 horas: REDIS_HISTORY_TTL_SECONDS=7200
# 24 horas: REDIS_HISTORY_TTL_SECONDS=86400
```

### 2. Configurar Retenção no Banco de Dados

Adicione no arquivo `.env`:

```bash
# Número de dias para manter mensagens no banco (null = permanente)
DB_HISTORY_RETENTION_DAYS=30

# Exemplos:
# 7 dias: DB_HISTORY_RETENTION_DAYS=7
# 30 dias: DB_HISTORY_RETENTION_DAYS=30
# 90 dias: DB_HISTORY_RETENTION_DAYS=90
# Permanente (sem limpeza): Não defina ou defina como null
```

**⚠️ Importante**: Se `DB_HISTORY_RETENTION_DAYS` não for definido ou for `null`, as mensagens ficam **permanentes** no banco.

### 3. Limpeza Automática (Opcional)

Para ativar limpeza automática, você pode:

1. **Configurar um cron job** para chamar a API de limpeza:
```bash
# Executar limpeza diariamente às 2h da manhã
0 2 * * * curl -X POST http://localhost:3001/api/conversations/cleanup
```

2. **Ou criar um script Node.js** para executar periodicamente:
```javascript
const { cleanupOldMessages } = require('./server/middleware/conversationHistoryStore');

// Executar limpeza
cleanupOldMessages().then(result => {
    console.log(`Limpeza concluída: ${result.deleted} mensagens removidas`);
});
```

## 📊 Verificar Estatísticas

### Via API

```bash
# Estatísticas gerais
curl http://localhost:3001/api/conversations/stats

# Estatísticas de um usuário específico
curl "http://localhost:3001/api/conversations/stats?userId=220"
```

### Resposta da API

```json
{
  "success": true,
  "stats": {
    "total": 150,
    "oldest": "2025-01-15T10:30:00Z",
    "newest": "2025-01-20T14:45:00Z",
    "retentionDays": "30",
    "redisTTL": "3600s (60 minutos)"
  },
  "config": {
    "redisTTL": 3600,
    "dbRetentionDays": 30
  }
}
```

## 🗑️ Limpar Mensagens Antigas Manualmente

### Via API

```bash
# Limpar mensagens antigas (baseado em DB_RETENTION_DAYS)
curl -X POST http://localhost:3001/api/conversations/cleanup
```

### Limpar Histórico de um Usuário Específico

```bash
# Limpar histórico de um usuário (apenas cache Redis)
curl -X DELETE http://localhost:3001/api/conversations/history \
  -H "x-user-id: 220"
```

## 📝 Resumo

| Armazenamento | Duração Padrão | Configurável | Limpeza Automática |
|--------------|----------------|--------------|-------------------|
| **Redis** | 1 hora | ✅ Sim (via `REDIS_HISTORY_TTL_SECONDS`) | ✅ Sim (automático) |
| **Banco de Dados** | Permanente | ✅ Sim (via `DB_HISTORY_RETENTION_DAYS`) | ⚠️ Manual (via API) |

## 💡 Recomendações

1. **Para desenvolvimento**: Mantenha `DB_HISTORY_RETENTION_DAYS` como `null` (permanente)
2. **Para produção**: Configure `DB_HISTORY_RETENTION_DAYS=30` (30 dias) e ative limpeza automática
3. **Para compliance/LGPD**: Configure retenção adequada conforme política da empresa
4. **Redis TTL**: Mantenha entre 1-24 horas dependendo do uso

## 🔍 Verificar Configuração Atual

Após reiniciar o servidor, você verá nos logs:

```
[HISTORY] Configuração de retenção:
  - Redis TTL: 3600 segundos (60 minutos)
  - DB Retention: Permanente (sem limpeza automática)
```

