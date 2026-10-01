#!/bin/bash
# Весь прогон на Mac одним двойным щелчком — всё, что накопилось после правок кода, по порядку:
#   1. git push — отправить коммиты, если они есть;
#   2. данные из Wikidata, Open Library и An API of Ice and Fire (deploy/resolve-all.command, 8 шагов);
#   3. индексы разборов — посты, ролики, соупоминания — и публикация на сервер (tools/collect.mts;
#      ролики — если в .env есть YT_API_KEY);
#   4. герои ещё раз — по свежим разборам (всё в кэше, это быстро);
#   5. калибровка книг — только если лист .cache/markup/book_calibration.csv уже заполнен;
#   6. проверка: пустые авторы (people.ts, workCredits.ts) в git не пойдут;
#   7. коммит src/mocks и push — с вопросом;
#   8. сборка для bothost (npm run build:bothost) — с вопросом.
# Ключи: --yes — не спрашивать (коммит, push и сборка — да); --no-build — без сборки;
#        --no-collect — без индексов разборов. Лог — .cache/run-all/<дата>.log.
# Долгий только первый прогон шага 2 (десятки минут): дальше кэш спрашивает лишь новое.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1

YES=0; BUILD=1; COLLECT=1
for a in "$@"; do
  case "$a" in
    --yes) YES=1 ;;
    --no-build) BUILD=0 ;;
    --no-collect) COLLECT=0 ;;
  esac
done

mkdir -p .cache/run-all
LOG=".cache/run-all/$(date +%Y-%m-%d_%H-%M).log"
exec > >(tee -a "$LOG") 2>&1

FAILED=()
step() { echo; echo "════ $1 ════"; }
ask() {  # ask "вопрос" → 0 да, 1 нет; Enter — да
  [ "$YES" = 1 ] && return 0
  read -r -p "$1 [Д/н] " ans </dev/tty
  case "$ans" in [нНnN]*) return 1 ;; *) return 0 ;; esac
}
started=$(date +%s)

step "1/8 git push"
if ! git rev-parse '@{u}' >/dev/null 2>&1; then
  git push || FAILED+=("git push")
elif [ -n "$(git log '@{u}..HEAD' --oneline)" ]; then
  echo "коммитов к отправке: $(git log '@{u}..HEAD' --oneline | wc -l | tr -d ' ')"
  git push || FAILED+=("git push")
else
  echo "отправлять нечего"
fi

step "2/8 данные: Wikidata, Open Library, Вестерос"
bash deploy/resolve-all.command || FAILED+=("resolve-all (данные) — смотрите лог выше")

if [ "$COLLECT" = 1 ]; then
  step "3/8 индексы разборов и публикация"
  npx --yes tsx tools/collect.mts || FAILED+=("collect (индексы разборов)")
else
  step "3/8 индексы разборов — пропущено (--no-collect)"
fi

step "4/8 герои по свежим разборам"
npx --yes tsx tools/resolve-characters.mts || FAILED+=("герои")

step "5/8 калибровка книг"
CSV=.cache/markup/book_calibration.csv
if [ -f "$CSV" ] && grep -qE '^[a-z0-9]+[;,]("[^"]*"|[^;,]*)[;,]("[^"]*"|[^;,]*)[;,][0-9]+[;,][0-9]' "$CSV"; then
  npx --yes tsx tools/apply-book-calibration.mts || FAILED+=("калибровка книг")
else
  echo "лист не заполнен — пропускаем (создать и заполнить: deploy/book-calibration.command)"
fi

step "6/8 проверка авторов"
# пустой справочник авторов — значит, Wikidata не ответила: такой файл не коммитим, оставляем прежний
for f in src/mocks/people.ts src/mocks/workCredits.ts; do
  if ! grep -qE 'Q[0-9]+' "$f"; then
    echo "!! $f пустой — Wikidata не ответила? Возвращаю версию из git."
    git checkout -- "$f" 2>/dev/null || true
    FAILED+=("авторы пустые ($f)")
  fi
done

step "7/8 коммит данных"
git status --short src/mocks
if [ -n "$(git status --porcelain src/mocks)" ]; then
  if ask "Закоммитить src/mocks и отправить?"; then
    git add src/mocks && git commit -q -m "Данные: прогон $(date +%d.%m)" && git push || FAILED+=("коммит или push данных")
  fi
else
  echo "данные не изменились"
fi

if [ "$BUILD" = 1 ]; then
  step "8/8 сборка для bothost"
  if ask "Собрать для bothost (deploy/tm-bothost.zip)?"; then
    npm run build:bothost || FAILED+=("сборка")
  fi
else
  step "8/8 сборка — пропущено (--no-build)"
fi

echo
echo "════ итог: $(( ($(date +%s) - started) / 60 )) мин, лог — $LOG ════"
if [ ${#FAILED[@]} -eq 0 ]; then
  echo "Всё прошло."
else
  echo "Не получилось:"; for f in "${FAILED[@]}"; do echo "  · $f"; done
fi
echo "Окно можно закрыть."
[ "$YES" = 1 ] || read -r </dev/tty
