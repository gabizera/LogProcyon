#!/bin/bash
# ============================================================
#  LogProcyon — Instalador automático
#  Suporte: Ubuntu 20.04+, Debian 11+
#  Uso: curl -fsSL https://raw.githubusercontent.com/gabizera/LogProcyon/main/install.sh | bash
#       ou: bash install.sh
# ============================================================
set -euo pipefail

REPO_URL="https://github.com/gabizera/LogProcyon.git"
INSTALL_DIR="/opt/logprocyon"
COMPOSE_VERSION="v2"   # usa 'docker compose' (plugin v2)

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
  OS_VERSION="$VERSION_ID"
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
apt-get install -y -qq \
  ca-certificates curl gnupg lsb-release git ufw 2>/dev/null

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

# Verificar docker compose plugin
if ! docker compose version &>/dev/null 2>&1; then
  info "Instalando docker-compose-plugin..."
  apt-get install -y -qq docker-compose-plugin
fi

success "Docker Compose: $(docker compose version --short 2>/dev/null || echo 'ok')"

# ── Clonar / atualizar repositório ───────────────────────────
step "Clonando repositório"

if [ -d "$INSTALL_DIR/.git" ]; then
  info "Repositório já existe — atualizando..."
  git -C "$INSTALL_DIR" pull --ff-only
  success "Repositório atualizado"
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  success "Repositório clonado em $INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# ── Configuração .env ─────────────────────────────────────────
step "Configuração de ambiente"

if [ -f .env ]; then
  warn ".env já existe — mantendo configuração atual"
else
  if [ ! -f .env.example ]; then
    cat > .env.example <<'EOF'
# Timezone offset em horas (ex: -3 para BRT, 0 para UTC, -4 para AMT)
TZ_OFFSET_HOURS=-3
EOF
  fi
  cp .env.example .env

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
    TZ_INPUT="${TZ_INPUT:-3}"
    # Garantir sinal negativo se o usuário não digitou
    [[ "$TZ_INPUT" =~ ^[0-9]+$ ]] && TZ_INPUT="-$TZ_INPUT"
    sed -i "s/TZ_OFFSET_HOURS=.*/TZ_OFFSET_HOURS=$TZ_INPUT/" .env
    success "Timezone configurado: UTC$TZ_INPUT"
  else
    success ".env criado com timezone padrão UTC-3"
  fi
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

# ── Build e inicialização ─────────────────────────────────────
step "Construindo e iniciando serviços"

docker compose up -d --build

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
echo -e "  ${BOLD}Credenciais:${RESET}  admin / admin123"
echo -e "  ${BOLD}Diretório:${RESET}    $INSTALL_DIR"
echo ""
echo -e "  ${YELLOW}${BOLD}Troque a senha do admin imediatamente!${RESET}"
echo -e "  Acesse: Usuários → Trocar senha"
echo ""
echo -e "  ${BOLD}Logs:${RESET}"
echo "    docker logs log-collector -f   # pacotes recebidos"
echo "    docker logs log-backend -f     # API"
echo "    docker logs log-clickhouse -f  # banco"
echo ""
echo -e "  ${BOLD}Configurar equipamento Cisco:${RESET}"
echo "    ip nat log translations flow-export v9 udp destination ${SERVER_IP} 514"
echo ""
