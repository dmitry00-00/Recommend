#!/bin/bash
# Собрать таблицу для ручной разметки «ролик → фильм»: .cache/markup/film_reviews.xlsx
# Двойной клик из Finder. Первый запуск ставит openpyxl в .cache/venv — это минута.
cd "$(dirname "$0")/.." || exit 1
set -e

echo "== 1/2 данные (ролики и список фильмов) =="
npx tsx tools/markup-xlsx.mts "$@"

VENV=.cache/venv
if [ ! -x "$VENV/bin/python" ]; then
  echo "== ставлю openpyxl (нужен только ради выпадающего списка) =="
  python3 -m venv "$VENV"
  "$VENV/bin/pip" install -q openpyxl
fi

echo "== 2/2 файл xlsx =="
"$VENV/bin/python" tools/markup-xlsx.py

open -R .cache/markup/film_reviews.xlsx
