#!/bin/bash
# LogProcyon — Atualizar para última versão
set -euo pipefail

INSTALL_DIR="/opt/logprocyon"
REPO_RAW="https://raw.githubusercontent.com/gabizera/LogProcyon/main"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

echo -e "${BOLD}━━━ LogProcyon — Atualizando ${RESET}"

cd "$INSTALL_DIR"

# Atualizar docker-compose.yml e init.sql
curl -fsSL "$REPO_RAW/docker-compose.yml" -o docker-compose.yml
curl -fsSL "$REPO_RAW/clickhouse/init.sql" -o clickhouse/init.sql

# Pull e restart
docker compose pull
docker compose up -d

echo ""
echo -e "${GREEN}${BOLD}Atualização concluída!${RESET}"
docker compose ps
