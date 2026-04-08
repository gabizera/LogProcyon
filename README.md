# LogProcyon

Plataforma leve de coleta, armazenamento e consulta de logs NAT/CGNAT/BPA para provedores de internet (ISPs).

Desenvolvida para substituir o Graylog em cenários que exigem **busca judicial** (identificação de assinante por IP público + porta + data/hora), dashboards em tempo real e suporte multi-vendor.

---

## Funcionalidades

| Módulo | Descrição |
|---|---|
| **Dashboard** | 6 gráficos: volume 24h, top IPs públicos/privados, distribuição NAT/protocolo/equipamento |
| **Busca de Logs** | Filtros por IP, porta, protocolo, tipo NAT e período |
| **Consulta Judicial** | Identifica o assinante (IP privado) por IP público + porta + timestamp — suporta BPA com range de portas |
| **Inputs** | Configura fontes de log por equipamento, protocolo e porta |
| **Usuários** | Gerenciamento de acesso com perfis admin/operador/viewer |
| **Configurações** | Timezone, nome da plataforma e retenção de dados |

### Vendors suportados

| Vendor | Protocolo | Status |
|---|---|---|
| Cisco (IOS/IOS-XE) | NetFlow v9 UDP | ✅ Funcional |
| A10 Networks | Syslog UDP | 🔧 Stub |
| Nokia (SROS) | Syslog UDP | 🔧 Stub |
| Hillstone | Syslog UDP | 🔧 Stub |
| Juniper (JUNOS) | Syslog UDP | 🔧 Stub |
| Genérico | Syslog UDP/TCP | ✅ Fallback key=value |

> Stubs já fazem parse dos campos mais comuns de cada vendor. Para finalizar, forneça amostras de log reais e ajuste o regex em `collector/parsers/<vendor>-syslog.js`.

---

## Stack

```
Cisco / A10 / Nokia / etc
        │
        │ UDP (NetFlow v9 ou Syslog)
        ▼
   [Collector]  Node.js — collector/
        │
        │ HTTP batch insert
        ▼
  [ClickHouse]  Columnar DB — TTL 15 meses
        │
        │
   [Backend]    NestJS REST API — backend/
        │
        │ /api proxy
        ▼
  [Frontend]    React + Vite + Tailwind — frontend/
```

---

## Pré-requisitos

- **Docker** e **Docker Compose** (v2+)
- Porta **80** disponível (frontend)
- Portas **UDP** disponíveis para receber logs (o collector usa `network_mode: host` — veja abaixo)
- Mínimo 2 GB RAM, 10 GB disco

---

## Instalação em produção (VPS Linux)

### 1. Clonar o repositório

```bash
git clone https://github.com/gabizera/LogProcyon.git
cd LogProcyon
```

### 2. Configurar variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

```env
# Timezone offset em horas (ex: -3 para BRT, 0 para UTC, -4 para AMT)
TZ_OFFSET_HOURS=-3
```

### 3. Subir os serviços

```bash
docker compose up -d --build
```

Aguarde cerca de 30 segundos para o ClickHouse inicializar na primeira execução.

### 4. Verificar status

```bash
docker compose ps
```

Todos os containers devem estar `healthy` ou `running`:

```
NAME              STATUS
log-clickhouse    healthy
log-collector     running
log-backend       running
log-frontend      running
```

### 5. Acessar o sistema

Abra no navegador: `http://<ip-do-servidor>`

Credenciais padrão: `admin / admin123`

> **Troque a senha do admin imediatamente** em **Usuários → Trocar senha**.

---

## Configuração do equipamento

### Cisco IOS / IOS-XE (NetFlow v9)

```
ip nat log translations flow-export v9 udp destination <IP-DO-SERVIDOR> 514
```

Verifique se há rota de volta do roteador para o servidor na porta 514/UDP.

Para confirmar que os logs estão chegando:

```bash
docker logs log-collector -f
```

Você deve ver linhas como:

```
[event] Cisco BRAS 01 bpa TCP 10.0.0.5:49200 -> 177.86.x.x:29100
[clickhouse] inserted 100 rows
```

### A10 Networks (CGN Syslog)

1. Acesse **Inputs → Novo Input**
2. Equipamento: `A10`, Protocolo: `Syslog UDP`, Porta: `514` (ou outra)
3. Configure o A10 para enviar syslog para `<IP-DO-SERVIDOR>:<porta>`
4. Reinicie o collector: `docker compose restart collector`

### Nokia / Hillstone / Juniper

Mesmos passos do A10. Selecione o vendor correto no campo **Equipamento** para que o parser adequado seja utilizado.

---

## Rede e portas UDP

O collector usa `network_mode: host` no Docker — ele se comporta como um processo rodando diretamente no servidor, sem NAT ou port mapping.

**O que isso significa na prática:**

- Qualquer porta configurada nos **Inputs** é imediatamente acessível via UDP no IP do servidor
- Não é necessário editar `docker-compose.yml` ao adicionar novos equipamentos/portas
- O collector acessa o ClickHouse via `http://localhost:8123` (não pelo DNS interno do Docker)

**Firewall:** libere as portas UDP que forem usar:

```bash
# Exemplo para porta 514 (padrão) e 5140 (A10)
ufw allow 514/udp
ufw allow 5140/udp
```

> **Mac/Linux dev:** `network_mode: host` não funciona no Docker Desktop para Mac. Por isso o `docker-compose.override.yml` coloca o collector em `profiles: ["prod"]` — no Mac, rode o collector nativamente (ver seção abaixo).

---

## Desenvolvimento local (Mac/Linux)

O collector usa sockets UDP que no **Docker Desktop para Mac** não funcionam corretamente. Use o modo de desenvolvimento:

### 1. Subir ClickHouse + Backend via Docker

```bash
docker compose up -d clickhouse backend
```

Isso expõe:
- ClickHouse: `localhost:8123` (HTTP), `localhost:9000` (native)
- Backend API: `localhost:3000`

### 2. Rodar o collector nativamente

```bash
cd collector
npm install
sudo TZ_OFFSET_HOURS=-3 CLICKHOUSE_URL=http://localhost:8123 DATA_DIR=./data node collector.js
```

> `sudo` necessário para bind na porta 514. Ou use uma porta acima de 1024 com `LISTEN_PORT=5140`.

### 3. Rodar o frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse: `http://localhost:5173`

---

## Múltiplos equipamentos / portas

O collector roda com `network_mode: host`, o que significa que **qualquer porta UDP configurada nos Inputs é aberta automaticamente** — sem precisar editar o `docker-compose.yml`.

Para receber logs de diferentes equipamentos no mesmo servidor:

1. Acesse **Inputs** no menu lateral
2. Clique em **Novo Input** para cada fonte
3. Configure o IP de origem para diferenciar equipamentos na mesma porta

| Input | Equipamento | Protocolo | IP Origem | Porta |
|---|---|---|---|---|
| Cisco BRAS 01 | cisco | netflow_v9 | 10.1.1.1 | 514 |
| Cisco BRAS 02 | cisco | netflow_v9 | 10.1.1.2 | 514 |
| A10 CGN SP01 | a10 | syslog_udp | 10.2.1.1 | 5140 |

> **Como funciona a roteamento por IP de origem:** se dois inputs usam a mesma porta, o collector entrega o pacote ao input cujo **IP Origem** bate com o remetente. Se o campo IP Origem estiver vazio, o input aceita qualquer origem naquela porta.

**Após salvar**, reinicie o collector para carregar as novas configurações:

```bash
docker compose restart collector
```

> O collector lê os inputs **apenas no startup**. Qualquer alteração nos Inputs requer reinício do container.

---

## Consulta Judicial

Para atender requisições judiciais de identificação de assinante:

1. Acesse **Consulta Judicial** no menu
2. Preencha:
   - **IP Público**: IP que aparece na requisição judicial
   - **Porta**: porta de origem do evento
   - **Data/Hora**: timestamp exato da conexão
3. O sistema busca qual assinante (IP privado) estava usando aquele IP:porta em uma janela de ±5 minutos

Para BPA (Bulk Port Allocation), a busca usa o range de portas: `porta_inicio <= porta < porta_inicio + tamanho_bloco`, identificando corretamente blocos de 1024 portas típicos do Cisco.

---

## Estrutura do projeto

```
LogProcyon/
├── clickhouse/
│   └── init.sql              # Schema: tabela nat_logs + índices + TTL + view agregada
├── collector/
│   ├── collector.js           # Entry point — config-driven, multi-porta
│   ├── parsers/
│   │   ├── index.js           # Registry de parsers
│   │   ├── cisco-netflow9.js  # Parser NetFlow v9 (funcional)
│   │   ├── a10-syslog.js      # Parser A10 (stub)
│   │   ├── nokia-syslog.js    # Parser Nokia (stub)
│   │   ├── hillstone-syslog.js# Parser Hillstone (stub)
│   │   ├── juniper-syslog.js  # Parser Juniper (stub)
│   │   └── syslog-generic.js  # Fallback genérico key=value
│   └── Dockerfile
├── backend/
│   └── src/
│       ├── logs/              # CRUD + busca + consulta judicial + stats
│       ├── config/            # Configurações da plataforma (/api/config)
│       ├── inputs/            # Fontes de log (/api/inputs)
│       ├── users/             # Usuários (/api/users)
│       └── clickhouse/        # Client ClickHouse
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── LogSearch.tsx
│       │   ├── JudicialSearch.tsx
│       │   ├── Inputs.tsx
│       │   ├── Users.tsx
│       │   └── Settings.tsx
│       └── components/
│           ├── Charts.tsx
│           ├── FilterBar.tsx
│           ├── LogTable.tsx
│           └── SessionView.tsx
├── data/                      # Volume persistente (config.json, inputs.json, users.json)
├── docker-compose.yml
├── docker-compose.override.yml # Dev overrides (Mac)
└── .env.example
```

---

## Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `TZ_OFFSET_HOURS` | `-3` | Offset de timezone para os timestamps dos logs |
| `CLICKHOUSE_URL` | `http://clickhouse:8123` | URL do ClickHouse |
| `LISTEN_PORT` | `514` | Porta UDP padrão do collector (fallback sem inputs.json) |
| `BATCH_SIZE` | `100` | Registros por batch de inserção no ClickHouse |
| `FLUSH_INTERVAL` | `2000` | Intervalo de flush em ms |
| `DATA_DIR` | `/data` | Diretório de dados persistentes (config, inputs, users) |

---

## Operações de manutenção

### Ver logs em tempo real

```bash
docker logs log-collector -f   # logs chegando + inserções
docker logs log-backend -f     # API NestJS
docker logs log-clickhouse -f  # ClickHouse
```

### Verificar dados no ClickHouse

```bash
docker exec -it log-clickhouse clickhouse-client
```

```sql
-- Total de registros
SELECT count() FROM nat_logs;

-- Últimos 10 eventos
SELECT timestamp, ip_publico, ip_privado, porta_publica, tipo_nat
FROM nat_logs ORDER BY timestamp DESC LIMIT 10;

-- Volume por hora nas últimas 24h
SELECT toStartOfHour(timestamp) AS hora, count() AS total
FROM nat_logs
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY hora ORDER BY hora;
```

### Backup dos dados

```bash
# Backup do volume ClickHouse
docker run --rm \
  -v log_clickhouse_data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/clickhouse_$(date +%Y%m%d).tar.gz /data

# Backup da configuração (inputs, users, config)
tar czf backup/logdata_$(date +%Y%m%d).tar.gz data/
```

### Atualizar para nova versão

```bash
git pull
docker compose up -d --build
```

### Reiniciar um serviço específico

```bash
docker compose restart collector   # após alterar inputs
docker compose restart backend     # após alterar config/users
```

---

## Adicionando suporte a novo vendor

1. Crie `collector/parsers/<vendor>-syslog.js` baseado em `syslog-generic.js`
2. Implemente `parse(buf, rinfo, config, tzOffsetMs)` que retorna um array de rows
3. Registre o parser em `collector/parsers/index.js`
4. Adicione o vendor na lista `EQUIPMENT_TYPES` em `backend/src/inputs/dto/input.dto.ts` e em `frontend/src/pages/Inputs.tsx`
5. Rebuild e restart: `docker compose up -d --build collector`

Cada row deve ter os campos:

```js
{
  timestamp,          // 'YYYY-MM-DD HH:MM:SS.mmm'
  ip_publico,         // string IPv4
  ip_privado,         // string IPv4
  porta_publica,      // UInt16
  porta_privada,      // UInt16
  tamanho_bloco,      // UInt16 (0 para CGNAT, >0 para BPA)
  protocolo,          // 'TCP' | 'UDP'
  tipo_nat,           // 'cgnat' | 'bpa' | 'estatico'
  equipamento_origem, // string (nome do input)
  payload_raw,        // string (log original, opcional)
}
```

---

## Solução de problemas

**Nenhum dado aparece no dashboard**
```bash
docker logs log-collector -f
# Se não aparecer "[event]", os pacotes não estão chegando
# Verifique firewall: ufw allow 514/udp
```

**Erro de conexão com ClickHouse**
```bash
docker compose ps clickhouse
# Se não estiver healthy, verifique: docker logs log-clickhouse
```

**Porta 514 ocupada**
```bash
sudo ss -ulnp | grep 514
# Mude LISTEN_PORT no .env ou desative o serviço conflitante
```

**Timestamp errado nos logs**
- Ajuste `TZ_OFFSET_HOURS` no `.env` ou via **Configurações** no painel
- Reinicie o collector: `docker compose restart collector`

**Inputs não aplicados após salvar**
- O collector lê `inputs.json` apenas no startup
- `docker compose restart collector`

---

## Licença

MIT
