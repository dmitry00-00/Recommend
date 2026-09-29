#!/bin/bash
# Выгрузить все ролики каналов-разборщиков (название, полное описание, теги, длительность)
# в .cache/youtube/videos.json — по ним размечаются разборы. Двойной щелчок в Finder.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
npx --yes tsx tools/youtube-dump.mts
echo; echo "Готово. Окно можно закрыть."; read -r
