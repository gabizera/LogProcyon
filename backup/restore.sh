#!/usr/bin/env bash
# ============================================================
# LogProcyon restore — deploy Docker Compose (NÃO Swarm).
#
#   ./restore.sh nat <arquivo.native.gz> [--truncate] [--temp]
#   ./restore.sh logdata <arquivo.tgz>
#
#   --temp     restaura nat_logs num clone (nat_logs_restore_test),
#              valida e descarta — NÃO toca no dado de produção.
#   --truncate TRUNCATE nat_logs antes (restore total). Sem isso = append.
# Roda como root, a partir de /opt/log.
# ============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/log}"
MODE="${1:-}"; FILE="${2:-}"
TRUNCATE=no; TEMP=no
for a in "$@"; do
  [ "$a" = "--truncate" ] && TRUNCATE=yes
  [ "$a" = "--temp" ] && TEMP=yes
done

cd "$APP_DIR"
[ -f .env ] || { echo "ERRO: .env não encontrado"; exit 1; }
CHPW="$(grep -m1 '^CLICKHOUSE_PASSWORD=' .env | cut -d= -f2-)"
ch(){ docker compose exec -T clickhouse clickhouse-client --password="$CHPW" "$@"; }
log(){ echo "[$(date '+%F %T')] $*"; }

if [ -z "$MODE" ] || [ -z "$FILE" ]; then
  echo "Uso: $0 nat <arquivo.native.gz> [--truncate] [--temp]"
  echo "     $0 logdata <arquivo.tgz>"
  echo "Backups disponíveis:"; ls -1 /opt/log-backups/ 2>/dev/null | grep -E 'native.gz|tgz' || echo "  (nenhum)"
  exit 1
fi
[ -f "$FILE" ] || { echo "ERRO: arquivo $FILE não existe"; exit 1; }
gzip -t "$FILE" || { echo "ERRO: $FILE corrompido (gzip -t falhou)"; exit 1; }
log "integridade do arquivo OK"

case "$MODE" in
  nat)
    ch --query "SELECT 1" >/dev/null || { echo "ERRO: ClickHouse inacessível"; exit 1; }
    if [ "$TEMP" = yes ]; then
      log "modo --temp: restaurando em nat_logs_restore_test (NÃO toca produção)"
      ch --query "DROP TABLE IF EXISTS nat_logs_restore_test"
      ch --query "CREATE TABLE nat_logs_restore_test AS nat_logs"
      zcat "$FILE" | ch --query "INSERT INTO nat_logs_restore_test FORMAT Native"
      N=$(ch --query "SELECT count() FROM nat_logs_restore_test")
      log "VALIDADO: $N linhas restauradas no clone de teste"
      ch --query "DROP TABLE nat_logs_restore_test"
      log "clone de teste descartado. Backup é restaurável. OK."
      exit 0
    fi
    BEFORE=$(ch --query "SELECT count() FROM nat_logs" 2>/dev/null || echo 0)
    if [ "$TRUNCATE" = yes ]; then
      log "TRUNCATE nat_logs (restore total)"; ch --query "TRUNCATE TABLE nat_logs"
    fi
    log "restaurando $FILE -> nat_logs..."
    zcat "$FILE" | ch --query "INSERT INTO nat_logs FORMAT Native"
    AFTER=$(ch --query "SELECT count() FROM nat_logs")
    log "linhas antes=$BEFORE depois=$AFTER (inseridas=$((AFTER-BEFORE)))"
    [ "$AFTER" -gt "$BEFORE" ] || { echo "ERRO: nenhuma linha inserida"; exit 1; }
    log "RESTORE nat_logs CONCLUÍDO"
    ;;
  logdata)
    log "parando backend+collector pra restaurar logdata com segurança"
    docker compose stop backend collector
    docker run --rm -v logprocyon_logdata:/to -v "$(dirname "$FILE")":/from alpine \
      sh -c "rm -rf /to/* && tar xzf /from/$(basename "$FILE") -C /to"
    docker compose start backend collector
    log "RESTORE logdata CONCLUÍDO (backend+collector reiniciados)"
    ;;
  *)
    echo "ERRO: modo inválido '$MODE' (use: nat | logdata)"; exit 1 ;;
esac
