#!/usr/bin/env bash
# ============================================================
# notify.sh — envia mensagem/arquivo pro Telegram (Bot API).
# Lê TELEGRAM_BOT_TOKEN e TELEGRAM_CHAT_ID do /opt/log/.env.
# Sem token configurado = no-op silencioso (não quebra o cron).
#
#   notify.sh msg "texto..."
#   notify.sh doc /caminho/arquivo "legenda"
# Limite Bot API: documento até 50 MB (por isso só logdata vai por aqui).
# ============================================================
set -uo pipefail
APP_DIR="${APP_DIR:-/opt/log}"
[ -f "$APP_DIR/.env" ] || exit 0
TOKEN="$(grep -m1 '^TELEGRAM_BOT_TOKEN=' "$APP_DIR/.env" | cut -d= -f2-)"
CHAT="$(grep -m1 '^TELEGRAM_CHAT_ID=' "$APP_DIR/.env" | cut -d= -f2-)"
TOPIC="$(grep -m1 '^TELEGRAM_TOPIC_ID=' "$APP_DIR/.env" | cut -d= -f2-)"
[ -n "$TOKEN" ] && [ -n "$CHAT" ] || exit 0   # não configurado → no-op

API="https://api.telegram.org/bot${TOKEN}"
KIND="${1:-msg}"
# supergrupo com topics: precisa de message_thread_id
THREAD=()
[ -n "${TOPIC:-}" ] && THREAD=(--data-urlencode "message_thread_id=${TOPIC}")
THREADF=()
[ -n "${TOPIC:-}" ] && THREADF=(-F "message_thread_id=${TOPIC}")

case "$KIND" in
  msg)
    # aceita %0A como quebra de linha (conveniência p/ chamadas em uma linha)
    TEXT="$(printf '%s' "${2:-}" | sed 's/%0A/\n/g')"
    curl -s -m 20 -X POST "$API/sendMessage" \
      --data-urlencode "chat_id=${CHAT}" \
      "${THREAD[@]}" \
      --data-urlencode "text=${TEXT}" \
      --data-urlencode "parse_mode=HTML" >/dev/null 2>&1 || true
    ;;
  doc)
    FILE="${2:-}"; CAP="${3:-}"
    [ -f "$FILE" ] || exit 0
    SZ=$(stat -c%s "$FILE" 2>/dev/null || echo 0)
    if [ "$SZ" -gt 49000000 ]; then
      # grande demais pra Bot API — avisa em vez de falhar calado
      curl -s -m 20 -X POST "$API/sendMessage" \
        --data-urlencode "chat_id=${CHAT}" \
        --data-urlencode "text=⚠️ Backup ${FILE##*/} = $((SZ/1048576))MB > 50MB, não enviado ao Telegram (mantido local). Configure offsite pro volume pesado." >/dev/null 2>&1 || true
      exit 0
    fi
    curl -s -m 120 -X POST "$API/sendDocument" \
      -F "chat_id=${CHAT}" \
      "${THREADF[@]}" \
      -F "caption=${CAP}" \
      -F "document=@${FILE}" >/dev/null 2>&1 || true
    ;;
esac
exit 0
