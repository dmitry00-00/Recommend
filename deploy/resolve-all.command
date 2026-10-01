#!/bin/bash
# Всё, что берётся из Wikidata, Open Library и An API of Ice and Fire, — одним двойным кликом.
# Шаги идут параллельно там, где не зависят друг от друга (01.10):
#
#   1. книги как произведения (З1): ISBN → работа Open Library → элемент Wikidata — от этого
#      зависят ключи книг во всём остальном, поэтому первым и один;
#   дальше две дорожки одновременно:
#     [авторы]  2. режиссёры, сценаристы, создатели сериалов, авторы книг (Д2);
#     [связи]   3. заложенные вселенные (Ж3) и 4. Вестерос (книги и герои) — тоже одновременно,
#               5. связи между произведениями (Ж1), 6. каталог книг (З2), 7. метаданные книг (З3);
#   8. герои (И1) — когда обе дорожки закончились: им нужны и книги, и Вестерос.
#
# Строки дорожек помечены [авторы], [связи], [вселенные], [Вестерос]. Кэш у всех в .cache — повторный
# запуск спрашивает только новое; запись кэша атомарная (tools/wikidata-lib.mts), соседние шаги не
# читают недописанный файл. Пишет src/mocks/bookWorks.ts, people.ts, workCredits.ts, universeSources.ts,
# workRelations.ts, bookBase.ts, bookMedia.ts, characters.ts — их потом в git и в сборку.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1

tsx() { npx --yes tsx "$@"; }
# строки шага — с меткой дорожки: параллельный вывод иначе не прочитать
tag() { local t="$1"; while IFS= read -r line; do printf '[%s] %s\n' "$t" "$line"; done; }
FAILED=0

echo "== 1/8 книги: ISBN → произведение =="
tsx tools/resolve-book-works.mts || echo "!! книги не сопоставились — ключи книг останутся по ISBN"

echo "== 2–7/8 две дорожки: [авторы] и [связи] =="
(
  echo "== 2/8 авторы =="
  tsx tools/resolve-credits.mts
) > >(tag авторы) 2>&1 &
CREDITS=$!

(
  set -e
  echo "== 3–4/8 заложенные вселенные и Вестерос — одновременно =="
  ( tsx tools/seed-universes.mts || echo "!! заложенные вселенные не собрались — связи без них" ) > >(tag вселенные) 2>&1 &
  U=$!
  ( tsx tools/seed-westeros.mts || echo "!! Вестерос не собрался — книги и герои «Песни льда и огня» только из Wikidata" ) > >(tag Вестерос) 2>&1 &
  W=$!
  wait $U; wait $W
  echo "== 5/8 связи =="
  tsx tools/resolve-relations.mts
  echo "== 6/8 книги через мост с кино =="
  tsx tools/build-book-base.mts
  echo "== 7/8 метаданные и обложки книг =="
  tsx tools/build-book-media.mts
) > >(tag связи) 2>&1 &
RELATIONS=$!

wait $CREDITS || { echo "!! [авторы] не собрались"; FAILED=1; }
wait $RELATIONS || { echo "!! [связи] остановились на ошибке — каталог книг и их метаданные могли не обновиться"; FAILED=1; }
sleep 0.2   # дописать хвост помеченного вывода

echo "== 8/8 герои =="
tsx tools/resolve-characters.mts || echo "!! герои не собрались — страница произведения без них"
echo
echo "Готово. Проверить: git diff --stat src/mocks/"
exit $FAILED
