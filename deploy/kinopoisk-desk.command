#!/bin/bash
# Пульт импорта оценок с Кинопоиска: дважды щёлкни — откроется страница в браузере.
# Бросаешь туда страницы «Оценки и просмотры» (файлы или папки, сразу от нескольких людей),
# вписываешь ник Telegram, «Собрать» → seeds/<ник>.json, «Отправить» → профиль на сервере.
# Пока пульт открыт, это окно не закрывай; закрыл — пульт остановлен.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
PORT=8721
URL="http://127.0.0.1:$PORT"
if curl -fs "$URL/api/state" >/dev/null 2>&1; then open "$URL"; echo "Пульт уже запущен — открыл в браузере."; exit 0; fi
( for _ in $(seq 1 40); do curl -fs "$URL/api/state" >/dev/null 2>&1 && { open "$URL"; break; }; sleep 0.5; done ) &
npx --yes tsx tools/kinopoisk-desk.mts "$PORT"
