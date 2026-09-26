#!/bin/bash
# Локальный просмотр сборки для bothost до заливки на хост.
# Двойной щелчок в Finder: распаковывает свежий tm-bothost.zip в deploy/preview,
# поднимает тот же сервер, что на хосте, и открывает http://localhost:4000.
# Остановить — закрыть окно Терминала (или Ctrl+C).
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node 2>/dev/null | tail -1)/bin:$PATH"
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then echo "Не нашёл node. Установите Node.js 20+ (brew install node)."; read -r; exit 1; fi
rm -rf preview/public preview/*.js preview/*.cjs preview/seed preview/vendor
mkdir -p preview && unzip -oq tm-bothost.zip -d preview || { echo "Не распаковался tm-bothost.zip"; read -r; exit 1; }
cd preview
# старый просмотр ещё держит порт — иначе новый не поднимется, а браузер покажет старую сборку
OLD=$(lsof -ti tcp:4000 2>/dev/null); [ -n "$OLD" ] && { echo "Останавливаю прежний просмотр на :4000"; kill $OLD 2>/dev/null; sleep 1; }
echo "Transformative Media — локальный просмотр: http://localhost:4000"
echo "Вне Telegram вход гостевой; база — deploy/preview/data (не боевая)."
(sleep 1.5; open "http://localhost:4000/#/today") &
PORT=4000 DATA_DIR="$(pwd)/data" node index.js
