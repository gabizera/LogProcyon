#!/bin/bash
# LogProcyon — Sync nftables allowlist from inputs.json
#
# Lê inputs.json do volume do backend e regenera a tabela nft
# 'logprocyon' com regras que só permitem UDP nas portas cadastradas
# vindas dos source_ips declarados. Pacotes fora dessa lista são
# descartados no hook prerouting, antes de chegarem aos containers.
#
# Idempotente: pode rodar quantas vezes quiser. Chamado via systemd
# path unit quando inputs.json muda.

set -euo pipefail

TABLE="logprocyon"
VOLUME_PATH="${VOLUME_PATH:-/var/lib/docker/volumes/log_shared/_data/inputs.json}"

if [ ! -f "$VOLUME_PATH" ]; then
  echo "[sync-firewall] inputs.json não encontrado em $VOLUME_PATH"
  exit 0
fi

# Parse inputs.json com python3 (sem depender de jq)
mapfile -t RULES < <(python3 -c "
import json
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

# Coleta portas distintas pra saber quais proteger (drop default)
declare -A PORTS_USED
for r in "${RULES[@]}"; do
  port="${r##* }"
  PORTS_USED[$port]=1
done

# Gera ruleset completo e aplica atomicamente via stdin
{
  echo "table inet $TABLE {"
  echo "  chain allowlist {"
  # prerouting prio -300 (antes de qualquer coisa do docker que usa prio 0+)
  echo "    type filter hook prerouting priority -300; policy accept;"
  # loopback e redes privadas sempre ok
  echo "    iif \"lo\" accept"
  echo "    ip saddr 127.0.0.0/8 accept"
  echo "    ip saddr 10.0.0.0/8 accept"
  echo "    ip saddr 172.16.0.0/12 accept"
  echo "    ip saddr 192.168.0.0/16 accept"

  # Allow por IP+porta cadastrados
  for r in "${RULES[@]}"; do
    ip="${r%% *}"
    port="${r##* }"
    echo "    udp dport $port ip saddr $ip accept"
  done

  # Drop nas portas que estão guardadas
  for port in "${!PORTS_USED[@]}"; do
    echo "    udp dport $port drop"
  done

  echo "  }"
  echo "}"
} > /tmp/logprocyon-firewall.nft

# Remove tabela antiga (se existir) e aplica nova atomicamente
nft delete table inet $TABLE 2>/dev/null || true
nft -f /tmp/logprocyon-firewall.nft

echo "[sync-firewall] applied — ${#RULES[@]} allow rules, ${#PORTS_USED[@]} guarded ports"
for r in "${RULES[@]}"; do echo "[sync-firewall]   allow $r"; done
for p in "${!PORTS_USED[@]}"; do echo "[sync-firewall]   drop  udp/$p (default)"; done
