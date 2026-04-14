# Collector bare-metal (sem Docker)

Opção alternativa: rodar o coletor Node.js **direto no host** gerenciado por `systemd`, em vez de dentro de um container Docker.

## Quando faz sentido

Esse modo é overkill pra maioria dos casos — o setup Docker do `docker-stack-core.yml` já isola bem o coletor do resto. Use esta opção se:

- Você quer **zero dependência do Docker daemon** pro coletor. Se o Docker cair, o coletor continua funcionando.
- Você está num servidor que **não vai usar Docker de jeito nenhum** (bare-metal restrito).
- Você quer **reinício do coletor em ~1 segundo** (systemd reinicia mais rápido que um container Swarm).
- Você tem equipe de ops mais confortável com systemd do que com Docker.

## Quando **não** usar

- Desenvolvimento local no Mac (use `start-dev.sh` normal)
- Se você precisa do auto-restart e orquestração do Swarm pra múltiplos nós
- Se não tem confiança em gerenciar processos systemd

Nesse caso, fique com o coletor dentro do `log-core` no Docker — é mais simples.

---

## Pré-requisitos

- Debian 12 / Ubuntu 22.04+
- Acesso root
- ClickHouse rodando em algum lugar acessível pelo host (pode estar em Docker em outra máquina, ou no mesmo host dentro do `log-core`)
- Porta UDP 514 livre no host

---

## 1. Instalar Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version   # v20.x
```

---

## 2. Criar usuário de sistema e diretórios

```bash
useradd -r -s /usr/sbin/nologin -d /var/lib/logprocyon logprocyon
mkdir -p /opt/logprocyon-collector
mkdir -p /var/lib/logprocyon/data
mkdir -p /var/log/logprocyon
chown -R logprocyon:logprocyon /opt/logprocyon-collector /var/lib/logprocyon /var/log/logprocyon
```

---

## 3. Instalar o código do coletor

```bash
cd /opt/logprocyon-collector
cp -a /caminho/do/repo/collector/* .
chown -R logprocyon:logprocyon .

# Instalar dependências como o user logprocyon
sudo -u logprocyon npm install --omit=dev
```

---

## 4. Permitir bind na porta 514 sem root

Porta 514 é privilegiada (<1024). Em vez de rodar o Node.js como root, dá a capability:

```bash
setcap 'cap_net_bind_service=+ep' $(which node)
```

**Atenção:** isso dá a **qualquer processo Node** no sistema permissão de bindar portas baixas. Se isso te incomoda, use uma alternativa:

- Mudar o coletor pra porta >1024 (ex: 5140) e criar um `iptables` redirect de 514 → 5140
- Ou rodar via `authbind` (mais cirúrgico)

---

## 5. Arquivo de ambiente

`/etc/default/logprocyon-collector`:

```bash
CLICKHOUSE_URL=http://127.0.0.1:8123
LISTEN_PORT=514
BATCH_SIZE=100
FLUSH_INTERVAL=2000
TZ_OFFSET_HOURS=-3
DATA_DIR=/var/lib/logprocyon/data
```

**`CLICKHOUSE_URL`:**
- Se ClickHouse está rodando no Docker (stack `log-core`), ele não está exposto no host por padrão. Pra acessar de fora do Docker, adicione um `ports: ["127.0.0.1:8123:8123"]` ao serviço `clickhouse` do `docker-stack-core.yml`, ou rode o ClickHouse também fora do Docker.
- Se ClickHouse é bare-metal na mesma máquina: `http://127.0.0.1:8123`
- Se ClickHouse é noutra máquina: `http://10.0.0.X:8123`

---

## 6. Unit file systemd

`/etc/systemd/system/logprocyon-collector.service`:

```ini
[Unit]
Description=LogProcyon NAT/CGNAT/BPA Collector
Documentation=https://github.com/gabizera/LogProcyon
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=logprocyon
Group=logprocyon
EnvironmentFile=/etc/default/logprocyon-collector
WorkingDirectory=/opt/logprocyon-collector
ExecStart=/usr/bin/node /opt/logprocyon-collector/collector.js
Restart=always
RestartSec=2
StandardOutput=append:/var/log/logprocyon/collector.log
StandardError=append:/var/log/logprocyon/collector.log

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/lib/logprocyon /var/log/logprocyon
ProtectHome=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Se você usou setcap no binário node:
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

---

## 7. Ativar e iniciar

```bash
systemctl daemon-reload
systemctl enable logprocyon-collector
systemctl start logprocyon-collector
systemctl status logprocyon-collector
```

Status esperado:

```
● logprocyon-collector.service - LogProcyon NAT/CGNAT/BPA Collector
     Loaded: loaded (/etc/systemd/system/logprocyon-collector.service; enabled; ...)
     Active: active (running) since ...
       Main PID: 12345 (node)
      Tasks: 11 (limit: 4915)
     Memory: 48.3M
        CPU: 1.234s
     CGroup: /system.slice/logprocyon-collector.service
             └─12345 /usr/bin/node /opt/logprocyon-collector/collector.js
```

---

## 8. Ver logs

```bash
# Live (do stdout capturado)
tail -f /var/log/logprocyon/collector.log

# Ou via journalctl (se `StandardOutput=journal` em vez do append:)
journalctl -u logprocyon-collector -f
```

Você deve ver:

```
[collector] LogProcyon Multi-Vendor Collector starting...
[collector] ClickHouse: http://127.0.0.1:8123
[collector] Polling /var/lib/logprocyon/data/inputs.json every 2s
[collector] Listening on UDP 0.0.0.0:514 → [001-ASR1002X-BDR-LIGO]
[event] 001-ASR1002X-BDR-LIGO bpa UDP 100.67.12.38:0 -> 177.152.111.145:8192
```

---

## 9. Atualizar o coletor

```bash
systemctl stop logprocyon-collector
cd /opt/logprocyon-collector
cp -a /caminho/do/repo/collector/*.js .
cp -a /caminho/do/repo/collector/parsers/. ./parsers/
chown -R logprocyon:logprocyon .
# Se o package.json mudou:
sudo -u logprocyon npm install --omit=dev
systemctl start logprocyon-collector
```

Ou com restart simples (sem mudança de código, só reload de config):

```bash
systemctl restart logprocyon-collector
```

Downtime de reinício: **~1 segundo** (muito mais rápido que container Docker).

---

## 10. Compartilhar `inputs.json` com o backend Docker

Se o coletor está bare-metal mas o backend continua no `log-app` Docker, eles precisam enxergar o **mesmo** `inputs.json` (o backend escreve, o coletor lê).

**Opção A — o backend também fica bare-metal** (máxima consistência, sem surpresa)

Fora do escopo deste doc. Envolve rodar o NestJS com `pm2` ou systemd também.

**Opção B — montar o diretório bare-metal dentro do container backend**

Adicione no `docker-stack-app.yml`:

```yaml
services:
  backend:
    volumes:
      - /var/lib/logprocyon/data:/data
```

E remova o uso do volume external `log_shared` do backend. O collector bare-metal usa `/var/lib/logprocyon/data` diretamente; o backend em Docker faz bind mount no mesmo diretório do host.

Cuidado: isso acopla o container ao host e quebra o princípio "stateless containers", mas em single-host é aceitável.

---

## Tradeoffs resumidos

| | Docker (padrão) | Bare-metal + systemd |
|---|---|---|
| Restart do coletor | ~5s | ~1s |
| Sobrevive crash do Docker daemon | ❌ | ✅ |
| Multi-node failover | ✅ | ❌ (precisa setup manual de DRBD/corosync) |
| Deploy | `docker build + service update` | `cp + systemctl restart` |
| Gerenciamento de dependências | Isolado na imagem | Shared com o host |
| Upgrade do Node.js | `FROM node:20` muda | `apt upgrade nodejs` (pode quebrar outros serviços) |
| Uso de RAM | ~100MB overhead do container | ~50MB direto |
| Observabilidade | `docker service logs` | `journalctl` / arquivo |
| Curva de aprendizado | Precisa saber Docker Swarm | Precisa saber systemd |

**Minha recomendação honesta:** use Docker (o padrão) a não ser que você tenha um motivo específico da lista acima. O ganho de 4 segundos de downtime por deploy raramente justifica o custo operacional de manter um processo systemd à parte.
