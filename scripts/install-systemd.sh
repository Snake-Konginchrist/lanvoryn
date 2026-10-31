#!/usr/bin/env bash
set -euo pipefail

if [[ "$(uname -s)" != Linux || "${EUID}" -ne 0 ]]; then
  echo '请在目标 Linux 服务器通过 sudo 运行此脚本。' >&2
  exit 1
fi
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
NPM_BIN="$(command -v npm)"
case "$NODE_BIN" in /home/*|/root/*) echo 'systemd 使用 ProtectHome；请将 Node 安装在 /usr/local 或 /usr，再运行安装。' >&2; exit 1;; esac
if [[ "$PROJECT_DIR" == /opt/lanvoryn ]]; then echo '请从独立源码目录安装，避免覆盖正在使用的目录。' >&2; exit 1; fi
for required in apps/server/dist/index.js apps/web/dist/index.html packages/shared/dist/index.js .runtime/media/mediamtx .runtime/mediamtx.yml .env; do
  if [[ ! -f "$PROJECT_DIR/$required" ]]; then echo "缺少 $required，请先完成构建和媒体配置。" >&2; exit 1; fi
done
command -v rsync >/dev/null
getent group video >/dev/null
getent group audio >/dev/null
if ! id lanvoryn >/dev/null 2>&1; then useradd --system --user-group --home-dir /var/lib/lanvoryn --shell /usr/sbin/nologin lanvoryn; fi
usermod -aG video,audio lanvoryn
install -d -m 0755 /opt/lanvoryn /etc/lanvoryn
install -d -m 0700 -o lanvoryn -g lanvoryn /var/lib/lanvoryn
rsync -a --delete --exclude=.git --exclude=node_modules --exclude=.runtime --exclude=.env --exclude=data --exclude=test-results --exclude=playwright-report "$PROJECT_DIR/" /opt/lanvoryn/
cd /opt/lanvoryn
"$NPM_BIN" ci --omit=dev --ignore-scripts
install -d -m 0755 /opt/lanvoryn/bin
install -m 0755 "$PROJECT_DIR/.runtime/media/mediamtx" /opt/lanvoryn/bin/mediamtx
install -m 0644 "$PROJECT_DIR/.runtime/mediamtx.yml" /etc/lanvoryn/mediamtx.yml
if [[ ! -f /etc/lanvoryn/lanvoryn.env ]]; then
  install -m 0600 "$PROJECT_DIR/.env" /etc/lanvoryn/lanvoryn.env
fi
# 数据目录由安装器统一设置；升级保留现有环境文件与账号配置。
sed -i '/^LANVORYN_DATA_DIR=/d' /etc/lanvoryn/lanvoryn.env
printf '\nLANVORYN_DATA_DIR=/var/lib/lanvoryn\n' >> /etc/lanvoryn/lanvoryn.env
sed "s|ExecStart=/usr/bin/node |ExecStart=$NODE_BIN |" deploy/lanvoryn.service > /etc/systemd/system/lanvoryn.service
install -m 0644 deploy/lanvoryn-media.service /etc/systemd/system/lanvoryn-media.service
if [[ ! -f /var/lib/lanvoryn/credentials.json ]]; then
  echo '现在设置管理员密码；密码仅在本机终端输入，不会显示。'
  sudo -u lanvoryn env LANVORYN_DATA_DIR=/var/lib/lanvoryn "$NODE_BIN" scripts/setup.mjs
fi
systemctl daemon-reload
systemctl enable lanvoryn-media.service lanvoryn.service
systemctl restart lanvoryn-media.service lanvoryn.service
echo '安装完成。运行 systemctl status lanvoryn lanvoryn-media 查看状态。'
