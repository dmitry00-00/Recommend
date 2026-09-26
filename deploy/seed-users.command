#!/bin/bash
# Присланные списки просмотренного → профили участников. Кладёшь список в seeds/<ник>.txt
# (ник Telegram без @), дважды щёлкаешь этот файл: названия ищутся в TMDb, результат — в
# seeds/<ник>.json и на сервере; участник увидит отмеченное при следующем входе в приложение.
# Проверь вывод: строки с «✗» не нашлись, «год не совпал» — возможно, не тот фильм.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
npx --yes tsx tools/resolve-seed.mts "$@" && npx --yes tsx tools/publish-seed.mts "$@"
echo; echo "Готово. Окно можно закрыть."; read -r
