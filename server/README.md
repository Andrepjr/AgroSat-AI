# AgroSat AI — Backend

API REST para monitoramento agrícola inteligente com multi-agentes de IA (GPT-4o) e banco Oracle.

## Tecnologias

- Node.js (ES Modules)
- Express 4
- Oracle Database (oracledb 6)
- OpenAI GPT-4o
- JWT + bcryptjs

## Setup

### 1. Instalar dependências

```bash
cd server
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Edite .env com suas credenciais
```

### 3. Inicializar o banco de dados

```bash
npm run init-db
```

### 4. Iniciar o servidor

```bash
npm run dev      # desenvolvimento (hot reload)
npm start        # produção
```

### 5. Iniciar o simulador IoT

```bash
npm run simulate            # modo normal (variação gradual)
npm run simulate:critical   # cenário crítico (valores extremos)
```

---

## Endpoints

### Auth
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/auth/register` | Cadastrar usuário |
| POST | `/api/auth/login` | Login e obter JWT |

### Sensores
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/sensors` | Últimas leituras (query: `setor`, `limit`) |
| GET | `/api/sensors/latest` | Leitura mais recente |
| GET | `/api/sensors/stats` | Estatísticas das últimas 24h |
| POST | `/api/sensors` | Inserir leitura manual |

### Agente Analista — Diagnósticos
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/diagnostics/generate` | **Gera diagnóstico com GPT-4o** |
| GET | `/api/diagnostics` | Lista diagnósticos do usuário |
| GET | `/api/diagnostics/latest` | Diagnóstico mais recente |
| GET | `/api/diagnostics/:id` | Diagnóstico por ID |

### Agente Monitor — Alertas
| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/alerts/check` | **Verifica thresholds e gera alertas com GPT-4o** |
| GET | `/api/alerts` | Lista alertas (query: `apenas_nao_lidos`, `setor`) |
| GET | `/api/alerts/summary` | Contagem por severidade |
| PATCH | `/api/alerts/:id/read` | Marcar alerta como lido |
| PATCH | `/api/alerts/read-all` | Marcar todos como lidos |

### Agente Consultor — Chat
| Método | Rota | Descrição |
|--------|------|-----------|
| POST | `/api/chat` | **Envia mensagem ao chatbot GPT-4o** |
| GET | `/api/chat/history` | Histórico da conversa |
| DELETE | `/api/chat/history` | Limpar histórico |

---

## Thresholds do Monitor

| Parâmetro | ALERTA | CRÍTICO |
|-----------|--------|---------|
| Temperatura | > 35°C | > 38°C ou < 5°C |
| Umidade Solo | < 30% | < 20% |
| NDVI | < 0.50 | < 0.30 |
| Umidade Ar | > 92% | < 25% |
| Precipitação | > 50mm | — |

---

## Exemplo de uso

```bash
# Registro
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nome":"João","email":"joao@farm.com","senha":"123456"}'

# Login
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"joao@farm.com","senha":"123456"}' | jq -r .token)

# Gerar diagnóstico com IA
curl -X POST http://localhost:3001/api/diagnostics/generate \
  -H "Authorization: Bearer $TOKEN"

# Chat com o consultor
curl -X POST http://localhost:3001/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mensagem":"Minha plantação está com folhas amarelas, o que fazer?"}'

# Verificar alertas
curl http://localhost:3001/api/alerts/check \
  -H "Authorization: Bearer $TOKEN"
```
