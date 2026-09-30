#!/bin/bash
# Всё, что берётся из Wikidata и Open Library, — одним двойным кликом, в нужном порядке:
#   1. книги как произведения (З1): ISBN → работа Open Library → элемент Wikidata — от этого зависят
#      ключи книг во всём остальном;
#   2. авторы (Д2): режиссёры, сценаристы, создатели сериалов, авторы книг;
#   3. заложенные вселенные (Ж3) и связи между произведениями (Ж1).
# Кэш у всех в .cache — повторный запуск спрашивает только новое. Пишет src/mocks/bookWorks.ts,
# people.ts, workCredits.ts, universeSources.ts, workRelations.ts — их потом в git и в сборку.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
echo "== 1/4 книги: ISBN → произведение =="
npx --yes tsx tools/resolve-book-works.mts || echo "!! книги не сопоставились — ключи книг останутся по ISBN"
echo "== 2/4 авторы =="
npx --yes tsx tools/resolve-credits.mts
echo "== 3/4 заложенные вселенные =="
npx --yes tsx tools/seed-universes.mts || echo "!! заложенные вселенные не собрались — связи без них"
echo "== 4/4 связи =="
npx --yes tsx tools/resolve-relations.mts
echo
echo "Готово. Проверить: git diff --stat src/mocks/"
