#!/usr/bin/env bash
# Выкладка recomend с Mac на VPS. Сборка — та же, что для bothost (tools/build-bothost.mjs → deploy/bothost/), доставка —
# архивом по SSH в /opt/recomend/releases/<время>-<коммит>, переключение ссылкой /opt/recomend/app, перезапуск службы,
# проверка /api/version (коммит сборки) и /api/health — сначала изнутри машины, потом снаружи через Caddy. Не поднялось —
# машина сама возвращает прошлый выпуск. На боевой bothost и в ветку bothost ничего не отправляет.
#
#   deploy/vps/deploy.sh ship [--no-build] [--allow-dirty] [--no-backup]   собрать (npm run build:bothost) и выложить
#   deploy/vps/deploy.sh branch [ветка]   выложить готовую сборку из ветки GitHub (по умолчанию bothost) — машина
#                                         сама делает git clone публичного репозитория; с Mac ничего не едет
#   deploy/vps/deploy.sh rollback          вернуть прошлый выпуск (одна команда; повтор — вернуться обратно)
#   deploy/vps/deploy.sh verify [коммит]  снаружи: /api/version = коммит (по умолчанию из deploy/bothost/version.json), /api/health
#   deploy/vps/deploy.sh db-check [путь]   integrity_check, строки и хеши таблиц живой базы на машине (JSON; см. db-check.cjs)
#   deploy/vps/deploy.sh status | logs [N] | check
#
# Куда (из окружения, иначе из .env.local):
#   TM_VPS          ssh-адрес, например tm@203.0.113.10 (ключ ~/.ssh/id_ed25519 или TM_VPS_KEY)
#   TM_VPS_SERVER   внешний адрес, https://app.example.com или https://203-0-113-10.sslip.io; TM_SERVER из окружения —
#                   тоже годится. TM_SERVER из .env.local НЕ берётся: до переключения там bothost
# Ещё: TM_VPS_KEY (путь к ключу), TM_VPS_PORT (22), TM_VPS_SSH_OPTS (доп. параметры ssh), TM_VPS_KEEP (выпусков хранить, 5), TM_VPS_WAIT_S (ждать подъёма, 180),
#      TM_VPS_AUTO_ROLLBACK=0 (не откатывать само), TM_REPO (для branch; по умолчанию origin этого репозитория).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HERE="$ROOT/deploy/vps"
OUT="$ROOT/deploy/bothost"
cd "$ROOT"

say()  { printf '\n\033[1m── %s\033[0m\n' "$*"; }
die()  { printf '\n✖ %s\n' "$*" >&2; exit 1; }

# значение: окружение, иначе .env.local (KEY=значение, кавычки снимаются)
envvar() {
  local v
  v=$(printenv "$1" 2>/dev/null || true)
  if [ -z "$v" ] && [ -f "$ROOT/.env.local" ]; then
    v=$(sed -n "s/^[[:space:]]*$1[[:space:]]*=[[:space:]]*//p" "$ROOT/.env.local" | tail -1 | sed -e 's/[[:space:]]*$//' -e "s/^['\"]//" -e "s/['\"]\$//")
  fi
  printf '%s' "$v"
}

CMD="${1:-ship}"; [ $# -gt 0 ] && shift
NO_BUILD=0; ALLOW_DIRTY=0; NO_BACKUP=0; ARGS=()
for a in "$@"; do
  case "$a" in
    --no-build) NO_BUILD=1 ;;
    --allow-dirty) ALLOW_DIRTY=1 ;;
    --no-backup) NO_BACKUP=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) ARGS+=("$a") ;;
  esac
done

VPS=$(envvar TM_VPS)
SERVER=$(printenv TM_VPS_SERVER 2>/dev/null || printenv TM_SERVER 2>/dev/null || envvar TM_VPS_SERVER)
SERVER=${SERVER%/}
KEY=$(envvar TM_VPS_KEY); KEY=${KEY:-$HOME/.ssh/id_ed25519}
PORT=$(envvar TM_VPS_PORT); PORT=${PORT:-22}
[ -n "$VPS" ] || die "не задан TM_VPS (например TM_VPS=tm@203.0.113.10)"
case "$SERVER" in
  '') die "не задан внешний адрес: TM_VPS_SERVER=https://… (или TM_SERVER=https://… в окружении)" ;;
  *bothost*) die "TM_VPS_SERVER/TM_SERVER указывает на bothost ($SERVER) — этот скрипт только для VPS" ;;
  https://*|http://*) ;;
  *) die "адрес без схемы: $SERVER" ;;
esac

# одно SSH-соединение на весь прогон
# в ~/.ssh: путь сокета у macOS ограничен ~104 знаками, а $TMPDIR длинный
CTL="$HOME/.ssh/tm-vps-%C"
SSH_OPTS=(-i "$KEY" -p "$PORT" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=15 -o ServerAliveInterval=15
  -o ControlMaster=auto -o "ControlPath=$CTL" -o ControlPersist=120 -o StrictHostKeyChecking=accept-new)
# TM_VPS_SSH_OPTS — ещё параметры ssh через пробел (например -o UserKnownHostsFile=…)
# shellcheck disable=SC2206
[ -n "${TM_VPS_SSH_OPTS:-}" ] && SSH_OPTS+=(${TM_VPS_SSH_OPTS})
ssh_vps() { ssh "${SSH_OPTS[@]}" "$VPS" "$@"; }
remote() { ssh_vps "TM_VPS_KEEP='${TM_VPS_KEEP:-5}' TM_VPS_WAIT_S='${TM_VPS_WAIT_S:-180}' TM_VPS_AUTO_ROLLBACK='${TM_VPS_AUTO_ROLLBACK:-1}' bash -s -- $*" < "$HERE/remote.sh"; }

json_get() { node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{const v=JSON.parse(s)[process.argv[1]];process.stdout.write(v===undefined?"":String(v))}catch{}})' "$1"; }

# снаружи, через Caddy и TLS: тот же критерий, что у tools/deploy-github.mjs verify — коммит в /api/version, затем /api/health ok
verify_public() {
  local want="$1" minutes="${TM_DEPLOY_WAIT_MIN:-3}" until body got code
  until=$(( $(date +%s) + minutes * 60 ))
  say "проверка снаружи: $SERVER (до $minutes мин)"
  while :; do
    body=$(curl -s --max-time 10 -H 'cache-control: no-cache' "$SERVER/api/version" || true)
    got=$(printf '%s' "$body" | json_get commit)
    if [ -n "$want" ] && [ "$got" = "$want" ]; then break; fi
    if [ "$(date +%s)" -ge "$until" ]; then
      echo "████ снаружи сервер не отдал ${want:0:7}: /api/version → ${body:0:160}"
      echo "    внутри машины: deploy/vps/deploy.sh check; TLS/DNS/Caddy: ssh $VPS journalctl -u caddy -n 50"
      return 1
    fi
    sleep 5
  done
  body=$(curl -s --max-time 10 -w '\n%{http_code}' -H 'cache-control: no-cache' "$SERVER/api/health" || true)
  code=$(printf '%s' "$body" | tail -1)
  body=$(printf '%s' "$body" | sed '$d')
  if [ "$code" = 200 ] && printf '%s' "$body" | grep -q '"ok":true'; then
    echo "✔ $SERVER отдаёт ${want:0:7}; /api/health: $code $body"
    # сжатие: статика должна приходить br из сборки, а не сжиматься на лету (и не дважды)
    curl -s -o /dev/null --max-time 10 -H 'accept-encoding: br, gzip' -D - "$SERVER/" | tr -d '\r' | grep -iE '^(content-encoding|server|alt-svc):' | sed 's/^/    /' || true
    return 0
  fi
  echo "████ /api/health: $code $body — откат: deploy/vps/deploy.sh rollback"
  return 1
}

# секретов в сборке быть не должно — тот же список ключей, что у deploy-github.mjs
scan_secrets() {
  node - "$ROOT/.env.local" "$OUT" <<'JS'
const fs = require('fs'), path = require('path');
const [envFile, out] = process.argv.slice(2);
const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, 'utf8') : '';
const secrets = [...env.matchAll(/^(TM_ADMIN_TOKEN|ADMIN_TOKEN|KP_API_KEY|VITE_KP_API_KEY|BOT_TOKEN|TELEGRAM_BOT_TOKEN|TMDB_API_KEY)=(.+)$/gm)]
  .map((m) => m[2].trim().replace(/^['"]|['"]$/g, '')).filter((s) => s.length >= 16);
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
for (const f of walk(out)) {
  if (/\.(br|gz)$/.test(f)) continue;
  const text = fs.readFileSync(f, 'latin1');
  if (secrets.some((s) => text.includes(s))) { console.error(`в сборке секрет из .env.local: ${f}`); process.exit(1); }
}
JS
}

server_up() { curl -s --max-time 10 "$SERVER/api/health" 2>/dev/null | grep -q '"ok":true'; }

backup_before() {
  if [ "$NO_BACKUP" = 1 ]; then echo "копия базы перед выкладкой: пропущена (--no-backup)"; return 0; fi
  if ! server_up; then echo "копия базы: $SERVER не отвечает — первая выкладка? копию не снимаю"; return 0; fi
  say "копия базы перед выкладкой (tools/db-backup.mts pull --fresh, TM_SERVER=$SERVER)"
  TM_SERVER="$SERVER" npx --yes tsx tools/db-backup.mts pull --fresh || die "копия базы не снята — не выкладываю (без копии: --no-backup)"
}

release_name() { printf '%s-%s' "$(date -u +%Y%m%d-%H%M%S)" "${1:0:7}"; }

case "$CMD" in
  ship)
    if [ "$NO_BUILD" = 0 ]; then
      dirty=$(git status --porcelain --untracked-files=no)
      if [ -n "$dirty" ] && [ "$ALLOW_DIRTY" = 0 ]; then
        printf '%s\n' "$dirty" | head -15
        die "незакоммиченное в отслеживаемых файлах — не выкладываю (закоммитьте или --allow-dirty)"
      fi
      say "сборка: npm run build:bothost"
      npm run build:bothost
    fi
    [ -f "$OUT/index.js" ] && [ -f "$OUT/version.json" ] || die "нет сборки в deploy/bothost (npm run build:bothost)"
    COMMIT=$(json_get commit < "$OUT/version.json")
    DIRTY=$(json_get dirty < "$OUT/version.json")
    [ -n "$COMMIT" ] && [ "$COMMIT" != unknown ] || die "в deploy/bothost/version.json нет коммита"
    [ "$DIRTY" = true ] && [ "$ALLOW_DIRTY" = 0 ] && die "сборка из дерева с незакоммиченным (version.json: dirty) — пересоберите из чистого или --allow-dirty"
    scan_secrets || die "не отправляю"
    backup_before
    NAME=$(release_name "$COMMIT")
    say "доставка: deploy/bothost → $VPS:/opt/recomend/releases/$NAME ($(du -sh "$OUT" | cut -f1))"
    ssh_vps "mkdir -p /opt/recomend/releases/.incoming-$NAME"
    # COPYFILE_DISABLE: без ._-файлов и xattr macOS
    COPYFILE_DISABLE=1 tar -C "$OUT" -czf - . | ssh_vps "tar -xzf - -C /opt/recomend/releases/.incoming-$NAME --no-same-owner --warning=no-unknown-keyword"
    say "переключение и перезапуск на машине"
    remote activate "$NAME" || die "выпуск $NAME не поднялся (если был прошлый — машина уже вернула его): deploy/vps/deploy.sh logs"
    verify_public "$COMMIT"
    ;;
  branch)
    BR="${ARGS[0]:-bothost}"
    REPO=$(envvar TM_REPO); REPO=${REPO:-$(git remote get-url origin)}
    # машина без ключей GitHub: публичный репозиторий — по https
    case "$REPO" in git@github.com:*) REPO="https://github.com/${REPO#git@github.com:}" ;; esac
    git fetch -q origin "+refs/heads/$BR:refs/remotes/origin/$BR" || die "git fetch ветки $BR не прошёл"
    COMMIT=$(git show "origin/$BR:version.json" 2>/dev/null | json_get commit || true)
    [ -n "$COMMIT" ] || die "в ветке $BR нет version.json с коммитом"
    backup_before
    NAME=$(release_name "$COMMIT")
    say "машина забирает ветку $BR из $REPO (сборка ${COMMIT:0:7})"
    remote clone "$BR" "$REPO" "$NAME"
    remote activate "$NAME" || die "выпуск $NAME не поднялся (если был прошлый — машина уже вернула его): deploy/vps/deploy.sh logs"
    verify_public "$COMMIT"
    ;;
  rollback)
    say "откат на прошлый выпуск"
    remote rollback
    COMMIT=$(remote status | sed -n 's/^  → [^ ]*  //p' | json_get commit)
    verify_public "$COMMIT"
    ;;
  verify)
    COMMIT="${ARGS[0]:-$(json_get commit < "$OUT/version.json")}"
    verify_public "$COMMIT"
    ;;
  db-check)
    # integrity_check, строки и хеш содержимого по таблицам живой базы на машине (только чтение) — сравнить с копией на Mac:
    #   node deploy/vps/db-check.cjs ~/recomend-backups/db/<копия>.sqlite.gz > /tmp/a.json; deploy/vps/deploy.sh db-check > /tmp/b.json
    #   node deploy/vps/db-check.cjs --compare /tmp/a.json /tmp/b.json
    ssh_vps "node --disable-warning=ExperimentalWarning - ${ARGS[0]:-/var/lib/recomend/tm.sqlite}" < "$HERE/db-check.cjs"
    ;;
  status) remote status ;;
  logs)   remote logs "${ARGS[0]:-200}" ;;
  check)  remote check ;;
  *) die "команды: ship | branch [ветка] | rollback | verify [коммит] | db-check [путь] | status | logs [N] | check" ;;
esac
