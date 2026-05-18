# Operações diárias

Tudo pra cuidar do LogProcyon rodando em **Docker Compose** (não Swarm).
Instalação do zero: [`INSTALL.md`](INSTALL.md).

Comandos rodam como root, a partir de `/opt/log`.

---

## Arquitetura

```
reverse-proxy externo (TLS)  ──→  frontend (nginx, FRONTEND_PORT)
                                      │  /api → backend:3000
clientes (NetFlow/syslog)             │
   1 cliente = 1 porta UDP   ──→  collector (network_mode: host,
   dedicada 20000-20199)            range 20000-20199) → ClickHouse
                                  backend ──→ ClickHouse (nat_logs)
```

Volumes: `logprocyon_clickhouse_data` (logs), `logprocyon_logdata`
(inputs.json/users.json/config).

---

## Atualizar (após mudar código)

```bash
cd /opt/log
# subir o código novo (do seu PC): rsync ... root@IP:/opt/log/
docker compose build backend   && docker compose up -d backend
docker compose build frontend  && docker compose up -d frontend
docker compose build collector && docker compose up -d collector   # ~5s s/ UDP
docker compose ps              # tudo healthy
```

Recriar um serviço NÃO apaga os volumes (dados sobrevivem).

---

## Status e logs

```bash
docker compose ps
docker compose logs -f collector          # eventos chegando
docker compose logs --tail=50 backend
docker compose logs --tail=30 clickhouse
```

Evento normal no collector:
`[event] CLIENTE nat444 UDP 100.64.x:0 -> 45.185.x:31744` + `[clickhouse] inserted N rows`.

---

## ClickHouse

```bash
CHPW=$(grep -m1 ^CLICKHOUSE_PASSWORD= .env | cut -d= -f2-)
docker compose exec -T clickhouse clickhouse-client --password=$CHPW --query "SELECT count() FROM nat_logs"
docker compose exec -T clickhouse clickhouse-client --password=$CHPW --query \
  "SELECT equipamento_origem,count(),max(inserted_at) FROM nat_logs GROUP BY equipamento_origem"
```

Schema só é criado quando o volume está vazio. Se faltar tabela
(`UNKNOWN_TABLE` nos logs do backend, dashboard 500):

```bash
docker compose exec -T clickhouse clickhouse-client --password=$CHPW \
  --multiquery --queries-file /docker-entrypoint-initdb.d/init.sql
```

---

## Cadastrar cliente novo

1. **Inputs → Novo input**: nome, equipamento (cisco/hillstone/a10/...),
   protocolo. **Não preencha porta** — o backend aloca uma porta dedicada
   do range automaticamente. Informe o `source_ip` (IP público de onde
   chegam os pacotes) — 2ª camada de segurança.
2. Anote a **porta atribuída**; configure o equipamento do cliente pra
   mandar pra `<IP-VPS>:<porta>/udp` (NÃO 514).
3. Confirmar que chega:
   ```bash
   tcpdump -i any -nn udp port <porta> -c 5
   docker compose logs -f collector | grep <nome-do-cliente>
   ```
4. Acesso do cliente: **Usuários → novo**, perfil **viewer**,
   `allowed_instances` = o input dele. Ele vê só Dashboard + Logs do que
   foi liberado; sem Configuração nem Judicial.

---

## Backup, restore e monitoramento

Automatizado via cron (root):
- `03:30` diário — `/opt/log/backup/backup.sh`
- a cada 15 min — `/opt/log/backup/healthcheck.sh`

**Backup** (`/opt/log-backups/`): nat_logs por partição mensal
(Native gz), retenção legal **15 meses** + 1 de folga, guarda de espaço
livre (não enche o HD), validação `gzip -t`, checagem de cobertura
(alerta gap legal). logdata diário (30d).

Manual:
```bash
/opt/log/backup/backup.sh
```

**Restore**:
```bash
ls /opt/log-backups/
/opt/log/backup/restore.sh nat /opt/log-backups/nat_logs-YYYYMM.native.gz --temp   # valida sem tocar produção
/opt/log/backup/restore.sh nat /opt/log-backups/nat_logs-YYYYMM.native.gz           # append em produção
/opt/log/backup/restore.sh nat <arq> --truncate                                     # restore total
/opt/log/backup/restore.sh logdata /opt/log-backups/logdata-YYYYMMDD-HHMM.tgz
```

**Telegram** (`.env`: `TELEGRAM_BOT_TOKEN/CHAT_ID/TOPIC_ID`): alerta de
backup OK/falha/gap, container/API/disco, **ingestão parada** (gap
legal), **novo input criado**, **cliente começou a receber**, digest
diário. Sem token configurado = silencioso (não quebra nada).

> Cron requer o daemon `cron` ativo (`systemctl is-active cron`). Os
> scripts já exportam PATH (cron tem PATH mínimo, senão `docker` não resolve).

---

## Backup offsite

Hoje o nat_logs pesado fica **só local** (guarda de disco + cobertura
15m). Pra offsite real (Backblaze B2/S3/GDrive), configure `rclone` e
`RCLONE_REMOTE` no `.env` — o `backup.sh` já tem o gancho de upload.
Telegram só carrega o `logdata` (pequeno); nat_logs estoura o limite de
50 MB da Bot API.

---

## Troubleshooting

### Dashboard 500 / "Unknown table nat_logs"
Schema não criado (volume não-vazio no 1º boot). Aplique o init.sql
(ver seção ClickHouse).

### Cliente não aparece no dashboard
1. Chega pacote? `tcpdump -i any -nn udp port <porta>`
   - Sem pacote → equipamento do cliente não está mandando / porta
     errada / firewall do lado dele. (O problema é no cliente.)
2. Chega mas não grava? `docker compose logs --tail=50 collector | grep <nome>`
   - Sem `[event]` e sem erro → parser não casou o formato. Confira
     `equipment_type` certo no input (ex: hillstone, não o default cisco)
     e `source_ip` batendo. O parser do equipamento tem precedência
     sobre o genérico.

### Ingestão parou
Alerta automático no Telegram (sem log novo há > 30 min). Verifique
collector (`docker compose ps`), equipamento do cliente e firewall.

### Perdeu a senha do admin
```bash
docker compose stop backend
docker run --rm -v logprocyon_logdata:/d alpine sh -c "rm /d/users.json"
docker compose start backend
docker compose logs backend 2>&1 | grep -A4 'INITIAL ADMIN PASSWORD'
```
Recria admin com senha aleatória nova (perde os outros usuários).

### Disco
ClickHouse tem TTL de 15 meses (não cresce infinito). O `backup.sh`
aborta se o disco estiver abaixo do mínimo (não derruba o sistema).
```bash
df -h /
docker system df
```

---

## Próximos passos

- [Instalação](INSTALL.md)
- [Collector bare-metal](COLLECTOR-BARE-METAL.md)
