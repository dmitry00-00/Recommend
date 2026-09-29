#!/bin/bash
# Обделённые фильмы: о них говорят те, кто понимает, разбора нет ни у кого, а массовый
# зритель прошёл мимо. Двойной щелчок в Finder.
#
# Три шага, каждый можно запускать и отдельно:
#   1. счёт упоминаний по каналам        → .cache/mentions.json        (минуты)
#   2. просмотры статей в Википедии      → .cache/attention.json       (первый раз ~20 минут,
#      дальше добирает только новое — уже посчитанное не перезапрашивается)
#   3. сам отчёт                         → .cache/markup/overlooked.tsv
#
# Ключи после имени файла передаются отчёту, например:
#   ./overlooked.command --top 60 --min-mentions 5
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd "$(dirname "$0")/.." || exit 1
mkdir -p .cache/markup   # tee открывает файл раньше, чем до папки доберётся сам отчёт

echo "1/3 — упоминания по каналам"
npx --yes tsx tools/build-comention-index.mts || echo "   не вышло: считаю по тому, что уже собрано"

echo
echo "2/3 — просмотры статей в Википедии"
npx --yes tsx tools/build-attention.mts || echo "   не вышло: отчёт будет без оси массы"

echo
echo "3/3 — отчёт"
npx --yes tsx tools/overlooked.mts "$@" | tee .cache/markup/overlooked.md

echo
echo "Таблица: .cache/markup/overlooked.tsv"
echo "Отчёт:   .cache/markup/overlooked.md"
echo; echo "Готово. Окно можно закрыть."; read -r
