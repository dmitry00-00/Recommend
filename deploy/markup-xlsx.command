#!/bin/bash
# Собрать таблицу для ручной разметки «ролик → фильм»: .cache/markup/film_reviews.xlsx
# Двойной клик из Finder. Первый запуск ставит openpyxl в .cache/venv — это минута.
# Без обновления выгрузки роликов: SKIP_DUMP=1 deploy/markup-xlsx.command
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e

# Сначала свежая выгрузка роликов — с каналами из ссылок (via: 'links' в src/mocks/sources.ts),
# иначе недавно добавленные каналы в таблицу не попадут. Это несколько минут и несколько тысяч
# единиц квоты YouTube; пропустить — SKIP_DUMP=1. Не удалась (нет сети, кончилась квота) —
# таблица соберётся из прежней выгрузки.
if [ "${SKIP_DUMP:-0}" != "1" ]; then
  echo "== 0/2 выгрузка роликов с YouTube (с каналами из ссылок) =="
  npx --yes tsx tools/youtube-dump.mts || echo "!! выгрузка не удалась — таблица из прежней .cache/youtube/videos.json"
fi

echo "== 1/2 данные (ролики и список фильмов) =="
npx --yes tsx tools/markup-xlsx.mts "$@"

VENV=.cache/venv
if [ ! -x "$VENV/bin/python" ]; then
  echo "== ставлю openpyxl (нужен только ради выпадающего списка) =="
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q openpyxl
fi

echo "== 2/2 файл xlsx =="
"$VENV/bin/python" tools/markup-xlsx.py

open -R .cache/markup/film_reviews.xlsx
