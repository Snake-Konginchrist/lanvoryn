#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux ]]; then
  echo '请在目标 Linux 服务器运行此脚本。' >&2
  exit 1
fi
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="${LANVORYN_NODE_BIN:-}"
NPM_BIN="${LANVORYN_NPM_BIN:-}"
SERVICE_USER="${LANVORYN_SERVICE_USER:-}"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --node|--npm|--user)
      if [[ $# -lt 2 || -z "$2" ]]; then echo "缺少 $1 的值" >&2; exit 1; fi
      case "$1" in --node) NODE_BIN="$2";; --npm) NPM_BIN="$2";; --user) SERVICE_USER="$2";; esac
      shift 2;;
    --help) echo 'Usage: bash scripts/install-systemd.sh [--node PATH] [--npm PATH] [--user USER]'; exit 0;;
    *) echo "未知参数：$1" >&2; exit 1;;
  esac
done
# 在提权之前取得当前 shell 选择的运行时，避免 sudo 丢失版本管理器的 PATH。
NODE_BIN="${NODE_BIN:-$(command -v node || true)}"
if [[ -z "$NODE_BIN" ]]; then echo '找不到 Node.js。请在已加载 Node 的用户终端运行，或使用 --node 指定。' >&2; exit 1; fi
NODE_BIN="$("$NODE_BIN" -p 'process.execPath')"
if [[ -z "$NPM_BIN" ]]; then
  if [[ -x "$(dirname "$NODE_BIN")/npm" ]]; then NPM_BIN="$(dirname "$NODE_BIN")/npm";
  else NPM_BIN="$(command -v npm || true)"; fi
fi
if [[ -z "$NPM_BIN" || ! -x "$NPM_BIN" ]]; then echo '找不到 npm，请使用 --npm 指定现有 npm。' >&2; exit 1; fi
NPM_BIN="$(readlink -f "$NPM_BIN")"
if [[ "${EUID}" -ne 0 ]]; then
  SERVICE_USER="${SERVICE_USER:-$(id -un)}"
  exec sudo bash "$PROJECT_DIR/scripts/install-systemd.sh" --node "$NODE_BIN" --npm "$NPM_BIN" --user "$SERVICE_USER"
fi
SERVICE_USER="${SERVICE_USER:-${SUDO_USER:-lanvoryn}}"
"$NODE_BIN" -e 'if (Number(process.versions.node.split(".")[0]) < 24) { console.error("Node.js 24+ required"); process.exit(1) }'
if [[ "$PROJECT_DIR" == /opt/lanvoryn ]]; then echo '请从独立源码目录安装，避免覆盖正在使用的目录。' >&2; exit 1; fi
for required in apps/server/dist/index.js apps/web/dist/index.html packages/shared/dist/index.js .runtime/media/mediamtx .runtime/mediamtx.yml .env; do
  if [[ ! -f "$PROJECT_DIR/$required" ]]; then echo "缺少 $required，请先完成构建和媒体配置。" >&2; exit 1; fi
done
command -v rsync >/dev/null
getent group video >/dev/null
getent group audio >/dev/null
if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  if [[ "$SERVICE_USER" != lanvoryn ]]; then echo "服务用户不存在：$SERVICE_USER" >&2; exit 1; fi
  useradd --system --user-group --home-dir /var/lib/lanvoryn --shell /usr/sbin/nologin lanvoryn
fi
SERVICE_GROUP="$(id -gn "$SERVICE_USER")"
if ! runuser -u "$SERVICE_USER" -- "$NODE_BIN" --version >/dev/null; then
  echo "服务用户 $SERVICE_USER 无法执行所选 Node。请用 --user 选择有访问权限的用户；无需移动 Node 或放宽家目录权限。" >&2
  exit 1
fi
usermod -aG video,audio "$SERVICE_USER"
install -d -m 0755 /opt/lanvoryn /etc/lanvoryn
install -d -m 0700 -o "$SERVICE_USER" -g "$SERVICE_GROUP" /var/lib/lanvoryn
chown -R --no-dereference "$SERVICE_USER:$SERVICE_GROUP" /var/lib/lanvoryn
rsync -a --delete --exclude=.git --exclude=node_modules --exclude=.runtime --exclude=.env --exclude=data --exclude=test-results --exclude=playwright-report "$PROJECT_DIR/" /opt/lanvoryn/
cd /opt/lanvoryn
# 依赖是公开程序文件；不要继承调用方保护凭据用的 077 umask。
(umask 022; env PATH="$(dirname "$NODE_BIN"):$PATH" "$NPM_BIN" ci --omit=dev --ignore-scripts)
chmod -R a+rX /opt/lanvoryn/node_modules
install -d -m 0755 /opt/lanvoryn/bin
install -m 0755 "$PROJECT_DIR/.runtime/media/mediamtx" /opt/lanvoryn/bin/mediamtx
install -m 0644 "$PROJECT_DIR/.runtime/mediamtx.yml" /etc/lanvoryn/mediamtx.yml
if [[ ! -f /etc/lanvoryn/lanvoryn.env ]]; then
  install -m 0600 "$PROJECT_DIR/.env" /etc/lanvoryn/lanvoryn.env
fi
# 数据目录由安装器统一设置；升级保留现有环境文件与账号配置。
sed -i '/^LANVORYN_DATA_DIR=/d' /etc/lanvoryn/lanvoryn.env
printf '\nLANVORYN_DATA_DIR=/var/lib/lanvoryn\n' >> /etc/lanvoryn/lanvoryn.env
"$NODE_BIN" scripts/render-systemd.mjs "$NODE_BIN" "$SERVICE_USER" "$SERVICE_GROUP" /etc/systemd/system
if [[ ! -f /var/lib/lanvoryn/credentials.json ]]; then
  echo '现在设置管理员密码；密码仅在本机终端输入，不会显示。'
  runuser -u "$SERVICE_USER" -- env LANVORYN_DATA_DIR=/var/lib/lanvoryn "$NODE_BIN" scripts/setup.mjs
fi
systemctl daemon-reload
systemctl enable lanvoryn-media.service lanvoryn.service
systemctl restart lanvoryn-media.service lanvoryn.service
echo '安装完成。运行 systemctl status lanvoryn lanvoryn-media 查看状态。'
