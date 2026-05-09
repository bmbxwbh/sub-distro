#!/usr/bin/env bash
set -euo pipefail

# ============================================
# sub-distro 一键部署脚本
# 用法: bash deploy.sh
# ============================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

REPO="https://github.com/bmbxwbh/sub-distro.git"
INSTALL_DIR="/opt/sub-distro"
SERVICE_NAME="sub-distro"
NODE_MIN_VERSION=18

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
err()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ─── Root check ───────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "请使用 root 用户运行此脚本: sudo bash deploy.sh"
fi

# ─── Detect OS ────────────────────────────────────────────────────
detect_os() {
  if [[ -f /etc/os-release ]]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
  elif command -v lsb_release &>/dev/null; then
    OS=$(lsb_release -si | tr '[:upper:]' '[:lower:]')
  else
    err "无法识别操作系统"
  fi
  info "检测到系统: ${OS} ${VER}"
}

# ─── Install Node.js ──────────────────────────────────────────────
install_node() {
  if command -v node &>/dev/null; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [[ $NODE_VER -ge $NODE_MIN_VERSION ]]; then
      ok "Node.js $(node -v) 已安装"
      return
    else
      warn "Node.js 版本过低 ($(node -v))，需要 >= ${NODE_MIN_VERSION}"
    fi
  fi

  info "安装 Node.js ${NODE_MIN_VERSION}.x ..."

  case $OS in
    ubuntu|debian)
      curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash -
      apt-get install -y nodejs
      ;;
    centos|rhel|rocky|almalinux|fedora)
      curl -fsSL https://rpm.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash -
      yum install -y nodejs
      ;;
    alpine)
      apk add --no-cache nodejs npm
      ;;
    *)
      # Fallback: use fnm or nvm
      warn "未识别的包管理器，尝试通过 NodeSource 安装..."
      curl -fsSL https://deb.nodesource.com/setup_${NODE_MIN_VERSION}.x | bash -
      apt-get install -y nodejs 2>/dev/null || yum install -y nodejs 2>/dev/null || err "自动安装失败，请手动安装 Node.js >= ${NODE_MIN_VERSION}"
      ;;
  esac

  ok "Node.js $(node -v) 安装完成"
}

# ─── Install system dependencies ──────────────────────────────────
install_deps() {
  info "安装系统依赖..."
  case $OS in
    ubuntu|debian)
      apt-get update -qq
      apt-get install -y -qq git build-essential python3
      ;;
    centos|rhel|rocky|almalinux|fedora)
      yum install -y -q git gcc-c++ make python3
      ;;
    alpine)
      apk add --no-cache git build-base python3
      ;;
  esac
  ok "系统依赖安装完成"
}

# ─── Clone / Update repo ──────────────────────────────────────────
setup_repo() {
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "更新已有安装..."
    cd "$INSTALL_DIR"
    git fetch --all
    git reset --hard origin/main
    ok "代码已更新"
  else
    info "克隆仓库..."
    rm -rf "$INSTALL_DIR"
    git clone --depth 1 "$REPO" "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    ok "仓库克隆完成"
  fi
}

# ─── Install npm dependencies ─────────────────────────────────────
install_npm() {
  info "安装 npm 依赖..."
  cd "$INSTALL_DIR"
  npm install --production 2>&1 | tail -3
  ok "npm 依赖安装完成"
}

# ─── Configure .env ───────────────────────────────────────────────
setup_env() {
  ENV_FILE="$INSTALL_DIR/.env"

  if [[ -f "$ENV_FILE" ]]; then
    warn ".env 已存在，跳过配置（如需重新配置请删除 .env）"
    return
  fi

  info "配置环境变量..."

  # Generate random session secret
  SESSION_SECRET=$(head -c 32 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 32)

  # Get server IP
  SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

  cat > "$ENV_FILE" << EOF
# Server
PORT=3000
HOST=0.0.0.0

# 3x-ui Panel
XUI_BASE_URL=http://127.0.0.1:2053
XUI_USERNAME=admin
XUI_PASSWORD=admin

# Database
DB_PATH=./data/sub-distro.db

# Session secret (auto-generated)
SESSION_SECRET=${SESSION_SECRET}

# Subscription base URL
SUB_BASE_URL=http://${SERVER_IP}:14826

# EPay (易支付) - 请填入你的易支付信息
EPAY_API_URL=
EPAY_PID=
EPAY_KEY=
EOF

  ok ".env 已生成"
  warn "请编辑 ${ENV_FILE} 填入你的 3x-ui 和易支付配置"
}

# ─── Create systemd service ──────────────────────────────────────
setup_systemd() {
  info "创建 systemd 服务..."

  cat > /etc/systemd/system/${SERVICE_NAME}.service << EOF
[Unit]
Description=sub-distro - 3x-ui subscription distribution platform
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${INSTALL_DIR}
ExecStart=$(which node) src/app.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable ${SERVICE_NAME}
  ok "systemd 服务已创建"
}

# ─── Start service ────────────────────────────────────────────────
start_service() {
  info "启动服务..."
  systemctl restart ${SERVICE_NAME}
  sleep 2

  if systemctl is-active --quiet ${SERVICE_NAME}; then
    ok "服务启动成功!"
  else
    err "服务启动失败，运行 journalctl -u ${SERVICE_NAME} -n 20 查看日志"
  fi
}

# ─── Setup firewall ───────────────────────────────────────────────
setup_firewall() {
  if command -v ufw &>/dev/null; then
    info "配置防火墙 (ufw)..."
    ufw allow 14826/tcp comment "sub-distro" 2>/dev/null || true
    ok "防火墙规则已添加"
  elif command -v firewall-cmd &>/dev/null; then
    info "配置防火墙 (firewalld)..."
    firewall-cmd --permanent --add-port=14826/tcp 2>/dev/null || true
    firewall-cmd --reload 2>/dev/null || true
    ok "防火墙规则已添加"
  fi
}

# ─── Print summary ────────────────────────────────────────────────
print_summary() {
  SERVER_IP=$(curl -s --max-time 5 ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}  ✅ sub-distro 部署完成!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo -e "  ${BLUE}访问地址:${NC}  http://${SERVER_IP}:14826"
  echo -e "  ${BLUE}管理员:${NC}    admin / admin123"
  echo -e "  ${BLUE}安装目录:${NC}  ${INSTALL_DIR}"
  echo -e "  ${BLUE}配置文件:${NC}  ${INSTALL_DIR}/.env"
  echo -e "  ${BLUE}数据库:${NC}    ${INSTALL_DIR}/data/sub-distro.db"
  echo ""
  echo -e "  ${YELLOW}常用命令:${NC}"
  echo -e "    查看状态:  systemctl status ${SERVICE_NAME}"
  echo -e "    查看日志:  journalctl -u ${SERVICE_NAME} -f"
  echo -e "    重启服务:  systemctl restart ${SERVICE_NAME}"
  echo -e "    停止服务:  systemctl stop ${SERVICE_NAME}"
  echo -e "    更新代码:  bash ${INSTALL_DIR}/deploy.sh"
  echo ""
  echo -e "  ${YELLOW}下一步:${NC}"
  echo -e "    1. 编辑 ${INSTALL_DIR}/.env 配置 3x-ui 和易支付"
  echo -e "    2. 访问 http://${SERVER_IP}:3000/admin 配置面板"
  echo -e "    3. 在 /admin/xui 填入 3x-ui 面板地址"
  echo -e "    4. 在 /admin/plans 创建套餐"
  echo ""
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ─── Uninstall ────────────────────────────────────────────────────
uninstall() {
  echo ""
  warn "即将卸载 sub-distro"
  read -p "确定要卸载吗？(y/N): " confirm
  if [[ "$confirm" != "y" && "$confirm" != "Y" ]]; then
    info "已取消"
    exit 0
  fi

  systemctl stop ${SERVICE_NAME} 2>/dev/null || true
  systemctl disable ${SERVICE_NAME} 2>/dev/null || true
  rm -f /etc/systemd/system/${SERVICE_NAME}.service
  systemctl daemon-reload
  rm -rf "$INSTALL_DIR"
  ok "卸载完成"
  exit 0
}

# ─── Main ─────────────────────────────────────────────────────────
main() {
  # Handle arguments
  case "${1:-}" in
    uninstall|remove)
      uninstall
      ;;
    update|upgrade)
      detect_os
      setup_repo
      install_npm
      start_service
      ok "更新完成!"
      exit 0
      ;;
  esac

  echo ""
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}  sub-distro 一键部署脚本${NC}"
  echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""

  detect_os
  install_deps
  install_node
  setup_repo
  install_npm
  setup_env
  setup_systemd
  setup_firewall
  start_service
  print_summary
}

main "$@"
