# Instalação em produção

Deploy do LogProcyon numa VPS Linux usando Docker Swarm + Traefik. Checklist pra um servidor virgem.

> Sempre faça deploy num servidor com **pelo menos 2 GB RAM** e **20 GB disco**. ClickHouse não tem vergonha de usar 600MB+ só com dados de teste.

---

## 0. Pré-requisitos

### No servidor (VPS)
- **Debian 12** ou Ubuntu 22.04+
- **Docker** 20.10+ e o plugin **docker compose v2**
- **Docker Swarm** inicializado (single-node ou multi-node)
- **Traefik** rodando como reverse-proxy em Swarm com o resolver Let's Encrypt configurado (opcional, mas recomendado — veja [seção 5](#5-traefik-opcional) se precisar criar)
- Portas liberadas no firewall: `22/tcp`, `80/tcp`, `443/tcp`, `514/udp`

### No seu computador
- Acesso SSH como `root` (ou user com `sudo`)
- O repositório clonado

---

## 1. Preparar o servidor

### 1.1. Instalar Docker + Swarm + rsync

```bash
ssh root@<IP-DO-SERVIDOR>

apt-get update
apt-get install -y docker.io docker-compose-plugin rsync

# Inicializa Swarm em single-node (se ainda não foi)
docker swarm init 2>/dev/null || echo "Swarm já iniciado"
```

### 1.2. Criar a rede overlay compartilhada

Se sua VPS já usa Traefik em Swarm, provavelmente já existe uma rede overlay (`procyon_net`, `traefik_public`, ou similar). Use o nome dela nos `docker-stack-*.yml`. Senão:

```bash
docker network create --driver overlay --attachable procyon_net
```

---

## 2. Subir o código

Do seu computador:

```bash
# A partir do repo local
rsync -az --exclude '.git' --exclude 'node_modules' --exclude 'frontend/dist' \
          --exclude 'data' --exclude 'backup' --exclude '.env' \
  ./ root@<IP>:/opt/log/
```

No servidor:

```bash
cd /opt/log
ls        # deve mostrar docker-stack-core.yml, docker-stack-app.yml, collector/, backend/, frontend/
```

---

## 3. Configurar variáveis de ambiente

```bash
cd /opt/log
cat > .env <<EOF
TZ_OFFSET_HOURS=-3
JWT_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=https://log.<seu-dominio>.com
MULTI_TENANT_MODE=true
EOF
chmod 600 .env
```

**Explicando:**

| Variável | O que é |
|---|---|
| `TZ_OFFSET_HOURS` | Offset do fuso horário que o collector usa pra converter timestamps. `-3` = BRT |
| `JWT_SECRET` | Segredo pra assinar tokens JWT. **Mínimo 32 chars, gerado uma vez e guardado com carinho** |
| `CORS_ORIGINS` | Domínio oficial da plataforma. Bloqueia XHR de outros origins |
| `MULTI_TENANT_MODE` | `true` ativa o isolamento por usuário via `allowed_instances`. Deixa `false` (ou omite) pra single-tenant |

---

## 4. Build das imagens Docker

Na raiz do repo, no servidor:

```bash
cd /opt/log
docker build -t logprocyon-collector:latest ./collector
docker build -t logprocyon-backend:latest   ./backend
docker build -t logprocyon-frontend:latest  ./frontend
```

Primeira vez leva ~5 minutos (puxa base images + npm install + nest build + vite build).

---

## 5. Traefik (opcional)

Se sua VPS já tem Traefik rodando como stack Swarm com um resolver Let's Encrypt configurado, pule esta seção.

Senão, crie um `/opt/traefik/docker-stack.yml` mínimo (ajuste o email):

```yaml
version: "3.8"

services:
  traefik:
    image: traefik:latest
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_letsencrypt:/etc/traefik/letsencrypt
    networks:
      - procyon_net
    command:
      - "--api.dashboard=true"
      - "--providers.docker.swarmMode=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=procyon_net"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencryptresolver.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencryptresolver.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencryptresolver.acme.storage=/etc/traefik/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencryptresolver.acme.email=seu-email@dominio.com"
    deploy:
      replicas: 1
      placement:
        constraints: [node.role == manager]

volumes:
  traefik_letsencrypt:

networks:
  procyon_net:
    external: true
```

```bash
cd /opt/traefik
docker stack deploy -c docker-stack.yml traefik
```

O `docker-stack-app.yml` do LogProcyon já declara as labels Traefik compatíveis com o nome de resolver `letsencryptresolver`. Se seu resolver tem outro nome, ajuste a label `traefik.http.routers.logprocyon.tls.certresolver=...`.

---

## 6. DNS

Aponte `log.<seu-dominio>.com` (ou o host que você escolheu) pro IP da VPS com um `A` record. Espere propagar (~2min no Cloudflare, até 1h em outros DNS).

Teste:
```bash
dig +short log.<seu-dominio>.com
# deve retornar o IP da VPS
```

---

## 7. Criar os volumes external

Este é o passo que diferencia o deploy novo do deploy legado. Os volumes vivem **fora** das stacks — assim `docker stack rm` nunca apaga dados.

```bash
docker volume create log_clickhouse_store
docker volume create log_shared
```

---

## 8. Deploy das duas stacks

```bash
cd /opt/log
set -a && . ./.env && set +a

docker stack deploy -c docker-stack-core.yml --resolve-image never log-core
docker stack deploy -c docker-stack-app.yml  --resolve-image never log-app
```

`--resolve-image never` força o Swarm a usar a imagem local (que você acabou de buildar) em vez de tentar puxar do registry.

Aguarde ~30 segundos pra tudo convergir e verifique:

```bash
docker stack services log-core
docker stack services log-app
```

Você deve ver `1/1` em todas as 4 linhas:

```
log-core_clickhouse    replicated   1/1   clickhouse/clickhouse-server:latest
log-core_collector     replicated   1/1   logprocyon-collector:latest
log-app_backend        replicated   1/1   logprocyon-backend:latest
log-app_frontend       replicated   1/1   logprocyon-frontend:latest
```

---

## 9. Verificar

### Endpoint público

```bash
curl -skI https://log.<seu-dominio>.com/
# esperado: HTTP/2 200
```

### Config API

```bash
curl -sk https://log.<seu-dominio>.com/api/config/public
# esperado: {"platform_name":"LogProcyon","multi_tenant_mode":true}
```

### Collector escutando

```bash
ss -ulnp | grep :514
# esperado: UNCONN ... 0.0.0.0:514 ... users:(("docker-proxy",...))
```

### Logs dos serviços (deve estar tudo limpo)

```bash
docker service logs log-core_collector --tail 10
docker service logs log-app_backend --tail 10
```

---

## 10. Primeiro login

Abra `https://log.<seu-dominio>.com` no browser.

**Credenciais padrão:** `admin / admin123`

**Ações imediatas:**

1. Entrar no menu **USUÁRIOS** → editar admin → trocar senha
2. Em **INPUTS**, cadastrar ao menos uma instance (nome do equipamento, IP de origem, protocolo, porta) pra o collector começar a rotear corretamente
3. Apontar o(s) equipamento(s) NetFlow/syslog pro IP da VPS na porta cadastrada
4. Voltar no **DASHBOARD** — em até 1 minuto você verá eventos chegando

---

## 11. Firewall

Se você usa `ufw`:

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 514/udp       # syslog / NetFlow padrão
ufw allow 2055/udp      # NetFlow alternativo (alguns Cisco)
ufw allow 9995/udp      # NetFlow alternativo (alguns Nokia)
ufw enable
```

Se não usa `ufw` (VPS Debian minimal costuma vir sem firewall ativo), confirme com:

```bash
iptables -L INPUT -n | head
```

---

## Próximos passos

- [Operações diárias](OPERATIONS.md) — como atualizar, fazer backup, monitorar
- [Collector bare-metal](COLLECTOR-BARE-METAL.md) — opção sem Docker se quiser máximo uptime do coletor
