#!/bin/bash
# Синхронизация таблицы разметки с Google Drive: забрать решения людей → пересобрать →
# залить тем же файлом (ссылка не меняется). Двойной клик из Finder.
# Ключ — ~/.config/recomend/google-sa.json, id таблицы — MARKUP_SHEET_ID в .env.local.
# Решения людей (и ссылки, вписанные в «Без разбора») сначала забираются из Google в
# tools/markup-verdicts.json, потом таблица собирается заново — все ссылки остаются на месте.
# Свежая выгрузка роликов (новые каналы из sources.ts) — шаг 4; пропустить: SKIP_DUMP=1.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
# реестр в базе приложения (06.10): таблица разметки больше не пишет в разметку — иначе она затёрла бы
# правки пульта и телефона своими старыми значениями. Ссылки — через форму: deploy/inbox.command
if grep -qs '^REGISTRY_MODE=server' .env.local || [ "${REGISTRY_MODE:-}" = "server" ]; then
  echo "Реестр уже в базе приложения — синхронизация таблицы разметки выключена. Ссылки: форма Google (deploy/inbox.command)."
  exit 1
fi

VENV=.cache/venv
[ -x "$VENV/bin/python" ] || python3 -m venv "$VENV"
"$VENV/bin/python" -c "import openpyxl, google.auth, requests" 2>/dev/null \
  || "$VENV/bin/pip" install -q openpyxl google-auth requests
PY="$VENV/bin/python"

echo "== 1/7 скачать таблицу из Google =="
"$PY" tools/markup-google.py pull
echo "== 2/7 забрать решения людей =="
"$PY" tools/import-markup.py --in .cache/markup/google.xlsx --ref .cache/markup/pushed.json
echo "== 3/7 опознать фильмы, вписанные без года (Wikidata), и применить =="
npx --yes tsx tools/resolve-markup-films.mts
"$PY" tools/import-markup.py --in .cache/markup/google.xlsx --ref .cache/markup/pushed.json
# каналы роликов, принесённых ссылками в «Без разбора», — в реестр блогеров обзорщиками
# (src/mocks/sources.ts, via: 'links'); ярус потом меняется там руками
npx --yes tsx tools/register-link-channels.mts || echo "  (каналы не заведены — нет YT_API_KEY или сети; не мешает остальному)"
echo "== 4/7 свежая выгрузка роликов (новые каналы) =="
if [ "${SKIP_DUMP:-0}" != "1" ]; then
  npx --yes tsx tools/youtube-dump.mts || echo "  (выгрузка не удалась — таблица из прежней .cache/youtube/videos.json)"
else
  echo "  пропущено (SKIP_DUMP=1)"
fi
echo "== 5/7 данные (ролики, фильмы, решения) =="
npx --yes tsx tools/markup-xlsx.mts
echo "== 6/7 собрать xlsx =="
"$PY" tools/markup-xlsx.py
echo "== 7/7 залить в Google =="
"$PY" tools/markup-google.py push
