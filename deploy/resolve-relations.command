#!/bin/bash
# Связи между произведениями (Ж1): экранизации, сиквелы, ремейки, циклы и франшизы — из Wikidata.
# Двойной клик из Finder. Элементы Wikidata — общие с резолвом авторов (deploy/resolve-credits.command):
# кто прогнал одно, второе ищет только новое. Кэш — .cache/relations.json.
# Пишет src/mocks/workRelations.ts — его потом в git и в сборку.
# Флаги: --dry (только посчитать), --retry-missing, --fresh.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
npx --yes tsx tools/resolve-relations.mts "$@"
echo
echo "Готово. Проверить: git diff --stat src/mocks/workRelations.ts"
