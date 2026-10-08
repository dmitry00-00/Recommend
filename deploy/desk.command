#!/bin/bash
# Пульт: дважды щёлкни — откроется страница в браузере, вкладки:
#   «Сводка» — сбор, конвейер, разметка людьми, точность, каналы, разметка для подбора — одним экраном;
#   «Ссылки» — вставляешь заметки со ссылками (ролики к фильмам, каналы обзорщиков и эссеистов, сотни
#     сразу), правишь фильмы и ярусы, «Сохранить» → tools/markup-verdicts.json и src/mocks/sources.ts;
#     дальше — deploy/markup-sync.command или deploy/run-all.command;
#   «Проверка» — привязки роликов к фильмам с подсказками модели (решения сразу в verdicts) и
#     конвейер: сбор каналов, разметка, индекс, замер, таблица, публикация, коммит, сборка — кнопками;
#   «Каналы» — список каналов и профиль канала: ярус (эссе / обзор), предмет, голос или «из ссылок»,
#     фокус и причина решения → src/mocks/sources.ts и .cache/youtube/channels.json; «Пересобрать индекс»;
#   «Оценки Кинопоиска» — страницы профилей → seeds/<ник>.json → профиль на сервере.
# Пока пульт открыт, это окно не закрывай; закрыл — пульт остановлен.
# Вкладка при открытии — аргументом: deploy/desk.command kinopoisk (так делает kinopoisk-desk.command).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# свой пульт и шлюзы — мимо прокси VPN: иначе curl спрашивает localhost через Happ и получает чужой ответ
export no_proxy="localhost,127.0.0.1,::1" NO_PROXY="localhost,127.0.0.1,::1"
cd "$(dirname "$0")/.." || exit 1
PORT=8721
TAB="${1:-dash}"
URL="http://127.0.0.1:$PORT"
if curl -fs "$URL/links/api/state" >/dev/null 2>&1; then
  # запущен пульт старой версии, где этой вкладки ещё нет (02.10: «Проверка» отвечала not_found) —
  # перезапустить; несохранённое во вкладке «Ссылки» при этом теряется, поэтому спрашиваем
  # 06.10: и без общей полосы вкладок (/shell.js) — страницы с диска новые, а меню им отдать нечем
  if ! curl -fs "$URL/$TAB/" >/dev/null 2>&1 || ! curl -fs "$URL/shell.js" >/dev/null 2>&1; then
    read -r -p "Пульт запущен старой версией. Перезапустить? Несохранённое в «Ссылках» пропадёт. [Д/н] " ans
    case "$ans" in [нНnN]*) exit 0 ;; esac
    lsof -ti "tcp:$PORT" -sTCP:LISTEN | xargs kill 2>/dev/null
    for _ in $(seq 1 20); do curl -fs "$URL/links/api/state" >/dev/null 2>&1 || break; sleep 0.25; done
  else
    open "$URL/$TAB/"; echo "Пульт уже запущен — открыл в браузере."; exit 0
  fi
fi
( for _ in $(seq 1 60); do curl -fs "$URL/links/api/state" >/dev/null 2>&1 && { open "$URL/$TAB/"; break; }; sleep 0.5; done ) &
npx --yes tsx tools/desk.mts "$PORT"
