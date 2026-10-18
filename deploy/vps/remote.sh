#!/usr/bin/env bash
# Половина deploy.sh, которая выполняется на VPS (пользователь tm). Сам по себе не запускается: deploy.sh шлёт его
# через `ssh <TM_VPS> bash -s -- <команда> …` при каждом вызове, поэтому на машине его копия не нужна и не устаревает.
#
#   activate <выпуск>          — releases/.incoming-<выпуск> → releases/<выпуск>, ассеты прошлого выпуска рядом,
#                                переключить app, перезапустить, дождаться коммита и здоровья; не вышло — откат
#   clone <ветка> <репо> <выпуск> — git clone ветки (сборка, как для bothost) в releases/.incoming-<выпуск>
#   rollback                   — на прошлый выпуск (ссылка previous), перезапуск, проверка
#   status                     — выпуски, текущий, прошлый, служба, /api/version
#   logs [N]                   — последние N строк журнала службы (200)
#   check                      — /api/version и /api/health изнутри машины (мимо Caddy)
set -euo pipefail

APP_ROOT=/opt/recomend
REL="$APP_ROOT/releases"
APP="$APP_ROOT/app"
PREV="$APP_ROOT/previous"
LOCAL=http://127.0.0.1:3000
KEEP=${TM_VPS_KEEP:-5}
AUTO_ROLLBACK=${TM_VPS_AUTO_ROLLBACK:-1}
WAIT_S=${TM_VPS_WAIT_S:-180}

say() { printf '   [vps] %s\n' "$*"; }
die() { printf '   [vps] ✖ %s\n' "$*" >&2; exit 1; }

commit_of() { node -e 'try { process.stdout.write(String(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).commit || "")) } catch {}' "$1/version.json"; }
current() { [ -e "$APP" ] && readlink -f "$APP" 2>/dev/null || true; }

# GET: тело — в $BODY, код ответа — в $HTTP_CODE (звать напрямую, не через $(…): иначе переменные останутся в подоболочке)
BODY=""; HTTP_CODE=""
get() {
  local tmp; tmp=$(mktemp)
  HTTP_CODE=$(curl -s -o "$tmp" -w '%{http_code}' --max-time 10 -H 'cache-control: no-cache' "$LOCAL$1" || true)
  BODY=$(head -c 2000 "$tmp"); rm -f "$tmp"
}
json_commit() { printf '%s' "$1" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{process.stdout.write(String(JSON.parse(s).commit||""))}catch{}})'; }

# ждать, пока сервер отдаст этот коммит и будет здоров: /api/version → commit, /healthz → 200, /api/health → ok
wait_for() {
  local want="$1" until=$(( $(date +%s) + WAIT_S )) got last="" now
  while :; do
    get /api/version
    got=$(json_commit "$BODY")
    if [ "$got" = "$want" ]; then
      get /healthz
      if [ "$HTTP_CODE" = 200 ]; then
        get /api/health
        if [ "$HTTP_CODE" = 200 ] && printf '%s' "$BODY" | grep -q '"ok":true'; then say "✓ сервер отдаёт ${want:0:7}, /healthz 200, /api/health $BODY"; return 0; fi
      fi
      now="коммит совпал, жду здоровья (/healthz, /api/health: $HTTP_CODE)"
    else
      now="/api/version: ${got:+коммит ${got:0:7}}${got:-код $HTTP_CODE}"
    fi
    [ "$now" != "$last" ] && say "$(date +%T) $now" && last="$now"
    [ "$(date +%s)" -ge "$until" ] && return 1
    sleep 2
  done
}

restart() { sudo -n /usr/bin/systemctl restart recomend || { say "✖ sudo systemctl restart recomend не прошёл (sudoers ставит setup.sh)"; return 1; }; }

switch_to() {
  local target="$1" old
  old=$(current)
  ln -sfn "$target" "$APP_ROOT/.app.new"
  mv -Tf "$APP_ROOT/.app.new" "$APP"
  if [ -n "$old" ] && [ "$old" != "$target" ]; then ln -sfn "$old" "$APP_ROOT/.prev.new"; mv -Tf "$APP_ROOT/.prev.new" "$PREV"; fi
  say "app → $(basename "$target")${old:+ (было $(basename "$old"))}"
}

# Ассеты прошлого выпуска — только его собственные (assets.json → own), одно поколение, со сжатыми .br/.gz: открытое
# до выкладки приложение просит старые ленивые чанки (то же, что делают tools/build-bothost.mjs и deploy-github.mjs)
carry_assets() {
  local new="$1" old="$2"
  [ -n "$old" ] && [ -d "$old/public/assets" ] && [ -d "$new/public/assets" ] || return 0
  node - "$new" "$old" <<'JS'
const fs = require('fs'), path = require('path');
const [newDir, oldDir] = process.argv.slice(2);
const read = (d) => { try { return JSON.parse(fs.readFileSync(path.join(d, 'assets.json'), 'utf8')); } catch { return undefined; } };
const nm = read(newDir) ?? { own: fs.readdirSync(path.join(newDir, 'public/assets')), carried: [] };
const om = read(oldDir);
const oldAssets = path.join(oldDir, 'public/assets'), newAssets = path.join(newDir, 'public/assets');
const theirs = (om?.own ?? fs.readdirSync(oldAssets).filter((f) => !/\.(br|gz)$/.test(f))).filter((f) => fs.existsSync(path.join(oldAssets, f)));
const own = new Set(nm.own);
// перенесённое сборкой с Mac, которого в прошлом выпуске здесь не было, — лишнее
for (const f of nm.carried ?? []) if (!theirs.includes(f)) for (const x of ['', '.br', '.gz']) fs.rmSync(path.join(newAssets, f + x), { force: true });
const need = theirs.filter((f) => !own.has(f)).sort();
let copied = 0;
for (const f of need) for (const x of ['', '.br', '.gz']) {
  const src = path.join(oldAssets, f + x), dst = path.join(newAssets, f + x);
  if (fs.existsSync(src) && !fs.existsSync(dst)) { fs.copyFileSync(src, dst); copied++; }
}
nm.carried = need;
fs.writeFileSync(path.join(newDir, 'assets.json'), JSON.stringify(nm, null, 1) + '\n');
console.log(`   [vps] ассеты: своих ${nm.own.length}, от прошлого выпуска ${need.length} (скопировано файлов ${copied})`);
JS
}

# выпуски, новые первыми: имена начинаются с времени UTC (<ГГГГММДД-ччммсс>-<коммит>), поэтому сортировка по имени
releases() { local d; for d in "$REL"/*/; do [ -d "$d" ] && printf '%s\n' "${d%/}"; done | sort -r; }

cleanup() {
  local cur prev n=0 d
  cur=$(current); prev=$([ -e "$PREV" ] && readlink -f "$PREV" 2>/dev/null || true)
  # новые сверху; текущий и прошлый не трогаем никогда
  for d in $(releases); do
    [ "$d" = "$cur" ] || [ "$d" = "$prev" ] && continue
    n=$((n + 1))
    [ "$n" -gt "$KEEP" ] && rm -rf "$d" && say "убран старый выпуск $(basename "$d")"
  done
  rm -rf "$REL"/.incoming-* 2>/dev/null || true
}

# app — каталог (git clone вручную по шагу 4 плана), а не ссылка: уносим в releases/, дальше — ссылки
adopt_legacy() {
  if [ -d "$APP" ] && [ ! -L "$APP" ]; then
    local name
    name="$(date -u +%Y%m%d-%H%M%S)-legacy"
    mv "$APP" "$REL/$name"
    ln -s "$REL/$name" "$APP"
    say "каталог app унесён в releases/$name"
  fi
}

activate() {
  local name="$1" inc="$REL/.incoming-$1" dst="$REL/$1" old want prev_before
  [ -d "$inc" ] || die "нет $inc"
  for f in index.js worker.cjs schema.sql version.json public/index.html; do [ -e "$inc/$f" ] || die "в выпуске нет $f — это не сборка build-bothost"; done
  node -e "require('node:sqlite')" 2>/dev/null || die "на машине Node без node:sqlite: $(node -v)"
  rm -rf "$inc/.git"
  mv "$inc" "$dst"
  want=$(commit_of "$dst")
  [ -n "$want" ] || die "в version.json нет commit"
  adopt_legacy
  old=$(current)
  prev_before=$([ -e "$PREV" ] && readlink -f "$PREV" 2>/dev/null || true)
  carry_assets "$dst" "$old"
  switch_to "$dst"
  if ! restart; then
    # служба не перезапускалась — на старом коде и работает; ссылку — обратно
    [ -n "$old" ] && switch_to "$old"
    [ -n "$prev_before" ] && ln -sfn "$prev_before" "$APP_ROOT/.prev.new" && mv -Tf "$APP_ROOT/.prev.new" "$PREV"
    die "выпуск $(basename "$dst") не включён"
  fi
  say "жду ${want:0:7} (до ${WAIT_S} с)…"
  if wait_for "$want"; then cleanup; return 0; fi
  journalctl -u recomend -n 40 --no-pager 2>/dev/null | sed 's/^/   [журнал] /' || true
  if [ "$AUTO_ROLLBACK" = 1 ] && [ -n "$old" ] && [ "$old" != "$dst" ]; then
    say "████ выпуск $(basename "$dst") не поднялся — откат на $(basename "$old")"
    switch_to "$old"
    # «прошлый» — тот же, что до неудачной выкладки: rollback не должен вести на сломанный выпуск
    if [ -n "$prev_before" ]; then ln -sfn "$prev_before" "$APP_ROOT/.prev.new"; mv -Tf "$APP_ROOT/.prev.new" "$PREV"; else rm -f "$PREV"; fi
    mv "$dst" "$dst-failed" && say "сломанный выпуск оставлен как $(basename "$dst")-failed (уберёт очистка)"
    restart || true
    wait_for "$(commit_of "$old")" || say "████ и прошлый выпуск не поднялся — смотрите journalctl -u recomend"
    exit 2
  fi
  die "выпуск $(basename "$dst") не поднялся за ${WAIT_S} с (автоотката нет: нет прошлого выпуска или TM_VPS_AUTO_ROLLBACK=0)"
}

rollback() {
  local cur prev
  cur=$(current); prev=$([ -e "$PREV" ] && readlink -f "$PREV" 2>/dev/null || true)
  if [ -z "$prev" ] || [ "$prev" = "$cur" ] || [ ! -d "$prev" ]; then
    # ссылки previous нет — берём следующий по времени после текущего
    prev=$(releases | grep -vxF "$cur" | grep -v -- '-failed$' | head -1 || true)
  fi
  [ -n "$prev" ] && [ -d "$prev" ] || die "откатываться не на что: в $REL один выпуск"
  say "откат: $(basename "$cur") → $(basename "$prev")"
  switch_to "$prev"
  restart || { switch_to "$cur"; die "откат не включён: служба не перезапустилась"; }
  wait_for "$(commit_of "$prev")" || die "после отката сервер не поднялся — journalctl -u recomend -n 100"
}

status() {
  local cur prev d mark
  cur=$(current); prev=$([ -e "$PREV" ] && readlink -f "$PREV" 2>/dev/null || true)
  echo "выпуски ($REL):"
  for d in $(releases); do
    mark="  "
    [ "$d" = "$cur" ] && mark="→ "
    [ "$d" = "$prev" ] && mark="↩ "
    printf '  %s%s  %s\n' "$mark" "$(basename "$d")" "$(cat "$d/version.json" 2>/dev/null)"
  done
  echo "→ текущий, ↩ прошлый (deploy.sh rollback)"
  systemctl --no-pager --lines=0 status recomend 2>/dev/null | sed -n '1,6p' || true
  get /api/version; echo "/api/version: $BODY ($HTTP_CODE)"
  echo "место: $(df -h /var/lib/recomend | tail -1 | awk '{print $4 " свободно из " $2}'), база: $(du -sh /var/lib/recomend/tm.sqlite 2>/dev/null | cut -f1 || echo нет)"
  free -m | awk 'NR==2 {print "память: занято " $3 " МБ из " $2} NR==3 {print "swap: " $3 " МБ из " $2}'
}

check() {
  local p
  for p in /api/version /healthz /api/health; do get "$p"; echo "$p: $BODY ($HTTP_CODE)"; [ "$HTTP_CODE" = 200 ] || return 1; done
}

cmd="${1:-}"; shift || true
case "$cmd" in
  activate) [ -n "${1:-}" ] || die "activate <выпуск>"; activate "$1" ;;
  clone)
    [ -n "${3:-}" ] || die "clone <ветка> <репо> <выпуск>"
    git clone -q --depth 1 --single-branch --branch "$1" "$2" "$REL/.incoming-$3" || die "git clone $2 ветки $1 не прошёл"
    say "ветка $1: $(git -C "$REL/.incoming-$3" log -1 --format='%h %s')" ;;
  rollback) rollback ;;
  status) status ;;
  logs) journalctl -u recomend -n "${1:-200}" --no-pager ;;
  check) check ;;
  *) die "команды: activate | clone | rollback | status | logs | check" ;;
esac
