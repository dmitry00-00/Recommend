# Переезд recomend: bothost → VPS UpCloud (NL-AMS1)

Чек-лист на ~1 час после того, как есть IP и вход по SSH. **Я** — основная сессия Claude на Mac, **В** — владелец.
Подробности выбора — `reports/hosting-1810.md`. Всё ниже проверено на ubuntu:24.04 в Docker (кроме systemd/ufw/TLS — их
проверяет шаг 3 на живой машине).

Что лежит в `deploy/vps/`:

| файл | что |
|---|---|
| `setup.sh` | первичная настройка от root, повтор безопасен |
| `recomend.service` | systemd: `User=tm`, `/etc/recomend.env`, `Restart=always`, плавная остановка 30 с, память 1300/1600 МБ |
| `Caddyfile` | TLS, h1/h2/h3, `encode zstd gzip` (уже сжатое сервером не трогает), `reverse_proxy 127.0.0.1:3000` |
| `recomend.env.example` | все переменные сервера, без значений |
| `deploy.sh` + `remote.sh` | выкладка с Mac: `ship`, `branch`, `rollback`, `verify`, `status`, `logs`, `check`, `db-check` |
| `db-check.cjs` | integrity_check, строки и хеши всех таблиц, sha256 файла; `--compare` двух замеров |
| `mirror-reference.mjs` | справочники со старого сервера на новый один в один, со сверкой sha256 |

Обозначения: `NEW=https://<адрес>` — `app.<домен>` или `<ip-с-дефисами>.sslip.io`; `IP` — адрес машины.
Чтобы не писать каждый раз: `export TM_VPS=tm@$IP TM_VPS_SERVER=$NEW` (или те же две строки в `.env.local`;
`TM_SERVER` из `.env.local` deploy.sh не берёт — там до переключения bothost).

---

## 0. До переезда — делает В

1. **Сервер UpCloud**: зона NL-AMS1 (Amsterdam), Ubuntu Server 24.04 LTS, 1–2 vCPU / 2 ГБ / от 25 ГБ, публичный IPv4.
   При создании вставить открытый ключ — содержимое `~/.ssh/id_ed25519.pub` с этого Mac. Включить резервные копии
   (снимки) в панели. Файрвол UpCloud можно не включать — на машине ufw.
2. **Адрес. Решить до переезда**: каждый новый адрес приложения — новый origin, а вместе с ним у людей обнуляется
   хранилище браузера (раздел «Данные в браузере» ниже) и снова правится BotFather. Поэтому лучше сразу свой домен
   (бренд Filibri, домены свободны): A-запись `app.<домен>` → IP, TTL 300, **без** прокси Cloudflare (серое облако).
   sslip.io годится для пробы, но переходить с него потом на домен — второй переезд origin.
3. **Значения переменных** (вписать на машине в `/etc/recomend.env`, в чат не присылать): из панели bothost —
   `BOT_TOKEN`, `ADMIN_TOKEN`, `KP_API_KEY`, `OWNER_TG_ID`, `OWNER_USERNAME`, `ALLOW_DEMO`, `ALLOWED_ORIGINS`,
   `PUBLIC_PAGES` и всё, что там задано ещё (сверить по `recomend.env.example`). `TMDB_API_KEY` на bothost нет —
   взять тот же, что `VITE_TMDB_API_KEY` в `.env.local`. В `.env.local` нет `BOT_TOKEN` и `OWNER_TG_ID` — их знает
   только панель bothost.
4. **Пробное мини-приложение** (необязательно, но полезно): BotFather → `/newapp` → бот @recomend_media_bot → короткое
   имя, например `vps`, URL — `NEW`. Ссылка `t.me/recomend_media_bot/vps` открывает новый сервер с настоящим initData
   того же бота — вход, оценки, профиль проверяются до переключения, боевое приложение не тронуто.
5. bothost Pro — до ≈23.10: не продлевать/не отключать до конца шага 9.

## 1. Машина (Я, ~10 мин)

```bash
ssh root@$IP true                                    # принять ключ хоста
ssh root@$IP "command -v rsync >/dev/null || apt-get install -y -q rsync"
rsync -a --delete deploy/vps/ root@$IP:/root/vps/     # повторно — тоже так (scp -r вложил бы vps/vps)
ssh root@$IP 'TM_DOMAIN=app.<домен> TM_ACME_EMAIL=<почта> bash /root/vps/setup.sh'   # без TM_DOMAIN — sslip.io
ssh tm@$IP 'node -v && systemctl is-enabled recomend && sudo -n -l | tail -1'      # вход tm по ключу, sudo только на службу
```

setup.sh: пользователь `tm` (ключи root копируются ему), пароли SSH выключены, root — только по ключу, ufw 22/80/443
(443 и UDP — HTTP/3), fail2ban (sshd), unattended-upgrades без перезагрузки, swap 2 ГБ (1 ГБ, если диск < 20 ГБ),
swappiness 10, journald ≤ 300 МБ/месяц, Node 22 (NodeSource; проверяет `require('node:sqlite')`), Caddy из репозитория
Caddy, `/opt/recomend/releases`, `/var/lib/recomend` (DATA_DIR), `/etc/recomend.env` (600) из шаблона, служба включена
(стартует, когда появится код), Caddyfile с адресом.

## 2. Переменные (В или Я, ~5 мин)

`ssh -t root@$IP nano /etc/recomend.env` — вписать значения из шага 0.3. Обязательно: `BOT_TOKEN`, `ADMIN_TOKEN` (тот же,
что `TM_ADMIN_TOKEN` в `.env.local`, — иначе инструменты не достучатся), `OWNER_TG_ID`, `PUBLIC_ORIGIN=$NEW` (ровно,
без слеша), `KP_API_KEY`, `TMDB_API_KEY`. `DATA_DIR`/`PORT` не трогать (их задаёт служба; пустые перекрыли бы её).

## 3. Пробный запуск с пустой базой (Я, ~10 мин)

```bash
deploy/vps/deploy.sh branch          # ровно та сборка, что сейчас на bothost (ветка bothost, машина клонирует сама)
deploy/vps/deploy.sh check           # изнутри: /api/version, /healthz, /api/health
curl -sI $NEW | grep -iE 'HTTP|alt-svc|content-encoding'     # HTTP/2, alt-svc h3, сертификат
ssh tm@$IP 'systemctl status recomend --no-pager | head -5; journalctl -u recomend -n 20 --no-pager'
```

Для переезда — `branch`: тот же код, что у боевого, значит миграции базы при восстановлении — пустые. `ship` (сборка с
этого Mac) — для выкладок после переезда; он, как и deploy-github, не выкладывает грязное дерево без `--allow-dirty`.
Не поднялось — машина сама возвращает прошлый выпуск; руками — `deploy/vps/deploy.sh rollback`.

## 4. Справочники (Я, ~5 мин)

```bash
node deploy/vps/mirror-reference.mjs --to $NEW            # с bothost ровно то, что видят люди; сверка sha256
node deploy/vps/mirror-reference.mjs --to $NEW --verify
```

`tools/publish-reference.mts` с `TM_SERVER=$NEW` тоже работает, но сейчас стоит стоп `.cache/publish.hold`
(«справочник пишется по частям») — без `--only` скрипт молча выходит с кодом 0; и собирает он из `src/mocks`, а не то,
что на боевом. После переезда публикация — как обычно, только `TM_SERVER` новый.
Не справочники (их зеркало не переносит):
- списки просмотренного участников (`seed--*.json`): `TM_SERVER=$NEW npx tsx tools/publish-seed.mts` и публикация из
  пульта Кинопоиска — нужно только тем, кто ещё не входил (вошедшим всё уже в базе, `seed_applied`);
- очередь разметки владельца: перед переключением `npx tsx tools/owner-pull.mts` (с bothost), после —
  `TM_SERVER=$NEW npx tsx tools/owner-queue.mts`;
- обложки книг и кеш картинок наберутся сами; прогреть — `TM_SERVER=$NEW npx tsx tools/warm-covers.mts`.

Проверка пробы: В открывает `t.me/recomend_media_bot/vps` (шаг 0.4) на телефоне — вход, лента, карточка, оценка.
Доступность из РФ: `npx tsx tools/reachability.mts --server $NEW` (Globalping: Ростелеком, МТС, Билайн, Дом.ру… —
замеры 0/8/32 КБ, ловит обрыв на 16 КБ) и check-host.net (HTTP, узлы ru/kz).

## 5. Перенос базы (Я, ~10 мин; ночью, 01:00–06:00 МСК)

Ночью — потому что запись, пришедшая на bothost между копией и переключением, теряется, и потому что сводки подписок
уходят после 10:00 МСК: до утра bothost должен быть остановлен (шаг 8), иначе два сервера с одной базой пришлют людям
сводку дважды.

```bash
npx tsx tools/db-backup.mts pull --fresh                     # с bothost (TM_SERVER из .env.local); имя копии — в выводе
F=~/recomend-backups/db/<имя>.sqlite.gz
shasum -a 256 $F                                             # записать
node deploy/vps/db-check.cjs $F > /tmp/tm-a.json             # integrity, строки и хеши таблиц копии
TM_SERVER=$NEW npx tsx tools/db-backup.mts restore $F        # ответ: restored.integrity = ok, users, ratings
deploy/vps/deploy.sh db-check > /tmp/tm-b.json               # то же по живой базе на машине
node deploy/vps/db-check.cjs --compare /tmp/tm-a.json /tmp/tm-b.json     # «совпадает всё», код 0
```

Если нужен и sha256 на машине: `scp $F tm@$IP:/var/lib/recomend/backups/ && ssh tm@$IP sha256sum /var/lib/recomend/backups/<имя>`
(сервер видит её в `db-backup.mts list` и может восстановить по имени). Расхождение в `--compare` — не переключать:
скорее всего между копией и сверкой кто-то писал в базу машины (проба открыта) — повторить restore и сверку.
Сверка вместо sha256 файла: после восстановления сервер открывает базу (WAL, контрольные точки), байты файла меняются,
а содержимое таблиц — нет. Перенос 18.10 был бы мал: копия 14:09 — 40 таблиц, 9 452 строки, 7 участников.

## 6. Переключение (Я + В, ~5 мин)

```bash
TM_SERVER=$NEW npx tsx tools/tg-webhook.mts --set            # инлайн, /together, сообщения боту → $NEW/api/telegram
TM_SERVER=$NEW npx tsx tools/tg-webhook.mts                  # url = $NEW/api/telegram, last_error_message пусто
```

(`--set` откажет `url_host`, если `PUBLIC_ORIGIN` на машине не равен `NEW`.)
В, сразу же: BotFather → `/mybots` → @recomend_media_bot → Bot Settings → **Configure Mini App → Edit Mini App URL** →
`NEW`; и **Menu Button → URL** → `NEW` (если кнопка меню настроена отдельно). Ссылки `t.me/recomend_media_bot?startapp=…`
в старых сообщениях, сводках и посевах ведут через BotFather — менять их не нужно.
Я: в `.env.local` — `TM_SERVER=$NEW` (старое — строкой `TM_BOTHOST_SERVER=…` для отката). С этого момента на новый
сервер смотрят все `tools/*` и агенты launchd (копия базы каждые 6 ч, health-watch). host-probe читает адрес при
старте — перезапустить: `launchctl kickstart -k gui/$(id -u)/tm.recomend.probe`.
**Выкладка после переезда — только `deploy/vps/deploy.sh ship`.** `npm run deploy:github` пушит ветку bothost (её
забирает bothost) и ждёт коммит на `TM_SERVER`, который ветку не читает, — до замены скрипта им не пользоваться.

## 7. Проверка (В, ~15 мин)

- Telegram iOS, Android, Desktop, web.telegram.org: кнопка меню, `t.me/recomend_media_bot?startapp=…`, вход без
  повторных запросов, профиль и оценки — те же, что вчера; роль админа у владельца; оценка сохраняется после
  закрытия-открытия.
- Инлайн `@recomend_media_bot <фильм>` в любом чате, команда `/together` в группе.
- Сети РФ **без VPN**: МТС, Билайн, МегаФон, Т2 (мобильные), Ростелеком/домашний; первая загрузка (~2,7 МБ) доходит
  целиком — обрыв на 16 КБ выглядит как вечная загрузка. Плюс `tools/reachability.mts --server $NEW`.
- Я: `deploy/vps/deploy.sh status` (память, swap, место), `journalctl -u recomend -f` во время проверки,
  `npx tsx tools/host-probe.mts --report --hours 1`.

## 8. Закрыть bothost (В, в течение часа, не позже 09:00 МСК)

Перед остановкой (Я): ещё одна копия с bothost — что успели записать открытые до переключения окна:
`TM_SERVER=$TM_BOTHOST_SERVER npx tsx tools/db-backup.mts pull --fresh`, затем `db-check.cjs` по ней и `--compare` с
`/tmp/tm-a.json`. Разошлись `rating`/`journal`/`watched` — перенести эти строки руками (`sqlite3`, `WHERE at > '<время F>'`)
или решить, что потеря допустима.
В: в панели bothost **остановить** бота (не удалять: точка отката до ≈23.10). Открытое у людей старое окно после этого
покажет «нет связи», повторное открытие — уже новый адрес.

## 9. Откат на bothost (до ≈23.10)

Код на VPS — `deploy/vps/deploy.sh rollback` (прошлый выпуск, одна команда). Целиком на bothost:
1. В запускает бота в панели bothost.
2. Данные назад: `TM_SERVER=$NEW npx tsx tools/db-backup.mts pull --fresh` →
   `TM_SERVER=$TM_BOTHOST_SERVER npx tsx tools/db-backup.mts restore <файл>` → `db-check.cjs` + `--compare`.
3. `TM_SERVER=$TM_BOTHOST_SERVER npx tsx tools/tg-webhook.mts --set`; В — BotFather, Mini App URL и Menu Button обратно.
4. `.env.local`: `TM_SERVER` — снова bothost; `systemctl stop recomend` на машине (чтобы не слал сводки).
Откат снова сменит origin — данные в браузере обнулятся ещё раз (см. ниже).

## 10. После

- Вход root по SSH закрыть: `ssh root@$IP 'TM_ROOT_LOGIN=no TM_DOMAIN=<тот же> bash /root/vps/setup.sh'`.
- Адреса bothost по умолчанию в `tools/*` и `site/index.html` — заменить (перечень — в отчёте переезда).
- `npm run deploy:github` → заменить на `deploy/vps/deploy.sh ship` (или `deploy:vps` в package.json).
- После окончания подписки — удалить бота и данные на bothost: там копия базы участников.
- Обновления Node/Caddy — руками: `ssh root@$IP 'apt update && apt upgrade'`, затем `systemctl restart recomend`.

---

## Данные в браузере: что потеряется при смене origin

У WebView Telegram localStorage, sessionStorage и IndexedDB привязаны к origin; новый адрес — пустое хранилище.
CloudStorage Telegram приложение не использует; DeviceStorage (Telegram 9.0+) — хранилище бота, а не origin, оно
переживает переезд. IndexedDB, Service Worker, Cache API приложение не использует. По коду (`src/`):

| ключ | что | после переезда |
|---|---|---|
| `tm.token.tg<id>` | токен сессии | теряется; первый запрос заново входит по initData — незаметно для человека |
| `tm.pending.tg<id>` | оценки, не дошедшие до сервера (нет сети, перезапуск) | **теряются**, если не успели дослаться со старого адреса; на сервере их нет по определению — перенести нельзя |
| `tm.token.guest`, `tm.pending.guest` | гость вне Telegram (`ALLOW_DEMO`): аккаунт — только этот токен | **гость становится новым**, старые строки в базе остаются без хозяина. В копии 18.10 14:09 — 4 гостя, 0 оценок: сейчас терять нечего |
| `tm.lastSlate.<id>.*` | последняя лента (быстрый первый экран) | в Telegram 9.0+ — DeviceStorage, переживает; у старых клиентов — первый экран один раз грузится с сервера |
| `tm.media.v1` | кеш картинок и ссылок | наберётся заново |
| `tm.lang` | выбранный вручную язык | выбравший английский при русском Telegram — вернётся из настроек сервера (одна перезагрузка, src/lib/settingsStore.ts). **Обратный случай** — английский Telegram, вручную выбран русский: приложение откроется по-английски и запишет `en` в настройки на сервере (бот начнёт слать сводку по-английски) — таких, вероятно, единицы |
| `tm.homeScreenOffered`, `tm.hint.feedSwipe`, `tm.feed.tailTurn`, `tm-reel-on` | показанные подсказки, предложение ярлыка | покажутся ещё раз |
| `tm.review` | решения куратора по черновикам разборов (только у владельца) | **теряются**: отклонённые владельцем черновики снова видны ему; на сервер не уходят |
| `tm-reel-played`, `tm.chunkReload` (sessionStorage), `tm.fresh` | служебное | не важно |

Перенести через сервер можно бы только очередь оценок и гостевой токен — последней сборкой на bothost, которая
досылает очередь и уводит на новый адрес с токеном в `#`; на bothost сейчас не выкладываем, а по копии терять нечего —
не делаем. Ярлык на домашнем экране (addToHomeScreen) открывает бота, а не адрес, — должен пережить; проверить.
