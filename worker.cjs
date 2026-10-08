"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// worker/index.ts
var index_exports = {};
__export(index_exports, {
  REFERENCE_NAMES: () => REFERENCE_NAMES,
  default: () => index_default,
  forgetMigrations: () => forgetMigrations
});
module.exports = __toCommonJS(index_exports);

// worker/invite.ts
var TAIL = /(?:--(?:r[0-9a-f]{16}|s[a-z0-9_]{1,24}))+$/;
function withRef(param, userId) {
  const ref = /^u-([0-9a-f]{16})$/.exec(userId)?.[1];
  const p = ref ? `${param}--r${ref}` : param;
  return p.length <= 64 ? p : param;
}
async function noteInvite(db, userId, startParam) {
  const tail = startParam ? TAIL.exec(startParam)?.[0] : void 0;
  if (!tail) return;
  const ref = /--r([0-9a-f]{16})/.exec(tail)?.[1];
  const source = /--s([a-z0-9_]{1,24})/.exec(tail)?.[1];
  if (source) await db.prepare("UPDATE user SET source = ? WHERE id = ? AND source IS NULL").bind(source, userId).run();
  if (!ref) return;
  const by = `u-${ref}`;
  if (by === userId) return;
  const known = await db.prepare("SELECT id FROM user WHERE id = ?").bind(by).first();
  if (!known) return;
  await db.prepare("UPDATE user SET invited_by = ? WHERE id = ? AND invited_by IS NULL").bind(by, userId).run();
}

// worker/inline.ts
var BOT = "recomend_media_bot";
var LIMIT = 20;
var KIND = { film: "\u0424\u0438\u043B\u044C\u043C", series: "\u0421\u0435\u0440\u0438\u0430\u043B", book: "\u041A\u043D\u0438\u0433\u0430", character: "\u0413\u0435\u0440\u043E\u0439" };
async function webhookSecret(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tm-webhook:${token}`));
  return [...new Uint8Array(digest)].slice(0, 24).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var cache;
var norm = (s) => s.normalize("NFD").replace(new RegExp("\\p{M}+", "gu"), "").toLowerCase().replace(/ё/g, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
async function index(env) {
  if (cache && Date.now() - cache.at < 10 * 6e4) return cache;
  const object = await env.REFERENCE?.get("inlineIndex.json");
  if (!object) return cache;
  const list = JSON.parse(await new Response(object.body).text());
  cache = { at: Date.now(), list, keys: list.map((e) => [e.t, e.o, ...e.a ?? []].filter((x) => Boolean(x)).map(norm)) };
  return cache;
}
function search(idx, raw) {
  const q = norm(raw);
  if (!q) return [];
  const exact = idx.list.find((e) => e.p === raw.trim());
  if (exact) return [exact];
  const scored = [];
  idx.list.forEach((e, i) => {
    let best = 0;
    for (const k of idx.keys[i]) {
      if (k === q) best = Math.max(best, 3);
      else if (k.startsWith(q)) best = Math.max(best, 2);
      else if (k.includes(` ${q}`)) best = Math.max(best, 1);
    }
    if (best) scored.push([best * 1e3 + (e.k === "character" ? 200 : 0) + Math.min(e.r ?? 0, 199) - Math.min(e.t.length, 99) / 100, e]);
  });
  return scored.sort((a, b) => b[0] - a[0]).slice(0, LIMIT).map(([, e]) => e);
}
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function result(e) {
  const head = `${e.t}${e.y ? ` (${e.y})` : ""}`;
  const line = [KIND[e.k], e.o, e.s].filter(Boolean).join(" \xB7 ");
  return {
    type: "article",
    id: e.p,
    title: head,
    description: line,
    ...e.i ? { thumbnail_url: e.i } : {},
    input_message_content: { message_text: `<b>${esc(head)}</b>
${esc(line)}`, parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    reply_markup: { inline_keyboard: [[{ text: e.k === "character" ? "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0435\u0440\u043E\u044F" : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443", url: `https://t.me/${BOT}?startapp=${e.p}` }]] }
  };
}
async function answer(env, q) {
  const idx = await index(env);
  const found = idx ? search(idx, q.query) : [];
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerInlineQuery`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ inline_query_id: q.id, results: found.map(result), cache_time: 300 })
  }).catch((err) => console.error("answerInlineQuery", err));
}
async function telegramUpdate(req, env) {
  if (!env.BOT_TOKEN) return new Response("no bot", { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret(env.BOT_TOKEN)) return new Response("forbidden", { status: 403 });
  const update = await req.json().catch(() => ({}));
  if (update.inline_query) await answer(env, update.inline_query);
  return new Response("ok");
}
async function adminWebhook(req, env) {
  if (!env.BOT_TOKEN) return Response.json({ error: "no_bot_token" }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const api = (method, body) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body ?? {})
  }).then((r) => r.json());
  if (b.action === "set") {
    if (!b.url || !/^https:\/\/[^/]+\/api\/telegram$/.test(b.url)) return Response.json({ error: "url" }, { status: 400 });
    return Response.json(await api("setWebhook", { url: b.url, secret_token: await webhookSecret(env.BOT_TOKEN), allowed_updates: ["inline_query"], drop_pending_updates: true }));
  }
  if (b.action === "delete") return Response.json(await api("deleteWebhook", { drop_pending_updates: true }));
  const info = await api("getWebhookInfo");
  const me = await api("getMe");
  return Response.json({ webhook: info.result, bot: me.result?.username, inline: me.result?.supports_inline_queries ?? false });
}
var IMAGE_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|kinopoiskapiunofficial\.tech|avatars\.mds\.yandex\.net|commons\.wikimedia\.org|upload\.wikimedia\.org|i\.ytimg\.com)\//;
var clip = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
function shareResult(c) {
  const head = `${c.title}${c.year ? ` (${c.year})` : ""}`;
  const line = [c.kind && c.kind !== "together" ? KIND[c.kind] : void 0, c.by].filter(Boolean).join(" \xB7 ");
  const text = [`<b>${esc(head)}</b>`, line ? esc(line) : "", c.about ? `
${esc(c.about)}` : ""].filter(Boolean).join("\n");
  const button = c.kind === "together" ? "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u0442\u044C" : c.kind === "character" ? "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0435\u0440\u043E\u044F" : "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443";
  const reply_markup = { inline_keyboard: [[{ text: button, url: `https://t.me/${BOT}?startapp=${c.param}` }]] };
  const id = `s-${c.param}`.slice(0, 64);
  return c.image ? { type: "photo", id, photo_url: c.image, thumbnail_url: c.image, caption: text, parse_mode: "HTML", reply_markup } : { type: "article", id, title: head, input_message_content: { message_text: text, parse_mode: "HTML", link_preview_options: { is_disabled: true } }, reply_markup };
}
async function prepareShare(req, tgId, env, userId) {
  if (!env.BOT_TOKEN) return Response.json({ error: "no_bot_token" }, { status: 503 });
  if (tgId == null) return Response.json({ error: "telegram_only" }, { status: 400 });
  const b = await req.json().catch(() => ({}));
  const param = clip(b.param, 64);
  const title = clip(b.title, 120);
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(param) || !title) return Response.json({ error: "bad_card" }, { status: 400 });
  const kind = ["film", "series", "book", "character", "together"].find((k) => k === b.kind);
  const image = clip(b.image, 500);
  const card = {
    param: userId ? withRef(param, userId) : param,
    title,
    ...typeof b.year === "number" && b.year > 1800 && b.year < 2100 ? { year: b.year } : {},
    ...kind ? { kind } : {},
    ...clip(b.by, 80) ? { by: clip(b.by, 80) } : {},
    ...clip(b.about, 300) ? { about: clip(b.about, 300) } : {},
    ...IMAGE_HOSTS.test(image) ? { image } : {}
  };
  const save = (result2) => fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/savePreparedInlineMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ user_id: tgId, result: result2, allow_user_chats: true, allow_group_chats: true, allow_channel_chats: true, allow_bot_chats: false })
  }).then((r2) => r2.json());
  let r = await save(shareResult(card));
  if (!r.ok && card.image) r = await save(shareResult({ ...card, image: void 0 }));
  return r.ok && r.result ? Response.json({ id: r.result.id }) : Response.json({ error: "telegram", reason: r.description }, { status: 502 });
}

// worker/seasons.ts
var FRESH_DAYS = 14;
var IMDB_KEY = /^imdb:tt\d{5,10}$/;
function seriesKey(workId, work) {
  if (IMDB_KEY.test(workId)) return workId;
  const imdb = work?.externalIds?.imdb;
  return work?.type === "series" && imdb && /^tt\d{5,10}$/.test(imdb) ? `imdb:${imdb}` : void 0;
}
function freshSeasons(seasons, now2) {
  const today = now2.toISOString().slice(0, 10);
  const since = new Date(now2.getTime() - FRESH_DAYS * 864e5).toISOString().slice(0, 10);
  return new Map(Object.entries(seasons).filter(([k, s]) => IMDB_KEY.test(k) && s.n >= 2 && s.at > since && s.at <= today));
}
function waitedFor(status, progress, n) {
  if (status === "finished") return true;
  if (status !== "in_progress") return false;
  const done2 = Math.max(0, ...(progress?.done ?? []).map((d) => d.season));
  return done2 >= n - 1 && (progress?.season ?? 0) < n;
}
async function seasonNews(env, seasons, now2 = /* @__PURE__ */ new Date()) {
  const out = /* @__PURE__ */ new Map();
  const fresh = freshSeasons(seasons, now2);
  if (!fresh.size) return out;
  const add = (user, n) => {
    const list = out.get(user) ?? [];
    if (!list.some((x) => x.key === n.key)) list.push(n);
    out.set(user, list);
  };
  const journal = await env.DB.prepare(`SELECT user_id, work_id, work, status, series FROM journal WHERE status IN ('in_progress', 'finished') AND work IS NOT NULL`).all();
  for (const r of journal.results) {
    let work = null;
    try {
      work = JSON.parse(r.work);
    } catch {
      continue;
    }
    const key = seriesKey(r.work_id, work);
    const s = key ? fresh.get(key) : void 0;
    if (!key || !s) continue;
    let progress = null;
    try {
      progress = r.series ? JSON.parse(r.series) : null;
    } catch {
    }
    if (waitedFor(r.status, progress, s.n)) add(r.user_id, { key, title: work?.title ?? key, season: s.n, at: s.at, why: "watched" });
  }
  const follows = await env.DB.prepare(`SELECT user_id, ref, keys, title FROM follow WHERE kind = 'work'`).all();
  for (const f of follows.results) {
    for (const key of /* @__PURE__ */ new Set([f.ref, ...f.keys.split(",")])) {
      const s = fresh.get(key);
      if (s) add(f.user_id, { key, title: f.title, season: s.n, at: s.at, why: "follow" });
    }
  }
  if (!out.size) return out;
  const sent = await env.DB.prepare("SELECT user_id, key, season FROM season_notice WHERE at > ?").bind(new Date(now2.getTime() - 60 * 864e5).toISOString()).all();
  const seen = new Set(sent.results.map((x) => `${x.user_id} ${x.key} ${x.season}`));
  for (const [user, list] of out) {
    const left = list.filter((x) => !seen.has(`${user} ${x.key} ${x.season}`));
    if (left.length) out.set(user, left);
    else out.delete(user);
  }
  return out;
}
function noteSeasons(env, userId, news, now2 = /* @__PURE__ */ new Date()) {
  return news.map((x) => env.DB.prepare("INSERT OR IGNORE INTO season_notice (user_id, key, season, at) VALUES (?, ?, ?, ?)").bind(userId, x.key, x.season, now2.toISOString()));
}

// worker/follow.ts
var BOT2 = "recomend_media_bot";
var FRESH_DAYS2 = 14;
var KEEP_DAYS = 30;
var MAX_FOLLOWS = 100;
var PER_FOLLOW = 3;
var MAX_SECTIONS = 6;
var HOUR_MSK = 10;
var json = (body, status = 200) => Response.json(body, { status });
var iso = (d = /* @__PURE__ */ new Date()) => d.toISOString();
var msk = (d) => {
  const m = new Date(d.getTime() + 3 * 36e5);
  return { day: m.toISOString().slice(0, 10), hour: m.getUTCHours() };
};
var WORK_KEY = /^[a-z]{2,10}:[A-Za-z0-9_.-]{1,40}$/;
var youtubeId = (a) => /[?&]v=([\w-]{11})/.exec(a.url)?.[1] ?? /^yta-([\w-]{11})$/.exec(a.id)?.[1];
async function noteFresh(env, oldText, newText, now2 = /* @__PURE__ */ new Date()) {
  if (!oldText) return 0;
  const before = /* @__PURE__ */ new Set();
  for (const list of Object.values(JSON.parse(oldText))) for (const a of list) before.add(a.url);
  const lenses = await reference(env, "essayLenses") ?? {};
  const since = now2.getTime() - FRESH_DAYS2 * 864e5;
  const at = iso(now2);
  const rows = [];
  for (const [key, list] of Object.entries(JSON.parse(newText))) {
    for (const a of list) {
      if (before.has(a.url) || a.unverified || !a.publishedAt || Date.parse(a.publishedAt) < since) continue;
      const yt = youtubeId(a);
      const lens = yt ? lenses[yt] ?? null : null;
      rows.push(env.DB.prepare(`INSERT OR IGNORE INTO follow_fresh (url, key, title, author, platform, spoiler, tier, lens, at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(a.url, key, a.title.slice(0, 300), a.author.slice(0, 120), a.platform, a.spoilerLevel ?? 0, a.tier ?? null, lens, at));
    }
  }
  rows.push(env.DB.prepare("DELETE FROM follow_fresh WHERE at < ?").bind(iso(new Date(now2.getTime() - KEEP_DAYS * 864e5))));
  await env.DB.batch(rows);
  return rows.length - 1;
}
var refCache = /* @__PURE__ */ new Map();
async function reference(env, name) {
  const hit = refCache.get(name);
  if (hit && Date.now() - hit.at < 10 * 6e4) return hit.data;
  const object = await env.REFERENCE?.get(`${name}.json`);
  if (!object) return void 0;
  const data2 = JSON.parse(await new Response(object.body).text());
  refCache.set(name, { at: Date.now(), data: data2 });
  return data2;
}
var forgetReference = (name) => refCache.delete(name);
async function getFollows(userId, env) {
  const [rows, me] = await Promise.all([
    env.DB.prepare("SELECT kind, ref, title, at FROM follow WHERE user_id = ? ORDER BY at DESC").bind(userId).all(),
    env.DB.prepare("SELECT tg_id FROM user WHERE id = ?").bind(userId).first()
  ]);
  return json({ follows: rows.results, telegram: me?.tg_id != null });
}
async function putFollow(req, userId, env) {
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "work" || b.kind === "character" ? b.kind : void 0;
  const ref = typeof b.ref === "string" ? b.ref.trim() : "";
  if (!kind || !(kind === "character" ? /^(Q\d{1,12}|aoiaf-\d{1,6})$/.test(ref) : WORK_KEY.test(ref))) return json({ error: "bad_follow" }, 400);
  if (b.on === false) {
    await env.DB.prepare("DELETE FROM follow WHERE user_id = ? AND kind = ? AND ref = ?").bind(userId, kind, ref).run();
    return getFollows(userId, env);
  }
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
  if (!title) return json({ error: "bad_follow" }, 400);
  const keys = kind === "work" ? [.../* @__PURE__ */ new Set([ref, ...(Array.isArray(b.keys) ? b.keys : []).filter((k) => typeof k === "string" && WORK_KEY.test(k))])].slice(0, 8) : [];
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM follow WHERE user_id = ?").bind(userId).first();
  if ((count?.n ?? 0) >= MAX_FOLLOWS) return json({ error: "too_many" }, 400);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO follow (user_id, kind, ref, keys, title, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, kind, ref) DO UPDATE SET keys = excluded.keys, title = excluded.title`).bind(userId, kind, ref, keys.join(","), title, iso()),
    // снова подписался — значит, писать ему снова можно (бота могли разблокировать)
    env.DB.prepare("UPDATE follow_digest SET blocked = 0 WHERE user_id = ?").bind(userId)
  ]);
  return getFollows(userId, env);
}
var esc2 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var SPOILER_TITLE = "\u0440\u0430\u0437\u0431\u043E\u0440 \u0441\u043E \u0441\u043F\u043E\u0439\u043B\u0435\u0440\u0430\u043C\u0438";
var paramOf = (f) => f.kind === "character" ? `h-${f.ref}` : `w-${f.ref.replace(":", "_")}`;
function matchFollow(f, fresh, heroes) {
  if (f.kind === "work") {
    const keys = new Set(f.keys.split(",").filter(Boolean));
    return fresh.filter((x) => keys.has(x.key) && x.tier !== "review");
  }
  const h = heroes[f.ref];
  if (!h) return [];
  const own = h.own ? new RegExp(h.own, "u") : void 0;
  const other = h.other ? new RegExp(h.other, "u") : void 0;
  const works = new Set(h.works);
  return fresh.filter((x) => {
    const about = x.lens?.split("/").includes("character");
    if (x.tier === "review" && !about) return false;
    return (works.has(x.key) ? own : other)?.test(x.title) ?? false;
  });
}
function digestMessage(sections, seasons = []) {
  const shown2 = sections.slice(0, MAX_SECTIONS);
  const lines = [];
  const shownSeasons = seasons.slice(0, MAX_SECTIONS);
  if (shownSeasons.length) {
    lines.push("<b>\u0412\u044B\u0448\u0435\u043B \u043D\u043E\u0432\u044B\u0439 \u0441\u0435\u0437\u043E\u043D</b>");
    for (const x of shownSeasons) lines.push(`\u2014 \xAB${esc2(x.title)}\xBB: ${x.season} \u0441\u0435\u0437\u043E\u043D${x.why === "watched" ? " \u2014 \u0432\u044B \u0434\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043B\u0438 \u043F\u0440\u0435\u0436\u043D\u0438\u0435" : ""}`);
  }
  if (shown2.length) lines.push(...lines.length ? [""] : [], "<b>\u041D\u043E\u0432\u044B\u0435 \u0440\u0430\u0437\u0431\u043E\u0440\u044B \u043F\u043E \u0432\u0430\u0448\u0438\u043C \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430\u043C</b>");
  for (const { follow, items } of shown2) {
    lines.push("", `<b>${esc2(follow.title)}</b> \xB7 ${items.length}`);
    for (const x of items.slice(0, PER_FOLLOW)) lines.push(`\u2014 ${esc2(x.author)}: ${x.spoiler >= 2 ? SPOILER_TITLE : `\xAB${esc2(x.title)}\xBB`}`);
    if (items.length > PER_FOLLOW) lines.push(`\u2014 \u0438 \u0435\u0449\u0451 ${items.length - PER_FOLLOW}`);
  }
  if (sections.length > shown2.length) lines.push("", `\u0418 \u0435\u0449\u0451 \u043F\u043E\u0434\u043F\u0438\u0441\u043E\u043A \u0441 \u043D\u043E\u0432\u0438\u043D\u043A\u0430\u043C\u0438: ${sections.length - shown2.length}.`);
  lines.push("", "<i>\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0438 \u2014 \u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0421\u043B\u0435\u0434\u0438\u0442\u044C\xBB \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0433\u0435\u0440\u043E\u044F \u0438\u043B\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F.</i>");
  const buttons = [
    ...shownSeasons.map((x) => [{ text: `${x.title.slice(0, 32)} \xB7 ${x.season} \u0441\u0435\u0437\u043E\u043D`, url: `https://t.me/${BOT2}?startapp=${paramOf({ kind: "work", ref: x.key })}` }]),
    ...shown2.map(({ follow }) => [{ text: follow.title.slice(0, 40), url: `https://t.me/${BOT2}?startapp=${paramOf(follow)}` }])
  ];
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: buttons } };
}
async function followDigest(env, { now: now2 = /* @__PURE__ */ new Date(), force = false, dry = false } = {}) {
  const { day, hour } = msk(now2);
  const report = { due: force || hour >= HOUR_MSK, users: 0, sent: 0, empty: 0, blocked: 0, failed: 0, ...dry ? { preview: [] } : {} };
  if (!report.due || !env.BOT_TOKEN) return report;
  const seasons = await reference(env, "seriesSeasons") ?? {};
  const news = await seasonNews(env, seasons, now2).catch((err) => {
    console.error("seasonNews", err);
    return /* @__PURE__ */ new Map();
  });
  const users = await env.DB.prepare(`SELECT u.id AS id, u.tg_id AS tg, d.at AS last
    FROM user u LEFT JOIN follow_digest d ON d.user_id = u.id
    WHERE u.tg_id IS NOT NULL AND COALESCE(d.blocked, 0) = 0 ${force ? "" : "AND (d.day IS NULL OR d.day < ?)"}
      AND (EXISTS (SELECT 1 FROM follow f WHERE f.user_id = u.id) OR u.id IN (SELECT value FROM json_each(?)))`).bind(...force ? [] : [day], JSON.stringify([...news.keys()])).all();
  report.users = users.results.length;
  if (!users.results.length) return report;
  const oldest = users.results.reduce((m, u) => u.last && u.last < m ? u.last : m, iso(now2));
  const fresh = (await env.DB.prepare("SELECT * FROM follow_fresh WHERE at > ? ORDER BY at").bind(users.results.some((u) => !u.last) ? "" : oldest).all()).results;
  const heroes = await reference(env, "heroes") ?? {};
  const mark = (userId, blocked = 0) => env.DB.prepare(`INSERT INTO follow_digest (user_id, at, day, blocked) VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET at = excluded.at, day = excluded.day, blocked = excluded.blocked`).bind(userId, iso(now2), day, blocked).run();
  for (const u of users.results) {
    const follows = (await env.DB.prepare("SELECT * FROM follow WHERE user_id = ? ORDER BY at").bind(u.id).all()).results;
    const sections = follows.map((follow) => {
      const since = u.last && u.last > follow.at ? u.last : follow.at;
      return { follow, items: matchFollow(follow, fresh.filter((x) => x.at > since), heroes) };
    });
    const listed = /* @__PURE__ */ new Set();
    for (const sec of [...sections].sort((a, b) => Number(a.follow.kind === "character") - Number(b.follow.kind === "character"))) {
      sec.items = sec.items.filter((x) => !listed.has(x.url) && listed.add(x.url));
    }
    for (let i = sections.length - 1; i >= 0; i--) if (!sections[i].items.length) sections.splice(i, 1);
    const seasonsNew = news.get(u.id) ?? [];
    if (!sections.length && !seasonsNew.length) {
      report.empty++;
      if (!dry) await mark(u.id);
      continue;
    }
    const msg = digestMessage(sections, seasonsNew);
    if (dry) {
      report.preview.push({ user: u.id, text: msg.text });
      continue;
    }
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: u.tg, text: msg.text, parse_mode: "HTML", reply_markup: msg.reply_markup, link_preview_options: { is_disabled: true } })
    }).then((x) => x.json()).catch(() => ({ ok: false, error_code: 0 }));
    if (r.ok) {
      report.sent++;
      await mark(u.id);
      if (seasonsNew.length) await env.DB.batch(noteSeasons(env, u.id, seasonsNew, now2));
    } else if (r.error_code === 403) {
      report.blocked++;
      await mark(u.id, 1);
    } else report.failed++;
  }
  return report;
}
async function adminDigest(req, env) {
  const b = await req.json().catch(() => ({}));
  return json(await followDigest(env, { dry: b.dry !== false, force: b.force === true }));
}

// worker/pages.ts
var BOT3 = "recomend_media_bot";
var SITE = "Transformative Media";
var PER_PAGE = 40;
var esc3 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var norm2 = (s) => s.toLowerCase().replace(/ё/g, "\u0435").replace(/\s+/g, " ").trim();
var keyToPath = (key) => key.replace(":", "-");
var pathToKey = (p) => p.replace(/^([a-z]{2,10})-/, "$1:");
var startapp = (key) => `https://t.me/${BOT3}?startapp=w-${key.replace(":", "_")}--sseo`;
var year = (w) => w.y ? ` (${w.y})` : "";
var shown = (list) => (list ?? []).filter((a) => !a.unverified && (a.language ?? "ru") === "ru");
function origin(req, env) {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/+$/, "");
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? (u.hostname === "localhost" || u.hostname === "127.0.0.1" ? u.protocol.replace(":", "") : "https");
  return `${proto}://${req.headers.get("host") ?? u.host}`;
}
var byAuthor;
function authorIndex(essays) {
  if (byAuthor?.src === essays) return byAuthor.map;
  const map = /* @__PURE__ */ new Map();
  for (const [key, list] of Object.entries(essays)) for (const a of shown(list)) {
    const k = norm2(a.author);
    map.set(k, [...map.get(k) ?? [], { key, a }]);
  }
  byAuthor = { src: essays, map };
  return map;
}
function page(o) {
  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc3(o.title)}</title>
<meta name="description" content="${esc3(o.description)}">
<link rel="canonical" href="${esc3(o.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc3(o.title)}">
<meta property="og:description" content="${esc3(o.description)}">
<meta property="og:url" content="${esc3(o.canonical)}">
${o.image ? `<meta property="og:image" content="${esc3(o.image)}">
` : ""}${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, "\\u003c")}</script>
` : ""}<style>
:root{--bg:#faf8f4;--ink:#1d1b18;--muted:#6b665e;--line:#e4dfd6;--accent:#2f5d8a;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--ink:#ece8e1;--muted:#a19b91;--line:#2c2a26;--accent:#8ab4e0;--card:#1e1d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}a{color:var(--accent)}header.site{font-size:14px;color:var(--muted);margin-bottom:16px}
header.site a{color:inherit;text-decoration:none}.hero{display:flex;gap:16px;align-items:flex-start}.hero img{width:120px;border-radius:8px;flex:none}.hero>div{min-width:0}
body{overflow-wrap:anywhere}
h1{font-size:26px;line-height:1.2;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 12px}.what{font-size:18px;margin:12px 0}
.cta{display:inline-block;margin:8px 0 24px;padding:12px 18px;border-radius:10px;background:var(--accent);color:var(--bg);text-decoration:none;font-weight:600}
h2{font-size:18px;margin:28px 0 8px}ul{list-style:none;padding:0;margin:0}li{padding:10px 0;border-top:1px solid var(--line)}
li .who{font-weight:600}li .meta{color:var(--muted);font-size:14px}footer{margin-top:40px;color:var(--muted);font-size:13px}
</style>
</head>
<body><main>
<header class="site"><a href="/">${SITE}</a> \u2014 \u043F\u043E\u0434\u0431\u043E\u0440 \u0444\u0438\u043B\u044C\u043C\u043E\u0432 \u043D\u0430 \u0448\u0430\u0433 \u0441\u043B\u043E\u0436\u043D\u0435\u0435 \u0442\u043E\u0433\u043E, \u0447\u0442\u043E \u0432\u044B \u043B\u044E\u0431\u0438\u0442\u0435, \u0438 \u0440\u0430\u0437\u0431\u043E\u0440\u044B \u043A \u043D\u0438\u043C</header>
${o.body}
<footer>\u0420\u043E\u043B\u0438\u043A\u0438 \u0438 \u043F\u043E\u0441\u0442\u044B \u043F\u0440\u0438\u043D\u0430\u0434\u043B\u0435\u0436\u0430\u0442 \u0438\u0445 \u0430\u0432\u0442\u043E\u0440\u0430\u043C; \u0437\u0434\u0435\u0441\u044C \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0441\u044B\u043B\u043A\u0438. \u041F\u043E\u0434\u0431\u043E\u0440 \u043F\u043E\u0434 \u0432\u0430\u0448 \u0432\u043A\u0443\u0441 \u2014 \u0432 \u043C\u0438\u043D\u0438-\u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 Telegram.</footer>
</main></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
var notFound = () => new Response("\u0421\u0442\u0440\u0430\u043D\u0438\u0446\u0430 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u0430", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
function analysisItem(a, slugOf) {
  const slug = slugOf.get(norm2(a.author));
  const who = slug ? `<a class="who" href="/author/${encodeURIComponent(slug)}">${esc3(a.author)}</a>` : `<span class="who">${esc3(a.author)}</span>`;
  return `<li>${who}<br>${link(a)}</li>`;
}
var link = (a) => {
  const meta = [a.tier === "essay" ? "\u044D\u0441\u0441\u0435" : "\u043E\u0431\u0437\u043E\u0440", a.durationMinutes ? `${a.durationMinutes} \u043C\u0438\u043D` : "", a.publishedAt ? a.publishedAt.slice(0, 4) : "", (a.spoilerLevel ?? 0) >= 2 ? "\u0441\u043F\u043E\u0439\u043B\u0435\u0440\u044B" : ""].filter(Boolean).join(" \xB7 ");
  return `<a href="${esc3(a.url)}" rel="noopener" target="_blank">\xAB${esc3(a.title)}\xBB</a><br><span class="meta">${meta}</span>`;
};
function filmItem(key, w, xs) {
  const more = xs.length > 3 ? `<br><span class="meta">\u0438 \u0435\u0449\u0451 ${xs.length - 3}</span>` : "";
  return `<li><a class="who" href="/film/${keyToPath(key)}">${esc3(w.t)}${year(w)}</a>${xs.slice(0, 3).map((a) => `<br>${link(a)}`).join("")}${more}</li>`;
}
async function data(env) {
  const [pages, essays] = await Promise.all([reference(env, "publicPages"), reference(env, "essaysAuto")]);
  if (!pages || !essays) return void 0;
  const slugOf = new Map(Object.entries(pages.authors).map(([slug, a]) => [norm2(a.n), slug]));
  return { pages, essays, slugOf };
}
async function filmPage(req, env, rawKey) {
  const d = await data(env);
  const key = pathToKey(rawKey);
  const w = d?.pages.works[key];
  if (!d || !w) return notFound();
  const list = shown(d.essays[key]).sort((a, b) => Number(b.tier === "essay") - Number(a.tier === "essay") || (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));
  const essays = list.filter((a) => a.tier === "essay");
  const reviews = list.filter((a) => a.tier !== "essay");
  const kind = w.s ? "\u0441\u0435\u0440\u0438\u0430\u043B\u0430" : "\u0444\u0438\u043B\u044C\u043C\u0430";
  const by = w.c?.length ? `${w.s ? "\u0441\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C" : "\u0440\u0435\u0436\u0438\u0441\u0441\u0451\u0440"} ${w.c.join(", ")}` : "";
  const sub = [w.o, w.y, by].filter(Boolean).join(" \xB7 ");
  const canonical = `${origin(req, env)}/film/${keyToPath(key)}`;
  const section = (title, xs) => xs.length ? `<h2>${title} \xB7 ${xs.length}</h2><ul>${xs.slice(0, PER_PAGE).map((a) => analysisItem(a, d.slugOf)).join("")}</ul>` : "";
  const body = `<div class="hero">${w.p ? `<img src="${esc3(w.p)}" alt="${esc3(w.t)}">` : ""}<div>
<h1>${esc3(w.t)}${year(w)}</h1>${sub ? `<p class="sub">${esc3(sub)}</p>` : ""}
${w.w ? `<p class="what">${esc3(w.w)}</p>` : ""}</div></div>
<a class="cta" href="${startapp(key)}">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Telegram \u2014 \u0447\u0442\u043E \u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043F\u043E\u0441\u043B\u0435</a>
${section("\u0420\u0430\u0437\u0431\u043E\u0440\u044B \u0438 \u044D\u0441\u0441\u0435", essays)}${section("\u041E\u0431\u0437\u043E\u0440\u044B", reviews)}`;
  const description = `${w.t}${year(w)}: ${list.length} ${list.length === 1 ? "\u0440\u0430\u0437\u0431\u043E\u0440" : "\u0440\u0430\u0437\u0431\u043E\u0440\u043E\u0432"} ${kind} \u2014 ${[...new Set(list.map((a) => a.author))].slice(0, 3).join(", ")}.${w.w ? ` ${w.w}` : ""}`.slice(0, 300);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": w.s ? "TVSeries" : "Movie",
    name: w.t,
    ...w.o ? { alternateName: w.o } : {},
    ...w.y ? { dateCreated: String(w.y) } : {},
    ...w.c?.length ? { [w.s ? "creator" : "director"]: w.c.map((name) => ({ "@type": "Person", name })) } : {},
    ...w.p ? { image: w.p } : {},
    url: canonical
  };
  return page({ title: `${w.t}${year(w)} \u2014 \u0440\u0430\u0437\u0431\u043E\u0440\u044B \u0438 \u043E\u0431\u0437\u043E\u0440\u044B ${kind} | ${SITE}`, description, canonical, image: w.p, body, jsonLd });
}
async function authorPage(req, env, slug) {
  const d = await data(env);
  const a = d?.pages.authors[slug];
  if (!d || !a) return notFound();
  const items = (authorIndex(d.essays).get(norm2(a.n)) ?? []).filter((x) => d.pages.works[x.key]).sort((x, y) => (y.a.publishedAt ?? "").localeCompare(x.a.publishedAt ?? ""));
  const films = /* @__PURE__ */ new Map();
  for (const x of items) films.set(x.key, [...films.get(x.key) ?? [], x.a]);
  const canonical = `${origin(req, env)}/author/${encodeURIComponent(slug)}`;
  const role = a.b ? "\u043E \u043A\u043D\u0438\u0433\u0430\u0445 \u0438 \u044D\u043A\u0440\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F\u0445" : a.e ? "\u0432\u0438\u0434\u0435\u043E\u044D\u0441\u0441\u0435 \u043E \u043A\u0438\u043D\u043E" : "\u043E\u0431\u0437\u043E\u0440\u044B \u043A\u0438\u043D\u043E";
  const body = `<h1>${esc3(a.n)}</h1><p class="sub">${role} \xB7 <a href="${esc3(a.u)}" rel="noopener" target="_blank">\u043A\u0430\u043D\u0430\u043B \u0430\u0432\u0442\u043E\u0440\u0430</a></p>
<a class="cta" href="https://t.me/${BOT3}?startapp=--sseo">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Telegram</a>
<h2>\u0424\u0438\u043B\u044C\u043C\u044B \xB7 ${films.size}, \u0440\u0430\u0437\u0431\u043E\u0440\u043E\u0432 \xB7 ${items.length}</h2><ul>${[...films].slice(0, 150).map(([key, xs]) => filmItem(key, d.pages.works[key], xs)).join("")}</ul>`;
  const names = [...films.keys()].slice(0, 5).map((k) => d.pages.works[k].t).join(", ");
  return page({ title: `${a.n} \u2014 ${role} | ${SITE}`, description: `${a.n}: ${items.length} \u0440\u0430\u0437\u0431\u043E\u0440\u043E\u0432 ${films.size} \u0444\u0438\u043B\u044C\u043C\u043E\u0432 \u2014 ${names}.`.slice(0, 300), canonical, body });
}
async function sitemap(req, env) {
  const pages = await reference(env, "publicPages");
  if (!pages) return notFound();
  const base = origin(req, env);
  const day = pages.at.slice(0, 10);
  const urls = [...Object.keys(pages.works).map((k) => `${base}/film/${keyToPath(k)}`), ...Object.keys(pages.authors).map((s) => `${base}/author/${encodeURIComponent(s)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${esc3(u)}</loc><lastmod>${day}</lastmod></url>`).join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" } });
}
function robots(req, env) {
  const text = `User-agent: *
Allow: /film/
Allow: /author/
Disallow: /api/
Disallow: /kp-api/

Sitemap: ${origin(req, env)}/sitemap.xml
`;
  return new Response(text, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" } });
}
async function publicPage(req, env, path) {
  if (env.PUBLIC_PAGES !== "1") return void 0;
  if (req.method !== "GET" && req.method !== "HEAD") return void 0;
  if (path === "/robots.txt") return robots(req, env);
  if (path === "/sitemap.xml") return sitemap(req, env);
  let m = /^\/film\/([a-z]{2,10}-[A-Za-z0-9_.-]{1,40})$/.exec(path);
  if (m) return filmPage(req, env, m[1]);
  m = /^\/author\/([^/]{1,80})$/.exec(path);
  if (m) {
    let slug = m[1];
    try {
      slug = decodeURIComponent(slug);
    } catch {
      return notFound();
    }
    return authorPage(req, env, slug);
  }
  return void 0;
}

// worker/registry.ts
var json2 = (body, status = 200) => Response.json(body, { status });
var iso2 = () => (/* @__PURE__ */ new Date()).toISOString();
var KINDS = ["source", "excluded", "tgchannel", "video", "post", "doc"];
var isKind = (k) => typeof k === "string" && KINDS.includes(k);
var MAX_CHANGES = 2e4;
var MAX_BODY = 16e3;
var CHUNK = 400;
var LOG_DAYS = 365;
async function version(db) {
  const r = await db.prepare("SELECT v FROM registry_meta WHERE k = 'version'").first();
  return r?.v ?? 0;
}
var bump = (db) => db.prepare(
  "INSERT INTO registry_meta (k, v) VALUES ('version', 1) ON CONFLICT (k) DO UPDATE SET v = registry_meta.v + 1"
);
async function getRegistry(url, env) {
  const kind = url.searchParams.get("kind");
  if (kind && !isKind(kind)) return json2({ error: "bad_kind" }, 400);
  const rows = kind ? await env.DB.prepare("SELECT kind, id, body, ord, at, by FROM registry WHERE kind = ? ORDER BY ord, id").bind(kind).all() : await env.DB.prepare("SELECT kind, id, body, ord, at, by FROM registry ORDER BY kind, ord, id").all();
  return json2({
    version: await version(env.DB),
    at: iso2(),
    rows: rows.results.map((r) => ({ kind: r.kind, id: r.id, ord: r.ord, at: r.at, by: r.by, body: JSON.parse(r.body) }))
  });
}
async function getRegistryVersion(env) {
  return json2({ version: await version(env.DB) });
}
async function postRegistry(req, env) {
  let input;
  try {
    input = await req.json();
  } catch {
    return json2({ error: "bad_json" }, 400);
  }
  const by = typeof input.by === "string" && /^[\w.:-]{1,40}$/.test(input.by) ? input.by : void 0;
  if (!by) return json2({ error: "bad_by" }, 400);
  if (!Array.isArray(input.changes) || input.changes.length > MAX_CHANGES) return json2({ error: "bad_changes" }, 400);
  const changes = [];
  for (const c of input.changes) {
    if (!c || !isKind(c.kind) || typeof c.id !== "string" || !c.id || c.id.length > 400) return json2({ error: "bad_change", change: c }, 400);
    if (c.body !== null && (typeof c.body !== "object" || Array.isArray(c.body))) return json2({ error: "bad_body", id: c.id }, 400);
    if (c.body !== null && JSON.stringify(c.body).length > MAX_BODY) return json2({ error: "body_too_long", id: c.id }, 400);
    changes.push({ kind: c.kind, id: c.id, body: c.body, ...typeof c.ord === "number" && Number.isFinite(c.ord) ? { ord: c.ord } : {} });
  }
  const at = iso2();
  const quiet = by === "import";
  let applied = 0;
  for (let i = 0; i < changes.length; i += CHUNK) {
    const part = changes.slice(i, i + CHUNK);
    const before = /* @__PURE__ */ new Map();
    for (const kind of new Set(part.map((c) => c.kind))) {
      const ids = part.filter((c) => c.kind === kind).map((c) => c.id);
      for (let j = 0; j < ids.length; j += 90) {
        const slice = ids.slice(j, j + 90);
        const r = await env.DB.prepare(`SELECT id, body, ord FROM registry WHERE kind = ? AND id IN (${slice.map(() => "?").join(",")})`).bind(kind, ...slice).all();
        for (const row of r.results) before.set(`${kind}\0${row.id}`, { body: row.body, ord: row.ord });
      }
    }
    const stmts = [];
    for (const c of part) {
      const old = before.get(`${c.kind}\0${c.id}`);
      const text = c.body === null ? null : JSON.stringify(c.body);
      if (text === null && !old) continue;
      if (text !== null && old && old.body === text && (c.ord === void 0 || c.ord === old.ord)) continue;
      if (text === null) stmts.push(env.DB.prepare("DELETE FROM registry WHERE kind = ? AND id = ?").bind(c.kind, c.id));
      else stmts.push(env.DB.prepare(
        `INSERT INTO registry (kind, id, body, ord, at, by) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT (kind, id) DO UPDATE SET body = excluded.body, ord = COALESCE(?, registry.ord), at = excluded.at, by = excluded.by`
      ).bind(c.kind, c.id, text, c.ord ?? old?.ord ?? null, at, by, c.ord ?? null));
      if (!quiet) stmts.push(env.DB.prepare("INSERT INTO registry_log (kind, id, before, after, at, by) VALUES (?, ?, ?, ?, ?, ?)").bind(c.kind, c.id, old?.body ?? null, text, at, by));
      applied += 1;
    }
    if (stmts.length) await env.DB.batch([...stmts, bump(env.DB)]);
  }
  if (applied && !quiet) {
    const cut = new Date(Date.now() - LOG_DAYS * 864e5).toISOString();
    await env.DB.prepare("DELETE FROM registry_log WHERE at < ?").bind(cut).run();
  }
  return json2({ ok: true, applied, version: await version(env.DB) });
}
async function getRegistryLog(url, env) {
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 1e3);
  const r = kind && id ? await env.DB.prepare("SELECT seq, kind, id, before, after, at, by FROM registry_log WHERE kind = ? AND id = ? ORDER BY seq DESC LIMIT ?").bind(kind, id, limit).all() : await env.DB.prepare("SELECT seq, kind, id, before, after, at, by FROM registry_log ORDER BY seq DESC LIMIT ?").bind(limit).all();
  return json2({ rows: r.results });
}
async function getSources(env) {
  const r = await env.DB.prepare("SELECT body FROM registry WHERE kind = 'source' ORDER BY ord, id").all();
  if (!r.results.length) return json2({ error: "empty" }, 404);
  const list = r.results.map((x) => {
    const { _before, _after, ...rest } = JSON.parse(x.body);
    void _before;
    void _after;
    return rest;
  });
  return new Response(JSON.stringify(list), { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600" } });
}
var normUrl = (u) => u.trim();
async function postInbox(req, env) {
  let input;
  try {
    input = await req.json();
  } catch {
    return json2({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(input.rows) || input.rows.length > 5e3) return json2({ error: "bad_rows" }, 400);
  const rows = [];
  for (const r of input.rows) {
    const url = typeof r?.url === "string" ? normUrl(r.url) : "";
    if (!/^https?:\/\/\S{3,500}$/.test(url)) continue;
    const s = (v, n) => typeof v === "string" && v.trim() ? v.trim().slice(0, n) : void 0;
    rows.push({ url, film: s(r.film, 300), note: s(r.note, 1e3), sheetAt: s(r.sheetAt, 40) });
  }
  const at = iso2();
  const stmts = rows.map((r) => env.DB.prepare(
    `INSERT INTO registry_inbox (url, film, note, sheet_at, taken_at, status) VALUES (?, ?, ?, ?, ?, 'new')
     ON CONFLICT (url) DO UPDATE SET film = COALESCE(excluded.film, registry_inbox.film), note = COALESCE(excluded.note, registry_inbox.note)`
  ).bind(r.url, r.film ?? null, r.note ?? null, r.sheetAt ?? null, at));
  for (let i = 0; i < stmts.length; i += CHUNK) await env.DB.batch(stmts.slice(i, i + CHUNK));
  const held = /* @__PURE__ */ new Set();
  const urls = rows.map((r) => r.url);
  for (let i = 0; i < urls.length; i += 90) {
    const slice = urls.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT url FROM registry_inbox WHERE url IN (${slice.map(() => "?").join(",")})`).bind(...slice).all();
    for (const x of r.results) held.add(x.url);
  }
  return json2({ ok: true, held: [...held] });
}
async function getInbox(url, env) {
  const status = url.searchParams.get("status");
  const r = status ? await env.DB.prepare("SELECT * FROM registry_inbox WHERE status = ? ORDER BY taken_at, url").bind(status).all() : await env.DB.prepare("SELECT * FROM registry_inbox ORDER BY taken_at DESC, url LIMIT 2000").all();
  return json2({ rows: r.results.map((x) => ({ ...x, result: typeof x.result === "string" ? JSON.parse(x.result) : x.result })) });
}
async function postInboxResult(req, env) {
  let input;
  try {
    input = await req.json();
  } catch {
    return json2({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(input.items) || input.items.length > 5e3) return json2({ error: "bad_items" }, 400);
  const at = iso2();
  const stmts = [];
  for (const it of input.items) {
    if (typeof it?.url !== "string" || !["done", "skip", "error", "new"].includes(String(it.status))) continue;
    const result2 = it.result === void 0 ? null : JSON.stringify(it.result).slice(0, MAX_BODY);
    stmts.push(env.DB.prepare("UPDATE registry_inbox SET status = ?, result = ?, done_at = ? WHERE url = ?").bind(String(it.status), result2, at, it.url));
  }
  for (let i = 0; i < stmts.length; i += CHUNK) await env.DB.batch(stmts.slice(i, i + CHUNK));
  return json2({ ok: true, updated: stmts.length });
}

// worker/auth.ts
var enc = new TextEncoder();
async function hmac(key, data2) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data2));
}
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyInitData(raw, botToken, maxAgeSeconds = 86400) {
  const params = new URLSearchParams(raw);
  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no_hash" };
  const pairs = [];
  params.forEach((v, k) => {
    if (k !== "hash") pairs.push(`${k}=${v}`);
  });
  pairs.sort();
  const secret = await hmac(enc.encode("WebAppData"), botToken);
  const signature = hex(await hmac(secret, pairs.join("\n")));
  if (!same(signature, hash)) return { ok: false, reason: "bad_hash" };
  const authDate = Number(params.get("auth_date"));
  if (!authDate || Date.now() / 1e3 - authDate > maxAgeSeconds) return { ok: false, reason: "stale" };
  try {
    const user = JSON.parse(params.get("user") ?? "null");
    if (!user || typeof user.id !== "number") return { ok: false, reason: "no_user" };
    return { ok: true, user, ...params.get("start_param") ? { startParam: params.get("start_param") } : {} };
  } catch {
    return { ok: false, reason: "no_user" };
  }
}
function newToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}
function newId(prefix) {
  return `${prefix}-${hex(crypto.getRandomValues(new Uint8Array(8)).buffer)}`;
}

// worker/migrate.ts
var COLUMNS = [
  // 24.09, трек Б: прогноз модели вероятностями — для Брайера
  { table: "prediction", column: "model_p", ddl: "ALTER TABLE prediction ADD COLUMN model_p TEXT" },
  // 24.09: «насколько хочется» со свайпа по ленте
  { table: "feedback", column: "eagerness", ddl: "ALTER TABLE feedback ADD COLUMN eagerness INTEGER" },
  // 24.09: «в планы» — теперь запись дневника со статусом planned; сколько хотелось — при ней
  { table: "journal", column: "eagerness", ddl: "ALTER TABLE journal ADD COLUMN eagerness INTEGER" },
  // 24.09: старт по переходу в кинотеатр, а не кнопкой «Начать смотреть»
  { table: "journal", column: "inferred", ddl: "ALTER TABLE journal ADD COLUMN inferred INTEGER" },
  // 30.09, Е3: сериал — сезон и серия, досмотренные сезоны
  { table: "journal", column: "series", ddl: "ALTER TABLE journal ADD COLUMN series TEXT" },
  // 07.10, ЗП-37: кто привёл — по ссылке «Поделиться» с хвостом `--r<код>` (worker/invite.ts)
  { table: "user", column: "invited_by", ddl: "ALTER TABLE user ADD COLUMN invited_by TEXT" },
  // 07.10, ЗП-13/38: источник прихода — метка `--s<метка>` в ссылке посева
  { table: "user", column: "source", ddl: "ALTER TABLE user ADD COLUMN source TEXT" }
];
var TABLES = [
  // 02.10: неточность в карточке произведения
  `CREATE TABLE IF NOT EXISTS work_issue (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    title TEXT NOT NULL, fields TEXT NOT NULL, note TEXT, context TEXT, at TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS work_issue_work ON work_issue(work_id, at)",
  // 06.10, ТВ-3г: открытия материалов — замер рубрик
  `CREATE TABLE IF NOT EXISTS material_open (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), url TEXT NOT NULL,
    work_id TEXT, platform TEXT, lens TEXT, lens_also TEXT, tier TEXT, place TEXT, shelf TEXT, shelves INTEGER, at TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS material_open_user ON material_open(user_id, at)",
  // 06.10: разметка владельца с телефона — решения по привязкам и рубрикам
  `CREATE TABLE IF NOT EXISTS owner_decision (kind TEXT NOT NULL, item_id TEXT NOT NULL, body TEXT NOT NULL, at TEXT NOT NULL,
    PRIMARY KEY (kind, item_id))`,
  // 06.10 (ТВ-3в): тестеры — видят все полки, но не статистику и не механику; список ведёт админ
  "CREATE TABLE IF NOT EXISTS tester (username TEXT PRIMARY KEY, at TEXT NOT NULL)",
  // 06.10: подписки на разборы — герой или произведение, сводка раз в день (worker/follow.ts)
  `CREATE TABLE IF NOT EXISTS follow (user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL, ref TEXT NOT NULL,
    keys TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (user_id, kind, ref))`,
  // 07.10, ЗП-17: весть «вышел новый сезон» — одна на сезон (worker/seasons.ts)
  `CREATE TABLE IF NOT EXISTS season_notice (user_id TEXT NOT NULL REFERENCES user(id), key TEXT NOT NULL, season INTEGER NOT NULL,
    at TEXT NOT NULL, PRIMARY KEY (user_id, key, season))`,
  `CREATE TABLE IF NOT EXISTS follow_fresh (url TEXT PRIMARY KEY, key TEXT NOT NULL, title TEXT NOT NULL, author TEXT NOT NULL,
    platform TEXT NOT NULL, spoiler INTEGER NOT NULL DEFAULT 0, tier TEXT, lens TEXT, at TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS follow_fresh_at ON follow_fresh(at)",
  "CREATE TABLE IF NOT EXISTS follow_digest (user_id TEXT PRIMARY KEY, at TEXT NOT NULL, day TEXT NOT NULL, blocked INTEGER NOT NULL DEFAULT 0)",
  // 06.10: реестр каналов и разметки — в базе, файлы стали снимками (worker/registry.ts)
  `CREATE TABLE IF NOT EXISTS registry (kind TEXT NOT NULL, id TEXT NOT NULL, body TEXT NOT NULL, ord REAL, at TEXT NOT NULL,
    by TEXT, PRIMARY KEY (kind, id))`,
  `CREATE TABLE IF NOT EXISTS registry_log (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, id TEXT NOT NULL,
    before TEXT, after TEXT, at TEXT NOT NULL, by TEXT)`,
  `CREATE INDEX IF NOT EXISTS registry_log_item ON registry_log(kind, id, seq)`,
  `CREATE INDEX IF NOT EXISTS registry_log_at ON registry_log(at)`,
  `CREATE TABLE IF NOT EXISTS registry_meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS registry_inbox (url TEXT PRIMARY KEY, film TEXT, note TEXT, sheet_at TEXT, taken_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'new', result TEXT, done_at TEXT)`,
  `CREATE INDEX IF NOT EXISTS registry_inbox_status ON registry_inbox(status, taken_at)`,
  // 07.10, ЗП-3: заходы по дням и события карточки — воронка и удержание (worker/funnel.ts)
  "CREATE TABLE IF NOT EXISTS visit (user_id TEXT NOT NULL REFERENCES user(id), day TEXT NOT NULL, PRIMARY KEY (user_id, day))",
  "CREATE INDEX IF NOT EXISTS visit_day ON visit(day)",
  `CREATE TABLE IF NOT EXISTS event (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), kind TEXT NOT NULL,
    work_id TEXT, place TEXT, detail TEXT, at TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS event_kind_at ON event(kind, at)",
  "CREATE INDEX IF NOT EXISTS event_user ON event(user_id, work_id)",
  // 07.10, ЗП-11: выбор компанией — колода сессии и голоса (worker/together.ts); session_id без внешнего ключа:
  // удаление аккаунта создателя стирает сессию вместе с чужими голосами (worker/account.ts)
  "CREATE TABLE IF NOT EXISTS together (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), deck TEXT NOT NULL, created_at TEXT NOT NULL)",
  `CREATE TABLE IF NOT EXISTS together_vote (session_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'no', 'seen')), fit REAL, at TEXT NOT NULL, PRIMARY KEY (session_id, user_id, work_id))`
];
var done;
function forgetMigrations() {
  done = void 0;
}
function migrate(db) {
  done ??= (async () => {
    for (const ddl of TABLES) await db.prepare(ddl).run();
    for (const c of COLUMNS) {
      const info = await db.prepare(`PRAGMA table_info(${c.table})`).all();
      if (!info.results.some((r) => r.name === c.column)) await db.prepare(c.ddl).run();
    }
  })().catch((err) => {
    done = void 0;
    throw err;
  });
  return done;
}

// worker/funnel.ts
var json3 = (body, status = 200) => Response.json(body, { status });
var MSK_MS = 3 * 36e5;
var mskDay = (t = Date.now()) => new Date(t + MSK_MS).toISOString().slice(0, 10);
var addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
var SQL_DAY = (col) => `date(${col}, '+3 hours')`;
var noted = /* @__PURE__ */ new Set();
var notedDay = "";
async function noteVisit(db, userId) {
  const day = mskDay();
  if (day !== notedDay) {
    noted.clear();
    notedDay = day;
  }
  if (noted.has(userId)) return;
  noted.add(userId);
  await db.prepare("INSERT OR IGNORE INTO visit (user_id, day) VALUES (?, ?)").bind(userId, day).run();
}
var KINDS2 = /* @__PURE__ */ new Set(["card", "watch"]);
var eventSeq = 0;
async function postEvent(req, userId, db) {
  const b = await req.json().catch(() => ({}));
  const str2 = (v, n = 64) => typeof v === "string" && v ? v.slice(0, n) : null;
  const kind = str2(b.kind);
  if (!kind || !KINDS2.has(kind)) return json3({ error: "bad_kind" }, 400);
  const id = `e-${Date.now().toString(36)}-${(eventSeq++ % 1e6).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare("INSERT INTO event (id, user_id, kind, work_id, place, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, userId, kind, str2(b.workId, 120), str2(b.place), str2(b.detail, 120), (/* @__PURE__ */ new Date()).toISOString()).run();
  return json3({ ok: true });
}
var THRESHOLDS = {
  activation: 0.6,
  d7: 0.25,
  d30: 0.12,
  acceptedFeeds: 0.3,
  checkins: 0.2,
  watchClicks: 0.08,
  analysisOpens: 0.15
};
var ACCEPT = "('save', 'start')";
var ratio = (a, b) => b > 0 ? a / b : null;
async function getFunnel(req, env, admin) {
  if (!admin) return json3({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const db = env.DB;
  const owner = env.OWNER_USERNAME?.replace(/^@/, "").toLowerCase();
  const conds = [];
  const binds = [];
  if (owner && url.searchParams.get("owner") === "0") {
    conds.push("lower(coalesce(username, '')) <> ?");
    binds.push(owner);
  }
  if (url.searchParams.get("tg") === "1") conds.push("tg_id IS NOT NULL");
  const source = url.searchParams.get("source");
  if (source === "-") conds.push("source IS NULL");
  else if (source) {
    conds.push("source = ?");
    binds.push(source);
  }
  const userWhere = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const inUsers = `user_id IN (SELECT id FROM user ${userWhere})`;
  const q = async (sql, ...bind) => (await db.prepare(sql).bind(...bind).all()).results ?? [];
  const today = mskDay();
  const yesterday = addDays(today, -1);
  const from14 = addDays(today, -14);
  const from30 = addDays(today, -30);
  const from60 = addDays(today, -60);
  const byDay = (sql, ...bind) => q(sql, ...binds, ...bind);
  const [visits, joined, cards, watches, opens, ratings, feeds, accepted, checkins] = await Promise.all([
    byDay(`SELECT day, COUNT(*) AS n FROM visit WHERE ${inUsers} AND day >= ? GROUP BY day`, from14),
    q(`SELECT ${SQL_DAY("created_at")} AS day, COUNT(*) AS n FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ? GROUP BY day`, ...binds, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM event WHERE kind = 'card' AND ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM event WHERE kind = 'watch' AND ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(DISTINCT user_id || '|' || coalesce(work_id, '')) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM rating WHERE ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(DISTINCT slate_id) AS n, COUNT(DISTINCT user_id) AS users FROM impression WHERE ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    // лента принята, если хоть один её фильм отложен или начат
    byDay(`SELECT ${SQL_DAY("i.at")} AS day, COUNT(DISTINCT i.slate_id) AS n, COUNT(DISTINCT i.user_id) AS users FROM impression i
             WHERE i.${inUsers} AND ${SQL_DAY("i.at")} >= ?
               AND EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = i.user_id AND f.rec_id = i.rec_id AND f.action IN ${ACCEPT})
             GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM checkin WHERE ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14)
  ]);
  const accepts = await byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM feedback WHERE action IN ${ACCEPT} AND ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14);
  const pairsWith = (table, extra = "") => byDay(
    `SELECT ${SQL_DAY("c.at")} AS day, COUNT(DISTINCT c.user_id || '|' || c.work_id) AS n FROM event c
       WHERE c.kind = 'card' AND c.work_id IS NOT NULL AND c.${inUsers} AND ${SQL_DAY("c.at")} >= ?
         AND EXISTS (SELECT 1 FROM ${table} x WHERE x.user_id = c.user_id AND x.work_id = c.work_id ${extra} AND ${SQL_DAY("x.at")} = ${SQL_DAY("c.at")})
       GROUP BY day`,
    from14
  );
  const [cardsWithOpen, cardsWithWatch] = await Promise.all([pairsWith("material_open"), pairsWith("event", "AND x.kind = 'watch'")]);
  const days = [];
  for (let d = from14; d <= today; d = addDays(d, 1)) days.push(d);
  const pick = (rows, day2) => rows.find((r) => r.day === day2);
  const daily = days.map((day2) => ({
    day: day2,
    visitors: pick(visits, day2)?.n ?? 0,
    joined: pick(joined, day2)?.n ?? 0,
    cards: pick(cards, day2)?.n ?? 0,
    watch: pick(watches, day2)?.n ?? 0,
    opens: pick(opens, day2)?.n ?? 0,
    ratings: pick(ratings, day2)?.n ?? 0,
    feeds: pick(feeds, day2)?.n ?? 0,
    acceptedFeeds: pick(accepted, day2)?.n ?? 0,
    accepts: pick(accepts, day2)?.n ?? 0,
    checkins: pick(checkins, day2)?.n ?? 0,
    cardsWithOpen: pick(cardsWithOpen, day2)?.n ?? 0,
    cardsWithWatch: pick(cardsWithWatch, day2)?.n ?? 0
  }));
  const [funnelRow] = await q(
    `WITH u AS (SELECT id, created_at, ${SQL_DAY("created_at")} AS d FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?)
     SELECT COUNT(*) AS joined,
       SUM(CASE WHEN (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
                   + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
                THEN 1 ELSE 0 END) AS activated,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = u.id AND f.action IN ${ACCEPT})
                  OR EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id) THEN 1 ELSE 0 END) AS accepted,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM journal j WHERE j.user_id = u.id AND j.status = 'finished')
                  OR EXISTS (SELECT 1 FROM checkin c WHERE c.user_id = u.id AND c.status = 'finished') THEN 1 ELSE 0 END) AS watched,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day > u.d) THEN 1 ELSE 0 END) AS returned
     FROM u`,
    ...binds,
    from30
  );
  const funnel = {
    since: from30,
    joined: funnelRow?.joined ?? 0,
    activated: funnelRow?.activated ?? 0,
    accepted: funnelRow?.accepted ?? 0,
    watched: funnelRow?.watched ?? 0,
    returned: funnelRow?.returned ?? 0
  };
  const cohortRows = await q(
    `WITH u AS (SELECT id, ${SQL_DAY("created_at")} AS d FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?)
     SELECT d, COUNT(*) AS joined,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+1 day'))) AS d1,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+7 day'))) AS d7,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day = date(u.d, '+30 day'))) AS d30,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+1 day'))) AS d1p,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+7 day'))) AS d7p,
       SUM(EXISTS (SELECT 1 FROM visit v WHERE v.user_id = u.id AND v.day >= date(u.d, '+30 day'))) AS d30p
     FROM u GROUP BY d ORDER BY d`,
    ...binds,
    from60
  );
  const retention = [1, 7, 30].map((k) => {
    const done2 = cohortRows.filter((c) => addDays(c.d, k) <= yesterday);
    const base = done2.reduce((a, c) => a + c.joined, 0);
    const exact = done2.reduce((a, c) => a + Number(c[`d${k}`]), 0);
    const later = done2.reduce((a, c) => a + Number(c[`d${k}p`]), 0);
    return { k, cohorts: done2.length, users: base, exact, later, exactShare: ratio(exact, base), laterShare: ratio(later, base) };
  });
  const sum = (from, to) => {
    const rows = daily.filter((d) => d.day >= from && d.day <= to);
    const s = (k) => rows.reduce((a, r) => a + Number(r[k]), 0);
    return {
      from,
      to,
      visitors: s("visitors"),
      joined: s("joined"),
      cards: s("cards"),
      feeds: s("feeds"),
      accepts: s("accepts"),
      acceptedFeeds: ratio(s("acceptedFeeds"), s("feeds")),
      checkins: ratio(s("checkins"), s("accepts")),
      watchClicks: ratio(s("cardsWithWatch"), s("cards")),
      analysisOpens: ratio(s("cardsWithOpen"), s("cards"))
    };
  };
  const activationIn = async (from, to) => {
    const [r] = await q(
      `WITH u AS (SELECT id, created_at FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} BETWEEN ? AND ?)
       SELECT COUNT(*) AS joined, SUM(CASE WHEN
         (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
         + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
         THEN 1 ELSE 0 END) AS activated FROM u`,
      ...binds,
      from,
      to
    );
    return ratio(r?.activated ?? 0, r?.joined ?? 0);
  };
  const week = { ...sum(addDays(today, -7), yesterday), activation: await activationIn(addDays(today, -7), yesterday) };
  const day = { ...sum(yesterday, yesterday), activation: await activationIn(yesterday, yesterday) };
  const sources = await q(
    `WITH u AS (SELECT id, created_at, source, invited_by FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?)
     SELECT source, COUNT(*) AS joined, SUM(CASE WHEN invited_by IS NOT NULL THEN 1 ELSE 0 END) AS invited, SUM(CASE WHEN
       (SELECT COUNT(*) FROM rating r WHERE r.user_id = u.id AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))
       + (SELECT COUNT(*) FROM watched w WHERE w.user_id = u.id AND w.state = 'watched' AND w.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day')) >= 10
       THEN 1 ELSE 0 END) AS activated FROM u GROUP BY source ORDER BY joined DESC`,
    ...binds,
    from30
  );
  return json3({
    at: (/* @__PURE__ */ new Date()).toISOString(),
    today,
    filters: { withoutOwner: url.searchParams.get("owner") === "0", telegramOnly: url.searchParams.get("tg") === "1", ...source ? { source } : {} },
    thresholds: THRESHOLDS,
    yesterday: day,
    week,
    retention,
    funnel,
    daily,
    sources: sources.map((r) => ({ source: r.source ?? "\u2014", joined: r.joined, invitedByFriend: r.invited, activation: ratio(r.activated ?? 0, r.joined) }))
  });
}

// worker/account.ts
var json4 = (body, status = 200) => Response.json(body, { status });
async function userTables(db) {
  const tables = (await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all()).results ?? [];
  const out = [];
  for (const { name } of tables) {
    if (name === "user" || !/^[a-z_]+$/.test(name)) continue;
    const cols = (await db.prepare(`PRAGMA table_info(${name})`).all()).results ?? [];
    if (cols.some((c) => c.name === "user_id")) out.push(name);
  }
  return out;
}
async function deleteAccount(userId, env) {
  const db = env.DB;
  const me = await db.prepare("SELECT username FROM user WHERE id = ?").bind(userId).first();
  if (!me) return json4({ error: "not_found" }, 404);
  const tables = await userTables(db);
  const counts = {};
  for (const t of tables) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(userId).first();
    if (row?.n) counts[t] = Number(row.n);
  }
  await db.batch([
    // выбор компанией (ЗП-11): сессии участника уходят вместе с чужими голосами в них
    ...tables.includes("together") ? [db.prepare("DELETE FROM together_vote WHERE session_id IN (SELECT id FROM together WHERE user_id = ?)").bind(userId)] : [],
    ...tables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    ...me.username ? [db.prepare("DELETE FROM tester WHERE username = ?").bind(me.username.replace(/^@/, "").toLowerCase())] : [],
    // кого участник привёл (ЗП-37) — у них ссылка на него стирается
    db.prepare("UPDATE user SET invited_by = NULL WHERE invited_by = ?").bind(userId),
    db.prepare("DELETE FROM user WHERE id = ?").bind(userId)
  ]);
  console.log(`\u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0434\u0430\u043B\u0451\u043D \u043F\u043E \u043F\u0440\u043E\u0441\u044C\u0431\u0435 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ") || "\u0431\u0435\u0437 \u0437\u0430\u043F\u0438\u0441\u0435\u0439"}`);
  return json4({ ok: true, deleted: counts });
}

// worker/together.ts
var json5 = (body, status = 200) => Response.json(body, { status });
var DECK_MIN = 4;
var DECK_MAX = 12;
var VOTE_DAYS = 7;
var VOTES = /* @__PURE__ */ new Set(["yes", "no", "seen"]);
var str = (v, n) => typeof v === "string" && v.trim() ? v.trim().slice(0, n) : void 0;
var https = (v, n = 500) => {
  const s = str(v, n);
  return s && /^https:\/\/[^\s"'<>]+$/.test(s) ? s : void 0;
};
function cleanCard(c) {
  if (!c || typeof c !== "object") return void 0;
  const o = c;
  const id = str(o.id, 120);
  const title = str(o.title, 120);
  if (!id || !title) return void 0;
  const watch = Array.isArray(o.watch) ? o.watch.slice(0, 3).flatMap((w) => {
    const x = w;
    const platform = str(x?.platform, 40);
    const url = https(x?.url);
    const source = x?.source === "tmdb" ? "tmdb" : x?.source === "kinopoisk_unofficial" ? "kinopoisk_unofficial" : void 0;
    return platform && url ? [{ platform, url, ...source ? { source } : {} }] : [];
  }) : [];
  return {
    id,
    title,
    ...typeof o.year === "number" && o.year > 1800 && o.year < 2100 ? { year: Math.round(o.year) } : {},
    ...https(o.image) ? { image: https(o.image) } : {},
    ...str(o.about, 300) ? { about: str(o.about, 300) } : {},
    ...typeof o.essays === "number" && o.essays >= 0 ? { essays: Math.min(99, Math.round(o.essays)) } : {},
    ...o.kind === "series" ? { kind: "series" } : {},
    ...watch.length ? { watch } : {}
  };
}
var newSessionId = () => {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 12);
};
async function createTogether(req, userId, db) {
  const b = await req.json().catch(() => ({}));
  const seen = /* @__PURE__ */ new Set();
  const deck = (Array.isArray(b.deck) ? b.deck : []).map(cleanCard).filter((c) => Boolean(c && !seen.has(c.id) && seen.add(c.id))).slice(0, DECK_MAX);
  if (deck.length < DECK_MIN) return json5({ error: "small_deck", min: DECK_MIN }, 400);
  const id = newSessionId();
  await db.prepare("INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)").bind(id, userId, JSON.stringify(deck), (/* @__PURE__ */ new Date()).toISOString()).run();
  return json5({ id });
}
async function load(db, id) {
  const s = await db.prepare("SELECT id, user_id, deck, created_at FROM together WHERE id = ?").bind(id).first();
  if (!s) return void 0;
  const votes = (await db.prepare(
    `SELECT v.user_id, v.work_id, v.vote, v.fit, u.first_name AS name, u.username FROM together_vote v
       LEFT JOIN user u ON u.id = v.user_id WHERE v.session_id = ?`
  ).bind(id).all()).results ?? [];
  return { s, deck: JSON.parse(s.deck), votes };
}
var open = (s) => Date.now() - Date.parse(s.created_at) < VOTE_DAYS * 864e5;
function tally(deck, votes, me) {
  const people = /* @__PURE__ */ new Map();
  for (const v of votes) {
    const p = people.get(v.user_id) ?? { name: v.name || (v.username ? `@${v.username}` : "\u0413\u043E\u0441\u0442\u044C"), n: 0, me: v.user_id === me };
    p.n += 1;
    people.set(v.user_id, p);
  }
  const taken = /* @__PURE__ */ new Map();
  for (const p of people.values()) {
    const n = (taken.get(p.name) ?? 0) + 1;
    taken.set(p.name, n);
    if (n > 1) p.name = `${p.name} ${n}`;
  }
  const rows = deck.map((c) => {
    const vs = votes.filter((v) => v.work_id === c.id);
    const names = (vote) => vs.filter((v) => v.vote === vote).map((v) => v.user_id === me ? "\u0432\u044B" : people.get(v.user_id).name);
    const fits = vs.map((v) => v.fit).filter((f) => typeof f === "number");
    const yes = names("yes");
    const no = names("no");
    return {
      workId: c.id,
      yes: yes.length,
      no: no.length,
      seen: names("seen").length,
      yesNames: yes,
      seenNames: names("seen"),
      fit: fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : null,
      // совпадение: все, кто голосовал по фильму, хотят, и их хотя бы двое
      match: yes.length >= 2 && yes.length === vs.length
    };
  });
  const order = [...rows].sort((a, b) => Number(b.match) - Number(a.match) || b.yes - a.yes || a.no - b.no || (b.fit ?? 0) - (a.fit ?? 0));
  return { people: [...people.values()], rows: order };
}
async function getTogether(id, userId, db) {
  const got = await load(db, id);
  if (!got) return json5({ error: "not_found" }, 404);
  const { s, deck, votes } = got;
  const owner = await db.prepare("SELECT first_name, username FROM user WHERE id = ?").bind(s.user_id).first();
  const mine = Object.fromEntries(votes.filter((v) => v.user_id === userId).map((v) => [v.work_id, v.vote]));
  const t = tally(deck, votes, userId);
  if (!t.people.some((p) => p.me) && s.user_id === userId) t.people.unshift({ name: owner?.first_name || "\u0412\u044B", n: 0, me: true });
  return json5({
    id: s.id,
    createdAt: s.created_at,
    open: open(s),
    mineSession: s.user_id === userId,
    owner: owner?.first_name || (owner?.username ? `@${owner.username}` : null),
    deck,
    votes: mine,
    people: t.people,
    tally: t.rows
  });
}
async function voteTogether(req, id, userId, db) {
  const s = await db.prepare("SELECT id, user_id, deck, created_at FROM together WHERE id = ?").bind(id).first();
  if (!s) return json5({ error: "not_found" }, 404);
  if (!open(s)) return json5({ error: "closed" }, 409);
  const b = await req.json().catch(() => ({}));
  const workId = str(b.workId, 120);
  const vote = str(b.vote, 8);
  if (!workId || !vote || !VOTES.has(vote)) return json5({ error: "bad_vote" }, 400);
  if (!JSON.parse(s.deck).some((c) => c.id === workId)) return json5({ error: "not_in_deck" }, 400);
  const fit = typeof b.fit === "number" && Number.isFinite(b.fit) ? Math.max(0, Math.min(1, b.fit)) : null;
  await db.prepare(
    `INSERT INTO together_vote (session_id, user_id, work_id, vote, fit, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, user_id, work_id) DO UPDATE SET vote = excluded.vote, fit = excluded.fit, at = excluded.at`
  ).bind(id, userId, workId, vote, fit, (/* @__PURE__ */ new Date()).toISOString()).run();
  return json5({ ok: true });
}
async function togetherRoute(req, path, userId, env) {
  if (path === "/api/together" && req.method === "POST") return createTogether(req, userId, env.DB);
  const m = /^\/api\/together\/([a-z0-9]{6,16})(\/vote)?$/.exec(path);
  if (!m) return void 0;
  if (!m[2] && req.method === "GET") return getTogether(m[1], userId, env.DB);
  if (m[2] && req.method === "PUT") return voteTogether(req, m[1], userId, env.DB);
  return void 0;
}

// worker/loop.ts
var DIFFICULTIES = ["too_easy", "just_right", "too_hard"];
var HONEST_THRESHOLD = 30;
var isDiff = (x) => typeof x === "string" && DIFFICULTIES.includes(x);
var oneHot = (d) => ({ too_easy: d === "too_easy" ? 1 : 0, just_right: d === "just_right" ? 1 : 0, too_hard: d === "too_hard" ? 1 : 0 });
var brier = (p, fact) => DIFFICULTIES.reduce((s, d) => s + (p[d] - (d === fact ? 1 : 0)) ** 2, 0);
var round = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;
var median = (xs) => {
  if (!xs.length) return void 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
var emptyMatrix = () => Object.fromEntries(DIFFICULTIES.map((a) => [a, Object.fromEntries(DIFFICULTIES.map((b) => [b, 0]))]));
function loopReport(rows, now2 = /* @__PURE__ */ new Date()) {
  const lastCheck = /* @__PURE__ */ new Map();
  for (const c of [...rows.checkins].sort((a, b) => a.at.localeCompare(b.at))) lastCheck.set(`${c.user_id}|${c.entry_id}`, c);
  const started = new Map(rows.journal.map((j) => [`${j.user_id}|${j.entry_id}`, j.started_at]));
  const obs = [];
  for (const p of rows.predictions) {
    const c = lastCheck.get(`${p.user_id}|${p.entry_id}`);
    if (!c || !isDiff(c.perceived)) continue;
    let modelOdds;
    try {
      const o = p.model_p ? JSON.parse(p.model_p) : void 0;
      if (o && DIFFICULTIES.every((d) => typeof o[d] === "number")) modelOdds = o;
    } catch {
    }
    obs.push({ work: p.work_id, human: isDiff(p.expected) ? p.expected : void 0, model: isDiff(p.model) ? p.model : void 0, modelOdds, fact: c.perceived });
  }
  const facts = Object.fromEntries(DIFFICULTIES.map((d) => [d, obs.filter((o) => o.fact === d).length]));
  const baseOdds = Object.fromEntries(DIFFICULTIES.map((d) => [d, obs.length ? facts[d] / obs.length : 1 / 3]));
  const score = (pick) => {
    const xs = obs.map((o) => ({ o, p: pick(o) })).filter((x) => Boolean(x.p));
    if (!xs.length) return void 0;
    return {
      n: xs.length,
      brier: round(xs.reduce((s, x) => s + brier(x.p.odds, x.o.fact), 0) / xs.length),
      exact: round(xs.filter((x) => x.p.point === x.o.fact).length / xs.length)
    };
  };
  const top = (o) => DIFFICULTIES.reduce((a, b) => o[b] > o[a] ? b : a);
  const confusion = { human: emptyMatrix(), model: emptyMatrix() };
  for (const o of obs) {
    if (o.human) confusion.human[o.human][o.fact]++;
    if (o.model) confusion.model[o.model][o.fact]++;
  }
  const both = obs.filter((o) => o.human && o.model);
  const abandons = [...lastCheck.values()].filter((c) => c.status === "abandoned");
  const reasons = {};
  const days = [];
  for (const c of abandons) {
    reasons[c.reason ?? "no_reason"] = (reasons[c.reason ?? "no_reason"] ?? 0) + 1;
    const s = started.get(`${c.user_id}|${c.entry_id}`);
    if (s) days.push((Date.parse(c.at) - Date.parse(s)) / 864e5);
  }
  const dismiss = {};
  for (const f of rows.feedback.filter((f2) => f2.action === "dismiss")) dismiss[f.reason ?? "no_reason"] = (dismiss[f.reason ?? "no_reason"] ?? 0) + 1;
  const shownRecs = new Set(rows.impressions.map((i) => `${i.user_id}|${i.rec_id}`));
  const actOnShown = (a) => new Set(rows.feedback.filter((f) => f.action === a && f.rec_id && shownRecs.has(`${f.user_id}|${f.rec_id}`)).map((f) => `${f.user_id}|${f.rec_id}`)).size;
  const start = actOnShown("start");
  const uniqueShown = shownRecs.size;
  const plans = {};
  const want = /* @__PURE__ */ new Map();
  for (const f of [...rows.feedback].filter((f2) => f2.action === "save" && f2.work_id).sort((a, b) => a.at.localeCompare(b.at))) {
    want.set(`${f.user_id}|${f.work_id}`, f.eagerness ?? 0);
  }
  for (const j of rows.journal) if (j.work_id && j.status === "planned" && !want.has(`${j.user_id}|${j.work_id}`)) want.set(`${j.user_id}|${j.work_id}`, j.eagerness ?? 0);
  const begun = new Set(rows.journal.filter((j) => j.work_id && j.status && j.status !== "planned").map((j) => `${j.user_id}|${j.work_id}`));
  const done2 = new Set(rows.checkins.filter((c) => c.status === "finished").map((c) => `${c.user_id}|${c.work_id}`));
  for (const [key, level] of want) {
    const row = plans[String(level)] ??= { saved: 0, started: 0, finished: 0 };
    row.saved += 1;
    if (begun.has(key) || done2.has(key)) row.started += 1;
    if (done2.has(key)) row.finished += 1;
  }
  const byWork = {};
  const sig = (w) => byWork[w] ??= { checks: 0, modelMiss: 0, harder: 0, easier: 0, abandonFit: 0, abandon: 0, dismissFit: 0, score: 0 };
  const rank = (d) => DIFFICULTIES.indexOf(d);
  for (const o of obs) {
    const s = sig(o.work);
    s.checks += 1;
    const point = o.modelOdds ? top(o.modelOdds) : o.model;
    if (point && point !== o.fact) {
      s.modelMiss += 1;
      if (rank(o.fact) > rank(point)) s.harder += 1;
      else s.easier += 1;
    }
  }
  for (const c of abandons) {
    const s = sig(c.work_id);
    s.abandon += 1;
    if (c.reason === "too_hard" || c.reason === "not_engaging") s.abandonFit += 1;
  }
  for (const f of rows.feedback) {
    if (f.action === "dismiss" && f.work_id && (f.reason === "too_heavy_now" || f.reason === "not_interested")) sig(f.work_id).dismissFit += 1;
  }
  for (const s of Object.values(byWork)) s.score = 2 * s.modelMiss + 2 * s.abandonFit + 0.5 * s.dismissFit;
  const honest = obs.length >= HONEST_THRESHOLD;
  return {
    generatedAt: now2.toISOString(),
    users: new Set([...rows.predictions, ...rows.checkins, ...rows.impressions].map((r) => r.user_id)).size,
    observations: obs.length,
    honest,
    note: honest ? `\u041D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0439 ${obs.length} \u2014 \u043C\u043E\u0436\u043D\u043E \u0441\u0440\u0430\u0432\u043D\u0438\u0432\u0430\u0442\u044C \u043C\u043E\u0434\u0435\u043B\u044C \u0441 \u0431\u0430\u0437\u043E\u0432\u044B\u043C\u0438 \u0441\u0442\u0440\u0430\u0442\u0435\u0433\u0438\u044F\u043C\u0438 \u0438 \u043F\u043E\u0434\u0433\u043E\u043D\u044F\u0442\u044C \u0432\u0435\u0441\u0430 (\u04115).` : `\u041D\u0430\u0431\u043B\u044E\u0434\u0435\u043D\u0438\u0439 ${obs.length} \u0438\u0437 ${HONEST_THRESHOLD}: \u0432\u0435\u0441\u0430 \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u043C, \u0442\u043E\u043B\u044C\u043A\u043E \u043A\u043E\u043F\u0438\u043C. \u0426\u0438\u0444\u0440\u044B \u043D\u0438\u0436\u0435 \u2014 \u0434\u043B\u044F \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438, \u0447\u0442\u043E \u043F\u0435\u0442\u043B\u044F \u043F\u0438\u0448\u0435\u0442\u0441\u044F, \u0430 \u043D\u0435 \u0434\u043B\u044F \u0432\u044B\u0432\u043E\u0434\u043E\u0432.`,
    calibration: {
      human: score((o) => o.human ? { odds: oneHot(o.human), point: o.human } : void 0),
      model: score((o) => o.modelOdds ? { odds: o.modelOdds, point: top(o.modelOdds) } : o.model ? { odds: oneHot(o.model), point: o.model } : void 0),
      alwaysJustRight: score(() => ({ odds: oneHot("just_right"), point: "just_right" })),
      baseRate: score(() => ({ odds: baseOdds, point: top(baseOdds) }))
    },
    facts,
    confusion,
    agreement: { humanModel: both.length ? round(both.filter((o) => o.human === o.model).length / both.length) : void 0, n: both.length },
    abandon: {
      n: abandons.length,
      reasons,
      medianDays: days.length ? round(median(days), 1) : void 0,
      fit: abandons.filter((c) => c.reason === "too_hard" || c.reason === "not_engaging").length,
      circumstances: abandons.filter((c) => c.reason !== "too_hard" && c.reason !== "not_engaging").length
    },
    notWatched: {
      answered: rows.checkins.filter((c) => c.status === "not_watched").length,
      expired: rows.checkins.filter((c) => c.status === "expired").length
    },
    dismiss,
    slate: {
      impressions: uniqueShown,
      slates: new Set(rows.impressions.map((i) => `${i.user_id}|${i.slate_id}`)).size,
      start,
      save: actOnShown("save"),
      dismiss: actOnShown("dismiss"),
      acceptance: uniqueShown ? round(start / uniqueShown) : void 0
    },
    plans,
    byWork
  };
}
async function loopRows(db, userId) {
  const where = userId ? " WHERE user_id = ?" : "";
  const q = (sql) => (userId ? db.prepare(sql + where).bind(userId) : db.prepare(sql + where)).all().then((r) => r.results);
  const [predictions, checkins, journal, feedback, impressions] = await Promise.all([
    q("SELECT user_id, entry_id, work_id, expected, model, model_p, at FROM prediction"),
    q("SELECT user_id, entry_id, work_id, status, perceived, reason, at FROM checkin"),
    q("SELECT user_id, entry_id, started_at, work_id, status, eagerness FROM journal"),
    q("SELECT user_id, rec_id, work_id, action, reason, at, eagerness FROM feedback"),
    q("SELECT user_id, slate_id, rec_id, work_id, slot, rank, at FROM impression")
  ]);
  return { predictions, checkins, journal, feedback, impressions };
}

// worker/index.ts
var JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
var json6 = (data2, status = 200, extra = {}) => new Response(JSON.stringify(data2), { status, headers: { ...JSON_HEADERS, ...extra } });
var now = () => (/* @__PURE__ */ new Date()).toISOString();
function cors(req, env) {
  const origin2 = req.headers.get("Origin");
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!origin2 || !allowed.includes(origin2)) return {};
  return {
    "access-control-allow-origin": origin2,
    "access-control-allow-headers": "content-type, authorization",
    "access-control-allow-methods": "GET, PUT, POST, DELETE, OPTIONS",
    "access-control-max-age": "86400",
    vary: "Origin"
  };
}
async function whoIs(req, db) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!token) return void 0;
  const row = await db.prepare(
    `SELECT user.id AS id, user.settings AS settings, session.expires_at AS expires_at
       FROM session JOIN user ON user.id = session.user_id WHERE session.token = ?`
  ).bind(token).first();
  if (!row) return void 0;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare("DELETE FROM session WHERE token = ?").bind(token).run();
    return void 0;
  }
  return { id: row.id, settings: row.settings };
}
var SESSION_DAYS = 90;
async function openSession(db, userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await db.prepare("INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(token, userId, now(), expiresAt).run();
  return { token, expiresAt };
}
async function postSession(req, env) {
  const body = await req.json().catch(() => ({}));
  const db = env.DB;
  if (body.initData) {
    if (!env.BOT_TOKEN) return json6({ error: "server_not_configured" }, 500);
    const check = await verifyInitData(body.initData, env.BOT_TOKEN);
    if (!check.ok || !check.user) return json6({ error: "bad_init_data", reason: check.reason }, 401);
    const tg = check.user;
    const found = await db.prepare("SELECT id FROM user WHERE tg_id = ?").bind(tg.id).first();
    const id = found?.id ?? newId("u");
    if (found) {
      await db.prepare("UPDATE user SET seen_at = ?, username = ?, first_name = ? WHERE id = ?").bind(now(), tg.username ?? null, tg.first_name ?? null, id).run();
    } else {
      await db.prepare("INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, tg.id, tg.username ?? null, tg.first_name ?? null, now(), now()).run();
      await noteInvite(db, id, check.startParam);
    }
    const owner = isOwner(env, tg.username);
    if (owner && env.OWNER_SEED) await seedOwner(db, id, env.OWNER_SEED);
    const session = await openSession(db, id);
    return json6({ ...session, user: { id, username: tg.username, firstName: tg.first_name, telegram: true, owner } });
  }
  if (body.demo) {
    if (env.ALLOW_DEMO !== "1") return json6({ error: "demo_disabled" }, 403);
    const id = newId("u-anon");
    await db.prepare("INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, NULL, NULL, ?, ?, ?)").bind(id, "\u0413\u043E\u0441\u0442\u044C", now(), now()).run();
    const session = await openSession(db, id);
    return json6({ ...session, user: { id, firstName: "\u0413\u043E\u0441\u0442\u044C", telegram: false } });
  }
  return json6({ error: "no_credentials" }, 400);
}
var isOwner = (env, username) => Boolean(username && env.OWNER_USERNAME && username.toLowerCase() === env.OWNER_USERNAME.replace(/^@/, "").toLowerCase());
var nick = (s) => s.trim().replace(/^@/, "").toLowerCase();
async function roleOf(env, username) {
  if (!username) return "user";
  if (isOwner(env, username)) return "admin";
  const t = await env.DB.prepare("SELECT 1 AS x FROM tester WHERE username = ?").bind(nick(username)).first();
  return t ? "tester" : "user";
}
async function seedOwner(db, userId, seed) {
  const has = await db.prepare(
    "SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1) + (SELECT COUNT(*) FROM rating WHERE user_id = ?1) + (SELECT COUNT(*) FROM watched WHERE user_id = ?1) AS n"
  ).bind(userId).first();
  if (has && has.n > 0) return;
  const at = now();
  const statements = [
    ...seed.journal.map((e) => db.prepare(
      "INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, e.entryId, e.workId, JSON.stringify(e.work), e.status, e.startedAt ?? null, e.finishedAt ?? null)),
    ...seed.ratings.map((r) => db.prepare(
      "INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, at) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, r.workId, r.rating, r.raw ?? null, at)),
    // порядок присланного списка сохраняем временем отметки: первое в списке — самое свежее
    ...seed.watched.map((w, i) => db.prepare(
      "INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, ?, ?, ?)"
    ).bind(userId, w.workId, JSON.stringify(w.work), w.tmdb ?? null, w.imdb ?? null, new Date(Date.parse(at) - i * 1e3).toISOString()))
  ];
  if (statements.length) await db.batch(statements);
}
var seedKey = (username) => /^[A-Za-z0-9_]{3,40}$/.test(username) ? `seed--${username.toLowerCase()}.json` : void 0;
async function applyUserSeed(db, env, userId) {
  if (!env.REFERENCE) return;
  const row = await db.prepare("SELECT username FROM user WHERE id = ?").bind(userId).first();
  const key = row?.username ? seedKey(row.username) : void 0;
  if (!key) return;
  const object = await env.REFERENCE.get(key);
  if (!object) return;
  const seed = JSON.parse(await new Response(object.body).text());
  const mark = `user:${seed.version}`;
  const done2 = await db.prepare("SELECT 1 AS x FROM seed_applied WHERE user_id = ? AND seed = ?").bind(userId, mark).first();
  if (done2) return;
  const at = Date.parse(now());
  const stamp = (i) => new Date(at - (i + 1) * 1e3).toISOString();
  await db.batch([
    ...seed.watched.map((w, i) => db.prepare(
      "INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, ?, ?, ?)"
    ).bind(userId, w.workId, JSON.stringify(w.work), w.tmdb ?? null, w.imdb ?? null, stamp(i))),
    ...(seed.ratings ?? []).map((r) => db.prepare(
      "INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, r.workId, r.rating, r.raw ?? null, r.work ? JSON.stringify(r.work) : null, new Date(at).toISOString())),
    db.prepare("INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)").bind(userId, mark, now())
  ]);
}
async function putUserSeed(req, env, username) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json6({ error: "unauthorized" }, 401);
  const key = seedKey(username);
  if (!key) return json6({ error: "bad_username" }, 400);
  if (!env.REFERENCE) return json6({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  let seed;
  try {
    seed = JSON.parse(text);
  } catch {
    return json6({ error: "bad_json" }, 400);
  }
  if (!seed.version || !Array.isArray(seed.watched)) return json6({ error: "bad_seed" }, 400);
  await env.REFERENCE.put(key, text);
  const known = await env.DB.prepare("SELECT 1 AS x FROM user WHERE lower(username) = ?").bind(username.toLowerCase()).first();
  return json6({ ok: true, username, watched: seed.watched.length, ratings: seed.ratings?.length ?? 0, known: Boolean(known) });
}
async function putRating(req, user, db, workId) {
  const body = await req.json().catch(() => ({}));
  if (body.rating == null) {
    await db.prepare("DELETE FROM rating WHERE user_id = ? AND work_id = ?").bind(user.id, workId).run();
    return json6({ ok: true });
  }
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return json6({ error: "bad_rating" }, 400);
  await db.prepare(
    `INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET rating = excluded.rating, raw = excluded.raw, work = COALESCE(excluded.work, rating.work), at = excluded.at`
  ).bind(user.id, workId, rating, body.raw ?? null, body.work ? JSON.stringify(body.work) : null, now()).run();
  return json6({ ok: true });
}
async function postImpressions(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const items = (body.items ?? []).filter((i) => i.recId && i.workId).slice(0, 20);
  if (!body.slateId || !items.length) return json6({ error: "no_items" }, 400);
  const at = now();
  await db.batch(items.map((i) => db.prepare(
    "INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, slot, rank, energy, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(newId("i"), user.id, body.slateId, i.recId, i.workId, i.slot ?? null, i.rank ?? null, body.energy ?? null, at)));
  return json6({ ok: true, n: items.length });
}
async function postOpen(req, user, db) {
  const b = await req.json().catch(() => ({}));
  const str2 = (v, n = 64) => typeof v === "string" && v ? v.slice(0, n) : null;
  const url = str2(b.url, 500);
  if (!url) return json6({ error: "no_url" }, 400);
  await db.prepare(
    "INSERT INTO material_open (id, user_id, url, work_id, platform, lens, lens_also, tier, place, shelf, shelves, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    newId("o"),
    user.id,
    url,
    str2(b.workId, 120),
    str2(b.platform),
    str2(b.lens),
    str2(b.lensAlso),
    str2(b.tier),
    str2(b.place),
    str2(b.shelf),
    b.shelves ? 1 : 0,
    now()
  ).run();
  return json6({ ok: true });
}
async function getLoopReport(url, user, env) {
  if (!await ownerOnly(user, env)) return json6({ error: "owner_only" }, 403);
  const all = url.searchParams.get("scope") !== "me";
  return json6({ scope: all ? "all" : "me", ...loopReport(await loopRows(env.DB, all ? void 0 : user.id)) });
}
async function getState(user, db, env) {
  await applyUserSeed(db, env, user.id).catch((err) => console.error("seed", user.id, err));
  const [watched, journal, predictions, verdicts, ratings, profile] = await Promise.all([
    db.prepare("SELECT work_id, state, work FROM watched WHERE user_id = ? ORDER BY at DESC").bind(user.id).all(),
    db.prepare("SELECT entry_id, work_id, work, status, progress, started_at, finished_at, eagerness, inferred, series FROM journal WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT entry_id, work_id, expected, model, model_p, at FROM prediction WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT url, verdict FROM link_verdict WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT work_id, rating, raw, work, at FROM rating WHERE user_id = ? ORDER BY at").bind(user.id).all(),
    db.prepare("SELECT username, first_name, tg_id FROM user WHERE id = ?").bind(user.id).first()
  ]);
  const parse = (raw) => typeof raw === "string" ? JSON.parse(raw) : void 0;
  return json6({
    settings: parse(user.settings) ?? {},
    watched: watched.results.map((r) => ({ workId: r.work_id, watched: r.state === "watched", work: parse(r.work) })),
    journal: journal.results.map((r) => ({ ...r, work: parse(r.work), series: parse(r.series) })),
    predictions: predictions.results,
    verdicts: verdicts.results,
    ratings: ratings.results.map((r) => ({ workId: r.work_id, rating: r.rating, ...r.raw != null ? { raw: r.raw } : {}, work: parse(r.work), at: r.at })),
    profile: {
      username: profile?.username ?? void 0,
      firstName: profile?.first_name ?? void 0,
      telegram: profile?.tg_id != null,
      owner: isOwner(env, profile?.username ?? void 0),
      role: await roleOf(env, profile?.username)
    }
  });
}
async function putSettings(req, user, db) {
  const patch = await req.json().catch(() => ({}));
  const current = JSON.parse(user.settings || "{}");
  const merged = { ...current, ...patch };
  await db.prepare("UPDATE user SET settings = ?, seen_at = ? WHERE id = ?").bind(JSON.stringify(merged), now(), user.id).run();
  return json6(merged);
}
async function putWatched(req, user, db, workId) {
  const body = await req.json().catch(() => ({}));
  await db.prepare(
    `INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET state = excluded.state, work = COALESCE(excluded.work, watched.work), at = excluded.at`
  ).bind(
    user.id,
    workId,
    body.watched === false ? "removed" : "watched",
    body.work ? JSON.stringify(body.work) : null,
    body.tmdb ?? null,
    body.imdb ?? null,
    now()
  ).run();
  return json6({ ok: true });
}
async function postStart(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.workId) return json6({ error: "no_work" }, 400);
  const entryId = body.entryId ?? newId("j");
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, inferred) VALUES (?, ?, ?, ?, 'in_progress', ?, ?)
     ON CONFLICT (user_id, entry_id) DO UPDATE SET status = 'in_progress', started_at = excluded.started_at, inferred = excluded.inferred`
  ).bind(user.id, entryId, body.workId, body.work ? JSON.stringify(body.work) : null, body.startedAt ?? now(), body.inferred ? 1 : null).run();
  if (body.expected || body.model) {
    await db.prepare(
      `INSERT INTO prediction (user_id, entry_id, work_id, expected, model, model_p, at) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT (user_id, entry_id) DO UPDATE SET expected = excluded.expected, model = excluded.model, model_p = excluded.model_p`
    ).bind(
      user.id,
      entryId,
      body.workId,
      body.expected ?? null,
      body.model ?? null,
      body.modelOdds ? JSON.stringify(body.modelOdds) : null,
      now()
    ).run();
  }
  return json6({ entryId });
}
async function postPlan(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.workId) return json6({ error: "no_work" }, 400);
  const entryId = body.entryId ?? newId("j");
  const eager = Number.isInteger(body.eagerness) && body.eagerness >= 1 && body.eagerness <= 5 ? body.eagerness : null;
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)
     ON CONFLICT (user_id, entry_id) DO NOTHING`
  ).bind(user.id, entryId, body.workId, body.work ? JSON.stringify(body.work) : null, now(), eager).run();
  return json6({ entryId });
}
async function postUnstart(req, user, db, entryId) {
  const body = await req.json().catch(() => ({}));
  const reason = body.reason === "expired" || body.reason === "undo" ? body.reason : "not_watched";
  const row = await db.prepare("SELECT work_id, status FROM journal WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).first();
  if (!row || row.status !== "in_progress") return json6({ ok: true, changed: false });
  await db.prepare("UPDATE journal SET status = 'planned', inferred = NULL WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).run();
  if (reason !== "undo") {
    await db.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)").bind(newId("c"), user.id, entryId, row.work_id, reason, now()).run();
  }
  return json6({ ok: true, changed: true });
}
async function deletePlan(user, db, entryId) {
  await db.prepare("DELETE FROM journal WHERE user_id = ? AND entry_id = ? AND status = 'planned'").bind(user.id, entryId).run();
  return json6({ ok: true });
}
async function postCheckIn(req, user, db, entryId) {
  const body = await req.json().catch(() => ({}));
  const status = body.status ?? "finished";
  const journalStatus = status === "season_finished" || status === "part_finished" ? "in_progress" : status;
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  await db.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
    newId("c"),
    user.id,
    entryId,
    body.workId ?? "",
    status,
    body.perceived ?? null,
    body.reason ?? null,
    body.payload ? JSON.stringify(body.payload) : null,
    now()
  ).run();
  await db.prepare(
    `UPDATE journal SET status = ?, progress = COALESCE(?, progress), series = COALESCE(?, series), finished_at = ? WHERE user_id = ? AND entry_id = ?`
  ).bind(journalStatus, body.progress ?? null, series, journalStatus === "in_progress" ? null : now(), user.id, entryId).run();
  return json6({ ok: true });
}
function seriesJson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const n = (x, max) => Number.isInteger(x) && x >= 1 && x <= max ? x : void 0;
  const season = n(r.season, 99);
  if (!season) return null;
  const episode = n(r.episode, 999);
  const done2 = Array.isArray(r.done) ? r.done.slice(0, 99).flatMap((d) => {
    const x = d;
    const s = n(x.season, 99);
    return s ? [{
      season: s,
      ...typeof x.perceived === "string" ? { perceived: x.perceived.slice(0, 20) } : {},
      ...typeof x.at === "string" ? { at: x.at.slice(0, 30) } : {}
    }] : [];
  }) : [];
  return JSON.stringify({ season, ...episode ? { episode } : {}, ...done2.length ? { done: done2 } : {} });
}
function bookJson(raw) {
  if (!raw || typeof raw !== "object") return null;
  const r = raw;
  const n = (x, max) => Number.isInteger(x) && x >= 1 && x <= max ? x : void 0;
  const part = n(r.part, 99);
  const page2 = n(r.page, 2e4);
  const done2 = Array.isArray(r.done) ? r.done.slice(0, 99).flatMap((d) => {
    const x = d;
    const p = n(x.part, 99);
    return p ? [{
      part: p,
      ...typeof x.perceived === "string" ? { perceived: x.perceived.slice(0, 20) } : {},
      ...typeof x.at === "string" ? { at: x.at.slice(0, 30) } : {}
    }] : [];
  }) : [];
  if (!part && !page2 && !done2.length) return null;
  return JSON.stringify({ kind: "book", ...part ? { part } : {}, ...page2 ? { page: page2 } : {}, ...done2.length ? { done: done2 } : {} });
}
async function postProgress(req, user, db, entryId) {
  const body = await req.json().catch(() => ({}));
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  if (!series) return json6({ error: "bad_progress" }, 400);
  await db.prepare("UPDATE journal SET series = ? WHERE user_id = ? AND entry_id = ? AND status = 'in_progress'").bind(series, user.id, entryId).run();
  return json6({ ok: true });
}
async function postFeedback(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.action) return json6({ error: "no_action" }, 400);
  const eager = Number.isInteger(body.eagerness) && body.eagerness >= 1 && body.eagerness <= 5 ? body.eagerness : null;
  await db.prepare("INSERT INTO feedback (id, user_id, rec_id, work_id, action, reason, eagerness, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(newId("f"), user.id, body.recId ?? null, body.workId ?? null, body.action, body.reason ?? null, eager, now()).run();
  return json6({ ok: true });
}
async function postSuggestion(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").trim().slice(0, 200);
  if (!title) return json6({ error: "no_title" }, 400);
  if (body.kind !== "work" && body.kind !== "voice") return json6({ error: "bad_kind" }, 400);
  await db.prepare("INSERT INTO suggestion (id, user_id, kind, title, note, context, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
    newId("sg"),
    user.id,
    body.kind,
    title,
    (body.note ?? "").trim().slice(0, 500) || null,
    (body.context ?? "").trim().slice(0, 200) || null,
    now()
  ).run();
  return json6({ ok: true });
}
var ISSUE_FIELDS = /* @__PURE__ */ new Set(["title", "year", "people", "synopsis", "image", "duration", "type", "watch", "analyses", "relations", "heroes", "other"]);
async function postWorkIssue(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const workId = (body.workId ?? "").trim().slice(0, 100);
  const title = (body.title ?? "").trim().slice(0, 200);
  const fields = Array.isArray(body.fields) ? [...new Set(body.fields.filter((f) => typeof f === "string" && ISSUE_FIELDS.has(f)))] : [];
  const note = (body.note ?? "").trim().slice(0, 500);
  if (!workId || !title) return json6({ error: "no_work" }, 400);
  if (!fields.length && !note) return json6({ error: "empty" }, 400);
  await db.prepare("INSERT INTO work_issue (id, user_id, work_id, title, fields, note, context, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(
    newId("wi"),
    user.id,
    workId,
    title,
    (fields.length ? fields : ["other"]).join(","),
    note || null,
    (body.context ?? "").trim().slice(0, 200) || null,
    now()
  ).run();
  return json6({ ok: true });
}
async function getWorkIssues(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json6({ error: "unauthorized" }, 401);
  const r = await env.DB.prepare(
    `SELECT i.id, i.work_id, i.title, i.fields, i.note, i.context, i.at, u.username, u.first_name
       FROM work_issue i LEFT JOIN user u ON u.id = i.user_id ORDER BY i.at DESC LIMIT 500`
  ).all();
  return json6({ items: r.results ?? [] });
}
async function getSuggestions(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json6({ error: "unauthorized" }, 401);
  const r = await env.DB.prepare(
    `SELECT s.id, s.kind, s.title, s.note, s.context, s.at, u.username, u.first_name
       FROM suggestion s LEFT JOIN user u ON u.id = s.user_id ORDER BY s.at DESC LIMIT 500`
  ).all();
  return json6({ items: r.results ?? [] });
}
async function putVerdict(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.url || !body.verdict) return json6({ error: "no_verdict" }, 400);
  await db.prepare(
    `INSERT INTO link_verdict (user_id, url, work_id, verdict, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, url) DO UPDATE SET verdict = excluded.verdict, at = excluded.at`
  ).bind(user.id, body.url, body.workId ?? null, body.verdict, now()).run();
  return json6({ ok: true });
}
var OWNER_QUEUE = "owner-queue.json";
var OWNER_KINDS = /* @__PURE__ */ new Set(["check", "lens"]);
async function getTesters(db) {
  const rows = await db.prepare("SELECT username, at FROM tester ORDER BY at").all();
  return json6({ testers: rows.results });
}
async function putTester(req, db) {
  const b = await req.json().catch(() => ({}));
  const u = typeof b.username === "string" ? nick(b.username) : "";
  if (!/^[a-z0-9_]{3,32}$/.test(u)) return json6({ error: "username" }, 400);
  if (b.on === false) await db.prepare("DELETE FROM tester WHERE username = ?").bind(u).run();
  else await db.prepare("INSERT INTO tester (username, at) VALUES (?, ?) ON CONFLICT(username) DO NOTHING").bind(u, now()).run();
  return getTesters(db);
}
async function ownerOnly(user, env) {
  const row = await env.DB.prepare("SELECT username FROM user WHERE id = ?").bind(user.id).first();
  return isOwner(env, row?.username ?? void 0);
}
async function getOwnerQueue(env) {
  const object = env.REFERENCE ? await env.REFERENCE.get(OWNER_QUEUE) : null;
  if (!object) return json6({ error: "no_queue" }, 404);
  return new Response(object.body, { headers: { ...JSON_HEADERS, "cache-control": "no-store" } });
}
async function getOwnerDecisions(db) {
  const r = await db.prepare("SELECT kind, item_id, body, at FROM owner_decision ORDER BY at").all();
  return json6({ items: (r.results ?? []).map((x) => ({ kind: x.kind, id: x.item_id, at: x.at, ...JSON.parse(x.body) })) });
}
async function putOwnerDecision(req, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.kind || !OWNER_KINDS.has(body.kind) || !body.id || !/^[A-Za-z0-9_:-]{11,16}$/.test(body.id)) return json6({ error: "bad_decision" }, 400);
  const { kind, id, ...rest } = body;
  const text = JSON.stringify(rest);
  if (text.length > 2e3) return json6({ error: "too_long" }, 400);
  await db.prepare(
    `INSERT INTO owner_decision (kind, item_id, body, at) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind, item_id) DO UPDATE SET body = excluded.body, at = excluded.at`
  ).bind(kind, id, text, now()).run();
  return json6({ ok: true });
}
function adminOk(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  return Boolean(env.ADMIN_TOKEN && token && sameToken(token, env.ADMIN_TOKEN));
}
async function putOwnerQueue(req, env) {
  if (!adminOk(req, env)) return json6({ error: "unauthorized" }, 401);
  if (!env.REFERENCE) return json6({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  try {
    JSON.parse(text);
  } catch {
    return json6({ error: "bad_json" }, 400);
  }
  await env.REFERENCE.put(OWNER_QUEUE, text);
  return json6({ ok: true, bytes: text.length });
}
async function getBehavior(req, env) {
  if (!adminOk(req, env)) return json6({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const db = env.DB;
  const owner = env.OWNER_USERNAME?.replace(/^@/, "").toLowerCase();
  const ownerIds = owner && url.searchParams.get("owner") === "0" ? ((await db.prepare("SELECT id FROM user WHERE lower(username) = ?").bind(owner).all()).results ?? []).map((r) => r.id) : [];
  const not = ownerIds.length ? `AND user_id NOT IN (${ownerIds.map(() => "?").join(",")})` : "";
  const q = async (sql, ...bind) => (await db.prepare(sql).bind(...bind, ...ownerIds).all()).results ?? [];
  const by = (col, extra = "") => q(`SELECT ${col} AS k, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE 1=1 ${extra} ${not} GROUP BY ${col} ORDER BY n DESC`);
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const [total, lens, place, shelf, shelves, tier, days] = await Promise.all([
    q(`SELECT COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE 1=1 ${not}`),
    by("lens"),
    by("place"),
    by("shelf", "AND shelf IS NOT NULL"),
    by("shelves"),
    by("tier"),
    q(`SELECT substr(at, 1, 10) AS k, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM material_open WHERE at >= ? ${not} GROUP BY k ORDER BY k`, since)
  ]);
  const users = await db.prepare(`SELECT COUNT(*) AS all_users, SUM(CASE WHEN seen_at >= ? THEN 1 ELSE 0 END) AS week FROM user WHERE tg_id IS NOT NULL`).bind(new Date(Date.now() - 7 * 864e5).toISOString()).first();
  return json6({
    at: now(),
    withoutOwner: ownerIds.length > 0,
    opens: { ...total[0] ?? { n: 0, users: 0 }, lens, place, shelf, shelves, tier, days },
    users: { all: users?.all_users ?? 0, week: users?.week ?? 0 },
    loop: loopReport(await loopRows(db))
  });
}
var REFERENCE_NAMES = /* @__PURE__ */ new Set(["postsAuto", "essaysAuto", "essayLenses", "sourcesAuto", "filmBaseWiki", "comentions", "meta", "inlineIndex", "heroes", "seriesSeasons", "publicPages"]);
async function getReference(env, name) {
  if (!REFERENCE_NAMES.has(name)) return json6({ error: "unknown_reference", name }, 404);
  if (!env.REFERENCE) return json6({ error: "no_reference_bucket" }, 404);
  const object = await env.REFERENCE.get(`${name}.json`);
  if (!object) return json6({ error: "not_found", name }, 404);
  return new Response(object.body, { headers: { ...JSON_HEADERS, etag: object.httpEtag, "cache-control": "public, max-age=600" } });
}
async function putReference(req, env, name) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json6({ error: "unauthorized" }, 401);
  if (!REFERENCE_NAMES.has(name)) return json6({ error: "unknown_reference", name }, 404);
  if (!env.REFERENCE) return json6({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  try {
    JSON.parse(text);
  } catch {
    return json6({ error: "bad_json" }, 400);
  }
  const watched = name === "essaysAuto" || name === "postsAuto";
  const before = watched ? await env.REFERENCE.get(`${name}.json`).then((o) => o ? new Response(o.body).text() : void 0).catch(() => void 0) : void 0;
  await env.REFERENCE.put(`${name}.json`, text);
  forgetReference(name);
  const fresh = watched ? await noteFresh(env, before, text).catch((err) => {
    console.error("noteFresh", err);
    return -1;
  }) : void 0;
  return json6({ ok: true, name, bytes: text.length, ...fresh !== void 0 ? { fresh } : {} });
}
function sameToken(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
var withHead = (res, head) => {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(head)) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
};
var index_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";
    const head = cors(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: head });
    await migrate(env.DB);
    if (path === "/api/health") return json6({ ok: true, at: now() }, 200, head);
    if (path === "/api/telegram" && req.method === "POST") return telegramUpdate(req, env);
    if (path === "/api/session" && req.method === "POST") {
      const res2 = await postSession(req, env);
      return new Response(res2.body, { status: res2.status, headers: { ...JSON_HEADERS, ...head } });
    }
    if (!path.startsWith("/api/")) return await publicPage(req, env, path) ?? json6({ error: "not_found" }, 404, head);
    const refPath = /^\/api\/reference\/([A-Za-z0-9-]+)$/.exec(path);
    if (refPath && req.method === "GET") return withHead(await getReference(env, refPath[1]), head);
    if (refPath && req.method === "PUT") return withHead(await putReference(req, env, refPath[1]), head);
    if (path === "/api/sources" && req.method === "GET") return withHead(await getSources(env), head);
    const seedPath = /^\/api\/admin\/seed\/([A-Za-z0-9_]+)$/.exec(path);
    if (seedPath && req.method === "PUT") return withHead(await putUserSeed(req, env, seedPath[1]), head);
    if (path === "/api/admin/suggestions" && req.method === "GET") return withHead(await getSuggestions(req, env), head);
    if (path === "/api/admin/work-issues" && req.method === "GET") return withHead(await getWorkIssues(req, env), head);
    if (path === "/api/admin/owner-queue" && req.method === "PUT") return withHead(await putOwnerQueue(req, env), head);
    if (path === "/api/admin/behavior" && req.method === "GET") return withHead(await getBehavior(req, env), head);
    if (path === "/api/admin/funnel" && req.method === "GET") return withHead(await getFunnel(req, env, adminOk(req, env)), head);
    if (path === "/api/admin/telegram-webhook" && req.method === "POST") {
      return withHead(adminOk(req, env) ? await adminWebhook(req, env) : json6({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/follow-digest" && req.method === "POST") {
      return withHead(adminOk(req, env) ? await adminDigest(req, env) : json6({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/owner-decisions" && req.method === "GET") {
      return withHead(adminOk(req, env) ? await getOwnerDecisions(env.DB) : json6({ error: "unauthorized" }, 401), head);
    }
    if (path.startsWith("/api/admin/registry") || path.startsWith("/api/admin/inbox")) {
      if (!adminOk(req, env)) return json6({ error: "unauthorized" }, 401, head);
      if (path === "/api/admin/registry" && req.method === "GET") return withHead(await getRegistry(url, env), head);
      if (path === "/api/admin/registry" && req.method === "POST") return withHead(await postRegistry(req, env), head);
      if (path === "/api/admin/registry/version" && req.method === "GET") return withHead(await getRegistryVersion(env), head);
      if (path === "/api/admin/registry/log" && req.method === "GET") return withHead(await getRegistryLog(url, env), head);
      if (path === "/api/admin/inbox" && req.method === "GET") return withHead(await getInbox(url, env), head);
      if (path === "/api/admin/inbox" && req.method === "POST") return withHead(await postInbox(req, env), head);
      if (path === "/api/admin/inbox/result" && req.method === "POST") return withHead(await postInboxResult(req, env), head);
      return json6({ error: "not_found" }, 404, head);
    }
    const user = await whoIs(req, env.DB);
    if (!user) return json6({ error: "unauthorized" }, 401, head);
    await noteVisit(env.DB, user.id).catch((err) => console.error("visit", err));
    const reply = async () => {
      if (path === "/api/state" && req.method === "GET") return getState(user, env.DB, env);
      if (path === "/api/settings" && req.method === "PUT") return putSettings(req, user, env.DB);
      if (path === "/api/feedback" && req.method === "POST") return postFeedback(req, user, env.DB);
      if (path === "/api/verdict" && req.method === "PUT") return putVerdict(req, user, env.DB);
      if (path === "/api/suggestion" && req.method === "POST") return postSuggestion(req, user, env.DB);
      if (path === "/api/work-issue" && req.method === "POST") return postWorkIssue(req, user, env.DB);
      if (path === "/api/journal/start" && req.method === "POST") return postStart(req, user, env.DB);
      if (path === "/api/journal/plan" && req.method === "POST") return postPlan(req, user, env.DB);
      const unstart = /^\/api\/journal\/([^/]+)\/unstart$/.exec(path);
      if (unstart && req.method === "POST") return postUnstart(req, user, env.DB, decodeURIComponent(unstart[1]));
      const plan = /^\/api\/journal\/([^/]+)\/plan$/.exec(path);
      if (plan && req.method === "DELETE") return deletePlan(user, env.DB, decodeURIComponent(plan[1]));
      if (path === "/api/impressions" && req.method === "POST") return postImpressions(req, user, env.DB);
      if (path === "/api/open" && req.method === "POST") return postOpen(req, user, env.DB);
      if (path === "/api/event" && req.method === "POST") return postEvent(req, user.id, env.DB);
      if (path === "/api/account" && req.method === "DELETE") return deleteAccount(user.id, env);
      if (path === "/api/share" && req.method === "POST") {
        const me = await env.DB.prepare("SELECT tg_id FROM user WHERE id = ?").bind(user.id).first();
        return prepareShare(req, me?.tg_id, env, user.id);
      }
      if (path === "/api/report/loop" && req.method === "GET") return getLoopReport(url, user, env);
      if (path === "/api/follows" && req.method === "GET") return getFollows(user.id, env);
      if (path === "/api/follow" && req.method === "PUT") return putFollow(req, user.id, env);
      if (path.startsWith("/api/owner/")) {
        if (!await ownerOnly(user, env)) return json6({ error: "owner_only" }, 403);
        if (path === "/api/owner/queue" && req.method === "GET") return getOwnerQueue(env);
        if (path === "/api/owner/decisions" && req.method === "GET") return getOwnerDecisions(env.DB);
        if (path === "/api/owner/decision" && req.method === "PUT") return putOwnerDecision(req, env.DB);
        if (path === "/api/owner/testers" && req.method === "GET") return getTesters(env.DB);
        if (path === "/api/owner/testers" && req.method === "PUT") return putTester(req, env.DB);
      }
      if (path.startsWith("/api/together")) {
        const r = await togetherRoute(req, path, user.id, env);
        if (r) return r;
      }
      const rating = /^\/api\/rating\/(.+)$/.exec(path);
      if (rating && req.method === "PUT") return putRating(req, user, env.DB, decodeURIComponent(rating[1]));
      const watched = /^\/api\/watched\/(.+)$/.exec(path);
      if (watched && req.method === "PUT") return putWatched(req, user, env.DB, decodeURIComponent(watched[1]));
      const progress = /^\/api\/journal\/([^/]+)\/progress$/.exec(path);
      if (progress && req.method === "POST") return postProgress(req, user, env.DB, decodeURIComponent(progress[1]));
      const checkin = /^\/api\/journal\/([^/]+)\/checkin$/.exec(path);
      if (checkin && req.method === "POST") return postCheckIn(req, user, env.DB, decodeURIComponent(checkin[1]));
      return json6({ error: "not_found" }, 404);
    };
    const res = await reply();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(head)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
  /** По расписанию (Cloudflare cron; на bothost — таймер server/index.js): сводка подписок раз в день. */
  async scheduled(_event, env) {
    await migrate(env.DB);
    const r = await followDigest(env);
    if (r.users) console.log(`\u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438: ${JSON.stringify(r)}`);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  REFERENCE_NAMES,
  forgetMigrations
});
