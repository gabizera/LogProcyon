# Operações diárias

Tudo que o técnico precisa pra cuidar do LogProcyon rodando em Docker Swarm. Se é instalação do zero, veja [`INSTALL.md`](INSTALL.md).

---

## Índice

- [Visão geral da arquitetura](#visão-geral-da-arquitetura)
- [Atualizar frontend ou backend (zero downtime)](#atualizar-frontend-ou-backend-zero-downtime)
- [Atualizar o collector](#atualizar-o-collector-janela-curta-de-downtime)
- [Status dos serviços](#status-dos-serviços)
- [Ler logs](#ler-logs)
- [Inspecionar ClickHouse](#inspecionar-clickhouse)
- [Gerenciar usuários](#gerenciar-usuários)
- [Cadastrar um cliente novo](#cadastrar-um-cliente-novo-instance)
- [Backup](#backup)
- [Restore](#restore)
- [Troubleshooting](#troubleshooting)

---

## Visão geral da arquitetura

```
stack log-core          stack log-app           external volumes
─────────────           ────────────            ────────────────
clickhouse     ──┐                              log_clickhouse_store
collector      ──┘                              log_shared
                                                    │
backend        ──┐                                  │
frontend       ──┤ ←──── Traefik (:443) ←─── domain │
                 │                                  │
                 └──── lê/escreve /data ────────────┘
```

**Regra de ouro:** deploys de frontend/backend **nunca** tocam no coletor ou no ClickHouse. Deploy do collector causa ~5s de janela sem receber NetFlow (aceitável pra ISP). `log_clickhouse_store` e `log_shared` são volumes external — sobrevivem a qualquer `docker stack rm`.

---

## Atualizar frontend ou backend (zero downtime)

Isso é o que você faz **toda vez que mexe no código React ou no NestJS**. O coletor fica intacto.

### Do seu computador

```bash
# 1. commit local (obrigatório pra ter histórico)
git add -A && git commit -m "descrição da mudança"
git push

# 2. subir o código pra VPS
rsync -az --exclude '.git' --exclude 'node_modules' --exclude 'frontend/dist' \
          --exclude 'data' --exclude 'backup' --exclude '.env' \
  ./ root@<IP>:/opt/log/
```

### No servidor

```bash
cd /opt/log

# FRONTEND ──────────────────────────────────────
docker build -t logprocyon-frontend:latest ./frontend
docker service update --image logprocyon-frontend:latest --force log-app_frontend

# BACKEND ───────────────────────────────────────
docker build -t logprocyon-backend:latest ./backend
docker service update --image logprocyon-backend:latest --force log-app_backend
```

Aguarde ~5s e confirme:

```bash
docker stack services log-app
# ambos devem estar 1/1
```

> **`--force`** força re-criação mesmo se o tag `latest` não mudou. Sem isso o Swarm pensa que nada mudou e não faz nada.

> **Zero logs perdidos.** O `log-core_collector` continua rodando sem piscar. Confirme:
> ```bash
> docker service logs log-core_collector --tail 5 --since 1m
> # deve mostrar eventos chegando continuamente
> ```

---

## Atualizar o collector (janela curta de downtime)

Só precisa disso quando você mexe no `collector.js` ou nos parsers. Há uma janela de **~3-5 segundos** onde pacotes UDP chegando são descartados (inerente ao host-mode UDP: só um processo pode bindar 514/udp por vez).

```bash
cd /opt/log
docker build -t logprocyon-collector:latest ./collector
docker service update --image logprocyon-collector:latest --force log-core_collector
```

Logs antes/depois:

```bash
docker service logs log-core_collector --tail 20 --since 2m
```

---

## Status dos serviços

```bash
# Visão de todas as stacks
docker stack ls
docker stack services log-core
docker stack services log-app

# Tasks em execução e histórico
docker stack ps log-core --no-trunc
docker stack ps log-app --no-trunc

# Serviço específico
docker service ps log-app_frontend --no-trunc
```

---

## Ler logs

```bash
# Ao vivo
docker service logs log-core_collector -f
docker service logs log-core_clickhouse -f
docker service logs log-app_backend -f
docker service logs log-app_frontend -f

# Últimos N minutos
docker service logs log-app_backend --since 5m

# Últimas N linhas
docker service logs log-core_collector --tail 50
```

**Eventos de log chegando** aparecem no collector como:

```
[event] 001-ASR1002X-BDR-LIGO bpa UDP 100.67.12.38:0 -> 177.152.111.145:8192
[clickhouse] inserted 5 rows
```

Se aparecer `[collector] unmatched source IP X.X.X.X`, significa que chegou um pacote de um IP que não bate com nenhuma instance cadastrada — é só criar uma instance com aquele `source_ip` no painel.

---

## Inspecionar ClickHouse

```bash
# Shell interativo
docker exec -it $(docker ps --filter name=log-core_clickhouse -q) clickhouse-client
```

Queries úteis:

```sql
-- Total de logs
SELECT count() FROM nat_logs;

-- Por equipamento (ideal ver quem tá mandando dado)
SELECT equipamento_origem, count() FROM nat_logs GROUP BY equipamento_origem ORDER BY 2 DESC;

-- Últimos 10 eventos
SELECT timestamp, equipamento_origem, tipo_nat, ip_privado, ip_publico, porta_publica
FROM nat_logs ORDER BY timestamp DESC LIMIT 10;

-- Volume por hora nas últimas 24h
SELECT toStartOfHour(timestamp) AS h, count() AS c
FROM nat_logs
WHERE timestamp >= now() - INTERVAL 24 HOUR
GROUP BY h ORDER BY h;

-- Tamanho no disco
SELECT formatReadableSize(sum(data_compressed_bytes)) AS compressed,
       formatReadableSize(sum(data_uncompressed_bytes)) AS uncompressed,
       sum(rows)
FROM system.parts WHERE table = 'nat_logs' AND active = 1;
```

---

## Gerenciar usuários

Toda gestão de usuários é via painel web (**USUÁRIOS** no menu). Mas em emergências dá pra ler/editar direto o arquivo:

```bash
docker run --rm -v log_shared:/data alpine cat /data/users.json
```

**Nunca edite o arquivo com serviços rodando** — risco de race condition. Se precisar editar à mão:

```bash
docker service scale log-app_backend=0
docker run --rm -it -v log_shared:/data alpine vi /data/users.json
docker service scale log-app_backend=1
```

**Perfis:**

| Perfil | Pode |
|---|---|
| `admin` | Tudo: gerenciar usuários, configurações, deletar inputs, fazer consulta judicial |
| `operator` | Criar/editar inputs, fazer consulta judicial, ver dashboards |
| `viewer` | Apenas visualizar dashboards e buscar logs. Sem judicial, sem editar nada |

No modo multi-tenant, cada operator/viewer tem um campo `allowed_instances` que restringe **quais clientes** ele vê. Admin sempre vê tudo.

---

## Cadastrar um cliente novo (instance)

1. Acesse **INPUTS** no menu
2. **NOVO INPUT**
3. Preencha:
   - **Nome** — ex: `002-ASR1002X-BDR-CLIENTE-X` (sugestão: prefixar com o ID do equipamento pra ordenar)
   - **Equipamento** — `cisco`, `a10`, `nokia`...
   - **Protocolo** — `netflow_v9`, `syslog_udp`, etc.
   - **IP de origem** — IP público de onde os pacotes chegam (ex: `177.152.109.21`). Campo crítico pro roteamento no collector
   - **Porta** — 514 pra a maioria dos casos; 2055 ou 9995 se o equipamento não deixa mudar
4. **Salvar**
5. O collector recarrega em ~2s automaticamente (não precisa reiniciar)

No equipamento do cliente, configure:

**Cisco IOS-XE (exemplo NetFlow v9):**
```
ip nat log translations flow-export v9 udp destination <IP-VPS> 514
```

Firewall: libere porta 514/udp tanto do lado do cliente quanto do lado da VPS (já deve estar liberada pelo `ufw` do passo de instalação).

**Conferir se está chegando:**

```bash
docker service logs log-core_collector -f | grep <nome-do-cliente>
```

Se não aparecer nada em ~30s, é sinal de:
- Firewall bloqueando (confirmar com `tcpdump -i any udp port 514 -n` no servidor)
- IP de origem cadastrado errado (olhar mensagem `unmatched source IP X.X.X.X`)
- Equipamento não está mandando (verificar `show ip nat statistics` no Cisco)

---

## Backup

Dois volumes são tudo que importa:

- `log_clickhouse_store` — todos os logs históricos (grande, cresce)
- `log_shared` — `inputs.json` + `users.json` + `config.json` (pequeno)

### Backup manual

```bash
BACKUP_DIR=/opt/log-backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d-%H%M)

# ClickHouse (com serviço rodando — o export mantém consistência via snapshot COW)
docker run --rm \
  -v log_clickhouse_store:/from \
  -v $BACKUP_DIR:/to \
  alpine tar czf /to/clickhouse-$DATE.tar.gz -C /from .

# Shared data
docker run --rm \
  -v log_shared:/from \
  -v $BACKUP_DIR:/to \
  alpine tar czf /to/shared-$DATE.tar.gz -C /from .
```

> **Em produção sério**, pare o ClickHouse antes do backup pra consistência total:
> ```bash
> docker service scale log-core_clickhouse=0
> # backup
> docker service scale log-core_clickhouse=1
> ```
> Isso causa ~30s onde o collector acumula eventos localmente (ele tem buffer) — pra maioria dos ISPs é aceitável fazer backup fora do horário de pico.

### Backup automatizado (cron)

`/etc/cron.daily/logprocyon-backup`:

```bash
#!/bin/bash
set -e
BACKUP_DIR=/opt/log-backups
mkdir -p $BACKUP_DIR
DATE=$(date +%Y%m%d)

docker run --rm -v log_clickhouse_store:/from -v $BACKUP_DIR:/to alpine \
  tar czf /to/clickhouse-$DATE.tar.gz -C /from .
docker run --rm -v log_shared:/from -v $BACKUP_DIR:/to alpine \
  tar czf /to/shared-$DATE.tar.gz -C /from .

# Retenção: manter só últimos 14 dias
find $BACKUP_DIR -name '*.tar.gz' -mtime +14 -delete
```

```bash
chmod +x /etc/cron.daily/logprocyon-backup
```

Ainda melhor: copiar os `.tar.gz` pra um bucket S3/R2/B2 após criar.

---

## Restore

### Restaurar só os arquivos de config (users.json, inputs.json)

```bash
docker service scale log-app_backend=0
docker run --rm \
  -v log_shared:/to \
  -v /opt/log-backups:/from \
  alpine sh -c "tar xzf /from/shared-YYYYMMDD.tar.gz -C /to"
docker service scale log-app_backend=1
```

### Restaurar ClickHouse (mais delicado)

```bash
docker service scale log-core_clickhouse=0
docker service scale log-core_collector=0

# Limpa o volume e substitui
docker run --rm -v log_clickhouse_store:/data alpine sh -c "rm -rf /data/*"
docker run --rm \
  -v log_clickhouse_store:/to \
  -v /opt/log-backups:/from \
  alpine sh -c "tar xzf /from/clickhouse-YYYYMMDD.tar.gz -C /to"

docker service scale log-core_clickhouse=1
sleep 10   # aguarda init
docker service scale log-core_collector=1
```

---

## Troubleshooting

### Dashboard vazio, collector rodando

```bash
docker service logs log-core_collector --since 2m | grep "\[event\]"
```

Se não tem `[event]`, o collector não está recebendo pacotes. Verifique:

```bash
# Pacotes chegando na interface?
tcpdump -i any udp port 514 -n -c 10

# Porta aberta?
ss -ulnp | grep :514

# Firewall?
ufw status
iptables -L INPUT -n | grep 514
```

Se tem `[event]` mas o Dashboard ainda tá vazio, problema é backend:

```bash
docker service logs log-app_backend --tail 30 | grep -i "error\|clickhouse"
```

### "Erro ao buscar logs" no Dashboard/LogSearch

Backend perdeu conexão com ClickHouse. Causas comuns:
- ClickHouse reiniciou (verificar `docker stack services log-core`)
- DNS cross-stack quebrou (verificar se a alias `clickhouse` ainda está no `docker-stack-core.yml`)
- Rede `procyon_net` não é `external: true` nas duas stacks

Confirme DNS:
```bash
docker exec -it $(docker ps --filter name=log-app_backend -q) sh -c "getent hosts clickhouse"
# deve retornar um IP
```

### Collector escutando mas não reconhece instance cadastrada

```bash
docker service logs log-core_collector --tail 30 | grep unmatched
# mostra quais IPs estão chegando e não batem
```

Copia o IP que aparece e cadastra como nova instance no painel, **ou** atualiza o `source_ip` de uma instance existente. Hot-reload em ~2s.

### "Token inválido ou expirado" logando o tempo todo

JWT provavelmente expirou. Logar de novo. Se persistir, JWT_SECRET pode ter mudado entre deploys:

```bash
docker exec -it $(docker ps --filter name=log-app_backend -q) env | grep JWT_SECRET
```

Se mudou, volte pro valor original no `.env` e redeploy.

### Perdeu a senha do admin

```bash
docker service scale log-app_backend=0
docker run --rm -v log_shared:/data alpine sh -c "rm /data/users.json"
docker service scale log-app_backend=1
# Próximo boot: admin/admin123 será recriado (ver UsersService.seed)
```

Todos os outros usuários serão perdidos — só use isso em emergência.

### Disco cheio

ClickHouse tem TTL de 15 meses configurado no schema. Verifique uso:

```bash
docker run --rm -v log_clickhouse_store:/data alpine du -sh /data
df -h /var/lib/docker
```

Pra reduzir retenção sem esperar TTL rodar, ajuste em **CONFIGURAÇÕES** no painel. Depois forçar merge no ClickHouse:

```sql
OPTIMIZE TABLE nat_logs FINAL;
```
