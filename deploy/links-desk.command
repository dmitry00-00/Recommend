#!/bin/bash
# Пульт ссылок: дважды щёлкни — откроется страница в браузере. Вставляешь накопленные заметки со
# ссылками (ролики к фильмам, каналы обзорщиков и эссеистов, сотни сразу), правишь фильмы и ярусы,
# «Сохранить» → tools/markup-verdicts.json и src/mocks/sources.ts. Дальше — deploy/markup-sync.command
# (таблица в Google и опознание фильмов, которых у нас нет) или deploy/run-all.command.
# Пока пульт открыт, это окно не закрывай; закрыл — пульт остановлен.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
PORT=8722
URL="http://127.0.0.1:$PORT"
if curl -fs "$URL/api/state" >/dev/null 2>&1; then open "$URL"; echo "Пульт уже запущен — открыл в браузере."; exit 0; fi
( for _ in $(seq 1 60); do curl -fs "$URL/api/state" >/dev/null 2>&1 && { open "$URL"; break; }; sleep 0.5; done ) &
npx --yes tsx tools/links-desk.mts "$PORT"
