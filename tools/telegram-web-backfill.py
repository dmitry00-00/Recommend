"""История новых каналов recomend с публичной страницы t.me/s/ (24.10, слово владельца «брать историю из t.me/s, а не
через API»): бюджет аккаунта шлюза (~171 обращение в сутки, первый визит канала ~5) — узкое место, очередь из ~470 новых
каналов читалась бы до конца ноября. Веб-превью аккаунт не тратит.

Только каналы, у которых ВСЕ подписчики в шлюзе — recomend* (правила других потребителей не наши) и которые шлюз ещё
не читал (last_msg_id = 0). Посты — в архив шлюза тем же store(), что у его веб-транспорта (fetcher.run_web): source='web',
текст и дата, адреса ссылок — блоком в конце текста, без вложений и кнопок. last_msg_id канала после этого > 0, и
MTProto-обход дальше берёт только новые посты — первый визит обходится ему в 1–2 обращения вместо ~5.
Бережно: пауза между страницами и каналами, на 429 — пауза и повтор, на втором подряд — стоп прогона.
Код и настройки шлюза не меняются (его web_fallback выключен — это для всех потребителей сразу).
  ~/core/.venv/bin/python -u tools/telegram-web-backfill.py [--pages 20] [--limit N] [--only a,b] [--dry]
"""
import argparse
import asyncio
import os
import sys
import time
from datetime import datetime

ap = argparse.ArgumentParser()
ap.add_argument("--pages", type=int, default=20, help="страниц по ~20 постов: 20 ≈ 400, как первый визит MTProto")
ap.add_argument("--limit", type=int, default=0)
ap.add_argument("--only", default="")
ap.add_argument("--page-pause", type=float, default=2.0)
ap.add_argument("--channel-pause", type=float, default=5.0)
ap.add_argument("--dry", action="store_true")
a = ap.parse_args()

os.chdir(os.path.expanduser("~/core/services/tg-gateway"))  # .env шлюза: путь архива как у CLI
from tg_gateway.analysis.near_dup import DupIndex  # noqa: E402
from tg_gateway.archive import Archive, now  # noqa: E402
from tg_gateway.clients.tg_web import TgWebClient, looks_like_channel_preview, parse_page  # noqa: E402
from tg_gateway.config import settings  # noqa: E402
from tg_gateway.fetcher import store  # noqa: E402
from tg_gateway.models import Post  # noqa: E402


def log(*x):
    print(datetime.now().strftime("%m-%d %H:%M:%S"), *x, flush=True)


def todo(arch: Archive) -> list[dict]:
    rows = arch.db.execute("""
        SELECT c.handle, c.status, c.last_msg_id, MAX(s.priority) AS priority, GROUP_CONCAT(s.consumer) AS consumers
        FROM channels c JOIN subscriptions s ON s.handle = c.handle
        WHERE c.platform = 'telegram'
        GROUP BY c.handle
        HAVING SUM(s.consumer NOT LIKE 'recomend%') = 0
        ORDER BY MAX(s.priority) DESC, c.created_at ASC, c.handle ASC
    """).fetchall()
    only = {x.strip().lstrip("@").lower() for x in a.only.split(",") if x.strip()}
    out = [dict(r) for r in rows if int(r["last_msg_id"] or 0) == 0 and r["status"] == "active"
           and not r["handle"].lstrip("-").isdigit() and (not only or r["handle"] in only)]
    return out[: a.limit] if a.limit else out


class Stop(Exception):
    pass


async def history(web: TgWebClient, handle: str) -> tuple[list, str]:
    """посты от старых к новым и итог: ok | empty | no_preview | bad:<код>"""
    got, before, why = {}, None, "ok"
    for page in range(a.pages):
        html, code = await web.fetch_page(handle, before=before)
        if code == 429:
            log(f"  429 на {handle}, пауза 120 с")
            await asyncio.sleep(120)
            html, code = await web.fetch_page(handle, before=before)
            if code == 429:
                raise Stop("повторный 429")
        if code != 200 or not html:
            why = f"bad:{code}"
            break
        if not looks_like_channel_preview(html):
            why = "no_preview"
            break
        posts = parse_page(html)
        if not posts:
            why = "empty" if not got else "ok"
            break
        for p in posts:
            got[p.id] = p
        if before is not None and posts[0].id >= before:
            break
        before = posts[0].id
        if before <= 1:
            break
        await asyncio.sleep(a.page_pause)
    return [got[k] for k in sorted(got)], why


async def main() -> int:
    arch = Archive(settings().db_path)
    chans = todo(arch)
    log(f"каналов без истории (только recomend): {len(chans)}; страниц на канал до {a.pages}")
    if a.dry:
        for c in chans[:40]:
            log(" ", c["handle"], "приоритет", c["priority"])
        return 0
    dups = DupIndex(arch)
    run_id = arch.run_start("web")
    res = {"channels": 0, "new": 0, "updated": 0, "failed": [], "empty": []}
    t0 = time.time()
    try:
        async with TgWebClient() as web:
            for i, c in enumerate(chans, 1):
                h = c["handle"]
                posts, why = await history(web, h)
                if not posts:
                    (res["failed"] if why.startswith("bad") else res["empty"]).append(f"{h}:{why}")
                    log(f"[{i}/{len(chans)}] {h}: постов нет ({why})")
                    await asyncio.sleep(a.channel_pause)
                    continue
                last = 0
                n_new = 0
                for wp in posts:
                    r = store(arch, dups, Post(channel=h, msg_id=wp.id, date=wp.date.isoformat(), text=wp.text, source="web"))
                    n_new += r == "new"
                    res["updated"] += r == "updated"
                    last = max(last, wp.id)
                res["new"] += n_new
                # MTProto мог прочитать канал, пока мы листали: last_msg_id — не меньше уже записанного
                cur = arch.db.execute("SELECT last_msg_id FROM channels WHERE handle=?", (h,)).fetchone()
                arch.update_channel(h, last_msg_id=max(last, int(cur[0] or 0) if cur else 0), last_fetch_at=now())
                res["channels"] += 1
                log(f"[{i}/{len(chans)}] {h}: {len(posts)} постов (новых {n_new}), {posts[0].date:%Y-%m-%d} … {posts[-1].date:%Y-%m-%d}")
                await asyncio.sleep(a.channel_pause)
    except Stop as e:
        log("стоп:", e)
        res["failed"].append(f"стоп: {e}")
    status = "partial" if res["failed"] else "ok"
    arch.run_finish(run_id, status=status, channels=res["channels"], posts_new=res["new"], posts_upd=res["updated"],
                    detail={"failed": res["failed"][:50], "empty": res["empty"][:50], "by": "recomend telegram-web-backfill"})
    log(f"итог: каналов {res['channels']}, постов новых {res['new']}, пустых {len(res['empty'])}, сбоев {len(res['failed'])}, {time.time() - t0:.0f} с")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
