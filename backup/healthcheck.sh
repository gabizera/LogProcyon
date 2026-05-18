#!/usr/bin/env bash
# ============================================================
# healthcheck.sh — monitor LogProcyon + alerta Telegram.
# Cron horário: alerta 🔴 imediato em falha (com dedupe p/ não
# spammar) e manda 📊 digest diário em DIGEST_HOUR.
# Checa: containers, /api/health, disco, INGESTÃO PARADA
# (equipamento sem log = gap legal), e frescor do backup.
# Roda como root, a partir de /opt/log.
# ============================================================
set -uo pipefail
# cron tem PATH mínimo — garante docker/python3/etc.
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
APP_DIR="${APP_DIR:-/opt/log}"
BACKUP_DIR="${BACKUP_DIR:-/opt/log-backups}"
NOTIFY="${APP_DIR}/backup/notify.sh"
STATE="${BACKUP_DIR}/.hc_state"
DIGEST_HOUR="${DIGEST_HOUR:-8}"
INGEST_MAX_MIN="${INGEST_MAX_MIN:-30}"   # sem log novo há > isso = alerta
DISK_MAX_PCT="${DISK_MAX_PCT:-85}"

cd "$APP_DIR" || exit 1
CHPW="$(grep -m1 '^CLICKHOUSE_PASSWORD=' .env | cut -d= -f2-)"
ch(){ docker compose exec -T clickhouse clickhouse-client --password="$CHPW" --query "$1" 2>/dev/null; }
tg(){ [ -x "$NOTIFY" ] && bash "$NOTIFY" msg "$1" >/dev/null 2>&1 || true; }

# ── Eventos de input: novo input criado / começou a receber dados ──
# State em arquivos; 1ª execução só semeia (não alerta histórico).
SEEN_IN="${BACKUP_DIR}/.hc_inputs"
SEEN_RX="${BACKUP_DIR}/.hc_receiving"

INPUTS_JSON=$(docker run --rm -v logprocyon_logdata:/d alpine cat /d/inputs.json 2>/dev/null || echo '[]')
CUR_INPUTS=$(printf '%s' "$INPUTS_JSON" | python3 -c 'import sys,json
try: d=json.load(sys.stdin)
except: d=[]
print("\n".join(sorted("%s|%s"%(i.get("name",""),i.get("port","")) for i in d if not i.get("archived_at"))))' 2>/dev/null || echo "")
CUR_RX=$(ch "SELECT DISTINCT equipamento_origem FROM nat_logs ORDER BY 1" | sort || echo "")

if [ ! -f "$SEEN_IN" ]; then printf '%s\n' "$CUR_INPUTS" > "$SEEN_IN"; else
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    grep -qxF "$line" "$SEEN_IN" || tg "📥 <b>Novo input criado</b>%0A%0AEquipamento: <b>${line%%|*}</b>%0APorta dedicada: <b>${line##*|}/udp</b>%0A%0AAponte o equipamento do cliente pra essa porta."
  done <<< "$CUR_INPUTS"
  printf '%s\n' "$CUR_INPUTS" > "$SEEN_IN"
fi

if [ ! -f "$SEEN_RX" ]; then printf '%s\n' "$CUR_RX" > "$SEEN_RX"; else
  while IFS= read -r eq; do
    [ -z "$eq" ] && continue
    grep -qxF "$eq" "$SEEN_RX" || tg "📡 <b>Coleta ativa</b>%0A%0A<b>${eq}</b> começou a receber dados.%0AOnboarding do cliente OK ✅"
  done <<< "$CUR_RX"
  printf '%s\n' "$CUR_RX" > "$SEEN_RX"
fi

PROB=""

# 1. containers
NOTUP=$(docker compose ps --format '{{.Name}} {{.State}}' 2>/dev/null | grep -v ' running' | awk '{print $1}' | tr '\n' ',' || true)
[ -n "$NOTUP" ] && PROB="${PROB}• containers fora do ar: ${NOTUP}; "

# 2. API
HC=$(curl -s -m 8 -o /dev/null -w '%{http_code}' http://localhost:8080/api/health || echo 000)
[ "$HC" = "200" ] || PROB="${PROB}• /api/health=${HC}; "

# 3. disco
USEPCT=$(df -P "$BACKUP_DIR" | awk 'NR==2{gsub("%","",$5);print $5}')
[ "${USEPCT:-0}" -ge "$DISK_MAX_PCT" ] && PROB="${PROB}• disco ${USEPCT}% (limite ${DISK_MAX_PCT}%); "

# 4. ingestão parada (gap legal): nenhum input ativo recebendo?
NINPUTS=$(ch "SELECT count() FROM nat_logs" || echo 0)
LASTMIN=$(ch "SELECT ifNull(dateDiff('minute', max(inserted_at), now()), 999999) FROM nat_logs")
if [ "${NINPUTS:-0}" -gt 0 ] && [ "${LASTMIN:-999999}" -gt "$INGEST_MAX_MIN" ]; then
  PROB="${PROB}• INGESTÃO PARADA: sem log novo há ${LASTMIN} min (gap legal — verifique equipamentos/collector); "
fi

# 5. frescor do backup (mês corrente + log do dia)
CURM=$(date +%Y%m)
[ -f "$BACKUP_DIR/nat_logs-${CURM}.native.gz" ] || PROB="${PROB}• sem backup do mês ${CURM}; "
if [ -f "$BACKUP_DIR/backup.log" ]; then
  grep -q "BACKUP CONCLUÍDO ($(date +%Y%m%d)" "$BACKUP_DIR/backup.log" 2>/dev/null || \
    PROB="${PROB}• backup não concluiu hoje; "
fi

HOST=$(hostname)
NOW=$(date '+%F %T')

if [ -n "$PROB" ]; then
  LAST=$(cat "$STATE" 2>/dev/null || echo "")
  if [ "$PROB" != "$LAST" ]; then       # dedupe: só alerta em mudança de estado
    tg "🔴 <b>LogProcyon — ALERTA</b>%0A%0A${HOST} · ${NOW}%0A%0A${PROB//; /%0A}"
  fi
  echo "$PROB" > "$STATE"
else
  [ -s "$STATE" ] && tg "✅ <b>LogProcyon — recuperado</b>%0A%0A${HOST} · ${NOW}%0ATudo normal."
  : > "$STATE"
fi

# Digest diário (1x: na 1ª rodada da hora do digest, minuto < 15)
if [ "$(date +%-H)" -eq "$DIGEST_HOUR" ] && [ "$(date +%-M)" -lt 15 ]; then
  ROWS=$(ch "SELECT count() FROM nat_logs" || echo '?')
  EQ=$(ch "SELECT count(DISTINCT equipamento_origem) FROM nat_logs" || echo '?')
  LASTLOG=$(ch "SELECT ifNull(toString(max(inserted_at)),'-') FROM nat_logs")
  FREE=$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')
  BKP=$(ls -1 "$BACKUP_DIR"/nat_logs-*.native.gz 2>/dev/null | wc -l | tr -d ' ')
  ST=$([ -z "$PROB" ] && echo "✅ tudo OK" || echo "🔴 ${PROB}")
  tg "📊 <b>LogProcyon — digest diário</b>%0A%0A${HOST} · ${NOW}%0AStatus: ${ST}%0A%0A• nat_logs: <b>${ROWS}</b> linhas%0A• equipamentos: <b>${EQ}</b>%0A• último log: ${LASTLOG}%0A• backups mensais: ${BKP}%0A• disco livre: ${FREE}MB%0A• API: HTTP ${HC}"
fi
