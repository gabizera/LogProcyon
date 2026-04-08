#!/bin/bash
# ============================================================
#  LogProcyon — Instalador automático
#  Suporte: Ubuntu 20.04+, Debian 11+
#  Uso: curl -fsSL https://raw.githubusercontent.com/gabizera/LogProcyon/main/install.sh | bash
#       ou: bash install.sh
# ============================================================
set -euo pipefail

REPO_RAW="https://raw.githubusercontent.com/gabizera/LogProcyon/main"
INSTALL_DIR="/opt/logprocyon"

# ── Cores ────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERRO]${RESET}  $*" >&2; exit 1; }
step()    { echo -e "\n${BOLD}━━━ $* ${RESET}"; }

# ── Verificações iniciais ─────────────────────────────────────
step "Verificando pré-requisitos"

[ "$(id -u)" -ne 0 ] && error "Execute como root: sudo bash install.sh"

# Detectar OS
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS_ID="$ID"
else
  error "Sistema operacional não suportado (sem /etc/os-release)"
fi

case "$OS_ID" in
  ubuntu|debian|linuxmint|pop) : ;;
  *) warn "OS '$OS_ID' não testado. Tentando continuar como Debian/Ubuntu..." ;;
esac

info "Sistema: $PRETTY_NAME"
info "Diretório de instalação: $INSTALL_DIR"

# ── Dependências básicas ──────────────────────────────────────
step "Instalando dependências do sistema"

apt-get update -qq
apt-get install -y -qq ca-certificates curl ufw 2>/dev/null

success "Dependências instaladas"

# ── Docker ───────────────────────────────────────────────────
step "Verificando Docker"

if command -v docker &>/dev/null && docker compose version &>/dev/null 2>&1; then
  DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ',')
  success "Docker já instalado: $DOCKER_VER"
else
  info "Instalando Docker via get.docker.com..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  success "Docker instalado"
fi

if ! docker compose version &>/dev/null 2>&1; then
  info "Instalando docker-compose-plugin..."
  apt-get install -y -qq docker-compose-plugin
fi

success "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'ok')"

# ── Baixar arquivos do projeto ────────────────────────────────
step "Baixando LogProcyon"

mkdir -p "$INSTALL_DIR/clickhouse"

# Baixar apenas os arquivos necessários (sem git clone)
curl -fsSL "$REPO_RAW/docker-compose.yml"     -o "$INSTALL_DIR/docker-compose.yml"
curl -fsSL "$REPO_RAW/clickhouse/init.sql"     -o "$INSTALL_DIR/clickhouse/init.sql"

success "Arquivos baixados em $INSTALL_DIR"

cd "$INSTALL_DIR"

# ── Configuração .env ─────────────────────────────────────────
step "Configuração de ambiente"

if [ -f .env ]; then
  warn ".env já existe — mantendo configuração atual"
else
  # Gerar JWT_SECRET aleatório (64 hex chars)
  JWT_SECRET=$(openssl rand -hex 32)

  cat > .env <<EOF
# Timezone offset em horas (ex: -3 para BRT, 0 para UTC, -4 para AMT)
TZ_OFFSET_HOURS=-3

# JWT secret (gerado automaticamente na instalação — não compartilhe)
JWT_SECRET=${JWT_SECRET}
EOF

  # Perguntar timezone interativamente (se tiver terminal)
  if [ -t 0 ]; then
    echo ""
    echo -e "  ${BOLD}Fusos horários comuns:${RESET}"
    echo "    -5  → UTC-5  (BRT - Acre)"
    echo "    -4  → UTC-4  (AMT - Manaus)"
    echo "    -3  → UTC-3  (BRT - Brasília)  ← padrão"
    echo "    -2  → UTC-2  (Fernando de Noronha)"
    echo "     0  → UTC+0  (GMT)"
    echo ""
    read -rp "  Timezone offset [-3]: " TZ_INPUT
    TZ_INPUT="${TZ_INPUT:--3}"
    if [[ "$TZ_INPUT" =~ ^-?[0-9]+$ ]]; then
      sed -i "s/TZ_OFFSET_HOURS=.*/TZ_OFFSET_HOURS=$TZ_INPUT/" .env
      success "Timezone configurado: UTC$TZ_INPUT"
    else
      warn "Valor inválido — usando padrão UTC-3"
    fi
  else
    success ".env criado com timezone padrão UTC-3"
  fi

  chmod 600 .env
  success "JWT_SECRET gerado automaticamente"
fi

# ── Firewall ──────────────────────────────────────────────────
step "Configurando firewall (ufw)"

if ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp   comment 'LogProcyon frontend' 2>/dev/null || true
  ufw allow 514/udp  comment 'LogProcyon collector (NetFlow/Syslog)' 2>/dev/null || true
  success "Regras adicionadas: 80/tcp, 514/udp"
else
  warn "ufw não está ativo — configure manualmente se necessário"
  info "  ufw allow 80/tcp && ufw allow 514/udp"
fi

# ── Pull e inicialização ─────────────────────────────────────
step "Baixando e iniciando serviços"

docker compose pull
docker compose up -d

# Aguardar ClickHouse ficar healthy
info "Aguardando ClickHouse inicializar..."
TIMEOUT=60
ELAPSED=0
until docker inspect log-clickhouse --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  if [ $ELAPSED -ge $TIMEOUT ]; then
    warn "ClickHouse demorou mais que esperado — verifique com: docker logs log-clickhouse"
    break
  fi
  echo -n "."
done
echo ""
success "Serviços iniciados"

# ── Status final ──────────────────────────────────────────────
step "Status dos serviços"

docker compose ps

SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${RESET}"
echo -e "${GREEN}${BOLD}║        LogProcyon instalado com sucesso!     ║${RESET}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Acesso:${RESET}       http://${SERVER_IP}"
echo -e "  ${BOLD}Login:${RESET}        admin"
echo -e "  ${BOLD}Senha:${RESET}        admin123"
echo -e "  ${BOLD}Diretório:${RESET}    $INSTALL_DIR"
echo ""
echo -e "  ${RED}${BOLD}IMPORTANTE: Troque a senha do admin imediatamente!${RESET}"
echo -e "  Acesse: Usuários → Trocar senha"
echo ""
echo -e "  ${BOLD}Atualizar:${RESET}"
echo "    cd $INSTALL_DIR && docker compose pull && docker compose up -d"
echo ""
echo -e "  ${BOLD}Logs:${RESET}"
echo "    docker logs log-collector -f   # pacotes recebidos"
echo "    docker logs log-backend -f     # API"
echo "    docker logs log-clickhouse -f  # banco"
echo ""
