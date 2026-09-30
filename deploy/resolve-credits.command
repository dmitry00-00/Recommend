#!/bin/bash
# Резолв авторов (Д2): режиссёры, сценаристы, создатели сериалов, авторы книг — из Wikidata
# (и TMDb для создателей сериалов, если в .env.local есть TMDB_API_KEY).
# Двойной клик из Finder. Первый прогон — несколько минут (поиск элементов по ~2,5 тыс.
# произведений), дальше — только новое: кэш в .cache/credits*.json.
# Пишет src/mocks/people.ts и src/mocks/workCredits.ts — их потом в git и в сборку.
# Флаги: --dry (только посчитать), --retry-missing (снова искать ненайденное), --fresh.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
npx --yes tsx tools/resolve-credits.mts "$@"
echo
echo "Готово. Проверить: git diff --stat src/mocks/people.ts src/mocks/workCredits.ts"
