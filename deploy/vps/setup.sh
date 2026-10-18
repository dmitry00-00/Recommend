#!/usr/bin/env bash
# Первичная настройка VPS под recomend (Ubuntu 24.04, 1–2 vCPU, 2 ГБ). Запускать от root; повторный запуск безопасен —
# каждый шаг сначала смотрит, не сделан ли он уже.
#
#   rsync -a --delete deploy/vps/ root@<IP>:/root/vps/
#   ssh root@<IP> 'TM_DOMAIN=app.example.com bash /root/vps/setup.sh'      — свой домен (A-запись уже смотрит на IP)
#   ssh root@<IP> 'bash /root/vps/setup.sh'                               — без домена: <ip-с-дефисами>.sslip.io
#
# Переменные (все необязательны):
#   TM_DOMAIN       адрес для Caddy и TLS; по умолчанию <публичный IPv4 через дефисы>.sslip.io
#   TM_ACME_EMAIL   почта для Let's Encrypt (предупреждения о сроке сертификата); пусто — без почты
#   TM_SWAP_MB      размер swap-файла, МБ (по умолчанию 2048; если диск меньше 20 ГБ — 1024)
#   TM_ROOT_LOGIN   «no» — закрыть вход root по SSH (по умолчанию: root только по ключу)
#   TM_SSH_PUBKEY   открытый ключ для пользователя tm; по умолчанию — ключи из /root/.ssh/authorized_keys
#   TM_SKIP_APT     «1» — не ставить пакеты (только конфиги; для отладки)
#
# Что делает: пользователь tm, SSH только по ключу, ufw 22/80/443 (443 и UDP — для HTTP/3), fail2ban (sshd),
# unattended-upgrades, swap, Node 22 LTS (NodeSource, проверка node:sqlite), Caddy (официальный репозиторий),
# /opt/recomend/releases и /var/lib/recomend, journald с пределом, recomend.service, Caddyfile, /etc/recomend.env (600,
# из шаблона, если файла ещё нет). Сервис НЕ запускается, пока нет кода (/opt/recomend/app/index.js — ставит deploy.sh)
# и пока в /etc/recomend.env не задан BOT_TOKEN.
#
# В контейнере без systemd (проверка: docker run ubuntu:24.04) шаги, которым нужен systemd или ядро (ufw, swap, sysctl,
# запуск служб), пропускаются с пометкой «пропущено».
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_USER=tm
APP_ROOT=/opt/recomend
DATA_DIR=/var/lib/recomend
ENV_FILE=/etc/recomend.env
NODE_MAJOR=22
NODE_MIN=22.13.0

say()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
ok()   { printf '   ✓ %s\n' "$*"; }
skip() { printf '   · пропущено: %s\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "запускать от root"
[ -r /etc/os-release ] && . /etc/os-release
[ "${ID:-}" = ubuntu ] || [ "${ID:-}" = debian ] || die "ожидается Ubuntu 24.04 (или Debian 12), а тут ${PRETTY_NAME:-неизвестно}"
for f in recomend.service Caddyfile recomend.env.example; do [ -f "$HERE/$f" ] || die "рядом со setup.sh нет $f — копируйте папку deploy/vps целиком"; done

HAS_SYSTEMD=0
[ -d /run/systemd/system ] && HAS_SYSTEMD=1
IN_CONTAINER=0
if [ -f /.dockerenv ] || [ -f /run/.containerenv ] || { command -v systemd-detect-virt >/dev/null && systemd-detect-virt --container -q; }; then IN_CONTAINER=1; fi
real_host() { [ "$HAS_SYSTEMD" = 1 ] && [ "$IN_CONTAINER" = 0 ]; }

export DEBIAN_FRONTEND=noninteractive
apt_install() { [ "${TM_SKIP_APT:-}" = 1 ] && { skip "apt install $*"; return 0; }; apt-get install -y -q --no-install-recommends "$@" >/dev/null; }

# ─── 1. пакеты ────────────────────────────────────────────────────────────────────────────────────────────────────────
say "1. базовые пакеты"
if [ "${TM_SKIP_APT:-}" != 1 ]; then
  apt-get update -q >/dev/null
  apt_install ca-certificates curl gnupg git rsync sqlite3 jq ufw fail2ban python3-systemd unattended-upgrades \
    apt-transport-https debian-keyring debian-archive-keyring sudo openssh-server iproute2 tzdata logrotate
  ok "ca-certificates curl gnupg git rsync sqlite3 jq ufw fail2ban unattended-upgrades"
else skip "apt"; fi

# ─── 2. пользователь tm ───────────────────────────────────────────────────────────────────────────────────────────────
say "2. пользователь $APP_USER"
if id "$APP_USER" >/dev/null 2>&1; then ok "уже есть"; else useradd -m -s /bin/bash -U "$APP_USER"; ok "создан"; fi
# пароля нет и не будет: вход только по ключу
passwd -l "$APP_USER" >/dev/null 2>&1 || true
install -d -m 700 -o "$APP_USER" -g "$APP_USER" "/home/$APP_USER/.ssh"
AK="/home/$APP_USER/.ssh/authorized_keys"
touch "$AK"
if [ -n "${TM_SSH_PUBKEY:-}" ]; then
  grep -qxF "$TM_SSH_PUBKEY" "$AK" || printf '%s\n' "$TM_SSH_PUBKEY" >> "$AK"
fi
if [ -s /root/.ssh/authorized_keys ]; then
  while IFS= read -r line; do
    case "$line" in ''|'#'*) continue ;; esac
    grep -qxF "$line" "$AK" || printf '%s\n' "$line" >> "$AK"
  done < /root/.ssh/authorized_keys
fi
chown "$APP_USER:$APP_USER" "$AK"; chmod 600 "$AK"
if [ -s "$AK" ]; then ok "ключей у $APP_USER: $(grep -c . "$AK")"; else printf '   ! у %s нет ключей SSH — задайте TM_SSH_PUBKEY или ключ root\n' "$APP_USER"; fi
# журнал службы — без sudo; перезапуск службы — только этой одной (deploy.sh)
getent group systemd-journal >/dev/null && usermod -aG systemd-journal "$APP_USER"
SUDOERS=/etc/sudoers.d/recomend
cat > "$SUDOERS.tmp" <<EOF
# deploy/vps/setup.sh: $APP_USER перезапускает только свою службу (deploy.sh), без пароля
$APP_USER ALL=(root) NOPASSWD: /usr/bin/systemctl restart recomend, /usr/bin/systemctl start recomend, /usr/bin/systemctl stop recomend
EOF
chmod 440 "$SUDOERS.tmp"
if command -v visudo >/dev/null; then visudo -cqf "$SUDOERS.tmp" || die "sudoers не прошёл visudo"; fi
mv -f "$SUDOERS.tmp" "$SUDOERS"; ok "sudo: только systemctl {restart,start,stop} recomend (status и журнал — без sudo)"

# ─── 3. SSH только по ключу ──────────────────────────────────────────────────────────────────────────────────────────
say "3. SSH: только ключи"
# 00- — раньше 50-cloud-init.conf: в sshd побеждает первое значение, а cloud-init любит PasswordAuthentication yes
SSHD=/etc/ssh/sshd_config.d/00-recomend.conf
ROOT_LOGIN=prohibit-password
[ "${TM_ROOT_LOGIN:-}" = no ] && ROOT_LOGIN=no
# не запереть себя: без единого ключа пароли не выключаем
if [ ! -s "$AK" ] && [ ! -s /root/.ssh/authorized_keys ]; then
  printf '   ! ключей нет ни у root, ни у %s — пароли НЕ выключаю\n' "$APP_USER"
else
  [ "$ROOT_LOGIN" = no ] && [ ! -s "$AK" ] && die "TM_ROOT_LOGIN=no, но у $APP_USER нет ключа — потеряете доступ"
  cat > "$SSHD" <<EOF
# deploy/vps/setup.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PubkeyAuthentication yes
PermitRootLogin $ROOT_LOGIN
MaxAuthTries 4
LoginGraceTime 30
X11Forwarding no
EOF
  mkdir -p /run/sshd
  sshd -t || die "sshd -t не принял конфигурацию (см. $SSHD)"
  if real_host; then systemctl reload ssh 2>/dev/null || systemctl restart ssh; ok "PasswordAuthentication no, PermitRootLogin $ROOT_LOGIN"; else skip "перезагрузка sshd (нет systemd) — конфигурация проверена sshd -t"; fi
fi

# ─── 4. ufw ───────────────────────────────────────────────────────────────────────────────────────────────────────────
say "4. ufw: 22, 80, 443 (TCP+UDP)"
if real_host; then
  ufw default deny incoming >/dev/null
  ufw default allow outgoing >/dev/null
  ufw allow 22/tcp >/dev/null
  ufw allow 80/tcp >/dev/null
  ufw allow 443 >/dev/null          # и UDP: HTTP/3 (QUIC)
  ufw --force enable >/dev/null
  ok "$(ufw status | head -1)"
  # порт 3000 сервер слушает на 0.0.0.0 (server/index.js) — снаружи его закрывает ufw, ходить к нему — только Caddy
else skip "ufw (контейнер)"; fi

# ─── 5. fail2ban ──────────────────────────────────────────────────────────────────────────────────────────────────────
say "5. fail2ban (sshd)"
mkdir -p /etc/fail2ban/jail.d
cat > /etc/fail2ban/jail.d/recomend.local <<'EOF'
# deploy/vps/setup.sh
[DEFAULT]
backend = systemd
bantime = 1h
bantime.increment = true
findtime = 10m
maxretry = 5

[sshd]
enabled = true
EOF
if real_host; then systemctl enable --now fail2ban >/dev/null 2>&1; systemctl restart fail2ban; ok "включён"; else skip "запуск fail2ban (нет systemd)"; fi

# ─── 6. автообновления ────────────────────────────────────────────────────────────────────────────────────────────────
say "6. unattended-upgrades (только безопасность, без перезагрузки)"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF
cat > /etc/apt/apt.conf.d/52recomend-unattended <<'EOF'
// deploy/vps/setup.sh: перезагрузку решает человек; Node и Caddy обновляются руками (apt upgrade) — их репозитории
// не в списке источников по умолчанию
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
EOF
ok "20auto-upgrades, 52recomend-unattended"

# ─── 7. swap ──────────────────────────────────────────────────────────────────────────────────────────────────────────
say "7. swap"
if real_host; then
  if swapon --show --noheadings | grep -q .; then ok "уже есть: $(swapon --show --noheadings --bytes | awk '{s+=$3} END {printf "%.0f МБ", s/1048576}')"
  else
    DISK_GB=$(df -BG --output=size / | tail -1 | tr -dc 0-9)
    SWAP_MB=${TM_SWAP_MB:-$([ "${DISK_GB:-0}" -lt 20 ] && echo 1024 || echo 2048)}
    fallocate -l "${SWAP_MB}M" /swapfile 2>/dev/null || dd if=/dev/zero of=/swapfile bs=1M count="$SWAP_MB" status=none
    chmod 600 /swapfile; mkswap /swapfile >/dev/null; swapon /swapfile
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
    ok "/swapfile ${SWAP_MB} МБ"
  fi
  cat > /etc/sysctl.d/90-recomend.conf <<'EOF'
# deploy/vps/setup.sh: swap — запас на пик (аналитика владельца, миграции), а не рабочая память
vm.swappiness = 10
vm.vfs_cache_pressure = 50
EOF
  sysctl -q --system >/dev/null 2>&1 || sysctl -q -p /etc/sysctl.d/90-recomend.conf
  ok "vm.swappiness=10"
else skip "swap и sysctl (контейнер)"; fi

# ─── 8. journald ──────────────────────────────────────────────────────────────────────────────────────────────────────
say "8. journald: предел 300 МБ, месяц"
mkdir -p /etc/systemd/journald.conf.d
cat > /etc/systemd/journald.conf.d/90-recomend.conf <<'EOF'
# deploy/vps/setup.sh
[Journal]
Storage=persistent
SystemMaxUse=300M
SystemKeepFree=1G
MaxRetentionSec=1month
RateLimitIntervalSec=30s
RateLimitBurst=10000
EOF
if real_host; then systemctl restart systemd-journald; ok "применено"; else skip "перезапуск journald (нет systemd)"; fi

# ─── 9. Node 22 LTS ───────────────────────────────────────────────────────────────────────────────────────────────────
say "9. Node $NODE_MAJOR (NodeSource)"
ver_ge() { [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]; }
NODE_NOW=$(node -v 2>/dev/null | tr -d v || true)
if [ -n "$NODE_NOW" ] && ver_ge "$NODE_NOW" "$NODE_MIN" && [ "${NODE_NOW%%.*}" = "$NODE_MAJOR" ]; then ok "уже стоит $NODE_NOW"
elif [ "${TM_SKIP_APT:-}" = 1 ]; then skip "установка Node"
else
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  chmod 644 /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
  # nodejs из Ubuntu (18.x) не должен перебить NodeSource
  printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' > /etc/apt/preferences.d/nodejs
  apt-get update -q >/dev/null
  apt_install nodejs
  NODE_NOW=$(node -v | tr -d v)
  ok "поставлен $NODE_NOW"
fi
if command -v node >/dev/null; then
  NODE_NOW=$(node -v | tr -d v)
  ver_ge "$NODE_NOW" "$NODE_MIN" || die "Node $NODE_NOW, а нужен $NODE_MIN+ (node:sqlite)"
  node -e "const { DatabaseSync } = require('node:sqlite'); const d = new DatabaseSync(':memory:'); d.exec('CREATE TABLE t(x); INSERT INTO t VALUES (1)'); if (d.prepare('SELECT x FROM t').get().x !== 1) process.exit(1)" 2>/dev/null \
    || die "require('node:sqlite') не работает в Node $NODE_NOW"
  ok "node:sqlite работает (Node $NODE_NOW, $(command -v node))"
fi

# ─── 10. Caddy ────────────────────────────────────────────────────────────────────────────────────────────────────────
say "10. Caddy (официальный репозиторий)"
if command -v caddy >/dev/null; then ok "уже стоит $(caddy version | awk '{print $1}')"
elif [ "${TM_SKIP_APT:-}" = 1 ]; then skip "установка Caddy"
else
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' -o /etc/apt/sources.list.d/caddy-stable.list
  chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q >/dev/null
  apt_install caddy
  ok "поставлен $(caddy version | awk '{print $1}')"
fi

# ─── 11. каталоги ─────────────────────────────────────────────────────────────────────────────────────────────────────
say "11. каталоги"
install -d -m 755 -o "$APP_USER" -g "$APP_USER" "$APP_ROOT" "$APP_ROOT/releases"
# /opt/recomend/app — ссылка на текущий выпуск (releases/<время>-<коммит>), её ставит deploy.sh. Если здесь когда-то
# сделали git clone прямо в app — оставляем как есть: deploy.sh при первой выкладке унесёт его в releases/
install -d -m 750 -o "$APP_USER" -g "$APP_USER" "$DATA_DIR"
ok "$APP_ROOT/releases (код, $APP_USER), $DATA_DIR (DATA_DIR: база, копии, кеш картинок, справочники; 750)"

# ─── 12. переменные ───────────────────────────────────────────────────────────────────────────────────────────────────
say "12. $ENV_FILE"
if [ -f "$ENV_FILE" ]; then ok "уже есть — не трогаю"
else
  # шаблон без значений: незаполненные «KEY=» сервер понимает как «не задано» (у него везде `|| умолчание`); настройки,
  # где пустое значение означает 0 (DB_CACHE_MB и т. п.), в шаблоне закомментированы
  cp "$HERE/recomend.env.example" "$ENV_FILE"
  ok "создан из recomend.env.example — впишите значения: sudo nano $ENV_FILE"
fi
chown root:root "$ENV_FILE"; chmod 600 "$ENV_FILE"

# ─── 13. systemd-служба ───────────────────────────────────────────────────────────────────────────────────────────────
say "13. recomend.service"
install -m 644 "$HERE/recomend.service" /etc/systemd/system/recomend.service
if command -v systemd-analyze >/dev/null; then systemd-analyze verify /etc/systemd/system/recomend.service || printf '   ! systemd-analyze verify ругается (см. выше)\n'; fi
if real_host; then
  systemctl daemon-reload
  systemctl enable recomend >/dev/null 2>&1
  ok "включена (стартует, когда deploy.sh положит код)"
  if [ -e "$APP_ROOT/app/index.js" ] && grep -Eq '^(BOT_TOKEN|TELEGRAM_BOT_TOKEN)=.+' "$ENV_FILE"; then systemctl restart recomend; ok "перезапущена"; fi
else skip "systemctl enable (нет systemd)"; fi

# ─── 14. Caddy: адрес и конфигурация ──────────────────────────────────────────────────────────────────────────────────
say "14. Caddyfile"
public_ip() {
  ip -4 route get 1.1.1.1 2>/dev/null | awk '{for (i = 1; i < NF; i++) if ($i == "src") { print $(i + 1); exit }}'
}
DOMAIN="${TM_DOMAIN:-}"
if [ -z "$DOMAIN" ]; then
  IP=$(public_ip || true)
  case "$IP" in 10.*|172.1[6-9].*|172.2[0-9].*|172.3[01].*|192.168.*|100.6[4-9].*|100.[7-9][0-9].*|100.1[01][0-9].*|100.12[0-7].*|'')
    IP=$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || true) ;;
  esac
  [ -n "$IP" ] || die "не узнал публичный IPv4 — задайте TM_DOMAIN"
  DOMAIN="$(echo "$IP" | tr . -).sslip.io"
fi
case "$DOMAIN" in *[!a-zA-Z0-9.-]*|'') die "странный TM_DOMAIN: $DOMAIN" ;; esac
GLOBAL_EMAIL=""
[ -n "${TM_ACME_EMAIL:-}" ] && GLOBAL_EMAIL="email ${TM_ACME_EMAIL}"
sed -e "s|__DOMAIN__|$DOMAIN|g" -e "s|__ACME_EMAIL__|$GLOBAL_EMAIL|g" "$HERE/Caddyfile" > /etc/caddy/Caddyfile.new
if command -v caddy >/dev/null; then
  caddy fmt --overwrite /etc/caddy/Caddyfile.new >/dev/null 2>&1 || true
  caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile.new >/dev/null 2>&1 || { caddy validate --adapter caddyfile --config /etc/caddy/Caddyfile.new; die "Caddyfile не прошёл проверку"; }
fi
mv -f /etc/caddy/Caddyfile.new /etc/caddy/Caddyfile
ok "адрес: https://$DOMAIN"
if real_host && command -v caddy >/dev/null; then systemctl enable caddy >/dev/null 2>&1; systemctl reload caddy 2>/dev/null || systemctl restart caddy; ok "Caddy перечитал конфигурацию (сертификат — при первом обращении)"; else skip "перезагрузка Caddy (нет systemd)"; fi

# ─── итог ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
say "готово"
cat <<EOF
   адрес:        https://$DOMAIN   (PUBLIC_ORIGIN в /etc/recomend.env и TM_VPS_SERVER на Mac — ровно он)
   переменные:   $ENV_FILE (600) — впишите значения, затем выкладка с Mac:
                 TM_VPS=$APP_USER@<IP> TM_VPS_SERVER=https://$DOMAIN deploy/vps/deploy.sh ship
   журнал:       journalctl -u recomend -f       состояние: systemctl status recomend
EOF
