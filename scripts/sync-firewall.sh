#!/bin/bash
# LogProcyon — Sync iptables allowlist from inputs.json
#
# Lê inputs.json do volume do backend e regenera uma chain LOGPROCYON
# com regras que só permitem UDP nas portas cadastradas vindas dos
# source_ips declarados. Pacotes fora dessa lista são descartados antes
# de chegarem aos containers Docker.
#
# Idempotente: pode rodar quantas vezes quiser. Chamado via systemd path
# unit quando inputs.json muda.

set -euo pipefail

CHAIN="LOGPROCYON"
VOLUME_PATH="${VOLUME_PATH:-/var/lib/docker/volumes/log-core_log_shared/_data/inputs.json}"

if [ ! -f "$VOLUME_PATH" ]; then
  echo "[sync-firewall] inputs.json não encontrado em $VOLUME_PATH"
  exit 0
fi

# Parser sem jq pra não depender: usa python3 que já vem em tudo
mapfile -t RULES < <(python3 -c "
import json, sys
data = json.load(open('$VOLUME_PATH'))
seen = set()
for i in data:
    if not i.get('enabled', True): continue
    ip = (i.get('source_ip') or '').strip()
    port = int(i.get('port') or 0)
    if not ip or not port: continue
    key = f'{ip}:{port}'
    if key in seen: continue
    seen.add(key)
    print(f'{ip} {port}')
")

# Também coletamos as portas distintas (pra aplicar drop na porta só se
# houver pelo menos uma regra de allow — evita trancar acidentalmente).
declare -A PORTS_USED
for r in "${RULES[@]}"; do
  port="${r##* }"
  PORTS_USED[$port]=1
done

# (Re)cria a chain
if iptables -n -L "$CHAIN" >/dev/null 2>&1; then
  iptables -F "$CHAIN"
else
  iptables -N "$CHAIN"
fi

# Garante que DOCKER-USER referencia nossa chain (Docker processa
# DOCKER-USER antes das regras automáticas de NAT, então isso pega
# tráfego antes de chegar nos containers).
if ! iptables -C DOCKER-USER -j "$CHAIN" 2>/dev/null; then
  iptables -I DOCKER-USER -j "$CHAIN"
fi

# Sempre libera tráfego já estabelecido / relacionado
iptables -A "$CHAIN" -m conntrack --ctstate RELATED,ESTABLISHED -j RETURN

# Libera loopback e redes privadas (containers se comunicam por
# 172.x/10.x/192.168.x dentro do Docker)
iptables -A "$CHAIN" -s 127.0.0.0/8 -j RETURN
iptables -A "$CHAIN" -s 10.0.0.0/8 -j RETURN
iptables -A "$CHAIN" -s 172.16.0.0/12 -j RETURN
iptables -A "$CHAIN" -s 192.168.0.0/16 -j RETURN

# Allow por IP+porta cadastrados
for r in "${RULES[@]}"; do
  ip="${r%% *}"
  port="${r##* }"
  iptables -A "$CHAIN" -p udp -s "$ip" --dport "$port" -j RETURN
  echo "[sync-firewall] allow udp/$port from $ip"
done

# Drop final: só para as portas que temos allow. Tudo que não matched
# antes é dropado silenciosamente (sem REJECT pra não sinalizar ao
# atacante que a porta existe).
for port in "${!PORTS_USED[@]}"; do
  iptables -A "$CHAIN" -p udp --dport "$port" -j DROP
  echo "[sync-firewall] drop udp/$port (default)"
done

# Outras portas/protocolos: fall-through (RETURN para próxima chain)
iptables -A "$CHAIN" -j RETURN

echo "[sync-firewall] done — ${#RULES[@]} allow rules, ${#PORTS_USED[@]} guarded ports"
