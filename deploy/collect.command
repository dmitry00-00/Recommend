#!/bin/bash
# Собрать всё сейчас — то же, что по расписанию в 06:30: новые посты, справочник фильмов, индексы,
# рубрики новых роликов, замер, публикация на сервер, копия базы. Двойной щелчок в Finder.
# Лог — .cache/collect/. Ключи передаются сборщику: --expand, --no-publish.
# Если прошлый сбор ещё идёт (07.10: шаг «разборы в постах» висел три часа) — покажет, какой шаг и сколько
# он идёт, и спросит, снять ли его. Ответ «y» снимает сбор со всеми шагами и запускает заново.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1

# дерево процессов: сборщик → npx → tsx → node шага
tree() { local p; for p in $(pgrep -P "$1"); do tree "$p"; done; echo "$1"; }

OLD=$(pgrep -f "tsx tools/collect.mts" | head -1)
if [ -n "$OLD" ]; then
  echo "Прошлый сбор ещё идёт (pid $OLD, $(ps -o etime= -p "$OLD" | tr -d ' ') ч:мин:с)."
  for P in $(tree "$OLD"); do
    STEP=$(ps -o command= -p "$P" 2>/dev/null | grep -o "tsx tools/[a-z-]*\.mts" | grep -v collect.mts)
    [ -n "$STEP" ] && { echo "Сейчас шаг: ${STEP#tsx }, идёт $(ps -o etime= -p "$P" | tr -d ' ')."; break; }
  done
  LOG=$(ls -t .cache/collect/*.log 2>/dev/null | grep -v launchd | head -1)
  [ -n "$LOG" ] && { echo "Последние строки лога $LOG:"; tail -4 "$LOG"; }
  printf "Снять его и собрать заново? [y/N] "; read -r A
  if [ "$A" = "y" ] || [ "$A" = "Y" ]; then
    # корень дерева — npx/bash над сборщиком, если его запустил launchd
    ROOT=$(ps -o ppid= -p "$OLD" | tr -d ' ')
    case "$(ps -o command= -p "$ROOT" 2>/dev/null)" in *collect.mts*) OLD=$ROOT ;; esac
    kill $(tree "$OLD") 2>/dev/null; sleep 2; kill -9 $(tree "$OLD") 2>/dev/null
    echo "Снят."
  else
    echo "Оставляю как есть."; read -r; exit 0
  fi
fi

npx --yes tsx tools/collect.mts "$@"
echo; echo "Готово. Окно можно закрыть."; read -r
