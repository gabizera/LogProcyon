# LogProcyon

Plataforma leve de coleta, armazenamento e consulta de logs NAT/CGNAT/BPA para provedores de internet.

Substitui o Graylog em cenários que exigem **consulta judicial** (identificação de assinante por IP público + porta + data/hora), dashboards em tempo real, audit de tráfego e suporte multi-vendor. Desenvolvido pela [Procyon Tecnologia](https://procyontecnologia.com.br).

---

## O que tem

| Módulo | Descrição |
|---|---|
| **Dashboard** | Readout em mono, timeline 24h, top IPs públicos, filtro por cliente em modo multi-tenant |
| **Logs** | Busca com filtros por IP, porta, protocolo, tipo NAT, equipamento e período |
| **Judicial** | Identifica assinante (IP privado) por IP público + porta + timestamp — suporta BPA com range de portas |
| **Inputs** | Cadastra fontes de log por equipamento, protocolo, porta e IP de origem. Hot-reload em ~2s |
| **Armazenamento** | Volume de logs e uso de disco por dia |
| **Usuários** | Perfis admin/operador/viewer. Suporte multi-tenant com `allowed_instances` por usuário |
| **Configurações** | Timezone, nome da plataforma, retenção de dados |

### Vendors suportados no collector

| Vendor | Protocolo | Status |
|---|---|---|
| Cisco (IOS/IOS-XE) | NetFlow v9 UDP | ✅ Funcional |
| A10 Networks | Syslog UDP | 🔧 Stub |
| Nokia (SROS) | Syslog UDP | 🔧 Stub |
| Hillstone | Syslog UDP | 🔧 Stub |
| Juniper (JUNOS) | Syslog UDP | 🔧 Stub |
| Genérico | Syslog UDP/TCP | ✅ Fallback key=value |

---

## Arquitetura

Duas stacks Docker Swarm independentes compartilhando 2 volumes external:

```
                        Cisco / A10 / Nokia / etc
                                │
                                │ UDP 514/2055/9995 (host-mode)
                                ▼
  ┌─ stack: log-core ───────────────────────────────┐
  │                                                 │
  │   [collector]  ─── batch insert HTTP ───▶       │
  │      │                                          │
  │      ▼                                          │
  │   [clickhouse]  columnar DB · TTL 15 meses      │
  │                                                 │
  └────────────────┬────────────────────────────────┘
                   │   volumes external:
                   │     log_clickhouse_store
                   │     log_shared
                   │
  ┌────────────────┴────────────────────────────────┐
  │                                                 │
  │   [backend]  NestJS · /api                      │
  │      │                                          │
  │      ▼                                          │
  │   [frontend] nginx + React · porta 80           │
  │                                                 │
  └─ stack: log-app ────────────────┬───────────────┘
                                    │
                                    │ HTTPS
                                    ▼
                              [Traefik]
                                    │
                           log.procyontecnologia.net
```

**Por que 2 stacks separadas:** atualizar o frontend ou backend (`log-app`) fisicamente não toca no coletor nem no ClickHouse (`log-core`). Zero risco de perder logs durante deploys rotineiros.

---

## Documentação

| Documento | Quando ler |
|---|---|
| [`docs/INSTALL.md`](docs/INSTALL.md) | Instalar numa VPS nova do zero |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md) | Dia-a-dia: atualizar, backup, troubleshoot, adicionar cliente |
| [`docs/COLLECTOR-BARE-METAL.md`](docs/COLLECTOR-BARE-METAL.md) | Alternativa: rodar o coletor fora do Docker via systemd |

---

## Desenvolvimento local (Mac/Linux)

O collector usa sockets UDP que no **Docker Desktop para Mac** não funcionam corretamente. Use o modo dev:

```bash
# 1. Clickhouse + backend dev
docker compose up -d clickhouse backend

# 2. Collector nativo (precisa sudo por causa da porta 514)
cd collector
npm install
sudo TZ_OFFSET_HOURS=-3 CLICKHOUSE_URL=http://localhost:8123 DATA_DIR=./data node collector.js

# 3. Frontend dev server
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Veja também [`start-dev.sh`](start-dev.sh) para o fluxo automatizado.

---

## Estrutura do projeto

```
LogProcyon/
├── clickhouse/                  # init.sql (schema + TTL)
├── collector/                   # Node.js UDP collector
│   ├── collector.js
│   └── parsers/                 # Um por vendor
├── backend/                     # NestJS REST API
│   └── src/
│       ├── logs/                # Search + judicial + stats
│       ├── inputs/              # Fontes de log
│       ├── users/               # Gerenciamento de acesso
│       ├── config/              # Configurações da plataforma
│       ├── auth/                # JWT + roles guard
│       └── clickhouse/
├── frontend/                    # React + Vite + Tailwind
│   └── src/
│       ├── pages/
│       └── components/
├── docs/                        # ⬅ documentação operacional
│   ├── INSTALL.md
│   ├── OPERATIONS.md
│   └── COLLECTOR-BARE-METAL.md
├── docker-stack-core.yml        # clickhouse + collector (Swarm)
├── docker-stack-app.yml         # backend + frontend (Swarm)
├── docker-compose.yml           # single-host dev mode
└── .env.example
```

---

## Licença

MIT
