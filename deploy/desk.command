#!/bin/bash
# Пульт: дважды щёлкни — откроется страница в браузере, две вкладки:
#   «Ссылки» — вставляешь заметки со ссылками (ролики к фильмам, каналы обзорщиков и эссеистов, сотни
#     сразу), правишь фильмы и ярусы, «Сохранить» → tools/markup-verdicts.json и src/mocks/sources.ts;
#     дальше — deploy/markup-sync.command или deploy/run-all.command;
#   «Оценки Кинопоиска» — страницы профилей → seeds/<ник>.json → профиль на сервере.
# Пока пульт открыт, это окно не закрывай; закрыл — пульт остановлен.
# Вкладка при открытии — аргументом: deploy/desk.command kinopoisk (так делает kinopoisk-desk.command).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
PORT=8721
TAB="${1:-links}"
URL="http://127.0.0.1:$PORT"
if curl -fs "$URL/links/api/state" >/dev/null 2>&1; then open "$URL/$TAB/"; echo "Пульт уже запущен — открыл в браузере."; exit 0; fi
( for _ in $(seq 1 60); do curl -fs "$URL/links/api/state" >/dev/null 2>&1 && { open "$URL/$TAB/"; break; }; sleep 0.5; done ) &
npx --yes tsx tools/desk.mts "$PORT"
