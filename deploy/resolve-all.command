#!/bin/bash
# Всё, что берётся из Wikidata и Open Library, — одним двойным кликом, в нужном порядке:
#   1. книги как произведения (З1): ISBN → работа Open Library → элемент Wikidata — от этого зависят
#      ключи книг во всём остальном;
#   2. авторы (Д2): режиссёры, сценаристы, создатели сериалов, авторы книг;
#   3. заложенные вселенные (Ж3), герои и книги Вестероса (An API of Ice and Fire) и связи между
#      произведениями (Ж1);
#   4. стартовый каталог книг через мост с кино (З2): по экранизациям из связей и от эссеистов;
#   5. метаданные и обложки книг (З3): русское название, авторы, страницы, обложка, регистр;
#   6. герои через несколько произведений (И1): Холмс, Джокер, Дракула — названные в разборах.
# Кэш у всех в .cache — повторный запуск спрашивает только новое. Пишет src/mocks/bookWorks.ts,
# people.ts, workCredits.ts, universeSources.ts, workRelations.ts, bookBase.ts, bookMedia.ts, characters.ts — их потом в git и в сборку.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
set -e
echo "== 1/8 книги: ISBN → произведение =="
npx --yes tsx tools/resolve-book-works.mts || echo "!! книги не сопоставились — ключи книг останутся по ISBN"
echo "== 2/8 авторы =="
npx --yes tsx tools/resolve-credits.mts
echo "== 3/8 заложенные вселенные =="
npx --yes tsx tools/seed-universes.mts || echo "!! заложенные вселенные не собрались — связи без них"
echo "== 4/8 Вестерос: книги и герои =="
npx --yes tsx tools/seed-westeros.mts || echo "!! Вестерос не собрался — книги и герои «Песни льда и огня» только из Wikidata"
echo "== 5/8 связи =="
npx --yes tsx tools/resolve-relations.mts
echo "== 6/8 книги через мост с кино =="
npx --yes tsx tools/build-book-base.mts
echo "== 7/8 метаданные и обложки книг =="
npx --yes tsx tools/build-book-media.mts
echo "== 8/8 герои =="
npx --yes tsx tools/resolve-characters.mts || echo "!! герои не собрались — страница произведения без них"
echo
echo "Готово. Проверить: git diff --stat src/mocks/"
