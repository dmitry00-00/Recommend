#!/bin/bash
# Всё, что берётся из Wikidata и Open Library, — одним двойным кликом, в нужном порядке:
#   1. книги как произведения (З1): ISBN → работа Open Library → элемент Wikidata — от этого зависят
#      ключи книг во всём остальном;
#   2. авторы (Д2): режиссёры, сценаристы, создатели сериалов, авторы книг;
#   3. заложенные вселенные (Ж3) и связи между произведениями (Ж1);
#   4. стартовый каталог книг через мост с кино (З2): по экранизациям из связей и от эссеистов;
#   5. метаданные и обложки книг (З3): русское название, авторы, страницы, обложка, регистр.
# Кэш у всех в .cache — повторный запуск спрашивает только новое. Пишет src/mocks/bookWorks.ts,
# people.ts, workCredits.ts, universeSources.ts, workRelations.ts, bookBase.ts, bookMedia.ts — их потом в git и в сборку.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
echo "== 1/6 книги: ISBN → произведение =="
npx --yes tsx tools/resolve-book-works.mts || echo "!! книги не сопоставились — ключи книг останутся по ISBN"
echo "== 2/6 авторы =="
npx --yes tsx tools/resolve-credits.mts
echo "== 3/6 заложенные вселенные =="
npx --yes tsx tools/seed-universes.mts || echo "!! заложенные вселенные не собрались — связи без них"
echo "== 4/6 связи =="
npx --yes tsx tools/resolve-relations.mts
echo "== 5/6 книги через мост с кино =="
npx --yes tsx tools/build-book-base.mts
echo "== 6/6 метаданные и обложки книг =="
npx --yes tsx tools/build-book-media.mts
echo
echo "Готово. Проверить: git diff --stat src/mocks/"
