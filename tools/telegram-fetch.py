"""Дочитать новые посты каналов через MTProto — чтобы индексы обновлялись сами.

    ~/recruit/apps/openclaw/.venv/bin/python tools/telegram-fetch.py [каналы…]

Зачем. До сих пор посты приходили официальным экспортом Telegram Desktop: владелец
вручную выгружал историю, генераторы её читали. Для первой сборки это правильно, но
обновляться так нельзя — каждый раз заново выгружать четырнадцать каналов никто не станет.
Здесь тот же материал берётся штатным клиентским API от лица владельца: его аккаунт,
его подписки, публичные каналы, которые он и так читает.

Чего скрипт не делает: не парсит `t.me/s/<канал>` (запрещено в проекте), не вступает в
каналы, не читает переписку, не трогает ничего, кроме перечисленных каналов, и не пишет
в Telegram вообще ничего.

Ключи. `TG_API_ID`, `TG_API_HASH`, `TG_SESSION_PATH` берутся из окружения, а если их там
нет — из env-файла соседнего проекта (`--env`, по умолчанию recruit). Значения только
читаются и никуда не печатаются: в лог идут имена каналов и числа.

Сессия. Файл сессии копируется во временную папку и открывается копия: у соседнего проекта
свой бот может держать оригинал открытым, и SQLite этого не любит (их же урок,
check_dead_channels.py).

Бережность. Резолв канала по имени — дорогая операция, за неё прилетает FloodWait; поэтому
id каналов кешируются и второй прогон не резолвит ничего. Между каналами пауза, за прогон
не больше `--limit` постов на канал, FloodWaitError не глушится: прогон останавливается,
состояние сохраняется, следующий раз продолжит с той же точки.

Выход — `.cache/telegram/<канал>.json` в том же виде, какой читают генераторы
(tools/telegram-export.mts), и `.cache/telegram/state.json` с последним прочитанным id.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import re
import shutil
import sys
import tempfile
from datetime import UTC, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / ".cache" / "telegram"
AVATARS = ROOT / "public" / "voices"
DEFAULT_ENV = Path.home() / "recruit" / "apps" / "openclaw" / ".env.openclaw"

CHANNELS_FILE = Path(__file__).resolve().parent / "telegram-channels.json"


def default_channels() -> list[str]:
    """Список каналов — один на весь проект: tools/telegram-channels.json.

    Свой список здесь уже разошёлся с тем, что читают генераторы: пять каналов,
    добавленных вечером 23.09, оказались в JSON и не оказались тут, и `--discussions`
    молча их пропустил. Второго списка быть не должно."""
    data = json.loads(CHANNELS_FILE.read_text(encoding="utf8"))
    return [c["username"] for c in data.get("channels", [])]

HASHTAG = re.compile(r"(?:^|[\s(«\"])#([^\W\d_][\w]{1,39})", re.UNICODE)


def hashtags(text: str) -> list[str]:
    """Рубрики канала из текста — то же правило, что в tools/telegram-export.mts."""
    return sorted({m.group(1).lower() for m in HASHTAG.finditer(text)})


def load_env(path: Path) -> None:
    """Подтянуть ключи из env-файла в окружение. Значения не печатаются и не возвращаются."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if key in {"TG_API_ID", "TG_API_HASH", "TG_SESSION_PATH"} and key not in os.environ:
            os.environ[key] = value.strip().strip('"').strip("'")


def session_copy(raw: str, base: Path) -> tuple[str, Path]:
    """Копия файла сессии во временной папке: оригинал может быть занят соседним проектом.

    Путь в env бывает относительным (`openclaw.session`) — он считается от папки самого
    env-файла, потому что соседний проект запускается из неё."""
    src = Path(raw if raw.endswith(".session") else raw + ".session")
    if not src.is_absolute():
        src = base / src
    if not src.exists():
        raise SystemExit(f"файла сессии нет: {src} — проверь TG_SESSION_PATH")
    tmp = Path(tempfile.mkdtemp(prefix="recomend_tg_"))
    shutil.copy2(src, tmp / "read.session")
    return str(tmp / "read"), tmp


def post_of(msg, chats: dict) -> dict | None:
    """Сообщение Telethon → та же запись, что делает разбор экспорта."""
    body = (msg.message or "").strip()
    preview = None
    web = getattr(getattr(msg, "media", None), "webpage", None)
    if web is not None and getattr(web, "url", None):
        preview = {"url": web.url}
        site = getattr(web, "site_name", None)
        title = getattr(web, "title", None)
        if site:
            preview["site"] = site
        if title:
            preview["title"] = title
    # заголовок превью идёт первой строкой, как в HTML-экспорте: у поста-ссылки название
    # ролика лежит только там, а по первой строке генераторы ищут произведение
    text = "\n".join(x for x in [(preview or {}).get("title"), body] if x)
    if not text:
        return None

    links: list[dict] = []
    seen: set[str] = set()
    raw = msg.message or ""
    for ent, inner in (msg.get_entities_text() or []):
        kind = type(ent).__name__
        url = inner if kind == "MessageEntityUrl" else getattr(ent, "url", None)
        if not url or url in seen:
            continue
        seen.add(url)
        link = {"url": url}
        if kind == "MessageEntityTextUrl" and inner and inner != url:
            link["text"] = inner
        links.append(link)
    if preview and preview["url"] not in seen:
        links.append({"url": preview["url"]})
    del raw

    forwarded = None
    fwd = getattr(msg, "forward", None)
    if fwd is not None:
        chat = getattr(fwd, "chat", None)
        forwarded = getattr(chat, "title", None) or getattr(fwd, "from_name", None)
        if not forwarded:
            peer = getattr(getattr(fwd, "original_fwd", None), "from_id", None)
            cid = getattr(peer, "channel_id", None)
            forwarded = chats.get(cid)

    out = {
        "id": msg.id,
        "date": msg.date.astimezone(UTC).date().isoformat() if msg.date else None,
        "text": text,
        "tags": hashtags(text),
        "links": links,
    }
    if preview:
        out["preview"] = preview
    if forwarded:
        out["forwardedFrom"] = forwarded
    return out


async def main() -> int:
    ap = argparse.ArgumentParser(description="дочитать новые посты каналов через MTProto")
    ap.add_argument("channels", nargs="*", default=None, help="имена каналов без @")
    ap.add_argument("--env", default=str(DEFAULT_ENV), help="env-файл с TG_API_ID/TG_API_HASH/TG_SESSION_PATH")
    ap.add_argument("--limit", type=int, default=2000, help="сколько постов за прогон на канал")
    ap.add_argument("--backfill", type=int, default=400, help="сколько взять, если канал читается впервые")
    ap.add_argument("--pause", type=float, default=2.0, help="пауза между каналами, секунды")
    ap.add_argument("--discussions", action="store_true",
                    help="не читать посты, а выяснить, у каких каналов есть привязанный чат обсуждений")
    ap.add_argument("--avatars", action="store_true",
                    help="не читать посты, а скачать аватары каналов в public/voices")
    args = ap.parse_args()

    load_env(Path(args.env).expanduser())
    api_id, api_hash = os.environ.get("TG_API_ID"), os.environ.get("TG_API_HASH")
    if not api_id or not api_hash:
        raise SystemExit("нет TG_API_ID / TG_API_HASH — ни в окружении, ни в " + args.env)

    from telethon import TelegramClient
    from telethon.errors import ChannelPrivateError, FloodWaitError, UsernameNotOccupiedError
    from telethon.tl.functions.channels import GetFullChannelRequest
    from telethon.tl.types import InputPeerChannel

    session, tmp_dir = session_copy(
        os.environ.get("TG_SESSION_PATH", "/var/lib/openclaw/tg.session"),
        Path(args.env).expanduser().resolve().parent,
    )
    OUT.mkdir(parents=True, exist_ok=True)
    state_file = OUT / "state.json"
    state = json.loads(state_file.read_text(encoding="utf8")) if state_file.exists() else {}
    peers_file = OUT / "peers.json"
    peers = json.loads(peers_file.read_text(encoding="utf8")) if peers_file.exists() else {}
    # старый кеш хранил один id — по нему канал не найти, заводим заново
    peers = {k: v for k, v in peers.items() if isinstance(v, dict)}
    discussions_file = OUT / "discussions.json"
    discussions = json.loads(discussions_file.read_text(encoding="utf8")) if discussions_file.exists() else {}

    channels = args.channels or default_channels()
    added_total = 0
    stopped = None
    try:
        client = TelegramClient(session, int(api_id), api_hash)
        await client.start()
        if not await client.is_user_authorized():
            raise SystemExit("сессия не авторизована — войди в аккаунт в соседнем проекте")
        for i, name in enumerate(channels):
            key = name.lstrip("@")
            # Канал кешируем парой (id, access_hash), а не одним id: по голому числу
            # Telethon канал не найдёт — access_hash живёт в кеше сессии, а сессию мы
            # каждый раз копируем заново и выбрасываем. На этом первая версия и сломалась:
            # второй прогон выдал «канала нет» почти по всем.
            cached = peers.get(key)
            entity = None
            if isinstance(cached, dict) and cached.get("access_hash") is not None:
                entity = InputPeerChannel(int(cached["id"]), int(cached["access_hash"]))
            if entity is None:
                try:
                    # резолв по имени — самая дорогая операция, именно за неё в соседнем
                    # проекте ловили FloodWait на 16 часов; делаем его один раз на канал
                    resolved = await client.get_entity(key)
                except (UsernameNotOccupiedError, ValueError):
                    print(f"  {key}: по такому имени канала нет", file=sys.stderr)
                    continue
                except ChannelPrivateError:
                    print(f"  {key}: закрытый канал, аккаунт в нём не состоит", file=sys.stderr)
                    continue
                peers[key] = {
                    "id": resolved.id,
                    "access_hash": getattr(resolved, "access_hash", None),
                    "title": getattr(resolved, "title", key),
                }
                entity = resolved

            known = int(state.get(key, {}).get("lastId", 0))
            file = OUT / f"{key}.json"
            existing = json.loads(file.read_text(encoding="utf8")) if file.exists() else {"posts": []}
            by_id = {p["id"]: p for p in existing.get("posts", [])}

            if args.avatars:
                # аватар канала: в карточке автор — это лицо, а строка иконок без картинок
                # читается как список, а не как набор лиц
                dest = AVATARS / f"tg-{key}.jpg"
                AVATARS.mkdir(parents=True, exist_ok=True)
                # маленькая версия фотографии: в строке иконка 48 px, большая тянет
                # по сотне килобайт на канал и уезжает в сборку
                got = await client.download_profile_photo(entity, file=str(dest), download_big=False)
                print(f"  {key}: {'аватар сохранён' if got else 'аватара нет'}")
                if i + 1 < len(channels):
                    await asyncio.sleep(args.pause)
                continue

            if args.discussions:
                # у канала бывает привязанный чат: там комментарии под постами — другой
                # материал, чем сами посты, и читать его будем отдельно
                try:
                    full = await client(GetFullChannelRequest(entity))
                    linked = getattr(full.full_chat, "linked_chat_id", None)
                except (ChannelPrivateError, ValueError, TypeError) as err:
                    linked, full = None, None
                    print(f"  {key}: чат не спросить ({type(err).__name__})", file=sys.stderr)
                info = {"channel": key, "linkedChatId": linked}
                if linked and full is not None:
                    for chat in full.chats:
                        if chat.id == linked:
                            info["title"] = getattr(chat, "title", None)
                            info["username"] = getattr(chat, "username", None)
                            info["participants"] = getattr(chat, "participants_count", None)
                discussions[key] = info
                print(f"  {key}: чат обсуждений — {info.get('username') and '@' + info['username'] or info.get('title') or ('id ' + str(linked) if linked else 'нет')}")
                if i + 1 < len(channels):
                    await asyncio.sleep(args.pause)
                continue

            chats: dict[int, str] = {}
            fresh = 0
            # впервые — берём хвост истории (остальное уже лежит в экспорте Desktop);
            # дальше — только то, что новее прочитанного
            kwargs = ({"min_id": known, "reverse": True, "limit": args.limit} if known
                      else {"limit": args.backfill})
            async for msg in client.iter_messages(entity, **kwargs):
                post = post_of(msg, chats)
                if post:
                    by_id[post["id"]] = post
                    fresh += 1
                known = max(known, msg.id)

            posts = [by_id[k] for k in sorted(by_id)]
            file.write_text(json.dumps({
                "name": getattr(entity, "title", None) or peers.get(key, {}).get("title") or key,
                "username": key,
                "source": "mtproto",
                "fetchedAt": datetime.now(UTC).isoformat(timespec="seconds"),
                "posts": posts,
            }, ensure_ascii=False), encoding="utf8")
            state[key] = {"lastId": known, "at": datetime.now(UTC).isoformat(timespec="seconds")}
            added_total += fresh
            print(f"  {key}: новых {fresh}, всего {len(posts)}")
            if i + 1 < len(channels):
                await asyncio.sleep(args.pause)
        await client.disconnect()
    except FloodWaitError as e:
        # не глушим и не ждём: Telegram просит подождать — значит, останавливаемся,
        # состояние уже сохранено и следующий прогон продолжит с той же точки
        stopped = f"FloodWait: Telegram просит подождать {e.seconds} с"
    finally:
        state_file.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding="utf8")
        peers_file.write_text(json.dumps(peers, ensure_ascii=False, indent=1), encoding="utf8")
        if discussions:
            discussions_file.write_text(json.dumps(discussions, ensure_ascii=False, indent=1), encoding="utf8")
        shutil.rmtree(tmp_dir, ignore_errors=True)

    print(f"новых постов: {added_total} → {OUT}")
    if stopped:
        print(stopped, file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
