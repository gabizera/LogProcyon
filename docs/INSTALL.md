# Instalação em produção

Deploy do LogProcyon numa VPS Linux com **Docker Compose** (NÃO Swarm —
Swarm não lida bem com IPv6). TLS é terminado por um **reverse-proxy
externo** que encaminha pra uma porta interna do compose.

> Servidor com **≥4 GB RAM** e **≥20 GB disco** (ClickHouse + logs crescem).

---

## 0. Pré-requisitos

### No servidor (VPS)
- Debian 12+ / Ubuntu 22.04+
- Acesso root (via `su -` ou sudo)
- Portas: `22/tcp` (SSH), a porta do reverse-proxy → frontend, `20000-20199/udp` (1 cliente = 1 porta dedicada)
- Um reverse-proxy externo (na frente) que termina HTTPS do domínio e encaminha pro `FRONTEND_PORT`

### No seu computador
- Acesso SSH ao servidor
- O repositório clonado

---

## 1. Preparar o servidor

VPS Debian minimal **não vem com `curl`** — instale antes:

```bash
apt-get update
apt-get install -y curl ca-certificates rsync
# Docker (instala engine + compose plugin)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker --version && docker compose version
```

---

## 2. Subir o código

Do seu computador (ou `git clone` no servidor):

```bash
rsync -az --exclude '.git' --exclude 'node_modules' --exclude 'frontend/dist' \
          --exclude 'data' --exclude 'backup/*.gz' --exclude '.env' \
  ./ root@<IP>:/opt/log/
```

No servidor deve haver `/opt/log/docker-compose.yml`, `backend/`,
`frontend/`, `collector/`, `clickhouse/init.sql`, `backup/`.

---

## 3. Configurar o `.env`

```bash
cd /opt/log
cp .env.example .env
```

Edite `/opt/log/.env` — **obrigatórias** (o compose falha de propósito se faltarem):

| Variável | O que é |
|---|---|
| `CLICKHOUSE_PASSWORD` | Senha do ClickHouse. `openssl rand -hex 24` |
| `JWT_SECRET` | Segredo JWT, ≥32 chars. `openssl rand -hex 32` |
| `CORS_ORIGINS` | Domínio https público (o que o proxy externo serve), ex: `https://log.seudominio.com.br` |

Opcionais (têm default): `TZ_OFFSET_HOURS` (-3 BRT), `MULTI_TENANT_MODE`
(`true` p/ isolar cliente por `allowed_instances` — use `true` se vende
acesso a clientes), `FRONTEND_PORT` (porta interna p/ o proxy externo,
default 80 — use ex. `8080` se a 80 já é do proxy), `INPUT_PORT_MIN/MAX`
(range de portas dedicadas, default 20000-20199).

```bash
chmod 600 .env
```

---

## 4. Subir a stack

```bash
cd /opt/log
docker compose up -d --build      # 1ª vez: build ~5-15 min
docker compose ps                 # tudo deve ficar healthy
```

`init.sql` cria o schema do ClickHouse **só quando o volume está vazio**
(primeiro boot). Se você recriar com volume já existente e o schema
mudar, aplique manualmente:

```bash
CHPW=$(grep -m1 ^CLICKHOUSE_PASSWORD= .env | cut -d= -f2-)
docker compose exec -T clickhouse clickhouse-client --password=$CHPW \
  --multiquery --queries-file /docker-entrypoint-initdb.d/init.sql
docker compose exec -T clickhouse clickhouse-client --password=$CHPW --query "SHOW TABLES"
# esperado: nat_logs, nat_logs_hourly, nat_logs_hourly_mv
```

---

## 5. Reverse-proxy externo (TLS)

O compose **não termina TLS**. Aponte seu proxy externo (nginx/traefik/
caddy noutra máquina ou na borda) pro `http://<IP-VPS>:<FRONTEND_PORT>`.
Garanta que `CORS_ORIGINS` no `.env` seja exatamente o domínio https
que o proxy serve.

---

## 6. Firewall

Se usa `ufw` (cuidado: libere o SSH antes de habilitar):

```bash
ufw allow 22/tcp
ufw allow <FRONTEND_PORT>/tcp     # do proxy externo até a VPS
ufw allow 20000:20199/udp         # portas dedicadas por cliente
ufw enable
```

---

## 7. Primeiro login

A senha inicial do admin é **aleatória, gerada no 1º boot e mostrada
uma única vez** nos logs (não existe senha default):

```bash
docker compose logs backend 2>&1 | grep -A4 'INITIAL ADMIN PASSWORD'
```

Usuário `admin`. Entre, vá em **Usuários → trocar senha** imediatamente.

---

## 8. Cadastrar cliente + dar acesso

1. **Inputs → Novo input**: nome, equipamento (cisco/hillstone/...),
   protocolo. **Não informe porta** — o backend aloca uma porta dedicada
   do range automaticamente. Informe o `source_ip` (IP público de onde
   os pacotes vêm) como 2ª camada.
2. Anote a **porta atribuída** e configure o equipamento do cliente pra
   enviar NetFlow/syslog pra `<IP-VPS>:<porta-atribuída>`.
3. Para o cliente ver só os dados dele: **Usuários → novo usuário**,
   perfil **viewer**, `allowed_instances` = o input dele (exige
   `MULTI_TENANT_MODE=true`). O viewer vê só Dashboard + Logs do que lhe
   foi permitido — sem Configuração, sem Judicial.

---

## 9. Backup e monitoramento

Ver [OPERATIONS.md](OPERATIONS.md): backup diário automatizado
(cron, retenção legal 15 meses, validado), restore testável, e
alertas no Telegram (falha de backup, ingestão parada, novo input,
gap legal).

---

## Próximos passos

- [Operações diárias](OPERATIONS.md)
- [Collector bare-metal](COLLECTOR-BARE-METAL.md)
