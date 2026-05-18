#!/usr/bin/env bash
# ============================================================
# LogProcyon backup — deploy Docker Compose (NÃO Swarm).
#
# Requisito legal: reter 15 meses (1a3m) de logs de TODOS os
# equipamentos, sem falha. nat_logs é particionado por mês
# (PARTITION BY toYYYYMM). Estratégia:
#   - 1 arquivo de backup por partição mensal (YYYYMM)
#   - re-dump só do mês corrente e anterior (ainda mutáveis)
#   - meses antigos ficam arquivados (não re-exporta à toa)
#   - retenção dos arquivos = LEGAL_MONTHS+1 (folga)
#   - checagem de COBERTURA: alerta se faltar mês no período legal
#   - guarda de espaço livre (não enche o HD / não para o sistema)
# Uso: ./backup.sh   (root, a partir de /opt/log) — via cron diário.
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/log}"
BACKUP_DIR="${BACKUP_DIR:-/opt/log-backups}"
LEGAL_MONTHS="${LEGAL_MONTHS:-15}"          # retenção legal (Marco Civil)
KEEP_MONTHS="${KEEP_MONTHS:-$((LEGAL_MONTHS+1))}"  # arquivos: 15 + 1 folga
LD_RETAIN_DAYS="${LD_RETAIN_DAYS:-30}"      # logdata é pequeno
MIN_FREE_MB="${MIN_FREE_MB:-3000}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"          # ex: gdrive:logprocyon-backups
LOG="${BACKUP_DIR}/backup.log"

NOTIFY="${APP_DIR}/backup/notify.sh"
mkdir -p "$BACKUP_DIR"
log(){ echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }
tg(){ [ -x "$NOTIFY" ] && bash "$NOTIFY" "$@" >/dev/null 2>&1 || true; }
fail(){ log "ERRO: $*"; tg msg "🔴 LogProcyon backup FALHOU em $(hostname): $*"; exit 1; }
ch(){ docker compose exec -T clickhouse clickhouse-client --password="$CHPW" "$@"; }

cd "$APP_DIR" || fail "APP_DIR $APP_DIR inexistente"
[ -f .env ] || fail ".env não encontrado"
CHPW="$(grep -m1 '^CLICKHOUSE_PASSWORD=' .env | cut -d= -f2-)"
[ -n "$CHPW" ] || fail "CLICKHOUSE_PASSWORD vazio"

FREE_MB=$(df -Pm "$BACKUP_DIR" | awk 'NR==2{print $4}')
log "espaço livre ${FREE_MB}MB (mín ${MIN_FREE_MB}MB)"
[ "$FREE_MB" -ge "$MIN_FREE_MB" ] || fail "espaço insuficiente — backup ABORTADO"

CUR=$(date +%Y%m)
PREV=$(date -d "$(date +%Y-%m-01) -1 month" +%Y%m)

# Meses presentes em nat_logs
MONTHS=$(ch --query "SELECT DISTINCT toYYYYMM(timestamp) FROM nat_logs ORDER BY 1" 2>/dev/null) \
  || fail "ClickHouse inacessível"
[ -n "$MONTHS" ] || log "AVISO: nat_logs sem dados ainda"

for M in $MONTHS; do
  F="$BACKUP_DIR/nat_logs-$M.native.gz"
  # re-dump se: arquivo não existe, ou é mês corrente/anterior (mutável)
  if [ ! -f "$F" ] || [ "$M" = "$CUR" ] || [ "$M" = "$PREV" ]; then
    log "dump partição $M -> $F"
    ch --query "SELECT * FROM nat_logs WHERE toYYYYMM(timestamp)=$M FORMAT Native" \
      | gzip > "$F.tmp" || fail "dump $M falhou"
    gzip -t "$F.tmp" || { rm -f "$F.tmp"; fail "gz $M corrompido"; }
    [ "$(stat -c%s "$F.tmp")" -ge 40 ] || { rm -f "$F.tmp"; fail "dump $M suspeito (vazio)"; }
    mv "$F.tmp" "$F"
    log "  $M OK ($(stat -c%s "$F") bytes)"
  else
    log "partição $M já arquivada (imutável) — pulando"
  fi
done

# logdata (inputs/users/config) — pequeno, diário
D=$(date +%Y%m%d-%H%M)
LD="$BACKUP_DIR/logdata-$D.tgz"
docker run --rm -v logprocyon_logdata:/from -v "$BACKUP_DIR":/to alpine \
  tar czf "/to/$(basename "$LD")" -C /from . || fail "tar logdata falhou"
gzip -t "$LD" || { rm -f "$LD"; fail "gz logdata corrompido"; }
log "logdata OK ($(stat -c%s "$LD") bytes)"
tg doc "$LD" "logdata $(hostname) $D"   # logdata é pequeno, vai pro Telegram (offsite leve)

# ── COBERTURA: todo mês dos últimos LEGAL_MONTHS tem backup? ──
GAP=0
for i in $(seq 0 $((LEGAL_MONTHS-1))); do
  MM=$(date -d "$(date +%Y-%m-01) -$i month" +%Y%m)
  HAS_DATA=$(ch --query "SELECT count() FROM nat_logs WHERE toYYYYMM(timestamp)=$MM" 2>/dev/null || echo 0)
  if [ "${HAS_DATA:-0}" -gt 0 ] && [ ! -f "$BACKUP_DIR/nat_logs-$MM.native.gz" ]; then
    log "ALERTA GAP LEGAL: mês $MM tem dados mas SEM backup!"
    GAP=1
  fi
done
[ "$GAP" -eq 0 ] && log "cobertura legal OK ($LEGAL_MONTHS meses)"

# ── Offsite opcional (rclone — Google Drive etc.) ──
if [ -n "$RCLONE_REMOTE" ] && command -v rclone >/dev/null 2>&1; then
  if rclone copy "$BACKUP_DIR" "$RCLONE_REMOTE" --include "nat_logs-*.native.gz" --include "logdata-*.tgz" 2>>"$LOG"; then
    log "offsite OK -> $RCLONE_REMOTE"
  else
    log "AVISO: offsite falhou (backup local mantido)"
  fi
fi

# ── Retenção (não estoura HD) ──
# Partições mensais: remove as mais antigas que KEEP_MONTHS.
CUTOFF=$(date -d "$(date +%Y-%m-01) -$KEEP_MONTHS month" +%Y%m)
for f in "$BACKUP_DIR"/nat_logs-*.native.gz; do
  [ -e "$f" ] || continue
  MM=$(basename "$f" | sed 's/nat_logs-\([0-9]\{6\}\).native.gz/\1/')
  [ "$MM" -lt "$CUTOFF" ] && { rm -f "$f"; log "retenção: removido $f (anterior a $CUTOFF)"; }
done
DEL=$(find "$BACKUP_DIR" -maxdepth 1 -name 'logdata-*.tgz' -mtime "+$LD_RETAIN_DAYS" -print -delete | wc -l | tr -d ' ')
log "retenção logdata: ${DEL} removidos (>${LD_RETAIN_DAYS}d). Partições mensais: $(find "$BACKUP_DIR" -name 'nat_logs-*.native.gz'|wc -l|tr -d ' ')"
NPART=$(find "$BACKUP_DIR" -name 'nat_logs-*.native.gz' | wc -l | tr -d ' ')
if [ "$GAP" -eq 0 ]; then
  log "BACKUP CONCLUÍDO ($D)"
  tg msg "✅ LogProcyon backup OK em $(hostname) — $D | nat_logs: $NPART partição(ões) | cobertura legal ${LEGAL_MONTHS}m OK | disco livre ${FREE_MB}MB"
else
  log "BACKUP CONCLUÍDO COM GAP LEGAL ($D)"
  tg msg "🔴 LogProcyon backup com GAP LEGAL em $(hostname) — $D. Há mês com dados SEM backup. Verifique $LOG urgente."
  exit 2
fi
