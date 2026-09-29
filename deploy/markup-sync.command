#!/bin/bash
# Синхронизация таблицы разметки с Google Drive: забрать решения людей → пересобрать →
# залить тем же файлом (ссылка не меняется). Двойной клик из Finder.
# Ключ — ~/.config/recomend/google-sa.json, id таблицы — MARKUP_SHEET_ID в .env.local.
cd "$(dirname "$0")/.." || exit 1
set -e

VENV=.cache/venv
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/python" -c "import openpyxl, google.auth, requests" 2>/dev/null \
  || "$VENV/bin/pip" install -q openpyxl google-auth requests
PY="$VENV/bin/python"

echo "== 1/6 скачать таблицу из Google =="
"$PY" tools/markup-google.py pull
echo "== 2/6 забрать решения людей =="
"$PY" tools/import-markup.py --in .cache/markup/google.xlsx --ref .cache/markup/pushed.json
echo "== 3/6 опознать фильмы, вписанные без года (Wikidata), и применить =="
npx tsx tools/resolve-markup-films.mts
"$PY" tools/import-markup.py --in .cache/markup/google.xlsx --ref .cache/markup/pushed.json
echo "== 4/6 данные (ролики, фильмы, решения) =="
npx tsx tools/markup-xlsx.mts
echo "== 5/6 собрать xlsx =="
"$PY" tools/markup-xlsx.py
echo "== 6/6 залить в Google =="
"$PY" tools/markup-google.py push
