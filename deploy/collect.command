#!/bin/bash
# Собрать индексы разборов сейчас (то же, что по расписанию): новые посты, справочник фильмов,
# индексы, замер, публикация на сервер. Двойной щелчок в Finder. Лог — .cache/collect/.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
npx --yes tsx tools/collect.mts "$@"
echo; echo "Готово. Окно можно закрыть."; read -r
