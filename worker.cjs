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

// worker/env.ts
var bot = { name: "recomend_media_bot" };
function useBot(env) {
  bot.name = env.BOT_USERNAME?.replace(/^@/, "") || "recomend_media_bot";
}

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

// worker/tg.ts
var TG_TIMEOUT = 8e3;
async function tg(env, method, body, timeout = TG_TIMEOUT) {
  if (!env.BOT_TOKEN) return { ok: false, error_code: 0, description: "no_bot_token" };
  let text;
  let status;
  try {
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}),
      signal: AbortSignal.timeout(timeout)
    });
    status = r.status;
    text = await r.text();
  } catch (err) {
    const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
    console.error(`tg ${method}:`, timedOut ? `\u043D\u0435\u0442 \u043E\u0442\u0432\u0435\u0442\u0430 \u0437\u0430 ${timeout / 1e3} \u0441` : err?.message ?? err);
    return { ok: false, error_code: 0, description: timedOut ? "timeout" : "network" };
  }
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object" && typeof j.ok === "boolean") return j;
  } catch {
  }
  console.error(`tg ${method}: \u043E\u0442\u0432\u0435\u0442 \u043D\u0435 JSON (${status}): ${text.slice(0, 120)}`);
  return { ok: false, error_code: status, description: "not_json" };
}

// worker/together.ts
var json = (body, status = 200) => Response.json(body, { status });
var DECK_MIN = 4;
var DECK_MAX = 12;
var VOTE_DAYS = 7;
var VOTES = /* @__PURE__ */ new Set(["yes", "maybe", "no", "veto", "seen"]);
var ROUND_MS = 3 * 6e4;
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
  const v = o.voice;
  const voice = v && str(v.author, 80) && str(v.title, 160) && https(v.url) ? { author: str(v.author, 80), title: str(v.title, 160), url: https(v.url) } : void 0;
  return {
    id,
    title,
    ...typeof o.year === "number" && o.year > 1800 && o.year < 2100 ? { year: Math.round(o.year) } : {},
    ...https(o.image) ? { image: https(o.image) } : {},
    ...str(o.about, 300) ? { about: str(o.about, 300) } : {},
    ...typeof o.essays === "number" && o.essays >= 0 ? { essays: Math.min(99, Math.round(o.essays)) } : {},
    ...o.kind === "series" ? { kind: "series" } : {},
    ...watch.length ? { watch } : {},
    ...voice ? { voice } : {}
  };
}
var newSessionId = () => {
  const b = crypto.getRandomValues(new Uint8Array(8));
  return [...b].map((x) => x.toString(36).padStart(2, "0")).join("").slice(0, 12);
};
var CHAT_HOURS = 24;
var command = () => new RegExp(`^\\/(?:(?:together|vmeste)(?:@${bot.name})?(?:\\s|$)|start\\s+together$)`, "i");
var esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var TEXT = {
  ru: {
    ask: "\u0427\u0442\u043E \u0441\u043C\u043E\u0442\u0440\u0438\u043C? \u041E\u0434\u0438\u043D \u0441\u043E\u0431\u0438\u0440\u0430\u0435\u0442 \u043F\u043E\u0434\u0431\u043E\u0440\u043A\u0443 \u043F\u043E\u0434 \u0441\u0432\u043E\u0439 \u0432\u043A\u0443\u0441 \u2014 \u044F \u043F\u0440\u0438\u0448\u043B\u044E \u0435\u0451 \u0441\u044E\u0434\u0430, \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435 \u0433\u043E\u043B\u043E\u0441\u0443\u044E\u0442: \xAB\u0445\u043E\u0447\u0443\xBB, \xAB\u043D\u0435 \u0445\u043E\u0447\u0443\xBB, \xAB\u0432\u0438\u0434\u0435\u043B\xBB.",
    pick: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u043E\u0434\u0431\u043E\u0440\u043A\u0443",
    inChat: "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u0442\u044C \u043F\u0440\u044F\u043C\u043E \u0432 \u0447\u0430\u0442\u0435",
    result: (t, match) => `<b>${match ? "\u0421\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435" : "\u0418\u0442\u043E\u0433"}: ${esc(t)}</b>
\u0413\u043E\u043B\u043E\u0441\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u044B \u2014 \u043F\u043E\u0434\u0440\u043E\u0431\u043D\u043E\u0441\u0442\u0438 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438.`,
    open: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0438\u0442\u043E\u0433",
    vote: (name, n) => `<b>\u0413\u043E\u043B\u043E\u0441\u0443\u0435\u043C: \u0447\u0442\u043E \u0441\u043C\u043E\u0442\u0440\u0438\u043C</b>
\u041F\u043E\u0434\u0431\u043E\u0440\u043A\u0430 \u043E\u0442 ${esc(name)} \u2014 ${n} \u0444\u0438\u043B\u044C\u043C\u043E\u0432. \u0413\u043E\u043B\u043E\u0441\u0443\u0439\u0442\u0435, \u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u043F\u043E\u043A\u0430\u0436\u0443 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438.`,
    go: "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u0442\u044C"
  },
  en: {
    ask: "What are we watching? One of you picks a set to match their taste \u2014 I'll post it here, and everyone votes: want, don't, seen.",
    pick: "Pick films",
    inChat: "Vote right in the chat",
    result: (t, match) => `<b>${match ? "Match" : "Result"}: ${esc(t)}</b>
Votes are open \u2014 details in the app.`,
    open: "Open result",
    vote: (name, n) => `<b>Vote: what are we watching</b>
A set of ${n} films from ${esc(name)}. Vote \u2014 the match shows up in the app.`,
    go: "Vote"
  }
};
var lang = (code) => code && /^en/i.test(code) ? "en" : "ru";
async function send(env, body) {
  if (!env.BOT_TOKEN) return false;
  return (await tg(env, "sendMessage", body)).ok;
}
async function togetherCommand(env, m) {
  if (!m.text || !command().test(m.text.trim())) return false;
  const token = newSessionId();
  const l = lang(m.from?.language_code);
  await env.DB.prepare("DELETE FROM together_chat WHERE created_at < ?").bind(new Date(Date.now() - 7 * 864e5).toISOString()).run();
  await env.DB.prepare("INSERT INTO together_chat (token, chat_id, title, lang, created_at) VALUES (?, ?, ?, ?, ?)").bind(token, m.chat.id, m.chat.title?.slice(0, 120) ?? null, l, (/* @__PURE__ */ new Date()).toISOString()).run();
  return send(env, {
    chat_id: m.chat.id,
    text: TEXT[l].ask,
    reply_parameters: { message_id: m.message_id, allow_sending_without_reply: true },
    // без приложения — голосование прямо в чате (worker/inlinePoll.ts): кнопка вставляет «@бот вместе » в поле ввода
    reply_markup: { inline_keyboard: [
      [{ text: TEXT[l].pick, url: `https://t.me/${bot.name}?startapp=g-${token}` }],
      [{ text: TEXT[l].inChat, switch_inline_query_current_chat: l === "en" ? "together " : "\u0432\u043C\u0435\u0441\u0442\u0435 " }]
    ] }
  });
}
async function postToChat(env, token, sessionId, userId, n) {
  const c = await env.DB.prepare("SELECT chat_id, title, lang, created_at, session_id FROM together_chat WHERE token = ?").bind(token).first();
  if (!c || c.session_id || Date.now() - Date.parse(c.created_at) > CHAT_HOURS * 36e5) return void 0;
  const u = await env.DB.prepare("SELECT first_name, username FROM user WHERE id = ?").bind(userId).first();
  const l = lang(c.lang);
  const name = u?.first_name || (u?.username ? `@${u.username}` : l === "en" ? "a friend" : "\u0434\u0440\u0443\u0433\u0430");
  const sent = await send(env, {
    chat_id: c.chat_id,
    text: TEXT[l].vote(name, n),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: TEXT[l].go, url: `https://t.me/${bot.name}?startapp=t-${sessionId}` }]] }
  });
  if (!sent) return void 0;
  await env.DB.prepare("UPDATE together_chat SET session_id = ? WHERE token = ?").bind(sessionId, token).run();
  return { title: c.title };
}
async function createTogether(req, userId, env) {
  const db = env.DB;
  const b = await req.json().catch(() => ({}));
  const seen = /* @__PURE__ */ new Set();
  const deck = (Array.isArray(b.deck) ? b.deck : []).map(cleanCard).filter((c) => Boolean(c && !seen.has(c.id) && seen.add(c.id))).slice(0, DECK_MAX);
  if (deck.length < DECK_MIN) return json({ error: "small_deck", min: DECK_MIN }, 400);
  const id = newSessionId();
  await db.prepare("INSERT INTO together (id, user_id, deck, created_at) VALUES (?, ?, ?, ?)").bind(id, userId, JSON.stringify(deck), (/* @__PURE__ */ new Date()).toISOString()).run();
  const token = typeof b.chat === "string" && /^[a-z0-9]{6,16}$/.test(b.chat) ? b.chat : void 0;
  const posted = token ? await postToChat(env, token, id, userId, deck.length) : void 0;
  return json({ id, ...posted ? { chat: posted.title } : {} });
}
var SESSION = "SELECT id, user_id, deck, created_at, round_at, revealed_at FROM together WHERE id = ?";
async function load(db, id) {
  const s = await db.prepare(SESSION).bind(id).first();
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
    const maybe = names("maybe");
    const veto = vs.filter((v) => v.vote === "veto").length;
    return {
      workId: c.id,
      yes: yes.length,
      maybe: maybe.length,
      no: no.length,
      veto,
      seen: names("seen").length,
      yesNames: yes,
      maybeNames: maybe,
      seenNames: names("seen"),
      fit: fits.length ? fits.reduce((a, b) => a + b, 0) / fits.length : null,
      // совпадение: все, кто голосовал по фильму, хотят, и их хотя бы двое
      match: !veto && yes.length >= 2 && yes.length === vs.length
    };
  });
  const score = (r) => r.yes + r.maybe / 2;
  const order = [...rows].sort((a, b) => Number(Boolean(a.veto)) - Number(Boolean(b.veto)) || Number(b.match) - Number(a.match) || score(b) - score(a) || a.no - b.no || (b.fit ?? 0) - (a.fit ?? 0));
  return { people: [...people.values()], rows: order };
}
function revealState(s, deck, votes, now2 = Date.now()) {
  if (s.revealed_at) return { revealed: true };
  const per = /* @__PURE__ */ new Map();
  for (const v of votes) per.set(v.user_id, (per.get(v.user_id) ?? 0) + 1);
  if (per.size < 2) return { revealed: false };
  if (!s.round_at) return { revealed: true };
  const at = Date.parse(s.round_at) + ROUND_MS;
  const all = [...per.values()].every((n) => n >= deck.length);
  return all || now2 >= at || !open(s) ? { revealed: true } : { revealed: false, revealAt: new Date(at).toISOString() };
}
async function markRevealed(env, s, deck, votes) {
  const r = await env.DB.prepare("UPDATE together SET revealed_at = ? WHERE id = ? AND revealed_at IS NULL").bind((/* @__PURE__ */ new Date()).toISOString(), s.id).run();
  if (!Number(r.meta?.changes)) return;
  const c = await env.DB.prepare("SELECT chat_id, lang FROM together_chat WHERE session_id = ?").bind(s.id).first();
  if (!c) return;
  const top = tally(deck, votes, "").rows[0];
  const card = top && !top.veto && top.yes + top.maybe > 0 ? deck.find((d) => d.id === top.workId) : void 0;
  if (!card) return;
  const l = lang(c.lang);
  await send(env, {
    chat_id: c.chat_id,
    text: TEXT[l].result(`${card.title}${card.year ? ` (${card.year})` : ""}`, top.match),
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [[{ text: TEXT[l].open, url: `https://t.me/${bot.name}?startapp=t-${s.id}` }]] }
  });
}
async function getTogether(id, userId, env) {
  const db = env.DB;
  const got = await load(db, id);
  if (!got) return json({ error: "not_found" }, 404);
  const { s, deck, votes } = got;
  const owner = await db.prepare("SELECT first_name, username FROM user WHERE id = ?").bind(s.user_id).first();
  const mine = Object.fromEntries(votes.filter((v) => v.user_id === userId).map((v) => [v.work_id, v.vote]));
  const t = tally(deck, votes, userId);
  if (!t.people.some((p) => p.me) && s.user_id === userId) t.people.unshift({ name: owner?.first_name || "\u0412\u044B", n: 0, me: true });
  const r = revealState(s, deck, votes);
  if (r.revealed && !s.revealed_at) await markRevealed(env, s, deck, votes).catch((err) => console.error("together reveal", err));
  return json({
    id: s.id,
    createdAt: s.created_at,
    open: open(s),
    mineSession: s.user_id === userId,
    owner: owner?.first_name || (owner?.username ? `@${owner.username}` : null),
    deck,
    votes: mine,
    people: t.people,
    // до раскрытия чужих голосов не отдаём вовсе — только кто сколько прошёл
    revealed: r.revealed,
    ...r.revealAt ? { revealAt: r.revealAt } : {},
    tally: r.revealed ? t.rows : []
  });
}
async function revealTogether(id, userId, env) {
  const got = await load(env.DB, id);
  if (!got) return json({ error: "not_found" }, 404);
  if (got.s.user_id !== userId) return json({ error: "not_owner" }, 403);
  if (new Set(got.votes.map((v) => v.user_id)).size < 2) return json({ error: "alone" }, 409);
  if (!got.s.revealed_at) await markRevealed(env, got.s, got.deck, got.votes);
  return json({ ok: true });
}
async function voteTogether(req, id, userId, db) {
  const s = await db.prepare(SESSION).bind(id).first();
  if (!s) return json({ error: "not_found" }, 404);
  if (!open(s)) return json({ error: "closed" }, 409);
  const b = await req.json().catch(() => ({}));
  const workId = str(b.workId, 120);
  const vote = str(b.vote, 8);
  if (!workId || !vote || !VOTES.has(vote)) return json({ error: "bad_vote" }, 400);
  if (!JSON.parse(s.deck).some((c) => c.id === workId)) return json({ error: "not_in_deck" }, 400);
  const fit = typeof b.fit === "number" && Number.isFinite(b.fit) ? Math.max(0, Math.min(1, b.fit)) : null;
  await db.prepare(
    `INSERT INTO together_vote (session_id, user_id, work_id, vote, fit, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (session_id, user_id, work_id) DO UPDATE SET vote = excluded.vote, fit = excluded.fit, at = excluded.at`
  ).bind(id, userId, workId, vote, fit, (/* @__PURE__ */ new Date()).toISOString()).run();
  if (!s.round_at && !s.revealed_at) {
    await db.prepare(`UPDATE together SET round_at = ? WHERE id = ? AND round_at IS NULL
      AND (SELECT COUNT(DISTINCT user_id) FROM together_vote WHERE session_id = ?) >= 2`).bind((/* @__PURE__ */ new Date()).toISOString(), id, id).run();
  }
  return json({ ok: true });
}
async function togetherRoute(req, path, userId, env) {
  if (path === "/api/together" && req.method === "POST") return createTogether(req, userId, env);
  const m = /^\/api\/together\/([a-z0-9]{6,16})(\/vote|\/reveal)?$/.exec(path);
  if (!m) return void 0;
  if (!m[2] && req.method === "GET") return getTogether(m[1], userId, env);
  if (m[2] === "/vote" && req.method === "PUT") return voteTogether(req, m[1], userId, env.DB);
  if (m[2] === "/reveal" && req.method === "POST") return revealTogether(m[1], userId, env);
  return void 0;
}

// worker/inlinePoll.ts
var MAX = 10;
var KEEP_DAYS = 30;
var TRIGGER = /^(?:вместе|голосуем|голосование|выбираем|together|vote)(?=$|[\s,:;—-])[\s,:;—-]*/i;
var pollQuery = (q) => {
  const m = TRIGGER.exec(q.trim());
  return m ? q.trim().slice(m[0].length) : void 0;
};
var pollTitles = (rest) => rest.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean).slice(0, MAX);
var esc2 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var T = {
  ru: {
    head: "\u0427\u0442\u043E \u0441\u043C\u043E\u0442\u0440\u0438\u043C? \u0416\u043C\u0438\u0442\u0435 \u043D\u043E\u043C\u0435\u0440\u0430 \u2014 \u043C\u043E\u0436\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E, \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u044B\u0439 \u0442\u0430\u043F \u0441\u043D\u0438\u043C\u0430\u0435\u0442 \u0433\u043E\u043B\u043E\u0441.",
    title: (n) => `\u0413\u043E\u043B\u043E\u0441\u0443\u0435\u043C \u0432 \u0447\u0430\u0442\u0435: ${n} ${n < 5 ? "\u0444\u0438\u043B\u044C\u043C\u0430" : "\u0444\u0438\u043B\u044C\u043C\u043E\u0432"}`,
    app: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438",
    voted: (t) => `\u0413\u043E\u043B\u043E\u0441: ${t}`,
    unvoted: (t) => `\u0413\u043E\u043B\u043E\u0441 \u0441\u043D\u044F\u0442: ${t}`,
    stale: "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043D\u0438\u0435 \u0443\u0441\u0442\u0430\u0440\u0435\u043B\u043E",
    nobody: "\u041F\u043E\u043A\u0430 \u043D\u0438\u043A\u0442\u043E \u043D\u0435 \u0433\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u043B",
    lead: "\u0432\u043F\u0435\u0440\u0435\u0434\u0438"
  },
  en: {
    head: "What are we watching? Tap the numbers \u2014 several are fine, tap again to take a vote back.",
    title: (n) => `Vote in the chat: ${n} films`,
    app: "Open in the app",
    voted: (t) => `Voted: ${t}`,
    unvoted: (t) => `Vote removed: ${t}`,
    stale: "This vote has expired",
    nobody: "No votes yet",
    lead: "leading"
  }
};
async function pollId(films, owner) {
  const key = `${owner}|${films.map((f) => `${f.t}|${f.y ?? ""}`).join("||")}`;
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(d)].slice(0, 6).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function pollText(films, votes, lang2) {
  const by = films.map((_, i) => votes.filter((v) => v.idx === i).map((v) => v.name));
  const top = Math.max(0, ...by.map((n) => n.length));
  const lines = films.map((f, i) => {
    const name = `${esc2(f.t)}${f.y ? ` (${esc2(String(f.y))})` : ""}`;
    const who = by[i].length ? ` \u2014 ${by[i].length}: ${esc2(by[i].slice(0, 5).join(", "))}${by[i].length > 5 ? ` +${by[i].length - 5}` : ""}` : "";
    return `${i + 1}. ${top && by[i].length === top ? `<b>${name}</b>` : name}${who}`;
  });
  return [T[lang2].head, "", ...lines, ...votes.length ? [] : ["", T[lang2].nobody]].join("\n");
}
function pollKeyboard(id, n, lang2, session) {
  const nums = Array.from({ length: n }, (_, i) => ({ text: String(i + 1), callback_data: `tp:${id}:${i}` }));
  const rows = [];
  for (let i = 0; i < nums.length; i += 5) rows.push(nums.slice(i, i + 5));
  rows.push([{ text: T[lang2].app, url: `https://t.me/${bot.name}?startapp${session ? `=t-${session}` : ""}` }]);
  return { inline_keyboard: rows };
}
async function pollResult(env, films, owner, lang2, session, label) {
  const list = films.slice(0, MAX);
  const id = await pollId(list, owner);
  const old = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString();
  await env.DB.batch([
    env.DB.prepare("DELETE FROM inline_vote WHERE at < ?").bind(old),
    env.DB.prepare("DELETE FROM inline_poll WHERE created_at < ?").bind(old),
    env.DB.prepare("INSERT OR IGNORE INTO inline_poll (id, owner_tg, films, lang, session_id, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, owner, JSON.stringify(list), lang2, session ?? null, (/* @__PURE__ */ new Date()).toISOString())
  ]);
  const thumb = list.find((f) => f.i)?.i;
  return {
    type: "article",
    id: `poll-${id}`,
    title: label?.title ?? T[lang2].title(list.length),
    description: [label?.note, list.map((f) => f.t).join(" \xB7 ")].filter(Boolean).join(" \u2014 ").slice(0, 200),
    ...thumb ? { thumbnail_url: thumb } : {},
    input_message_content: { message_text: pollText(list, [], lang2), parse_mode: "HTML", link_preview_options: { is_disabled: true } },
    reply_markup: pollKeyboard(id, list.length, lang2, session)
  };
}
async function lastDeck(env, tgId) {
  const row = await env.DB.prepare(`SELECT t.id, t.deck FROM together t JOIN user u ON u.id = t.user_id
    WHERE u.tg_id = ? AND t.created_at > ? ORDER BY t.created_at DESC LIMIT 1`).bind(tgId, new Date(Date.now() - 7 * 864e5).toISOString()).first();
  if (!row) return void 0;
  const deck = JSON.parse(row.deck);
  return { films: deck.slice(0, MAX).map((c) => ({ t: c.title, ...c.year ? { y: c.year } : {}, ...c.image ? { i: c.image } : {} })), session: row.id };
}
var api = (env, method, body) => tg(env, method, body);
async function pollVote(env, cb) {
  const m = /^tp:([0-9a-f]{12}):(\d{1,2})$/.exec(cb.data ?? "");
  if (!m) return false;
  const [, id, raw] = m;
  const idx = Number(raw);
  const poll = await env.DB.prepare("SELECT films, lang, session_id FROM inline_poll WHERE id = ?").bind(id).first();
  const lang2 = poll?.lang === "en" ? "en" : "ru";
  const films = poll ? JSON.parse(poll.films) : [];
  if (!poll || idx >= films.length) {
    await api(env, "answerCallbackQuery", { callback_query_id: cb.id, text: T[lang2].stale });
    return true;
  }
  const msg = cb.inline_message_id ?? (cb.message ? `${cb.message.chat.id}:${cb.message.message_id}` : void 0);
  if (!msg) return true;
  const name = (cb.from.first_name || (cb.from.username ? `@${cb.from.username}` : "\u2026")).slice(0, 40);
  const had = await env.DB.prepare("SELECT 1 AS x FROM inline_vote WHERE msg = ? AND tg_id = ? AND idx = ?").bind(msg, cb.from.id, idx).first();
  if (had) await env.DB.prepare("DELETE FROM inline_vote WHERE msg = ? AND tg_id = ? AND idx = ?").bind(msg, cb.from.id, idx).run();
  else await env.DB.prepare("INSERT INTO inline_vote (msg, poll_id, tg_id, name, idx, at) VALUES (?, ?, ?, ?, ?, ?)").bind(msg, id, cb.from.id, name, idx, (/* @__PURE__ */ new Date()).toISOString()).run();
  const votes = (await env.DB.prepare("SELECT idx, name FROM inline_vote WHERE msg = ? ORDER BY at").bind(msg).all()).results ?? [];
  const where = cb.inline_message_id ? { inline_message_id: cb.inline_message_id } : { chat_id: cb.message.chat.id, message_id: cb.message.message_id };
  await Promise.all([
    api(env, "answerCallbackQuery", { callback_query_id: cb.id, text: (had ? T[lang2].unvoted : T[lang2].voted)(films[idx].t) }),
    api(env, "editMessageText", {
      ...where,
      text: pollText(films, votes, lang2),
      parse_mode: "HTML",
      link_preview_options: { is_disabled: true },
      reply_markup: pollKeyboard(id, films.length, lang2, poll.session_id ?? void 0)
    })
  ]);
  return true;
}

// worker/hosts.ts
var IMAGE_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|kinopoiskapiunofficial\.tech|avatars\.mds\.yandex\.net|commons\.wikimedia\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org|i\.ytimg\.com)\//;

// worker/inlineGroup.ts
var MAX2 = 10;
var MAX_NICKS = 9;
var MIN_RATED = 30;
function groupQuery(q) {
  const m = /^(?:(?:для|вместе|с|for|together|with)\s+)?(@[A-Za-z0-9_]{1,32}(?:(?:\s*,\s*|\s+(?:и|and)\s+|\s+)@[A-Za-z0-9_]{1,32})*)[\s,]*$/i.exec(q.trim());
  if (!m) return void 0;
  return [...new Set(m[1].match(/@[A-Za-z0-9_]+/g).map((s) => s.slice(1).toLowerCase()))].slice(0, MAX_NICKS);
}
var norm = (s) => s.normalize("NFD").replace(new RegExp("\\p{M}+", "gu"), "").toLowerCase().replace(/ё/g, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
var parse = (s) => {
  try {
    return s ? JSON.parse(s) : void 0;
  } catch {
    return void 0;
  }
};
async function groupPick(env, from, nicks, lookup) {
  const me = await env.DB.prepare("SELECT id, username FROM user WHERE tg_id = ?").bind(from).first();
  if (!me) return { error: "not_in_bot", missing: [] };
  const others = nicks.filter((n) => n !== (me.username ?? "").toLowerCase());
  const found = others.length ? (await env.DB.prepare(`SELECT id, lower(username) AS nick FROM user WHERE lower(username) IN (${others.map(() => "?").join(",")})`).bind(...others).all()).results ?? [] : [];
  const missing = others.filter((n) => !found.some((f) => f.nick === n));
  if (!found.length) return { error: "nobody", missing };
  const members = [me.id, ...found.map((f) => f.id)];
  const marks = members.map(() => "?").join(",");
  const own2 = await env.DB.prepare("SELECT COUNT(*) AS n FROM rating WHERE user_id = ?").bind(me.id).first();
  if (Number(own2?.n ?? 0) < MIN_RATED) return { error: "no_history", missing };
  const [journal, rating, watched] = await env.DB.batch([
    env.DB.prepare(`SELECT user_id, work_id, work, status, eagerness, started_at AS at FROM journal WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, rating, at FROM rating WHERE user_id IN (${marks})`).bind(...members),
    env.DB.prepare(`SELECT user_id, work_id, work, at FROM watched WHERE state = 'watched' AND user_id IN (${marks})`).bind(...members)
  ]);
  const rows = (r) => r.results ?? [];
  const film = (r) => {
    const w = parse(r.work);
    const k = lookup(r.work_id);
    const kind = w?.format === "series" ? "series" : w?.type ?? k?.k;
    if (kind !== "film" && kind !== "series") return void 0;
    const rawT = w?.title || k?.t;
    if (typeof rawT !== "string" || !rawT.trim()) return void 0;
    const t = rawT.trim().slice(0, 120);
    const rawY = w?.year ?? k?.y;
    const y = Number.isInteger(rawY) && rawY >= 1800 && rawY <= 2100 ? rawY : void 0;
    const rawI = k?.i || w?.coverUrl;
    const i = typeof rawI === "string" && rawI.length <= 500 && IMAGE_HOSTS.test(rawI) ? rawI : void 0;
    return { key: `${norm(t)}|${y ?? ""}`, film: { t, ...y ? { y } : {}, ...i ? { i } : {} } };
  };
  const seen = /* @__PURE__ */ new Map();
  const saw = (key, user) => {
    if (!seen.has(key)) seen.set(key, /* @__PURE__ */ new Set());
    seen.get(key).add(user);
  };
  const cands = /* @__PURE__ */ new Map();
  const cand = (r) => {
    const f = film(r);
    if (!f) return void 0;
    if (!cands.has(f.key)) cands.set(f.key, { ...f, planned: /* @__PURE__ */ new Set(), fans: /* @__PURE__ */ new Set(), eager: 0, at: "" });
    return cands.get(f.key);
  };
  const keyOf = (r) => film(r)?.key;
  for (const r of rows(watched)) {
    const k = keyOf(r);
    if (k) saw(k, r.user_id);
  }
  for (const r of rows(rating)) {
    const k = keyOf(r);
    if (k) saw(k, r.user_id);
    if (r.rating === 5) cand(r)?.fans.add(r.user_id);
  }
  for (const r of rows(journal)) {
    if (r.status !== "planned") {
      const k = keyOf(r);
      if (k) saw(k, r.user_id);
      continue;
    }
    const c = cand(r);
    if (!c) continue;
    c.planned.add(r.user_id);
    c.eager = Math.max(c.eager, r.eagerness ?? 0);
    if ((r.at ?? "") > c.at) c.at = r.at ?? "";
  }
  const fresh = [...cands.values()].filter((c) => [...seen.get(c.key) ?? []].every((u) => c.fans.has(u)));
  const several = fresh.filter((c) => c.planned.size > 1).sort((a, b) => b.planned.size - a.planned.size || b.eager - a.eager || b.at.localeCompare(a.at));
  const roundRobin = (list, owner, order) => {
    const queues = members.map((u) => list.filter((c) => owner(c).includes(u)).sort(order));
    const out = [];
    const taken = /* @__PURE__ */ new Set();
    for (let i = 0; queues.some((q) => q.length > i); i++) {
      for (const q of queues) {
        const c = q[i];
        if (c && !taken.has(c.key)) {
          taken.add(c.key);
          out.push(c);
        }
      }
    }
    return out;
  };
  const single = roundRobin(
    fresh.filter((c) => c.planned.size === 1),
    (c) => [...c.planned],
    (a, b) => b.eager - a.eager || b.at.localeCompare(a.at)
  );
  const loved = roundRobin(
    fresh.filter((c) => !c.planned.size && c.fans.size),
    (c) => [...c.fans],
    (a, b) => b.fans.size - a.fans.size
  );
  const picked = [];
  const used = /* @__PURE__ */ new Set();
  for (const c of [...several, ...single, ...loved]) {
    if (used.has(c.key)) continue;
    used.add(c.key);
    picked.push(c.film);
    if (picked.length === MAX2) break;
  }
  if (picked.length < 2) return { error: "empty", missing };
  return { films: picked, names: found.map((f) => f.nick), missing };
}
async function memberInfo(env, nick2) {
  const n = nick2.trim().replace(/^@/, "").toLowerCase();
  const u = await env.DB.prepare("SELECT id, tg_id, created_at, seen_at FROM user WHERE lower(username) = ?").bind(n).first();
  const tester = Boolean(await env.DB.prepare("SELECT 1 AS x FROM tester WHERE username = ?").bind(n).first());
  if (!u) return Response.json({ nick: n, found: false, tester });
  const c = await env.DB.prepare(`SELECT (SELECT COUNT(*) FROM rating WHERE user_id = ?1) AS ratings,
    (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND status = 'planned') AS planned,
    (SELECT COUNT(*) FROM watched WHERE user_id = ?1 AND state = 'watched') AS watched`).bind(u.id).first();
  return Response.json({ nick: n, found: true, tester, telegram: u.tg_id != null, created: u.created_at, seen: u.seen_at, ...c });
}
var GROUP_T = {
  ru: {
    title: (names) => `\u0414\u043B\u044F \u0432\u0430\u0441 \u0438 ${names.map((n) => `@${n}`).join(", ")}`,
    missing: (m) => `${m.map((n) => `@${n}`).join(", ")} \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u043B\u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435`,
    not_in_bot: "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0431\u043E\u0442\u0430 \u2014 \u043F\u043E\u0434\u0431\u043E\u0440 \u0438\u0434\u0451\u0442 \u0438 \u043F\u043E \u0432\u0430\u0448\u0435\u043C\u0443 \u0432\u043A\u0443\u0441\u0443",
    no_history: `\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u043E\u0446\u0435\u043D\u0438\u0442\u0435 ${MIN_RATED} \u0444\u0438\u043B\u044C\u043C\u043E\u0432 \u2014 \u043F\u043E\u0434\u0431\u043E\u0440 \u0438\u0434\u0451\u0442 \u0438 \u043F\u043E \u0432\u0430\u0448\u0435\u043C\u0443 \u0432\u043A\u0443\u0441\u0443`,
    nobody: (m) => m.length ? `${m.map((n) => `@${n}`).join(", ")} \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u043B\u0438 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u2014 \u043F\u043E\u0437\u043E\u0432\u0438\u0442\u0435` : "\u041D\u0430\u0437\u043E\u0432\u0438\u0442\u0435 \u0434\u0440\u0443\u0437\u0435\u0439: \u0434\u043B\u044F @\u043D\u0438\u043A @\u043D\u0438\u043A",
    empty: "\u041E\u0431\u0449\u0435\u0433\u043E \u043F\u043E\u043A\u0430 \u043D\u0435\u0442 \u2014 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0432 \u043F\u043B\u0430\u043D\u044B"
  },
  en: {
    title: (names) => `For you and ${names.map((n) => `@${n}`).join(", ")}`,
    missing: (m) => `${m.map((n) => `@${n}`).join(", ")} haven't opened the app`,
    not_in_bot: "Open the bot \u2014 your taste counts too",
    no_history: `Rate ${MIN_RATED} films first \u2014 your taste counts too`,
    nobody: (m) => m.length ? `${m.map((n) => `@${n}`).join(", ")} haven't opened the app \u2014 invite them` : "Name your friends: for @nick @nick",
    empty: "Nothing in common yet \u2014 add films to your plans"
  }
};

// worker/inline.ts
var LIMIT = 20;
var RU_READERS = /^(?:ru|uk|be|kk|ky|uz|tg|hy|az|ka)\b/i;
var langOf = (code) => !code || RU_READERS.test(code) ? "ru" : "en";
var KINDS = {
  ru: { film: "\u0424\u0438\u043B\u044C\u043C", series: "\u0421\u0435\u0440\u0438\u0430\u043B", book: "\u041A\u043D\u0438\u0433\u0430", character: "\u0413\u0435\u0440\u043E\u0439" },
  en: { film: "Film", series: "Series", book: "Book", character: "Character" }
};
var BUTTON = {
  ru: { work: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0443", character: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0433\u0435\u0440\u043E\u044F", together: "\u0413\u043E\u043B\u043E\u0441\u043E\u0432\u0430\u0442\u044C" },
  en: { work: "Open card", character: "Open character", together: "Vote" }
};
async function webhookSecret(token) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`tm-webhook:${token}`));
  return [...new Uint8Array(digest)].slice(0, 24).map((b) => b.toString(16).padStart(2, "0")).join("");
}
var cache;
var norm2 = (s) => s.normalize("NFD").replace(new RegExp("\\p{M}+", "gu"), "").toLowerCase().replace(/ё/g, "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
async function index(env) {
  if (cache && Date.now() - cache.at < 10 * 6e4) return cache;
  const object = await env.REFERENCE?.get("inlineIndex.json");
  if (!object) return cache;
  const list = JSON.parse(await new Response(object.body).text());
  cache = { at: Date.now(), list, keys: list.map((e) => [e.t, e.o, ...e.a ?? []].filter((x) => Boolean(x)).map(norm2)) };
  return cache;
}
function search(idx, raw) {
  const q = norm2(raw);
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
var esc3 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var bigImage = (url) => url && IMAGE_HOSTS.test(url) ? url.replace(/(image\.tmdb\.org\/t\/p\/)w\d+\//, "$1w500/") : void 0;
function result(e, lang2 = "ru") {
  const head = `${e.t}${e.y ? ` (${e.y})` : ""}`;
  const line = [KINDS[lang2][e.k], e.o, e.s].filter(Boolean).join(" \xB7 ");
  const big = bigImage(e.i);
  return {
    type: "article",
    id: e.p,
    title: head,
    description: line,
    ...e.i ? { thumbnail_url: e.i } : {},
    input_message_content: {
      message_text: `<b>${esc3(head)}</b>
${esc3(line)}`,
      parse_mode: "HTML",
      link_preview_options: big ? { url: big, prefer_large_media: true, show_above_text: true } : { is_disabled: true }
    },
    reply_markup: { inline_keyboard: [[{ text: e.k === "character" ? BUTTON[lang2].character : BUTTON[lang2].work, url: `https://t.me/${bot.name}?startapp=${e.p}` }]] }
  };
}
var POLL_HINT = { ru: "\u0421\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u043E\u0434\u0431\u043E\u0440\u043A\u0443 \u2014 \u0438\u043B\u0438 \u043F\u0435\u0440\u0435\u0447\u0438\u0441\u043B\u0438\u0442\u0435 \u0444\u0438\u043B\u044C\u043C\u044B \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E", en: "Pick films \u2014 or list them separated by commas" };
async function answerPoll(env, q, rest, idx, lang2) {
  let films = [];
  let session;
  const titles = pollTitles(rest);
  if (titles.length && idx) {
    const seen = /* @__PURE__ */ new Set();
    for (const t of titles) {
      const e = search(idx, t).find((x) => (x.k === "film" || x.k === "series") && !seen.has(x.p));
      if (e) {
        seen.add(e.p);
        films.push({ t: e.t, ...e.y ? { y: e.y } : {}, ...e.i ? { i: e.i } : {} });
      }
    }
  } else if (q.from) {
    const deck = await lastDeck(env, q.from.id);
    if (deck) ({ films, session } = deck);
  }
  const results = films.length >= 2 && q.from ? [await pollResult(env, films, q.from.id, lang2, session)] : [];
  await tg(env, "answerInlineQuery", {
    inline_query_id: q.id,
    results,
    cache_time: 0,
    is_personal: true,
    ...results.length ? {} : { button: { text: POLL_HINT[lang2], start_parameter: "together" } }
  });
}
async function answerGroup(env, q, nicks, idx, lang2) {
  const T2 = GROUP_T[lang2];
  let results = [];
  let hint = T2.nobody([]);
  if (q.from) {
    if (idx && !idx.byId) idx.byId = new Map(idx.list.map((e) => [e.p, e]));
    const lookup = (workId) => {
      const e = idx?.byId?.get(`w-${workId.replace(":", "_")}`);
      return e && { t: e.t, k: e.k, ...e.y ? { y: e.y } : {}, ...e.i ? { i: e.i } : {} };
    };
    const r = await groupPick(env, q.from.id, nicks, lookup);
    if ("films" in r) {
      results = [await pollResult(
        env,
        r.films,
        q.from.id,
        lang2,
        void 0,
        { title: T2.title(r.names), ...r.missing.length ? { note: T2.missing(r.missing) } : {} }
      )];
    } else hint = r.error === "nobody" ? T2.nobody(r.missing) : T2[r.error];
  }
  await tg(env, "answerInlineQuery", {
    inline_query_id: q.id,
    results,
    cache_time: 0,
    is_personal: true,
    ...results.length ? {} : { button: { text: hint, start_parameter: "together" } }
  });
}
async function answer(env, q) {
  const idx = await index(env);
  const lang2 = langOf(q.from?.language_code);
  const nicks = groupQuery(q.query);
  if (nicks) return answerGroup(env, q, nicks, idx, lang2);
  const rest = pollQuery(q.query);
  if (rest !== void 0) return answerPoll(env, q, rest, idx, lang2);
  const found = idx ? search(idx, q.query) : [];
  await tg(env, "answerInlineQuery", { inline_query_id: q.id, results: found.map((e) => result(e, lang2)), cache_time: 300, is_personal: true });
}
async function telegramUpdate(req, env) {
  if (!env.BOT_TOKEN) return new Response("no bot", { status: 503 });
  if (req.headers.get("x-telegram-bot-api-secret-token") !== await webhookSecret(env.BOT_TOKEN)) return new Response("forbidden", { status: 403 });
  try {
    const update = await req.json().catch(() => ({}));
    if (typeof update.update_id === "number") {
      const seen = await env.DB.prepare("INSERT OR IGNORE INTO tg_update (update_id, at) VALUES (?, ?)").bind(update.update_id, (/* @__PURE__ */ new Date()).toISOString()).run();
      if (seen.meta?.changes === 0) return new Response("ok");
    }
    if (update.inline_query) await answer(env, update.inline_query);
    if (update.callback_query) await pollVote(env, update.callback_query).catch((err) => console.error("poll vote", err));
    if (update.message) await togetherCommand(env, update.message).catch((err) => console.error("together command", err));
  } catch (err) {
    console.error("telegram update:", err?.stack ?? err);
  }
  return new Response("ok");
}
async function adminWebhook(req, env) {
  if (!env.BOT_TOKEN) return Response.json({ error: "no_bot_token" }, { status: 503 });
  const b = await req.json().catch(() => ({}));
  const api2 = (method, body) => tg(env, method, body);
  if (b.action === "set") {
    if (!b.url || !/^https:\/\/[^/]+\/api\/telegram$/.test(b.url)) return Response.json({ error: "url" }, { status: 400 });
    const origin2 = env.PUBLIC_ORIGIN?.trim();
    if (!origin2) return Response.json({ error: "no_public_origin", hint: "\u0437\u0430\u0434\u0430\u0439\u0442\u0435 PUBLIC_ORIGIN=https://<\u0430\u0434\u0440\u0435\u0441 \u0441\u0435\u0440\u0432\u0435\u0440\u0430> \u0432 \u043F\u0430\u043D\u0435\u043B\u0438 bothost" }, { status: 503 });
    let ownHost = "";
    try {
      ownHost = new URL(origin2).host;
    } catch {
      return Response.json({ error: "bad_public_origin" }, { status: 503 });
    }
    if (!ownHost || new URL(b.url).host !== ownHost) return Response.json({ error: "url_host" }, { status: 400 });
    const hook = await api2("setWebhook", { url: b.url, secret_token: await webhookSecret(env.BOT_TOKEN), allowed_updates: ["inline_query", "message", "callback_query"], drop_pending_updates: true });
    const commands = [{ command: "together", description: "\u0412\u044B\u0431\u0440\u0430\u0442\u044C \u0444\u0438\u043B\u044C\u043C \u0432\u043C\u0435\u0441\u0442\u0435" }];
    const en = [{ command: "together", description: "Pick a film together" }];
    await api2("setMyCommands", { commands });
    await api2("setMyCommands", { commands: en, language_code: "en" });
    await api2("setMyCommands", { commands, scope: { type: "all_group_chats" } });
    await api2("setMyCommands", { commands: en, scope: { type: "all_group_chats" }, language_code: "en" });
    return Response.json(hook);
  }
  if (b.action === "delete") return Response.json(await api2("deleteWebhook", { drop_pending_updates: true }));
  const info = await api2("getWebhookInfo");
  const me = await api2("getMe");
  return Response.json({ webhook: info.result, bot: me.result?.username, inline: me.result?.supports_inline_queries ?? false });
}
var clip = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
function shareResult(c) {
  const head = `${c.title}${c.year ? ` (${c.year})` : ""}`;
  const line = [c.kind && c.kind !== "together" ? KINDS[c.lang ?? "ru"][c.kind] : void 0, c.by].filter(Boolean).join(" \xB7 ");
  const text = [`<b>${esc3(head)}</b>`, line ? esc3(line) : "", c.about ? `
${esc3(c.about)}` : ""].filter(Boolean).join("\n");
  const B = BUTTON[c.lang ?? "ru"];
  const button = c.kind === "together" ? B.together : c.kind === "character" ? B.character : B.work;
  const reply_markup = { inline_keyboard: [[{ text: button, url: `https://t.me/${bot.name}?startapp=${c.param}` }]] };
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
    ...IMAGE_HOSTS.test(image) ? { image } : {},
    ...b.lang === "en" ? { lang: "en" } : {}
  };
  const save = (result2) => tg(
    env,
    "savePreparedInlineMessage",
    { user_id: tgId, result: result2, allow_user_chats: true, allow_group_chats: true, allow_channel_chats: true, allow_bot_chats: false }
  );
  let r = await save(shareResult(card));
  if (!r.ok && card.image && r.error_code !== 0) r = await save(shareResult({ ...card, image: void 0 }));
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
async function seasonNews(env, seasons, now2 = /* @__PURE__ */ new Date(), users) {
  const out = /* @__PURE__ */ new Map();
  const fresh = freshSeasons(seasons, now2);
  if (!fresh.size) return out;
  const add = (user, n) => {
    const list = out.get(user) ?? [];
    if (!list.some((x) => x.key === n.key)) list.push(n);
    out.set(user, list);
  };
  const only = users ? " AND user_id IN (SELECT value FROM json_each(?))" : "";
  const scope = users ? [JSON.stringify(users)] : [];
  const journal = await env.DB.prepare(`SELECT user_id, work_id, work, status, series FROM journal WHERE status IN ('in_progress', 'finished') AND work IS NOT NULL${only}`).bind(...scope).all();
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
  const follows = await env.DB.prepare(`SELECT user_id, ref, keys, title FROM follow WHERE kind = 'work'${only}`).bind(...scope).all();
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
var FRESH_DAYS2 = 14;
var KEEP_DAYS2 = 30;
var MAX_FOLLOWS = 100;
var PER_FOLLOW = 3;
var MAX_SECTIONS = 6;
var HOUR_MSK = 10;
var json2 = (body, status = 200) => Response.json(body, { status });
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
  rows.push(env.DB.prepare("DELETE FROM follow_fresh WHERE at < ?").bind(iso(new Date(now2.getTime() - KEEP_DAYS2 * 864e5))));
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
  return json2({ follows: rows.results, telegram: me?.tg_id != null });
}
async function putFollow(req, userId, env) {
  const b = await req.json().catch(() => ({}));
  const kind = b.kind === "work" || b.kind === "character" ? b.kind : void 0;
  const ref = typeof b.ref === "string" ? b.ref.trim() : "";
  if (!kind || !(kind === "character" ? /^(Q\d{1,12}|aoiaf-\d{1,6})$/.test(ref) : WORK_KEY.test(ref))) return json2({ error: "bad_follow" }, 400);
  if (b.on === false) {
    await env.DB.prepare("DELETE FROM follow WHERE user_id = ? AND kind = ? AND ref = ?").bind(userId, kind, ref).run();
    return getFollows(userId, env);
  }
  const title = typeof b.title === "string" ? b.title.trim().slice(0, 120) : "";
  if (!title) return json2({ error: "bad_follow" }, 400);
  const keys = kind === "work" ? [.../* @__PURE__ */ new Set([ref, ...(Array.isArray(b.keys) ? b.keys : []).filter((k) => typeof k === "string" && WORK_KEY.test(k))])].slice(0, 8) : [];
  const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM follow WHERE user_id = ?").bind(userId).first();
  if ((count?.n ?? 0) >= MAX_FOLLOWS) return json2({ error: "too_many" }, 400);
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO follow (user_id, kind, ref, keys, title, at) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, kind, ref) DO UPDATE SET keys = excluded.keys, title = excluded.title`).bind(userId, kind, ref, keys.join(","), title, iso()),
    // снова подписался — значит, писать ему снова можно (бота могли разблокировать)
    env.DB.prepare("UPDATE follow_digest SET blocked = 0 WHERE user_id = ?").bind(userId)
  ]);
  return getFollows(userId, env);
}
var esc4 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
var DIGEST = {
  ru: {
    spoiler: "\u0440\u0430\u0437\u0431\u043E\u0440 \u0441\u043E \u0441\u043F\u043E\u0439\u043B\u0435\u0440\u0430\u043C\u0438",
    seasonHead: "\u0412\u044B\u0448\u0435\u043B \u043D\u043E\u0432\u044B\u0439 \u0441\u0435\u0437\u043E\u043D",
    season: (n) => `${n} \u0441\u0435\u0437\u043E\u043D`,
    watched: " \u2014 \u0432\u044B \u0434\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u043B\u0438 \u043F\u0440\u0435\u0436\u043D\u0438\u0435",
    essaysHead: "\u041D\u043E\u0432\u044B\u0435 \u0440\u0430\u0437\u0431\u043E\u0440\u044B \u043F\u043E \u0432\u0430\u0448\u0438\u043C \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0430\u043C",
    more: (n) => `\u2014 \u0438 \u0435\u0449\u0451 ${n}`,
    moreFollows: (n) => `\u0418 \u0435\u0449\u0451 \u043F\u043E\u0434\u043F\u0438\u0441\u043E\u043A \u0441 \u043D\u043E\u0432\u0438\u043D\u043A\u0430\u043C\u0438: ${n}.`,
    hint: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0438 \u2014 \u043A\u043D\u043E\u043F\u043A\u0430 \xAB\u0421\u043B\u0435\u0434\u0438\u0442\u044C\xBB \u043D\u0430 \u0441\u0442\u0440\u0430\u043D\u0438\u0446\u0435 \u0433\u0435\u0440\u043E\u044F \u0438\u043B\u0438 \u043F\u0440\u043E\u0438\u0437\u0432\u0435\u0434\u0435\u043D\u0438\u044F.",
    q: (t) => `\xAB${t}\xBB`
  },
  en: {
    spoiler: "an essay with spoilers",
    seasonHead: "A new season is out",
    season: (n) => `season ${n}`,
    watched: " \u2014 you finished the earlier ones",
    essaysHead: "New essays on what you follow",
    more: (n) => `\u2014 and ${n} more`,
    moreFollows: (n) => `More follows with news: ${n}.`,
    hint: "To follow, tap \u201CFollow\u201D on a character or title page.",
    q: (t) => `\u201C${t}\u201D`
  }
};
var paramOf = (f) => f.kind === "character" ? `h-${f.ref}` : `w-${f.ref.replace(":", "_")}`;
function matchFollow(f, fresh, heroes) {
  if (f.kind === "work") {
    const keys = new Set(f.keys.split(",").filter(Boolean));
    return fresh.filter((x) => keys.has(x.key) && x.tier !== "review");
  }
  const h = heroes[f.ref];
  if (!h) return [];
  const own2 = h.own ? new RegExp(h.own, "u") : void 0;
  const other = h.other ? new RegExp(h.other, "u") : void 0;
  const works = new Set(h.works);
  return fresh.filter((x) => {
    const about = x.lens?.split("/").includes("character");
    if (x.tier === "review" && !about) return false;
    return (works.has(x.key) ? own2 : other)?.test(x.title) ?? false;
  });
}
function digestMessage(sections, seasons = [], lang2 = "ru") {
  const T2 = DIGEST[lang2];
  const shown2 = sections.slice(0, MAX_SECTIONS);
  const lines = [];
  const shownSeasons = seasons.slice(0, MAX_SECTIONS);
  if (shownSeasons.length) {
    lines.push(`<b>${T2.seasonHead}</b>`);
    for (const x of shownSeasons) lines.push(`\u2014 ${T2.q(esc4(x.title))}: ${T2.season(x.season)}${x.why === "watched" ? T2.watched : ""}`);
  }
  if (shown2.length) lines.push(...lines.length ? [""] : [], `<b>${T2.essaysHead}</b>`);
  for (const { follow, items } of shown2) {
    lines.push("", `<b>${esc4(follow.title)}</b> \xB7 ${items.length}`);
    for (const x of items.slice(0, PER_FOLLOW)) lines.push(`\u2014 ${esc4(x.author)}: ${x.spoiler >= 2 ? T2.spoiler : T2.q(esc4(x.title))}`);
    if (items.length > PER_FOLLOW) lines.push(T2.more(items.length - PER_FOLLOW));
  }
  if (sections.length > shown2.length) lines.push("", T2.moreFollows(sections.length - shown2.length));
  lines.push("", `<i>${T2.hint}</i>`);
  const buttons = [
    ...shownSeasons.map((x) => [{ text: `${x.title.slice(0, 32)} \xB7 ${T2.season(x.season)}`, url: `https://t.me/${bot.name}?startapp=${paramOf({ kind: "work", ref: x.key })}` }]),
    ...shown2.map(({ follow }) => [{ text: follow.title.slice(0, 40), url: `https://t.me/${bot.name}?startapp=${paramOf(follow)}` }])
  ];
  return { text: lines.join("\n"), reply_markup: { inline_keyboard: buttons } };
}
var LOCK = "follow-digest";
var LOCK_STALE = 30 * 6e4;
var running = false;
async function lockDigest(env, now2) {
  const at = iso(now2);
  await env.DB.prepare("INSERT OR IGNORE INTO job_lock (name, locked_at, until) VALUES (?, '', '')").bind(LOCK).run();
  const got = await env.DB.prepare("UPDATE job_lock SET locked_at = ? WHERE name = ? AND locked_at < ? AND until <= ?").bind(at, LOCK, iso(new Date(now2.getTime() - LOCK_STALE)), at).run();
  if (got.meta?.changes === 1) return { at };
  const row = await env.DB.prepare("SELECT until FROM job_lock WHERE name = ?").bind(LOCK).first();
  return row && row.until > at ? { pausedUntil: row.until } : { busy: true };
}
var unlockDigest = (env, at) => env.DB.prepare("UPDATE job_lock SET locked_at = '' WHERE name = ? AND locked_at = ?").bind(LOCK, at).run();
var GONE = /chat not found|user not found|bot was blocked|user is deactivated|bot can't initiate|PEER_ID_INVALID|have no rights to send/i;
async function followDigest(env, { now: now2 = /* @__PURE__ */ new Date(), force = false, dry = false } = {}) {
  const { day, hour } = msk(now2);
  const report = { due: force || hour >= HOUR_MSK, users: 0, sent: 0, empty: 0, blocked: 0, failed: 0, ...dry ? { preview: [] } : {} };
  if (!report.due || !env.BOT_TOKEN) return report;
  if (dry) return digestRun(env, report, { now: now2, day, force, dry });
  if (running) return { ...report, busy: true };
  running = true;
  try {
    const lock = await lockDigest(env, now2);
    if (!("at" in lock)) return { ...report, ...lock };
    try {
      return await digestRun(env, report, { now: now2, day, force, dry });
    } finally {
      await unlockDigest(env, lock.at).catch((err) => console.error("\u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438: \u0437\u0430\u043C\u043E\u043A \u043D\u0435 \u0441\u043D\u044F\u0442", err));
    }
  } finally {
    running = false;
  }
}
async function digestRun(env, report, { now: now2, day, force, dry }) {
  const started = Date.now();
  const candidates = (await env.DB.prepare(`SELECT u.id AS id, u.tg_id AS tg, d.at AS last, d.day AS prev_day, json_extract(u.settings, '$.language') AS lang,
      EXISTS (SELECT 1 FROM follow f WHERE f.user_id = u.id) AS follows
    FROM user u LEFT JOIN follow_digest d ON d.user_id = u.id
    WHERE u.tg_id IS NOT NULL AND COALESCE(d.blocked, 0) = 0 ${force ? "" : "AND (d.day IS NULL OR d.day < ?)"}`).bind(...force ? [] : [day]).all()).results;
  if (!candidates.length) return report;
  const seasons = await reference(env, "seriesSeasons") ?? {};
  const news = await seasonNews(env, seasons, now2, candidates.map((u) => u.id)).catch((err) => {
    console.error("seasonNews", err);
    return /* @__PURE__ */ new Map();
  });
  const users = candidates.filter((u) => u.follows || news.has(u.id));
  report.users = users.length;
  if (!users.length) return report;
  const oldest = users.reduce((m, u) => u.last && u.last < m ? u.last : m, iso(now2));
  const fresh = (await env.DB.prepare("SELECT * FROM follow_fresh WHERE at > ? ORDER BY at").bind(users.some((u) => !u.last) ? "" : oldest).all()).results;
  const heroes = await reference(env, "heroes") ?? {};
  const markSent = (userId) => env.DB.prepare(`INSERT INTO follow_digest (user_id, at, day, blocked, state) VALUES (?, ?, ?, 0, NULL)
    ON CONFLICT(user_id) DO UPDATE SET at = excluded.at, day = excluded.day, blocked = 0, state = NULL`).bind(userId, iso(now2), day).run();
  const markSending = async (userId) => (await env.DB.prepare(`INSERT INTO follow_digest (user_id, at, day, blocked, state) VALUES (?, '', ?, 0, 'sending')
    ON CONFLICT(user_id) DO UPDATE SET day = excluded.day, state = 'sending' ${force ? "" : "WHERE follow_digest.day < excluded.day"}`).bind(userId, day).run()).meta?.changes === 1;
  const unmark = (userId, prevDay) => env.DB.prepare("UPDATE follow_digest SET day = ?, state = NULL WHERE user_id = ? AND state = 'sending'").bind(prevDay ?? "", userId).run();
  const markBlocked = (userId) => env.DB.prepare("UPDATE follow_digest SET blocked = 1, state = NULL WHERE user_id = ?").bind(userId).run();
  for (const u of users) {
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
      if (!dry) await markSent(u.id);
      continue;
    }
    const msg = digestMessage(sections, seasonsNew, u.lang === "en" ? "en" : "ru");
    if (dry) {
      report.preview.push({ user: u.id, text: msg.text });
      continue;
    }
    if (!await markSending(u.id)) continue;
    const r = await tg(env, "sendMessage", { chat_id: u.tg, text: msg.text, parse_mode: "HTML", reply_markup: msg.reply_markup, link_preview_options: { is_disabled: true } });
    if (r.ok) {
      report.sent++;
      await markSent(u.id);
      if (seasonsNew.length) await env.DB.batch(noteSeasons(env, u.id, seasonsNew, now2));
      continue;
    }
    if (r.error_code === 403 || r.error_code === 400 && GONE.test(r.description ?? "")) {
      report.blocked++;
      await markBlocked(u.id);
      continue;
    }
    report.failed++;
    if (r.error_code === 429) {
      await unmark(u.id, u.prev_day);
      const wait = Math.max(1, Number(r.parameters?.retry_after) || 60);
      report.pausedUntil = iso(new Date(now2.getTime() + (Date.now() - started) + wait * 1e3));
      report.stopped = "rate_limit";
      await env.DB.prepare("UPDATE job_lock SET until = ? WHERE name = ?").bind(report.pausedUntil, LOCK).run();
      console.warn(`\u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438: 429 \u043E\u0442 Telegram, \u043F\u0430\u0443\u0437\u0430 ${wait} \u0441`);
      break;
    }
    if (r.error_code === 0) {
      report.stopped = "telegram_down";
      break;
    }
    await unmark(u.id, u.prev_day);
  }
  return report;
}
async function adminDigest(req, env) {
  const b = await req.json().catch(() => ({}));
  return json2(await followDigest(env, { dry: b.dry !== false, force: b.force === true }));
}

// worker/pages.ts
var SITE = "Transformative Media";
var PER_PAGE = 40;
var PIC_HOSTS = /^https:\/\/(?:image\.tmdb\.org|covers\.openlibrary\.org|upload\.wikimedia\.org|thumb\.wikimedia\.org)\//;
var esc5 = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var norm3 = (s) => s.toLowerCase().replace(/ё/g, "\u0435").replace(/\s+/g, " ").trim();
var keyToPath = (key) => key.replace(":", "-");
var pathToKey = (p) => p.replace(/^([a-z]{2,10})-/, "$1:");
var startapp = (key) => `https://t.me/${bot.name}?startapp=w-${key.replace(":", "_")}--sseo`;
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
    const k = norm3(a.author);
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
<title>${esc5(o.title)}</title>
<meta name="description" content="${esc5(o.description)}">
<link rel="canonical" href="${esc5(o.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc5(o.title)}">
<meta property="og:description" content="${esc5(o.description)}">
<meta property="og:url" content="${esc5(o.canonical)}">
${o.image ? `<meta property="og:image" content="${esc5(o.image)}">
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
  const slug = slugOf.get(norm3(a.author));
  const who = slug ? `<a class="who" href="/author/${encodeURIComponent(slug)}">${esc5(a.author)}</a>` : `<span class="who">${esc5(a.author)}</span>`;
  return `<li>${who}<br>${link(a)}</li>`;
}
var link = (a) => {
  const meta = [a.tier === "essay" ? "\u044D\u0441\u0441\u0435" : "\u043E\u0431\u0437\u043E\u0440", a.durationMinutes ? `${a.durationMinutes} \u043C\u0438\u043D` : "", a.publishedAt ? a.publishedAt.slice(0, 4) : "", (a.spoilerLevel ?? 0) >= 2 ? "\u0441\u043F\u043E\u0439\u043B\u0435\u0440\u044B" : ""].filter(Boolean).join(" \xB7 ");
  return `<a href="${esc5(a.url)}" rel="noopener" target="_blank">\xAB${esc5(a.title)}\xBB</a><br><span class="meta">${meta}</span>`;
};
function filmItem(key, w, xs) {
  const more = xs.length > 3 ? `<br><span class="meta">\u0438 \u0435\u0449\u0451 ${xs.length - 3}</span>` : "";
  return `<li><a class="who" href="/film/${keyToPath(key)}">${esc5(w.t)}${year(w)}</a>${xs.slice(0, 3).map((a) => `<br>${link(a)}`).join("")}${more}</li>`;
}
async function data(env) {
  const [pages, essays] = await Promise.all([reference(env, "publicPages"), reference(env, "essaysAuto")]);
  if (!pages || !essays) return void 0;
  const slugOf = new Map(Object.entries(pages.authors).map(([slug, a]) => [norm3(a.n), slug]));
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
  const pic = w.p && PIC_HOSTS.test(w.p) ? w.p : void 0;
  const body = `<div class="hero">${pic ? `<img src="${esc5(pic)}" alt="${esc5(w.t)}">` : ""}<div>
<h1>${esc5(w.t)}${year(w)}</h1>${sub ? `<p class="sub">${esc5(sub)}</p>` : ""}
${w.w ? `<p class="what">${esc5(w.w)}</p>` : ""}</div></div>
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
    ...pic ? { image: pic } : {},
    url: canonical
  };
  return page({ title: `${w.t}${year(w)} \u2014 \u0440\u0430\u0437\u0431\u043E\u0440\u044B \u0438 \u043E\u0431\u0437\u043E\u0440\u044B ${kind} | ${SITE}`, description, canonical, image: pic, body, jsonLd });
}
async function authorPage(req, env, slug) {
  const d = await data(env);
  const a = d?.pages.authors[slug];
  if (!d || !a) return notFound();
  const items = (authorIndex(d.essays).get(norm3(a.n)) ?? []).filter((x) => d.pages.works[x.key]).sort((x, y) => (y.a.publishedAt ?? "").localeCompare(x.a.publishedAt ?? ""));
  const films = /* @__PURE__ */ new Map();
  for (const x of items) films.set(x.key, [...films.get(x.key) ?? [], x.a]);
  const canonical = `${origin(req, env)}/author/${encodeURIComponent(slug)}`;
  const role = a.b ? "\u043E \u043A\u043D\u0438\u0433\u0430\u0445 \u0438 \u044D\u043A\u0440\u0430\u043D\u0438\u0437\u0430\u0446\u0438\u044F\u0445" : a.e ? "\u0432\u0438\u0434\u0435\u043E\u044D\u0441\u0441\u0435 \u043E \u043A\u0438\u043D\u043E" : "\u043E\u0431\u0437\u043E\u0440\u044B \u043A\u0438\u043D\u043E";
  const body = `<h1>${esc5(a.n)}</h1><p class="sub">${role} \xB7 <a href="${esc5(a.u)}" rel="noopener" target="_blank">\u043A\u0430\u043D\u0430\u043B \u0430\u0432\u0442\u043E\u0440\u0430</a></p>
<a class="cta" href="https://t.me/${bot.name}?startapp=--sseo">\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 Telegram</a>
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
${urls.map((u) => `<url><loc>${esc5(u)}</loc><lastmod>${day}</lastmod></url>`).join("\n")}
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
var json3 = (body, status = 200) => Response.json(body, { status });
var iso2 = () => (/* @__PURE__ */ new Date()).toISOString();
var KINDS2 = ["source", "excluded", "tgchannel", "video", "post", "doc"];
var isKind = (k) => typeof k === "string" && KINDS2.includes(k);
var MAX_CHANGES = 2e4;
var MAX_BODY = 16e3;
var CHUNK = 400;
var LOG_DAYS = 365;
var COMMENT = /^\s*(?:\/\/.*)?$/;
var LINE_BREAK = /[\r\n\u2028\u2029]/;
var isComment = (s) => typeof s === "string" && !LINE_BREAK.test(s) && COMMENT.test(s);
var commentLines = (v) => Array.isArray(v) && v.every(isComment);
var IDENT = /^[A-Za-z_$][\w$]*$/;
function sourcesSafe(kind, id, body) {
  if (kind === "source") {
    if (body._before !== void 0 && !commentLines(body._before)) return false;
    if (body._after !== void 0 && !isComment(body._after)) return false;
    return Object.keys(body).every((k) => IDENT.test(k));
  }
  if (kind === "doc" && id === "sources") return body.end === void 0 || commentLines(body.end);
  return true;
}
async function version(db) {
  const r = await db.prepare("SELECT v FROM registry_meta WHERE k = 'version'").first();
  return r?.v ?? 0;
}
var bump = (db) => db.prepare(
  "INSERT INTO registry_meta (k, v) VALUES ('version', 1) ON CONFLICT (k) DO UPDATE SET v = registry_meta.v + 1"
);
async function getRegistry(url, env) {
  const kind = url.searchParams.get("kind");
  if (kind && !isKind(kind)) return json3({ error: "bad_kind" }, 400);
  const rows = kind ? await env.DB.prepare("SELECT kind, id, body, ord, at, by FROM registry WHERE kind = ? ORDER BY ord, id").bind(kind).all() : await env.DB.prepare("SELECT kind, id, body, ord, at, by FROM registry ORDER BY kind, ord, id").all();
  return json3({
    version: await version(env.DB),
    at: iso2(),
    rows: rows.results.map((r) => ({ kind: r.kind, id: r.id, ord: r.ord, at: r.at, by: r.by, body: JSON.parse(r.body) }))
  });
}
async function getRegistryVersion(env) {
  return json3({ version: await version(env.DB) });
}
async function postRegistry(req, env) {
  let input;
  try {
    input = await req.json();
  } catch {
    return json3({ error: "bad_json" }, 400);
  }
  const by = typeof input.by === "string" && /^[\w.:-]{1,40}$/.test(input.by) ? input.by : void 0;
  if (!by) return json3({ error: "bad_by" }, 400);
  if (!Array.isArray(input.changes) || input.changes.length > MAX_CHANGES) return json3({ error: "bad_changes" }, 400);
  const changes = [];
  for (const c of input.changes) {
    if (!c || !isKind(c.kind) || typeof c.id !== "string" || !c.id || c.id.length > 400) return json3({ error: "bad_change", change: c }, 400);
    if (c.body !== null && (typeof c.body !== "object" || Array.isArray(c.body))) return json3({ error: "bad_body", id: c.id }, 400);
    if (c.body !== null && JSON.stringify(c.body).length > MAX_BODY) return json3({ error: "body_too_long", id: c.id }, 400);
    if (c.body !== null && !sourcesSafe(c.kind, c.id, c.body)) return json3({ error: "bad_comment", id: c.id }, 400);
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
  return json3({ ok: true, applied, version: await version(env.DB) });
}
async function getRegistryLog(url, env) {
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 100, 1e3);
  const r = kind && id ? await env.DB.prepare("SELECT seq, kind, id, before, after, at, by FROM registry_log WHERE kind = ? AND id = ? ORDER BY seq DESC LIMIT ?").bind(kind, id, limit).all() : await env.DB.prepare("SELECT seq, kind, id, before, after, at, by FROM registry_log ORDER BY seq DESC LIMIT ?").bind(limit).all();
  return json3({ rows: r.results });
}
async function getSources(env) {
  const r = await env.DB.prepare("SELECT body FROM registry WHERE kind = 'source' ORDER BY ord, id").all();
  if (!r.results.length) return json3({ error: "empty" }, 404);
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
    return json3({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(input.rows) || input.rows.length > 5e3) return json3({ error: "bad_rows" }, 400);
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
  const held2 = /* @__PURE__ */ new Set();
  const urls = rows.map((r) => r.url);
  for (let i = 0; i < urls.length; i += 90) {
    const slice = urls.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT url FROM registry_inbox WHERE url IN (${slice.map(() => "?").join(",")})`).bind(...slice).all();
    for (const x of r.results) held2.add(x.url);
  }
  return json3({ ok: true, held: [...held2] });
}
async function getInbox(url, env) {
  const status = url.searchParams.get("status");
  const r = status ? await env.DB.prepare("SELECT * FROM registry_inbox WHERE status = ? ORDER BY taken_at, url").bind(status).all() : await env.DB.prepare("SELECT * FROM registry_inbox ORDER BY taken_at DESC, url LIMIT 2000").all();
  return json3({ rows: r.results.map((x) => ({ ...x, result: typeof x.result === "string" ? JSON.parse(x.result) : x.result })) });
}
async function postInboxResult(req, env) {
  let input;
  try {
    input = await req.json();
  } catch {
    return json3({ error: "bad_json" }, 400);
  }
  if (!Array.isArray(input.items) || input.items.length > 5e3) return json3({ error: "bad_items" }, 400);
  const at = iso2();
  const stmts = [];
  for (const it of input.items) {
    if (typeof it?.url !== "string" || !["done", "skip", "error", "new"].includes(String(it.status))) continue;
    const result2 = it.result === void 0 ? null : JSON.stringify(it.result).slice(0, MAX_BODY);
    stmts.push(env.DB.prepare("UPDATE registry_inbox SET status = ?, result = ?, done_at = ? WHERE url = ?").bind(String(it.status), result2, at, it.url));
  }
  for (let i = 0; i < stmts.length; i += CHUNK) await env.DB.batch(stmts.slice(i, i + CHUNK));
  return json3({ ok: true, updated: stmts.length });
}

// worker/auth.ts
var enc = new TextEncoder();
async function hmac(key, data2) {
  const cryptoKey = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(data2));
}
var hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
var tokenHash = async (token) => `h:${hex(await crypto.subtle.digest("SHA-256", enc.encode(token)))}`;
function same(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function verifyInitData(raw, botToken, maxAgeSeconds = 3600) {
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
  const age = Date.now() / 1e3 - authDate;
  if (!authDate || age > maxAgeSeconds || age < -60) return { ok: false, reason: "stale" };
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

// src/mocks/workAliases.ts
var workAliasesVersion = "7b3b9f096714";
var workAliases = {
  "b-wd1229792": "w15",
  "b-wd135515": "w14",
  "b-wd172850": "w12",
  "b-wd188538": "w16",
  "b-wd261281": "w17",
  "b-wd265954": "w11",
  "b-wd673156": "b-wd15555061",
  "b-wd70469944": "b-wd28306",
  "f-tmdb1018": "c-mulholland",
  "f-tmdb10494": "c-perfect-blue",
  "f-tmdb1052": "c-blow-up",
  "f-tmdb11423": "c-memories",
  "f-tmdb1156125": "f-wd120897557",
  "f-tmdb1366": "f-wd188652",
  "f-tmdb14337": "c-primer",
  "f-tmdb181886": "c-enemy",
  "f-tmdb188166": "c-blue-ruin",
  "f-tmdb1949": "c-zodiac",
  "f-tmdb27205": "w08",
  "f-tmdb273481": "c-sicario",
  "f-tmdb290098": "c-handmaiden",
  "f-tmdb31442": "w05",
  "f-tmdb329865": "w04",
  "f-tmdb348": "f-wd103569",
  "f-tmdb389": "w01",
  "f-tmdb438631": "f-wd60834962",
  "f-tmdb458723": "f-wd56000996",
  "f-tmdb46738": "c-incendies",
  "f-tmdb493922": "c-hereditary",
  "f-tmdb503919": "c-lighthouse",
  "f-tmdb517104": "f-wd51834363",
  "f-tmdb536554": "f-wd110661062",
  "f-tmdb548": "w02",
  "f-tmdb577922": "f-wd63985561",
  "f-tmdb593": "w06",
  "f-tmdb62": "f-wd103474",
  "f-tmdb64690": "f-wd732960",
  "f-tmdb652": "f-wd186587",
  "f-tmdb762504": "f-wd107176162",
  "f-tmdb77": "w03",
  "f-tmdb779": "f-wd304923",
  "f-tmdb807": "f-wd190908",
  "f-tmdb817758": "f-wd108649516",
  "f-tmdb817962": "f-wd89186326",
  "f-tmdb913290": "c-barbarian",
  "f-tmdb915935": "c-anatomy",
  "f-tmdb97370": "c-under-the-skin",
  "f-wd1419980": "c-sleuth",
  "f-wd22972803": "c-wailing",
  "f-wd2345": "w01",
  "f-wd27964354": "c-burning",
  "f-wd2844879": "c-enemy",
  "f-wd61448040": "w09",
  "f-wd838149": "w07",
  "f-wd860479": "w10",
  "f-wd97314140": "f-wd30887826",
  "l-tmdb10212": "f-wd2133691",
  "l-tmdb10226": "f-wd587407",
  "l-tmdb1058619": "f-wd116745247",
  "l-tmdb1062722": "f-wd124393045",
  "l-tmdb1072342": "f-wd117842595",
  "l-tmdb11020": "f-wd1421747",
  "l-tmdb11096": "f-wd1124080",
  "l-tmdb11976": "f-wd509913",
  "l-tmdb1398": "f-tmdb1398",
  "l-tmdb1427": "f-wd164813",
  "l-tmdb152601": "f-tmdb152601",
  "l-tmdb155084": "f-wd15110422",
  "l-tmdb17431": "f-tmdb17431",
  "l-tmdb208763": "f-wd4110928",
  "l-tmdb22970": "f-tmdb22970",
  "l-tmdb23488": "f-wd921510",
  "l-tmdb26466": "f-wd1783930",
  "l-tmdb2649": "f-tmdb2649",
  "l-tmdb2652": "f-wd841476",
  "l-tmdb2668": "f-wd208592",
  "l-tmdb27205": "w08",
  "l-tmdb272692": "f-wd18153209",
  "l-tmdb273477": "f-wd17112933",
  "l-tmdb298312": "f-wd18386312",
  "l-tmdb310131": "f-tmdb310131",
  "l-tmdb324560": "f-wd19571121",
  "l-tmdb32985": "f-wd1781432",
  "l-tmdb340837": "f-wd20649157",
  "l-tmdb361292": "f-wd28123467",
  "l-tmdb38319": "f-wd1415029",
  "l-tmdb395458": "f-wd25646568",
  "l-tmdb41215": "f-wd679833",
  "l-tmdb41505": "f-wd2413607",
  "l-tmdb424121": "f-wd29454857",
  "l-tmdb426063": "f-wd116361132",
  "l-tmdb449664": "f-wd39843662",
  "l-tmdb467660": "f-wd39071240",
  "l-tmdb475557": "f-tmdb475557",
  "l-tmdb497828": "f-tmdb497828",
  "l-tmdb500664": "f-tmdb500664",
  "l-tmdb503919": "c-lighthouse",
  "l-tmdb505706": "f-wd56054702",
  "l-tmdb506775": "f-wd55624938",
  "l-tmdb514684": "f-wd60850079",
  "l-tmdb514847": "f-wd62720813",
  "l-tmdb524251": "f-wd65081437",
  "l-tmdb536517": "f-wd96679883",
  "l-tmdb539181": "f-wd87519760",
  "l-tmdb542224": "f-wd63994491",
  "l-tmdb547565": "f-wd77906196",
  "l-tmdb553141": "f-wd60851945",
  "l-tmdb5548": "f-tmdb5548",
  "l-tmdb563": "f-tmdb563",
  "l-tmdb574321": "f-wd65924999",
  "l-tmdb593643": "f-wd108444804",
  "l-tmdb6312": "f-wd1123891",
  "l-tmdb650030": "f-wd110687185",
  "l-tmdb663866": "f-wd104682813",
  "l-tmdb6947": "f-wd465227",
  "l-tmdb70670": "f-wd1592308",
  "l-tmdb728054": "f-wd107484172",
  "l-tmdb734353": "f-wd106610552",
  "l-tmdb74461": "f-wd3198009",
  "l-tmdb744857": "f-wd121367826",
  "l-tmdb752": "f-tmdb752",
  "l-tmdb760104": "f-tmdb760104",
  "l-tmdb782": "f-wd491800",
  "l-tmdb787752": "f-tmdb787752",
  "l-tmdb80184": "f-wd24196",
  "l-tmdb8066": "f-wd936808",
  "l-tmdb82507": "f-wd761519",
  "l-tmdb8284": "f-wd192160",
  "l-tmdb83899": "f-tmdb83899",
  "l-tmdb889737": "f-wd108628759",
  "l-tmdb9282": "f-wd171582",
  "l-tmdb933260": "f-wd113380226",
  "l-tmdb9529": "f-wd1033108",
  "l-tmdb9597": "f-wd935331",
  "l-tmdb97020": "f-wd864518",
  "u-kp1007990": "f-wd42837930",
  "u-kp1009784": "f-tmdb500664",
  "u-kp1011685": "f-wd42049340",
  "u-kp1021046": "f-wd81402968",
  "u-kp1055528": "f-wd62075994",
  "u-kp1122129": "f-wd62720813",
  "u-kp1143242": "f-wd60614686",
  "u-kp1152188": "f-wd65081437",
  "u-kp1178053": "f-wd96679883",
  "u-kp1179555": "f-wd60737911",
  "u-kp12198": "f-tmdb2649",
  "u-kp1233447": "f-wd64576691",
  "u-kp1239493": "f-wd100227242",
  "u-kp1248786": "f-wd66688968",
  "u-kp1280691": "f-wd99973585",
  "u-kp1309847": "f-wd104682813",
  "u-kp1318972": "f-wd74190990",
  "u-kp1346175": "f-wd101091774",
  "u-kp1346533": "f-wd107484172",
  "u-kp1348487": "f-tmdb497828",
  "u-kp1368294": "f-wd106610552",
  "u-kp1392550": "f-wd99900595",
  "u-kp1405778": "f-wd110687185",
  "u-kp1413552": "f-wd116447930",
  "u-kp1445972": "f-tmdb787752",
  "u-kp1762": "f-wd1346258",
  "u-kp195334": "f-tmdb1124",
  "u-kp22936": "f-tmdb10795",
  "u-kp252099": "f-wd1654430",
  "u-kp276295": "f-tmdb8321",
  "u-kp309": "f-wd507461",
  "u-kp34465": "f-wd587407",
  "u-kp345": "f-tmdb274",
  "u-kp361": "f-tmdb550",
  "u-kp377": "f-wd190908",
  "u-kp3797": "f-wd224647",
  "u-kp397667": "f-tmdb11324",
  "u-kp403783": "f-wd2413607",
  "u-kp418762": "f-wd2173967",
  "u-kp4382899": "f-tmdb760104",
  "u-kp4397602": "f-wd110040047",
  "u-kp4499838": "f-tmdb667216",
  "u-kp4542208": "f-wd113470320",
  "u-kp470185": "f-wd638544",
  "u-kp4853049": "f-wd109549619",
  "u-kp493222": "f-wd194696",
  "u-kp5012": "f-wd491800",
  "u-kp502733": "f-wd4328873",
  "u-kp505851": "f-wd1187607",
  "u-kp5080927": "f-wd117816797",
  "u-kp5119522": "f-wd115804772",
  "u-kp5212124": "f-wd116470610",
  "u-kp522892": "f-wd499851",
  "u-kp5234126": "f-wd120476405",
  "u-kp5235968": "f-wd118375337",
  "u-kp526812": "f-wd1592308",
  "u-kp5376030": "f-wd121367826",
  "u-kp5457984": "f-wd123284951",
  "u-kp566311": "f-wd3277324",
  "u-kp568374": "f-wd74643",
  "u-kp577488": "f-tmdb152601",
  "u-kp584175": "f-tmdb83899",
  "u-kp588786": "f-wd24196",
  "u-kp5942378": "f-wd122933268",
  "u-kp607928": "f-wd19571121",
  "u-kp6268": "f-tmdb931",
  "u-kp674295": "f-wd3019722",
  "u-kp679924": "f-wd17014394",
  "u-kp681849": "f-wd324011",
  "u-kp692861": "f-tmdb210577",
  "u-kp694108": "f-wd18153209",
  "u-kp7471": "f-wd493807",
  "u-kp75871": "f-tmdb670",
  "u-kp779602": "f-wd17851365",
  "u-kp811709": "f-wd15292486",
  "u-kp819846": "f-tmdb254320",
  "u-kp838043": "f-wd18386312",
  "u-kp842493": "f-wd18149188",
  "u-kp868982": "f-wd18153484",
  "u-kp888154": "f-wd21450513",
  "u-kp893535": "f-wd19867192",
  "u-kp910353": "f-wd20716882",
  "u-kp922179": "f-wd29567973",
  "u-kp93377": "f-wd729788",
  "u-kp944708": "f-tmdb419430",
  "u-kp958442": "f-wd25339940",
  "u-kp983798": "f-wd55166818",
  "u-kp984309": "f-tmdb399057",
  "u-tmdb1142871": "f-wd118375337",
  "u-tmdb650030": "f-wd110687185",
  "u-tmdb947938": "f-wd109549619"
};

// src/lib/canon.ts
var own = Object.prototype.hasOwnProperty;
function canonIn(table2, id) {
  let x = id;
  for (let n = 0; n < 10 && own.call(table2, x); n++) x = table2[x];
  return x;
}

// worker/workAliases.ts
var canonWork = (id) => canonIn(workAliases, id);
function canonCard(work, id) {
  return work && typeof work === "object" && !Array.isArray(work) && work.id !== id ? { ...work, id } : work;
}
var ALIAS_TABLES = [
  `CREATE TABLE IF NOT EXISTS work_alias (alias TEXT PRIMARY KEY, main TEXT NOT NULL, version TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS work_alias_backup (seq INTEGER PRIMARY KEY AUTOINCREMENT, version TEXT NOT NULL, tbl TEXT NOT NULL,
    user_id TEXT, work_id TEXT NOT NULL, main TEXT NOT NULL, action TEXT NOT NULL, row TEXT NOT NULL, at TEXT NOT NULL)`,
  "CREATE INDEX IF NOT EXISTS work_alias_backup_user ON work_alias_backup(user_id, tbl)"
];
var PLAIN = [
  { tbl: "prediction", key: ["user_id", "entry_id"] },
  { tbl: "checkin", key: ["id"] },
  { tbl: "feedback", key: ["id"] },
  { tbl: "impression", key: ["id"] },
  { tbl: "material_open", key: ["id"] },
  { tbl: "event", key: ["id"] },
  { tbl: "work_issue", key: ["id"] },
  { tbl: "link_verdict", key: ["user_id", "url"] }
];
var str2 = (v) => typeof v === "string" ? v : "";
function cardJson(raw, main) {
  if (typeof raw !== "string" || !raw) return raw ?? null;
  try {
    return JSON.stringify(canonCard(JSON.parse(raw), main));
  } catch {
    return raw;
  }
}
var filled = (r) => ["finished_at", "started_at", "progress", "eagerness", "series"].filter((k) => r[k] != null && r[k] !== "").length;
async function migrateWorkAliases(db, table2 = workAliases, version2 = workAliasesVersion) {
  for (const ddl of ALIAS_TABLES) await db.prepare(ddl).run();
  const name = `work-aliases:${version2}`;
  if (await db.prepare("SELECT 1 AS x FROM migration_mark WHERE name = ?").bind(name).first()) return void 0;
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const pairs = Object.keys(table2).map((a) => [a, canonIn(table2, a)]).filter(([a, m]) => a !== m);
  const mapSteps = [db.prepare("DELETE FROM work_alias")];
  for (const [a, m] of pairs) mapSteps.push(db.prepare("INSERT INTO work_alias (alias, main, version) VALUES (?, ?, ?)").bind(a, m, version2));
  await db.batch(mapSteps);
  const steps = [];
  const out = { version: version2, moved: 0, dropped: 0, byTable: {} };
  const backup = (tbl, r, main, action) => {
    steps.push(db.prepare("INSERT INTO work_alias_backup (version, tbl, user_id, work_id, main, action, row, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(version2, tbl, r.user_id ?? null, r.work_id, main, action, JSON.stringify(r), at));
    if (action === "dropped") out.dropped++;
    else out.moved++;
    out.byTable[tbl] = (out.byTable[tbl] ?? 0) + 1;
  };
  const load2 = async (tbl) => {
    const moved = (await db.prepare(`SELECT t.*, a.main AS __main FROM ${tbl} t JOIN work_alias a ON a.alias = t.work_id`).all()).results;
    const onMain = moved.length ? (await db.prepare(`SELECT t.* FROM ${tbl} t WHERE EXISTS (SELECT 1 FROM ${tbl} x JOIN work_alias a ON a.alias = x.work_id
          WHERE x.user_id = t.user_id AND a.main = t.work_id)`).all()).results : [];
    return { moved, onMain };
  };
  const strip = (r) => {
    const { __main: _m, ...rest } = r;
    return rest;
  };
  for (const tbl of ["rating", "watched"]) {
    const { moved, onMain } = await load2(tbl);
    const groups = /* @__PURE__ */ new Map();
    for (const r of onMain) groups.set(`${r.user_id}	${r.work_id}`, { main: r.work_id, rows: [{ r, fromAlias: false }] });
    for (const m of moved) {
      const k = `${m.user_id}	${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      const best = [...rows].sort((a, b) => str2(b.r.at).localeCompare(str2(a.r.at)) || Number(a.fromAlias) - Number(b.fromAlias))[0];
      const work = rows.map((x) => x.r.work).find((w) => typeof w === "string" && w) ?? null;
      for (const x of rows) {
        if (x === best) continue;
        backup(tbl, x.r, main, "dropped");
        steps.push(db.prepare(`DELETE FROM ${tbl} WHERE user_id = ? AND work_id = ?`).bind(x.r.user_id, x.r.work_id));
      }
      const r = best.r;
      if (!best.fromAlias) {
        if (!r.work && work) steps.push(db.prepare(`UPDATE ${tbl} SET work = ? WHERE user_id = ? AND work_id = ? AND work IS NULL`).bind(cardJson(work, main), r.user_id, r.work_id));
        continue;
      }
      backup(tbl, r, main, "moved");
      if (tbl === "rating") {
        steps.push(db.prepare("UPDATE rating SET work_id = ?, work = ? WHERE user_id = ? AND work_id = ?").bind(main, cardJson(r.work ?? work, main), r.user_id, r.work_id));
      } else {
        const pick = (k) => r[k] ?? rows.map((x) => x.r[k]).find((v) => v != null) ?? null;
        steps.push(db.prepare("UPDATE watched SET work_id = ?, work = ?, tmdb = ?, imdb = ? WHERE user_id = ? AND work_id = ?").bind(main, cardJson(r.work ?? work, main), pick("tmdb"), pick("imdb"), r.user_id, r.work_id));
      }
    }
  }
  {
    const { moved, onMain } = await load2("afterword");
    const groups = /* @__PURE__ */ new Map();
    for (const r of onMain) groups.set(`${r.user_id}	${r.work_id}`, { main: r.work_id, rows: [{ r, fromAlias: false }] });
    for (const m of moved) {
      const k = `${m.user_id}	${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      const order = [...rows].sort((a, b) => str2(b.r.at).localeCompare(str2(a.r.at)) || Number(a.fromAlias) - Number(b.fromAlias));
      const field = (k) => order.map((x) => x.r[k]).find((v) => v != null) ?? null;
      for (const x of rows) {
        backup("afterword", x.r, main, x === order[0] ? rows.length > 1 ? "merged" : "moved" : "dropped");
        steps.push(db.prepare("DELETE FROM afterword WHERE user_id = ? AND work_id = ?").bind(x.r.user_id, x.r.work_id));
      }
      steps.push(db.prepare("INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?, ?, ?, ?, ?, ?)").bind(order[0].r.user_id, main, field("worth"), field("pace"), field("hook"), order[0].r.at));
    }
  }
  {
    const { moved, onMain } = await load2("journal");
    const groups = /* @__PURE__ */ new Map();
    for (const r of onMain) {
      const k = `${r.user_id}	${r.work_id}`;
      const g = groups.get(k) ?? { main: r.work_id, rows: [] };
      g.rows.push({ r, fromAlias: false });
      groups.set(k, g);
    }
    for (const m of moved) {
      const k = `${m.user_id}	${m.__main}`;
      const g = groups.get(k) ?? { main: m.__main, rows: [] };
      g.rows.push({ r: strip(m), fromAlias: true });
      groups.set(k, g);
    }
    for (const { main, rows } of groups.values()) {
      if (!rows.some((x) => x.fromAlias)) continue;
      const copies = new Set(rows.map((x) => x.r.work_id));
      const keep = /* @__PURE__ */ new Set();
      if (copies.size > 1) {
        const byStatus = /* @__PURE__ */ new Map();
        for (const x of rows) byStatus.set(str2(x.r.status), [...byStatus.get(str2(x.r.status)) ?? [], x]);
        for (const [status, xs] of byStatus) {
          if (status === "planned" && (byStatus.has("finished") || byStatus.has("in_progress"))) continue;
          keep.add([...xs].sort((a, b) => filled(b.r) - filled(a.r) || str2(b.r.finished_at ?? b.r.started_at).localeCompare(str2(a.r.finished_at ?? a.r.started_at)) || Number(a.fromAlias) - Number(b.fromAlias))[0]);
        }
      } else rows.forEach((x) => keep.add(x));
      for (const x of rows) {
        if (!keep.has(x)) {
          backup("journal", x.r, main, "dropped");
          steps.push(db.prepare("DELETE FROM journal WHERE user_id = ? AND entry_id = ?").bind(x.r.user_id, x.r.entry_id));
        } else if (x.fromAlias) {
          backup("journal", x.r, main, "moved");
          steps.push(db.prepare("UPDATE journal SET work_id = ?, work = ? WHERE user_id = ? AND entry_id = ?").bind(main, cardJson(x.r.work, main), x.r.user_id, x.r.entry_id));
        }
      }
    }
  }
  for (const { tbl, key } of PLAIN) {
    const moved = (await db.prepare(`SELECT t.*, a.main AS __main FROM ${tbl} t JOIN work_alias a ON a.alias = t.work_id`).all()).results;
    for (const m of moved) {
      backup(tbl, strip(m), m.__main, "moved");
      steps.push(db.prepare(`UPDATE ${tbl} SET work_id = ? WHERE ${key.map((k) => `${k} = ?`).join(" AND ")}`).bind(m.__main, ...key.map((k) => m[k])));
    }
  }
  steps.push(db.prepare("INSERT OR IGNORE INTO migration_mark (name, at) VALUES (?, ?)").bind(name, at));
  await db.batch(steps);
  if (out.moved || out.dropped) console.log("\u043A\u0430\u043D\u043E\u043D \u043A\u043E\u043F\u0438\u0439", version2, JSON.stringify(out.byTable), `\u043F\u0435\u0440\u0435\u043D\u0435\u0441\u0435\u043D\u043E ${out.moved}, \u0441\u043D\u044F\u0442\u043E \u043F\u0440\u0438 \u0441\u043B\u0438\u044F\u043D\u0438\u0438 ${out.dropped}`);
  return out;
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
  // 16.10, ХБ: тестер привязывается к номеру аккаунта при первом входе — ник можно сменить и занять
  { table: "tester", column: "tg_id", ddl: "ALTER TABLE tester ADD COLUMN tg_id INTEGER" },
  // 07.10, ЗП-37: кто привёл — по ссылке «Поделиться» с хвостом `--r<код>` (worker/invite.ts)
  { table: "user", column: "invited_by", ddl: "ALTER TABLE user ADD COLUMN invited_by TEXT" },
  // 07.10, ЗП-13/38: источник прихода — метка `--s<метка>` в ссылке посева
  { table: "user", column: "source", ddl: "ALTER TABLE user ADD COLUMN source TEXT" },
  // 13.10, МА-1/МА-2: уровень сложности и признаки произведения (операции, регистры) — как их видел
  // человек в момент события; «стоило ли» 1–5 у чек-ина (ДФ-10) и причина при 1–2 (worker/metrics.ts)
  ...["impression", "feedback", "checkin"].flatMap((table2) => [
    { table: table2, column: "level", ddl: `ALTER TABLE ${table2} ADD COLUMN level REAL` },
    { table: table2, column: "traits", ddl: `ALTER TABLE ${table2} ADD COLUMN traits TEXT` }
  ]),
  { table: "checkin", column: "worth", ddl: "ALTER TABLE checkin ADD COLUMN worth INTEGER" },
  { table: "checkin", column: "worth_why", ddl: "ALTER TABLE checkin ADD COLUMN worth_why TEXT" },
  // 14.10, ДФ-11: какой импорт положил запись дневника или оценку — по нему импорт отменяется целиком
  { table: "journal", column: "import_id", ddl: "ALTER TABLE journal ADD COLUMN import_id TEXT" },
  { table: "rating", column: "import_id", ddl: "ALTER TABLE rating ADD COLUMN import_id TEXT" },
  // 14.10, МА-3: открытие материала — чей он (голос из реестра), длина ролика и сколько человек был снаружи
  { table: "material_open", column: "voice_id", ddl: "ALTER TABLE material_open ADD COLUMN voice_id TEXT" },
  { table: "material_open", column: "minutes", ddl: "ALTER TABLE material_open ADD COLUMN minutes INTEGER" },
  { table: "material_open", column: "dwell", ddl: "ALTER TABLE material_open ADD COLUMN dwell INTEGER" },
  // 15.10, ДФ-13: раунд выбора компанией — когда пришёл второй и когда итог открылся всем
  { table: "together", column: "round_at", ddl: "ALTER TABLE together ADD COLUMN round_at TEXT" },
  { table: "together", column: "revealed_at", ddl: "ALTER TABLE together ADD COLUMN revealed_at TEXT" },
  // 17.10, аудит отказов п. 8: сводка подписок — «шлём» до sendMessage, NULL — отправлено (worker/follow.ts)
  { table: "follow_digest", column: "state", ddl: "ALTER TABLE follow_digest ADD COLUMN state TEXT" }
];
var TOGETHER_VOTE = `session_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    vote TEXT NOT NULL CHECK (vote IN ('yes', 'maybe', 'no', 'veto', 'seen')), fit REAL, at TEXT NOT NULL, PRIMARY KEY (session_id, user_id, work_id)`;
var REBUILDS = [
  // 15.10, ДФ-13: голоса «может быть» и «вето»
  { table: "together_vote", stale: (sql) => !sql.includes("'veto'"), ddl: TOGETHER_VOTE }
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
  `CREATE TABLE IF NOT EXISTS together_vote (${TOGETHER_VOTE})`,
  // 11.10, ЗП-11: команда /together в чате — одноразовый ключ чата для приглашения голосовать (worker/together.ts)
  `CREATE TABLE IF NOT EXISTS together_chat (token TEXT PRIMARY KEY, chat_id INTEGER NOT NULL, title TEXT, lang TEXT,
    created_at TEXT NOT NULL, session_id TEXT)`,
  // 15.10: голосование прямо в чате — подборка и голоса по сообщению (worker/inlinePoll.ts)
  `CREATE TABLE IF NOT EXISTS inline_poll (id TEXT PRIMARY KEY, owner_tg INTEGER NOT NULL, films TEXT NOT NULL, lang TEXT, session_id TEXT,
    created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS inline_vote (msg TEXT NOT NULL, poll_id TEXT NOT NULL, tg_id INTEGER NOT NULL, name TEXT, idx INTEGER NOT NULL,
    at TEXT NOT NULL, PRIMARY KEY (msg, tg_id, idx))`,
  // 13.10, МА-1: снимки карты участника — диапазон сложности, от которого считается «сдвиг» (worker/metrics.ts)
  `CREATE TABLE IF NOT EXISTS level_state (user_id TEXT NOT NULL REFERENCES user(id), at TEXT NOT NULL, center REAL NOT NULL,
    lo REAL NOT NULL, hi REAL NOT NULL, median REAL, n INTEGER NOT NULL, PRIMARY KEY (user_id, at))`,
  // 14.10: выгрузка дневника на час — для downloadFile Telegram (ДФ-14)
  `CREATE TABLE IF NOT EXISTS export_file (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES user(id), name TEXT NOT NULL,
    body TEXT NOT NULL, at TEXT NOT NULL)`,
  // 17.10, аудит отказов п. 7: принятые апдейты Telegram — повтор того же update_id не обрабатываем (worker/inline.ts);
  // старше двух суток чистит тик (worker/index.ts, scheduled)
  "CREATE TABLE IF NOT EXISTS tg_update (update_id INTEGER PRIMARY KEY, at TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS tg_update_at ON tg_update(at)",
  // 17.10, аудит отказов п. 8: замки периодических работ — сводка подписок (worker/follow.ts). locked_at '' — свободно,
  // until — не начинать раньше (пауза по 429 от Telegram)
  "CREATE TABLE IF NOT EXISTS job_lock (name TEXT PRIMARY KEY, locked_at TEXT NOT NULL DEFAULT '', until TEXT NOT NULL DEFAULT '')",
  // 17.10, решение владельца: послесловие к просмотренному (PUT /api/afterword/<workId>, worker/index.ts)
  `CREATE TABLE IF NOT EXISTS afterword (user_id TEXT NOT NULL REFERENCES user(id), work_id TEXT NOT NULL,
    worth INTEGER CHECK (worth BETWEEN 1 AND 5), pace TEXT, hook TEXT, at TEXT NOT NULL, PRIMARY KEY (user_id, work_id))`,
  // 17.10: разовые переносы данных (ONCE ниже) — сделанный не повторяется
  "CREATE TABLE IF NOT EXISTS migration_mark (name TEXT PRIMARY KEY, at TEXT NOT NULL)"
];
var ONCE = [
  // 17.10: «стоило ли» из чек-инов (ДФ-10) — в послесловие: последний по времени чек-ин со «стоило ли» на произведение
  { name: "afterword-from-checkin", sql: `INSERT OR IGNORE INTO afterword (user_id, work_id, worth, at)
      SELECT c.user_id, c.work_id, c.worth, c.at FROM checkin c
       WHERE c.worth BETWEEN 1 AND 5 AND c.work_id <> '' AND c.user_id IN (SELECT id FROM user)
         AND NOT EXISTS (SELECT 1 FROM checkin d WHERE d.user_id = c.user_id AND d.work_id = c.work_id AND d.worth BETWEEN 1 AND 5
                          AND (d.at > c.at OR (d.at = c.at AND d.id > c.id)))` }
];
var done;
function forgetMigrations() {
  done = void 0;
}
function migrate(db) {
  done ??= (async () => {
    for (const ddl of TABLES) await db.prepare(ddl).run();
    for (const r of REBUILDS) {
      const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").bind(r.table).first();
      if (!row || !r.stale(row.sql)) continue;
      await db.batch([
        db.prepare(`DROP TABLE IF EXISTS ${r.table}_new`),
        db.prepare(`CREATE TABLE ${r.table}_new (${r.ddl})`),
        db.prepare(`INSERT INTO ${r.table}_new SELECT * FROM ${r.table}`),
        db.prepare(`DROP TABLE ${r.table}`),
        db.prepare(`ALTER TABLE ${r.table}_new RENAME TO ${r.table}`)
      ]);
    }
    for (const c of COLUMNS) {
      const info = await db.prepare(`PRAGMA table_info(${c.table})`).all();
      if (!info.results.some((r) => r.name === c.column)) await db.prepare(c.ddl).run();
    }
    for (const o of ONCE) {
      if (await db.prepare("SELECT 1 AS x FROM migration_mark WHERE name = ?").bind(o.name).first()) continue;
      await db.batch([
        db.prepare(o.sql),
        db.prepare("INSERT OR IGNORE INTO migration_mark (name, at) VALUES (?, ?)").bind(o.name, (/* @__PURE__ */ new Date()).toISOString())
      ]);
    }
    try {
      await migrateWorkAliases(db);
    } catch (e) {
      console.error("\u043A\u0430\u043D\u043E\u043D \u043A\u043E\u043F\u0438\u0439: \u043F\u0435\u0440\u0435\u043D\u043E\u0441 \u043D\u0435 \u0443\u0434\u0430\u043B\u0441\u044F \u2014", e);
    }
    const guests = await db.prepare(`SELECT s.token AS token FROM session s JOIN user u ON u.id = s.user_id
      WHERE s.token NOT LIKE 'h:%' AND u.id LIKE 'u-anon-%' AND u.tg_id IS NULL`).all();
    if (guests.results.length) {
      await db.batch(await Promise.all(guests.results.map(async (g) => db.prepare("UPDATE OR IGNORE session SET token = ? WHERE token = ?").bind(await tokenHash(g.token), g.token))));
    }
    await db.prepare("DELETE FROM session WHERE token NOT LIKE 'h:%'").run();
  })().catch((err) => {
    done = void 0;
    throw err;
  });
  return done;
}

// worker/metrics.ts
var LEVEL_MAX = 10;
var DAY = 864e5;
var METRIC_BOUNDS = {
  shifted: { floor: 0.1, target: 0.2 },
  hakeG: { floor: 0.3, target: 0.7 },
  proxyReward: { floor: 0.1, target: 0.25 },
  valued: { floor: 0.5, target: 0.7 },
  qualityTake: { floor: 0.03, target: 0.08 },
  ecs: { floor: 0.5, target: 0.7 },
  coverage: { floor: 0.2, target: 0.4 },
  diversified: { floor: 0.3, target: 0.5 },
  spreadHeld: { floor: 0.5, target: 0.7 },
  revisit: { floor: 0.1, target: 0.25 }
};
var MSK = 3 * 36e5;
var mskDay = (iso3) => new Date((typeof iso3 === "number" ? iso3 : Date.parse(iso3)) + MSK).toISOString().slice(0, 10);
var addDays = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
var ratio = (a, b) => b > 0 ? a / b : null;
var round = (x, n = 3) => x == null ? null : Math.round(x * 10 ** n) / 10 ** n;
var median = (xs) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
var std = (xs) => {
  if (xs.length < 2) return null;
  const mean = xs.reduce((a, x) => a + x, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - mean) ** 2, 0) / xs.length);
};
var lv = (x) => x != null && x > 0 ? x : null;
var parseTraits = (s) => {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
};
var vectorOf = (t) => {
  if (!t) return null;
  const v = /* @__PURE__ */ new Map();
  for (const [k, x] of Object.entries(t.op ?? {})) if (x > 0) v.set(`op:${k}`, x);
  for (const r of t.rg ?? []) v.set(`rg:${r}`, 1);
  return v.size ? v : null;
};
var cosine = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (const [k, x] of a) {
    na += x * x;
    dot += x * (b.get(k) ?? 0);
  }
  for (const x of b.values()) nb += x * x;
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
};
function computeMetrics(rows, now2 = Date.now()) {
  const today = mskDay(now2);
  const yesterday = addDays(today, -1);
  const since28 = addDays(today, -28);
  const shownDays = /* @__PURE__ */ new Map();
  const shownLevel = /* @__PURE__ */ new Map();
  const shownTraits = /* @__PURE__ */ new Map();
  for (const i of rows.impressions) {
    const key = `${i.user_id}|${i.work_id}`;
    const d = mskDay(i.at);
    if (!shownDays.has(key) || d < shownDays.get(key)) shownDays.set(key, d);
    const l = lv(i.level);
    if (l != null) shownLevel.set(key, l);
    const t = parseTraits(i.traits);
    if (t) shownTraits.set(key, t);
  }
  const finishes = /* @__PURE__ */ new Map();
  const addFinish = (f) => {
    const key = `${f.user}|${f.work}`;
    const was = finishes.get(key);
    if (!was || f.at < was.at) finishes.set(key, { ...f, worth: f.worth ?? was?.worth ?? null });
    else if (was.worth == null && f.worth != null) was.worth = f.worth;
  };
  for (const c of rows.checkins) {
    if (c.status !== "finished" || !c.work_id) continue;
    addFinish({ user: c.user_id, work: c.work_id, level: lv(c.level) ?? shownLevel.get(`${c.user_id}|${c.work_id}`) ?? null, at: c.at, via: "checkin", worth: c.worth });
  }
  const seenPrompted = rows.feedback.filter((f) => f.action === "dismiss" && f.reason === "already_know" && f.work_id && shownDays.has(`${f.user_id}|${f.work_id}`) && shownDays.get(`${f.user_id}|${f.work_id}`) < mskDay(f.at));
  for (const f of seenPrompted) {
    addFinish({ user: f.user_id, work: f.work_id, level: lv(f.level) ?? shownLevel.get(`${f.user_id}|${f.work_id}`) ?? null, at: f.at, via: "seen", worth: null });
  }
  const finishesOf = /* @__PURE__ */ new Map();
  for (const f of finishes.values()) (finishesOf.get(f.user) ?? finishesOf.set(f.user, []).get(f.user)).push(f);
  const statesOf = /* @__PURE__ */ new Map();
  for (const s of [...rows.states].sort((a, b) => a.at.localeCompare(b.at))) {
    if (s.n < 3) continue;
    (statesOf.get(s.user_id) ?? statesOf.set(s.user_id, []).get(s.user_id)).push(s);
  }
  const stateBefore = (user, at) => {
    let out;
    for (const s of statesOf.get(user) ?? []) if (s.at <= at) out = s;
    else break;
    return out;
  };
  const perUser = /* @__PURE__ */ new Map();
  for (const [user, states] of statesOf) {
    const start = states[0];
    const after = (finishesOf.get(user) ?? []).filter((f) => f.at > start.at && f.level != null);
    const above = after.filter((f) => f.level > start.hi).length;
    const post = after.length >= 2 ? median(after.map((f) => f.level)) : null;
    const g = post != null && start.center < LEVEL_MAX ? Math.max(-1, Math.min(1, (post - start.center) / (LEVEL_MAX - start.center))) : null;
    const last = states[states.length - 1];
    const moved = last.center - start.center;
    const narrowed = start.hi - start.lo - (last.hi - last.lo);
    const map = states.length < 2 ? "noUpdate" : moved >= 0.5 ? "movedUp" : moved <= -0.5 ? "movedDown" : narrowed >= 0.5 ? "refined" : "same";
    perUser.set(user, { startDay: mskDay(start.at), shifted: above >= 2, g, map });
  }
  const summarize = (users) => {
    const xs = users.map((u) => perUser.get(u));
    const gs = xs.map((x) => x.g).filter((g) => g != null);
    const map = { movedUp: 0, movedDown: 0, refined: 0, same: 0, noUpdate: 0 };
    for (const x of xs) map[x.map] += 1;
    const shifted = xs.filter((x) => x.shifted).length;
    return {
      users: xs.length,
      shifted,
      share: round(ratio(shifted, xs.length)),
      g: { n: gs.length, median: round(median(gs)), low: gs.filter((g) => g < 0.3).length, mid: gs.filter((g) => g >= 0.3 && g < 0.7).length, high: gs.filter((g) => g >= 0.7).length },
      map
    };
  };
  const cohortFrom = addDays(today, -56), cohortTo = addDays(today, -28);
  const cohortUsers = [...perUser].filter(([, x]) => x.startDay >= cohortFrom && x.startDay <= cohortTo).map(([u]) => u);
  const active28 = new Set(rows.visits.filter((v) => v.day >= since28).map((v) => v.user_id));
  const noStart = [...active28].filter((u) => !statesOf.has(u)).length;
  const ratingOf = new Map(rows.ratings.map((r) => [`${r.user_id}|${r.work_id}`, r]));
  const recent = [...finishes.values()].filter((f) => mskDay(f.at) >= since28);
  let proxyBase = 0, proxyN = 0;
  for (const f of recent) {
    const s = stateBefore(f.user, f.at);
    if (f.level == null || s?.median == null) continue;
    proxyBase += 1;
    const r = ratingOf.get(`${f.user}|${f.work}`);
    if (r && r.rating >= 4 && Date.parse(r.at) - Date.parse(f.at) >= 3 * DAY && f.level > s.median) proxyN += 1;
  }
  let answered = 0, valuedN = 0;
  for (const f of recent) {
    const r = ratingOf.get(`${f.user}|${f.work}`);
    const atFinish = r && Math.abs(Date.parse(r.at) - Date.parse(f.at)) <= DAY ? r.rating : null;
    const answer2 = f.worth ?? atFinish;
    if (answer2 == null) continue;
    answered += 1;
    if (answer2 >= 4) valuedN += 1;
  }
  const recentShown = rows.impressions.filter((i) => mskDay(i.at) >= since28);
  const shownRecs = /* @__PURE__ */ new Map();
  for (const i of recentShown) {
    const key = `${i.user_id}|${i.rec_id}`;
    if (!shownRecs.has(key)) shownRecs.set(key, { user: i.user_id, work: i.work_id, at: i.at });
  }
  const accepts = rows.feedback.filter((f) => (f.action === "save" || f.action === "start") && f.rec_id && shownRecs.has(`${f.user_id}|${f.rec_id}`));
  const acceptedRecs = new Set(accepts.map((f) => `${f.user_id}|${f.rec_id}`));
  const lastWatch = /* @__PURE__ */ new Map();
  for (const e of rows.events) {
    if (e.kind !== "watch" || !e.work_id) continue;
    const key = `${e.user_id}|${e.work_id}`;
    if (!lastWatch.has(key) || e.at > lastWatch.get(key)) lastWatch.set(key, e.at);
  }
  const watchAfter = (user, work, at) => (lastWatch.get(`${user}|${work}`) ?? "") >= at;
  const finishedAfter = (user, work, at) => {
    const f = finishes.get(`${user}|${work}`);
    return Boolean(f && f.at >= at);
  };
  let qualityN = 0;
  for (const [key, s] of shownRecs) {
    const accepted = acceptedRecs.has(key);
    const prompted = finishes.get(`${s.user}|${s.work}`)?.via === "seen" && finishedAfter(s.user, s.work, s.at);
    if (accepted && (watchAfter(s.user, s.work, s.at) || finishedAfter(s.user, s.work, s.at)) || prompted) qualityN += 1;
  }
  const takes = [
    ...accepts.map((f) => ({ user: f.user_id, work: f.work_id ?? shownRecs.get(`${f.user_id}|${f.rec_id}`).work, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: "accept" })),
    ...seenPrompted.filter((f) => mskDay(f.at) >= since28).map((f) => ({ user: f.user_id, work: f.work_id, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: "seen" }))
  ].map((t) => ({ ...t, level: t.level ?? shownLevel.get(`${t.user}|${t.work}`) ?? null, traits: t.traits ?? shownTraits.get(`${t.user}|${t.work}`) ?? null }));
  const takenWorks = new Set(takes.map((t) => t.work));
  const shownWorks = new Set(recentShown.map((i) => i.work_id));
  const activation = /* @__PURE__ */ new Map();
  for (const i of rows.impressions) if (!activation.has(i.user_id) || i.at < activation.get(i.user_id)) activation.set(i.user_id, i.at);
  const allTakes = [
    ...rows.feedback.filter((f) => (f.action === "save" || f.action === "start") && f.work_id).map((f) => ({ user: f.user_id, work: f.work_id, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: "accept" })),
    ...seenPrompted.map((f) => ({ user: f.user_id, work: f.work_id, level: lv(f.level), traits: parseTraits(f.traits), at: f.at, via: "seen" }))
  ].map((t) => ({ ...t, level: t.level ?? shownLevel.get(`${t.user}|${t.work}`) ?? null, traits: t.traits ?? shownTraits.get(`${t.user}|${t.work}`) ?? null }));
  const takesOf = /* @__PURE__ */ new Map();
  for (const t of allTakes) (takesOf.get(t.user) ?? takesOf.set(t.user, []).get(t.user)).push(t);
  const gsWeek1 = [], gsLater = [];
  let diversified = 0, gsUsers = 0, spreadUsers = 0, spreadHeld = 0;
  for (const [user, list] of takesOf) {
    const act = activation.get(user);
    if (!act) continue;
    const dayOf3 = (t) => (Date.parse(t.at) - Date.parse(act)) / DAY;
    const w1 = list.filter((t) => dayOf3(t) >= 0 && dayOf3(t) < 7);
    const late = list.filter((t) => dayOf3(t) >= 21 && dayOf3(t) < 56);
    if (!w1.length || !late.length) continue;
    const vecs = list.map((t) => vectorOf(t.traits)).filter((v) => v != null);
    if (vecs.length) {
      const center = /* @__PURE__ */ new Map();
      for (const v of vecs) for (const [k, x] of v) center.set(k, (center.get(k) ?? 0) + x / vecs.length);
      const gs = (ts) => {
        const cs = ts.map((t) => vectorOf(t.traits)).filter((v) => v != null).map((v) => cosine(v, center));
        return cs.length ? cs.reduce((a2, x) => a2 + x, 0) / cs.length : null;
      };
      const a = gs(w1), b = gs(late);
      if (a != null && b != null) {
        gsUsers += 1;
        gsWeek1.push(a);
        gsLater.push(b);
        if (b < a) diversified += 1;
      }
    }
    const s1 = std(w1.map((t) => t.level).filter((l) => l != null));
    const s2 = std(late.map((t) => t.level).filter((l) => l != null));
    if (s1 != null && s2 != null) {
      spreadUsers += 1;
      if (s2 >= s1 - 1e-9) spreadHeld += 1;
    }
  }
  const recentCards = rows.events.filter((e) => e.kind === "card" && e.work_id && mskDay(e.at) >= since28);
  let revisits = 0;
  const cardUsers = /* @__PURE__ */ new Set(), revisitUsers = /* @__PURE__ */ new Set();
  for (const e of recentCards) {
    cardUsers.add(e.user_id);
    const r = ratingOf.get(`${e.user_id}|${e.work_id}`);
    const f = finishes.get(`${e.user_id}|${e.work_id}`);
    if (r && r.at < e.at || f && f.at < e.at) {
      revisits += 1;
      revisitUsers.add(e.user_id);
    }
  }
  const visitsOf = /* @__PURE__ */ new Map();
  for (const v of rows.visits) (visitsOf.get(v.user_id) ?? visitsOf.set(v.user_id, /* @__PURE__ */ new Set()).get(v.user_id)).add(v.day);
  const actDays = [...activation].map(([u, at]) => ({ u, d: mskDay(at) })).filter((x) => x.d >= addDays(today, -60));
  const retention = [1, 7, 30].map((k) => {
    const done2 = actDays.filter((x) => addDays(x.d, k) <= yesterday);
    const days = (x) => [...visitsOf.get(x.u) ?? []];
    const exact = done2.filter((x) => days(x).includes(addDays(x.d, k))).length;
    const later = done2.filter((x) => days(x).some((d) => d >= addDays(x.d, k))).length;
    return {
      k,
      cohorts: new Set(done2.map((x) => x.d)).size,
      users: done2.length,
      exact,
      later,
      exactShare: round(ratio(exact, done2.length)),
      laterShare: round(ratio(later, done2.length))
    };
  });
  const wau = Array.from({ length: 8 }, (_, i) => {
    const to = addDays(yesterday, -7 * (7 - i));
    const from = addDays(to, -6);
    return { to, users: new Set(rows.visits.filter((v) => v.day >= from && v.day <= to).map((v) => v.user_id)).size };
  });
  return {
    asOf: new Date(now2).toISOString(),
    bounds: METRIC_BOUNDS,
    shift: { cohort: { from: cohortFrom, to: cohortTo, ...summarize(cohortUsers) }, all: summarize([...perUser.keys()]), noStart },
    quality: {
      since: since28,
      proxyReward: { share: round(ratio(proxyN, proxyBase)), n: proxyN, base: proxyBase, finishes: recent.length },
      valued: { share: round(ratio(valuedN, answered)), n: valuedN, answered, finishes: recent.length, answerRate: round(ratio(answered, recent.length)) },
      take: { shown: shownRecs.size, accepted: acceptedRecs.size, quality: qualityN, takeRate: round(ratio(acceptedRecs.size, shownRecs.size)), qualityTake: round(ratio(qualityN, shownRecs.size)) },
      ecs: { takes: takes.length, unique: takenWorks.size, ecs: round(ratio(takenWorks.size, takes.length)), shownWorks: shownWorks.size, coverage: round(ratio([...takenWorks].filter((w) => shownWorks.has(w)).length, shownWorks.size)) },
      gs: { users: gsUsers, week1: round(median(gsWeek1)), later: round(median(gsLater)), diversified: round(ratio(diversified, gsUsers)), spreadHeld: round(ratio(spreadHeld, spreadUsers)), spreadUsers },
      revisit: { cards: recentCards.length, revisits, share: round(ratio(revisits, recentCards.length)), users: cardUsers.size, usersWithRevisit: revisitUsers.size, userShare: round(ratio(revisitUsers.size, cardUsers.size)) }
    },
    retention,
    wau
  };
}

// worker/engagement.ts
var median2 = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
var share = (n, of) => of ? n / of : null;
var dayOf = (iso3) => new Date(Date.parse(iso3) + 3 * 36e5).toISOString().slice(0, 10);
var addDays2 = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
var readThrough = (o) => o.dwell != null && o.dwell >= Math.max(60, (o.minutes ?? 0) * 30);
function computeEngagement(r) {
  const week = addDays2(r.today, -7);
  const byVoice = /* @__PURE__ */ new Map();
  for (const o of r.opens) if (o.voice_id) byVoice.set(o.voice_id, [...byVoice.get(o.voice_id) ?? [], o]);
  const voiceLine = (id, xs) => {
    const timed = xs.filter((o) => o.dwell != null);
    const through = timed.filter(readThrough).length;
    return {
      voiceId: id,
      opens: xs.length,
      users: new Set(xs.map((o) => o.user_id)).size,
      timed: timed.length,
      through,
      throughShare: share(through, timed.length),
      medianDwell: median2(timed.map((o) => o.dwell))
    };
  };
  const voices = [...byVoice].map(([id, xs]) => voiceLine(id, xs)).sort((a, b) => b.opens - a.opens || b.users - a.users).slice(0, 40);
  const allTimed = r.opens.filter((o) => o.dwell != null);
  const opens = {
    n: r.opens.length,
    withVoice: r.opens.filter((o) => o.voice_id).length,
    timed: allTimed.length,
    through: allTimed.filter(readThrough).length,
    throughShare: share(allTimed.filter(readThrough).length, allTimed.length),
    medianDwell: median2(allTimed.map((o) => o.dwell))
  };
  const shares = r.events.filter((e) => e.kind === "share_sent");
  const active = (from) => new Set(r.visits.filter((v) => v.day >= from).map((v) => v.user_id)).size;
  const split = (xs, part) => {
    const m = /* @__PURE__ */ new Map();
    for (const e of xs) {
      const k = (e.detail ?? "").split(":")[part] || "\u2014";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  };
  const shareSpan = (from) => {
    const xs = from ? shares.filter((e) => dayOf(e.at) >= from) : shares;
    const act = from ? active(from) : new Set(r.visits.map((v) => v.user_id)).size;
    return { n: xs.length, users: new Set(xs.map((e) => e.user_id)).size, active: act, per100: act ? xs.length / act * 100 : null };
  };
  const sharing = { week: shareSpan(week), month: shareSpan(void 0), what: split(shares, 0), how: split(shares, 1) };
  const bySource = /* @__PURE__ */ new Map();
  for (const u of r.joined) {
    const k = u.source ?? "\u2014";
    const s = bySource.get(k) ?? { joined: 0, invited: 0 };
    s.joined++;
    if (u.invited_by) s.invited++;
    bySource.set(k, s);
  }
  const organic = r.joined.filter((u) => !u.source && !u.invited_by).length;
  const newcomers = {
    joined: r.joined.length,
    invited: r.joined.filter((u) => u.invited_by).length,
    seeded: r.joined.filter((u) => u.source).length,
    organic,
    organicShare: share(organic, r.joined.length),
    sources: [...bySource].map(([source, s]) => ({ source, ...s })).sort((a, b) => b.joined - a.joined)
  };
  const queries = r.events.filter((e) => e.kind === "mood_query");
  const moodOpens = r.events.filter((e) => e.kind === "card" && e.place === "mood");
  const qCount = /* @__PURE__ */ new Map();
  for (const e of queries) {
    const t = (e.detail ?? "").toLowerCase().replace(/\s+/g, " ").trim();
    if (t) qCount.set(t, (qCount.get(t) ?? 0) + 1);
  }
  const mood = {
    queries: queries.length,
    users: new Set(queries.map((e) => e.user_id)).size,
    opens: moodOpens.length,
    opensPerQuery: queries.length ? moodOpens.length / queries.length : null,
    top: [...qCount].map(([text, n]) => ({ text, n })).sort((a, b) => b.n - a.n).slice(0, 15)
  };
  const answers = r.events.filter((e) => e.kind === "survey_answered");
  const bySurvey = /* @__PURE__ */ new Map();
  for (const e of answers) {
    const k = (e.detail ?? "").split(":")[0] || "\u2014";
    const s = bySurvey.get(k) ?? { n: 0, users: /* @__PURE__ */ new Set() };
    s.n++;
    s.users.add(e.user_id);
    bySurvey.set(k, s);
  }
  const surveys = [...bySurvey].map(([survey, s]) => ({ survey, n: s.n, users: s.users.size }));
  const delays = r.rated.map((x) => Math.max(0, (Date.parse(x.rated) - Date.parse(x.shown)) / 864e5));
  const ratingDelay = {
    n: delays.length,
    medianDays: median2(delays),
    within1: share(delays.filter((d) => d < 1).length, delays.length),
    after3: share(delays.filter((d) => d >= 3).length, delays.length)
  };
  return { opens, voices, sharing, newcomers, mood, surveys, ratingDelay };
}

// worker/funnel.ts
var json4 = (body, status = 200) => Response.json(body, { status });
var MSK_MS = 3 * 36e5;
var mskDay2 = (t = Date.now()) => new Date(t + MSK_MS).toISOString().slice(0, 10);
var addDays3 = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
var SQL_DAY = (col) => `date(${col}, '+3 hours')`;
var noted = /* @__PURE__ */ new Set();
var notedDay = "";
async function noteVisit(db, userId) {
  const day = mskDay2();
  if (day !== notedDay) {
    noted.clear();
    notedDay = day;
  }
  if (noted.has(userId)) return;
  noted.add(userId);
  await db.prepare("INSERT OR IGNORE INTO visit (user_id, day) VALUES (?, ?)").bind(userId, day).run();
}
var KINDS3 = /* @__PURE__ */ new Set(["card", "watch", "trailer", "share_sent", "mood_query", "survey_answered", "onboard", "trailer_play", "trailer_stall", "novelties"]);
var eventSeq = 0;
async function postEvent(req, userId, db) {
  const b = await req.json().catch(() => ({}));
  const str3 = (v, n = 64) => typeof v === "string" && v ? v.slice(0, n) : null;
  const kind = str3(b.kind);
  if (!kind || !KINDS3.has(kind)) return json4({ error: "bad_kind" }, 400);
  const id = `e-${Date.now().toString(36)}-${(eventSeq++ % 1e6).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const workId = str3(b.workId, 120);
  await db.prepare("INSERT INTO event (id, user_id, kind, work_id, place, detail, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, userId, kind, workId ? canonWork(workId) : null, str3(b.place), str3(b.detail, 120), (/* @__PURE__ */ new Date()).toISOString()).run();
  return json4({ ok: true });
}
var THRESHOLDS = {
  activation: 0.6,
  d7: 0.25,
  d30: 0.12,
  engagedFeeds: 0.3,
  analysisOpens: 0.15,
  acceptedFeeds: 0.3,
  checkins: 0.2,
  watchClicks: 0.08
};
var FLOORS = {
  activation: 0.4,
  d7: 0.15,
  d30: 0.07,
  engagedFeeds: 0.2,
  analysisOpens: 0.1
};
var MIN_BASE = 30;
var ACCEPT = "('save', 'start')";
var engagedWith = (i) => `(EXISTS (SELECT 1 FROM feedback f WHERE f.user_id = ${i}.user_id AND f.rec_id = ${i}.rec_id
    AND (f.action IN ${ACCEPT} OR (f.action = 'dismiss' AND f.reason = 'already_know')))
  OR EXISTS (SELECT 1 FROM material_open m WHERE m.user_id = ${i}.user_id AND m.work_id = ${i}.work_id AND m.at >= ${i}.at))`;
var activatedSql = `EXISTS (SELECT 1 FROM impression i WHERE i.user_id = u.id AND i.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day'))`;
var ratio2 = (a, b) => b > 0 ? a / b : null;
async function getFunnel(req, env, admin) {
  if (!admin) return json4({ error: "unauthorized" }, 401);
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
  const today = mskDay2();
  const yesterday = addDays3(today, -1);
  const from14 = addDays3(today, -14);
  const from30 = addDays3(today, -30);
  const from60 = addDays3(today, -60);
  const byDay = (sql, ...bind) => q(sql, ...binds, ...bind);
  const [visits, joined, cards, watches, opens, ratings, feeds, accepted, engaged, seen, prompted, checkins] = await Promise.all([
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
    // лента с откликом (минимальная редакция): хоть на один её фильм — «Видел», разбор или принятие
    byDay(`SELECT ${SQL_DAY("i.at")} AS day, COUNT(DISTINCT i.slate_id) AS n, COUNT(DISTINCT i.user_id) AS users FROM impression i
             WHERE i.${inUsers} AND ${SQL_DAY("i.at")} >= ? AND ${engagedWith("i")}
             GROUP BY day`, from14),
    // «Видел» на фильме из ленты: подбор попал в знакомое — сигнал вкуса, но не новое
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM feedback WHERE action = 'dismiss' AND reason = 'already_know' AND ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14),
    // посмотрел по подсказке (10.10): «Видел» на фильме, который лента показала ему в один из прошлых дней.
    // В минимуме нет «в планы» и «смотрю»: лента держит те же фильмы, пока нет новых оценок, — человек
    // возвращается после просмотра и отмечает. Это и есть «посмотрел то, что мы предложили»
    byDay(`SELECT ${SQL_DAY("f.at")} AS day, COUNT(*) AS n, COUNT(DISTINCT f.user_id) AS users FROM feedback f
             WHERE f.action = 'dismiss' AND f.reason = 'already_know' AND f.${inUsers} AND ${SQL_DAY("f.at")} >= ?
               AND EXISTS (SELECT 1 FROM impression i WHERE i.user_id = f.user_id AND i.work_id = f.work_id AND ${SQL_DAY("i.at")} < ${SQL_DAY("f.at")})
             GROUP BY day`, from14),
    byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM checkin WHERE ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14)
  ]);
  const accepts = await byDay(`SELECT ${SQL_DAY("at")} AS day, COUNT(*) AS n, COUNT(DISTINCT user_id) AS users FROM feedback WHERE action IN ${ACCEPT} AND ${inUsers} AND ${SQL_DAY("at")} >= ? GROUP BY day`, from14);
  const pairsWith = (table2, extra = "") => byDay(
    `SELECT ${SQL_DAY("c.at")} AS day, COUNT(DISTINCT c.user_id || '|' || c.work_id) AS n FROM event c
       WHERE c.kind = 'card' AND c.work_id IS NOT NULL AND c.${inUsers} AND ${SQL_DAY("c.at")} >= ?
         AND EXISTS (SELECT 1 FROM ${table2} x WHERE x.user_id = c.user_id AND x.work_id = c.work_id ${extra} AND ${SQL_DAY("x.at")} = ${SQL_DAY("c.at")})
       GROUP BY day`,
    from14
  );
  const [cardsWithOpen, cardsWithWatch] = await Promise.all([pairsWith("material_open"), pairsWith("event", "AND x.kind = 'watch'")]);
  const days = [];
  for (let d = from14; d <= today; d = addDays3(d, 1)) days.push(d);
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
    engagedFeeds: pick(engaged, day2)?.n ?? 0,
    seen: pick(seen, day2)?.n ?? 0,
    prompted: pick(prompted, day2)?.n ?? 0,
    accepts: pick(accepts, day2)?.n ?? 0,
    checkins: pick(checkins, day2)?.n ?? 0,
    cardsWithOpen: pick(cardsWithOpen, day2)?.n ?? 0,
    cardsWithWatch: pick(cardsWithWatch, day2)?.n ?? 0
  }));
  const [funnelRow] = await q(
    `WITH u AS (SELECT id, created_at, ${SQL_DAY("created_at")} AS d FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?)
     SELECT COUNT(*) AS joined,
       SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM impression i WHERE i.user_id = u.id AND ${engagedWith("i")}) THEN 1 ELSE 0 END) AS engaged,
       SUM(CASE WHEN EXISTS (SELECT 1 FROM material_open m WHERE m.user_id = u.id) THEN 1 ELSE 0 END) AS opened,
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
    engaged: funnelRow?.engaged ?? 0,
    opened: funnelRow?.opened ?? 0,
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
    const done2 = cohortRows.filter((c) => addDays3(c.d, k) <= yesterday);
    const base = done2.reduce((a, c) => a + c.joined, 0);
    const exact = done2.reduce((a, c) => a + Number(c[`d${k}`]), 0);
    const later = done2.reduce((a, c) => a + Number(c[`d${k}p`]), 0);
    return { k, cohorts: done2.length, users: base, exact, later, exactShare: ratio2(exact, base), laterShare: ratio2(later, base) };
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
      acceptedFeeds: ratio2(s("acceptedFeeds"), s("feeds")),
      engagedFeeds: ratio2(s("engagedFeeds"), s("feeds")),
      seen: s("seen"),
      prompted: s("prompted"),
      checkins: ratio2(s("checkins"), s("accepts")),
      watchClicks: ratio2(s("cardsWithWatch"), s("cards")),
      analysisOpens: ratio2(s("cardsWithOpen"), s("cards"))
    };
  };
  const activationIn = async (from, to) => {
    const [r] = await q(
      `WITH u AS (SELECT id, created_at FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} BETWEEN ? AND ?)
       SELECT COUNT(*) AS joined, SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated FROM u`,
      ...binds,
      from,
      to
    );
    return { share: ratio2(r?.activated ?? 0, r?.joined ?? 0), joined: r?.joined ?? 0 };
  };
  const weekAct = await activationIn(addDays3(today, -7), yesterday);
  const dayAct = await activationIn(yesterday, yesterday);
  const week = { ...sum(addDays3(today, -7), yesterday), activation: weekAct.share };
  const day = { ...sum(yesterday, yesterday), activation: dayAct.share };
  const sources = await q(
    `WITH u AS (SELECT id, created_at, source, invited_by FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?)
     SELECT source, COUNT(*) AS joined, SUM(CASE WHEN invited_by IS NOT NULL THEN 1 ELSE 0 END) AS invited,
       SUM(CASE WHEN ${activatedSql} THEN 1 ELSE 0 END) AS activated FROM u GROUP BY source ORDER BY joined DESC`,
    ...binds,
    from30
  );
  const from120 = addDays3(today, -120);
  const since = `${from120}T00:00:00.000Z`;
  const [mUsers, mVisits, mStates, mImpr, mFeedback, mCheckins, mRatings, mEvents] = await Promise.all([
    q(`SELECT id, created_at FROM user ${userWhere}`, ...binds),
    q(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, ...binds, from120),
    q(`SELECT user_id, at, center, lo, hi, median, n FROM level_state WHERE ${inUsers}`, ...binds),
    q(`SELECT user_id, rec_id, work_id, level, traits, at FROM impression WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q(`SELECT user_id, rec_id, work_id, action, reason, level, traits, at FROM feedback WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q(`SELECT user_id, work_id, status, level, worth, at FROM checkin WHERE ${inUsers} AND at >= ?`, ...binds, since),
    q(`SELECT user_id, work_id, rating, at FROM rating WHERE ${inUsers}`, ...binds),
    q(`SELECT user_id, kind, work_id, at FROM event WHERE kind IN ('card', 'watch') AND ${inUsers} AND at >= ?`, ...binds, since)
  ]);
  const metrics = computeMetrics({
    users: mUsers,
    visits: mVisits,
    states: mStates,
    impressions: mImpr,
    feedback: mFeedback,
    checkins: mCheckins,
    ratings: mRatings,
    events: mEvents
  });
  const since30 = `${from30}T00:00:00.000Z`;
  const [eOpens, eEvents, eVisits, eJoined, eRated] = await Promise.all([
    q(`SELECT user_id, voice_id, minutes, dwell, at FROM material_open WHERE ${inUsers} AND at >= ?`, ...binds, since30),
    q(`SELECT user_id, kind, work_id, place, detail, at FROM event
      WHERE (kind IN ('share_sent', 'mood_query', 'survey_answered') OR (kind = 'card' AND place = 'mood')) AND ${inUsers} AND at >= ?`, ...binds, since30),
    q(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, ...binds, from30),
    q(`SELECT source, invited_by FROM user ${userWhere ? `${userWhere} AND` : "WHERE"} ${SQL_DAY("created_at")} >= ?`, ...binds, from30),
    q(`SELECT r.at AS rated, MIN(i.at) AS shown FROM rating r
      JOIN impression i ON i.user_id = r.user_id AND i.work_id = r.work_id AND i.at <= r.at
      WHERE r.${inUsers} AND r.at >= ? GROUP BY r.user_id, r.work_id`, ...binds, since30)
  ]);
  const engagement = computeEngagement({ opens: eOpens, events: eEvents, visits: eVisits, joined: eJoined, rated: eRated, today });
  return json4({
    at: (/* @__PURE__ */ new Date()).toISOString(),
    today,
    filters: { withoutOwner: url.searchParams.get("owner") === "0", telegramOnly: url.searchParams.get("tg") === "1", ...source ? { source } : {} },
    thresholds: THRESHOLDS,
    floors: FLOORS,
    minBase: MIN_BASE,
    yesterday: day,
    week,
    retention,
    funnel,
    daily,
    metrics,
    engagement,
    sources: sources.map((r) => ({ source: r.source ?? "\u2014", joined: r.joined, invitedByFriend: r.invited, activation: ratio2(r.activated ?? 0, r.joined) }))
  });
}

// worker/growth.ts
var MSK_MS2 = 3 * 36e5;
var dayOf2 = (iso3) => new Date(Date.parse(iso3) + MSK_MS2).toISOString().slice(0, 10);
var addDays4 = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
var DAY_MS = 864e5;
function wilson(n, of, z = 1.96) {
  if (!of) return { n, of, share: null, lo: null, hi: null };
  const p = n / of, z2 = z * z;
  const centre = (p + z2 / (2 * of)) / (1 + z2 / of);
  const half = z * Math.sqrt(p * (1 - p) / of + z2 / (4 * of * of)) / (1 + z2 / of);
  return { n, of, share: p, lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}
var median3 = (xs) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
var ORGANIC = "organic";
var INVITED = "invited";
var sourceOf = (u) => u.source ?? (u.invited_by ? INVITED : ORGANIC);
function computeGrowth(r) {
  const today = r.today;
  const yesterday = addDays4(today, -1);
  const from90 = addDays4(today, -90);
  const from30 = addDays4(today, -30);
  const visitsBy = /* @__PURE__ */ new Map();
  for (const v of r.visits) visitsBy.set(v.user_id, [...visitsBy.get(v.user_id) ?? [], v.day]);
  const feedAt = new Map(r.firstFeed.map((f) => [f.user_id, Date.parse(f.at)]));
  const users = r.users.map((u) => {
    const created = Date.parse(u.created_at);
    const day = dayOf2(u.created_at);
    const feed = feedAt.get(u.id);
    const days = visitsBy.get(u.id) ?? [];
    return {
      ...u,
      day,
      created,
      activated: feed != null && feed <= created + DAY_MS,
      /** вернулся в k-й день или позже */
      back: (k) => days.some((d) => d >= addDays4(day, k)),
      /** k-й день уже прошёл — когорта годится в основание */
      due: (k) => addDays4(day, k) <= yesterday
    };
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  const retention = (xs, k) => {
    const due = xs.filter((u) => u.due(k));
    return wilson(due.filter((u) => u.back(k)).length, due.length);
  };
  const group = (xs) => ({
    joined: xs.length,
    activation: wilson(xs.filter((u) => u.activated).length, xs.length),
    d1: retention(xs, 1),
    d7: retention(xs, 7),
    d30: retention(xs, 30)
  });
  const fresh90 = users.filter((u) => u.day >= from90);
  const bySource = /* @__PURE__ */ new Map();
  for (const u of fresh90) {
    const k = sourceOf(u);
    bySource.set(k, [...bySource.get(k) ?? [], u]);
  }
  for (const s of r.seeding) if (!bySource.has(s.label)) bySource.set(s.label, []);
  const costOf = (label) => {
    const rows = r.seeding.filter((s) => s.label === label && s.price != null);
    return rows.length ? rows.reduce((a, s) => a + (s.price ?? 0), 0) : null;
  };
  const per = (cost, n) => cost != null && n ? cost / n : null;
  const sources = [...bySource].map(([source, xs]) => {
    const g = group(xs);
    const cost = costOf(source);
    const posts = r.seeding.filter((s) => s.label === source);
    return {
      source,
      ...g,
      cost,
      posts: posts.length,
      lastPost: posts.map((s) => s.posted_at ?? "").filter(Boolean).sort().at(-1) ?? null,
      channels: [...new Set(posts.map((s) => s.channel).filter((c) => Boolean(c)))],
      perJoined: per(cost, g.joined),
      perActivated: per(cost, g.activation.n),
      perD7: per(cost, g.d7.n)
    };
  }).sort((a, b) => b.joined - a.joined || a.source.localeCompare(b.source));
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const to = addDays4(today, -7 * i), from = addDays4(to, -6);
    const joined = users.filter((u) => u.day >= from && u.day <= to);
    const active = new Set(r.visits.filter((v) => v.day >= from && v.day <= to).map((v) => v.user_id));
    const returning = [...active].filter((id) => {
      const u = byId.get(id);
      return u && u.day < from;
    }).length;
    return {
      from,
      to,
      joined: joined.length,
      activated: joined.filter((u) => u.activated).length,
      invited: joined.filter((u) => u.invited_by).length,
      seeded: joined.filter((u) => u.source).length,
      active: active.size,
      returning,
      shares: r.shares.filter((s) => {
        const d = dayOf2(s.at);
        return d >= from && d <= to;
      }).length
    };
  }).reverse();
  const fresh30 = users.filter((u) => u.day >= from30);
  const onboarded = new Set(r.onboard.map((e) => e.user_id));
  const ratings1 = new Map(r.ratingsDay1.map((x) => [x.user_id, x.n]));
  const arm = (xs) => ({
    ...group(xs),
    ratingsDay1: median3(xs.map((u) => ratings1.get(u.id) ?? 0)),
    ratedDay1: wilson(xs.filter((u) => (ratings1.get(u.id) ?? 0) >= 5).length, xs.length)
  });
  const stepCount = (place) => new Set(r.onboard.filter((e) => e.place === place).map((e) => e.user_id)).size;
  const parse2 = (detail) => Object.fromEntries((detail ?? "").split(",").map((kv) => kv.split(":")).filter(([k, v]) => k && v).map(([k, v]) => [k, Number(v)]));
  const finals = r.onboard.filter((e) => e.place === "swipe_done" || e.place === "swipe_skip").map((e) => parse2(e.detail));
  const favs = r.onboard.filter((e) => e.place === "favorites_done").map((e) => parse2(e.detail).favorites ?? 0);
  const avg = (k) => finals.length ? finals.reduce((a, d) => a + (d[k] ?? 0), 0) / finals.length : null;
  const onboarding = {
    swipe: arm(fresh30.filter((u) => onboarded.has(u.id))),
    deck: arm(fresh30.filter((u) => !onboarded.has(u.id))),
    steps: { swipeDone: stepCount("swipe_done"), swipeSkip: stepCount("swipe_skip"), favoritesDone: stepCount("favorites_done"), favoritesSkip: stepCount("favorites_skip") },
    perPerson: { seen: avg("seen"), want: avg("want"), no: avg("no"), rated: avg("rated"), favorites: favs.length ? favs.reduce((a, b) => a + b, 0) / favs.length : null }
  };
  const active30 = new Set(r.visits.filter((v) => v.day >= from30).map((v) => v.user_id));
  const sharers = new Set(r.shares.map((s) => s.user_id));
  const invited30 = fresh30.filter((u) => u.invited_by);
  const inviters = new Set(invited30.map((u) => u.invited_by));
  const virality = {
    shares: r.shares.length,
    sharers: sharers.size,
    sharerShare: wilson(sharers.size, active30.size),
    invitedJoined: invited30.length,
    inviters: inviters.size,
    invited: group(invited30),
    /** приглашённых на одного активного: выше 1 — рост сам по себе, в бете ждём 0,1–0,3 */
    k: active30.size ? invited30.length / active30.size : null,
    invitedPerSharer: sharers.size ? invited30.length / sharers.size : null,
    together: r.together,
    inline: r.inline
  };
  const all30 = group(fresh30);
  return {
    period: { from90, from30, today },
    internal: r.internal,
    summary: {
      joined30: all30.joined,
      activation30: all30.activation,
      d7: all30.d7,
      d30: all30.d30,
      wau: weeks.at(-1)?.active ?? 0,
      active30: active30.size,
      spend90: r.seeding.filter((s) => s.price != null && (s.posted_at ?? today) >= from90).reduce((a, s) => a + (s.price ?? 0), 0)
    },
    sources,
    weeks,
    onboarding,
    virality
  };
}

// worker/growthRoute.ts
var json5 = (body, status = 200) => Response.json(body, { status });
var addDays5 = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
var LABEL = /^[a-z0-9_]{1,24}$/;
var ID = /^sd-[0-9a-f]{12}$/;
async function getGrowth(req, env, admin) {
  if (!admin) return json5({ error: "unauthorized" }, 401);
  const url = new URL(req.url);
  const db = env.DB;
  const owner = env.OWNER_USERNAME?.replace(/^@/, "").toLowerCase() ?? "";
  const withInternal = url.searchParams.get("internal") === "1";
  const conds = [];
  const binds = [];
  if (!withInternal) {
    if (owner) {
      conds.push("lower(coalesce(username, '')) <> ?");
      binds.push(owner);
    }
    conds.push("lower(coalesce(username, '')) NOT IN (SELECT username FROM tester)");
  }
  if (url.searchParams.get("tg") === "1") conds.push("tg_id IS NOT NULL");
  const userWhere = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const inUsers = `user_id IN (SELECT id FROM user ${userWhere})`;
  const q = async (sql, ...bind) => (await db.prepare(sql).bind(...binds, ...bind).all()).results ?? [];
  const one = async (sql, ...bind) => (await q(sql, ...bind))[0];
  const raw = async (sql, ...bind) => await db.prepare(sql).bind(...bind).first() ?? void 0;
  const today = mskDay2();
  const from120 = addDays5(today, -120);
  const since30 = `${addDays5(today, -30)}T00:00:00.000Z`;
  const since120 = `${from120}T00:00:00.000Z`;
  const [users, visits, firstFeed, ratingsDay1, onboard, shares, together, participants, polls, voters, seeding, internal] = await Promise.all([
    q(`SELECT id, created_at, source, invited_by FROM user ${userWhere}`),
    q(`SELECT user_id, day FROM visit WHERE ${inUsers} AND day >= ?`, from120),
    q(`SELECT user_id, MIN(at) AS at FROM impression WHERE ${inUsers} GROUP BY user_id`),
    q(`SELECT r.user_id, COUNT(*) AS n FROM rating r JOIN user u ON u.id = r.user_id
      WHERE r.${inUsers} AND u.created_at >= ? AND r.at <= strftime('%Y-%m-%dT%H:%M:%fZ', u.created_at, '+1 day') GROUP BY r.user_id`, since30),
    q(`SELECT user_id, place, detail, at FROM event WHERE kind = 'onboard' AND ${inUsers} AND at >= ?`, since30),
    q(`SELECT user_id, at FROM event WHERE kind = 'share_sent' AND ${inUsers} AND at >= ?`, since120),
    one(`SELECT COUNT(*) AS n FROM together WHERE ${inUsers} AND created_at >= ?`, since30),
    one(`SELECT COUNT(DISTINCT v.user_id) AS n FROM together_vote v JOIN together t ON t.id = v.session_id
      WHERE t.created_at >= ? AND v.user_id <> t.user_id AND v.${inUsers}`, since30),
    raw("SELECT COUNT(*) AS n FROM inline_poll WHERE created_at >= ?", since30),
    raw(`SELECT COUNT(*) AS n, SUM(CASE WHEN u.tg_id IS NULL THEN 1 ELSE 0 END) AS outsiders
      FROM (SELECT DISTINCT tg_id FROM inline_vote WHERE at >= ?) x LEFT JOIN user u ON u.tg_id = x.tg_id`, since30),
    db.prepare("SELECT id, label, channel, posted_at, price, currency, note FROM seeding ORDER BY posted_at DESC, created_at DESC").all().then((r) => r.results ?? []),
    db.prepare(`SELECT SUM(CASE WHEN lower(coalesce(username, '')) = ? THEN 1 ELSE 0 END) AS owner,
      SUM(CASE WHEN lower(coalesce(username, '')) <> ? AND lower(coalesce(username, '')) IN (SELECT username FROM tester) THEN 1 ELSE 0 END) AS testers FROM user`).bind(owner, owner).first()
  ]);
  const rows = {
    today,
    users,
    visits,
    firstFeed,
    ratingsDay1,
    onboard,
    shares,
    together: { sessions: together?.n ?? 0, participants: participants?.n ?? 0 },
    inline: { polls: polls?.n ?? 0, voters: voters?.n ?? 0, outsiders: voters?.outsiders ?? 0 },
    seeding,
    internal: withInternal ? { owner: 0, testers: 0 } : { owner: internal?.owner ?? 0, testers: internal?.testers ?? 0 }
  };
  return json5({ at: (/* @__PURE__ */ new Date()).toISOString(), filters: { internal: withInternal, telegramOnly: url.searchParams.get("tg") === "1" }, seedingRows: seeding, ...computeGrowth(rows) });
}
var clip2 = (v, n) => typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null;
async function seedingRoute(req, path, db) {
  if (path === "/api/admin/seeding" && req.method === "GET") {
    const r = await db.prepare("SELECT id, label, channel, posted_at, price, currency, note FROM seeding ORDER BY posted_at DESC, created_at DESC").all();
    return json5({ seeding: r.results ?? [] });
  }
  if (path === "/api/admin/seeding" && req.method === "PUT") {
    const b = await req.json().catch(() => ({}));
    const label = clip2(b.label, 24)?.toLowerCase();
    if (!label || !LABEL.test(label)) return json5({ error: "bad_label", hint: "\u043B\u0430\u0442\u0438\u043D\u0438\u0446\u0430, \u0446\u0438\u0444\u0440\u044B \u0438 _, \u0434\u043E 24 \u0437\u043D\u0430\u043A\u043E\u0432 \u2014 \u043A\u0430\u043A \u0432 \u0441\u0441\u044B\u043B\u043A\u0435 --s" }, 400);
    const postedAt = clip2(b.posted_at, 10);
    if (postedAt && !/^\d{4}-\d{2}-\d{2}$/.test(postedAt)) return json5({ error: "bad_date" }, 400);
    const price = b.price == null || b.price === "" ? null : Number(b.price);
    if (price != null && !(Number.isFinite(price) && price >= 0)) return json5({ error: "bad_price" }, 400);
    const id = typeof b.id === "string" && ID.test(b.id) ? b.id : `sd-${Array.from(crypto.getRandomValues(new Uint8Array(6)), (x) => x.toString(16).padStart(2, "0")).join("")}`;
    await db.prepare(`INSERT INTO seeding (id, label, channel, posted_at, price, currency, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET label = excluded.label, channel = excluded.channel, posted_at = excluded.posted_at, price = excluded.price,
        currency = excluded.currency, note = excluded.note`).bind(id, label, clip2(b.channel, 120), postedAt, price, clip2(b.currency, 8) ?? "RUB", clip2(b.note, 500), (/* @__PURE__ */ new Date()).toISOString()).run();
    return json5({ ok: true, id });
  }
  const del = /^\/api\/admin\/seeding\/(sd-[0-9a-f]{12})$/.exec(path);
  if (del && req.method === "DELETE") {
    const r = await db.prepare("DELETE FROM seeding WHERE id = ?").bind(del[1]).run();
    return json5({ ok: true, removed: r.meta?.changes ?? 0 });
  }
  return json5({ error: "not_found" }, 404);
}

// worker/account.ts
var json6 = (body, status = 200) => Response.json(body, { status });
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
  const me = await db.prepare("SELECT username, tg_id FROM user WHERE id = ?").bind(userId).first();
  if (!me) return json6({ error: "not_found" }, 404);
  const tables = await userTables(db);
  const nicks = tables.includes("seed_applied") ? ((await db.prepare("SELECT seed FROM seed_applied WHERE user_id = ? AND seed LIKE 'nick:%'").bind(userId).all()).results ?? []).map((r) => r.seed.slice("nick:".length)).filter((n) => /^[a-z0-9_]{3,40}$/.test(n)) : [];
  const nick2 = me.username?.replace(/^@/, "").toLowerCase();
  const counts = {};
  for (const t of tables) {
    const row = await db.prepare(`SELECT COUNT(*) AS n FROM ${t} WHERE user_id = ?`).bind(userId).first();
    if (row?.n) counts[t] = Number(row.n);
  }
  await db.batch([
    // выбор компанией (ЗП-11): сессии участника уходят вместе с чужими голосами в них
    ...tables.includes("together") ? [db.prepare("DELETE FROM together_vote WHERE session_id IN (SELECT id FROM together WHERE user_id = ?)").bind(userId)] : [],
    ...tables.map((t) => db.prepare(`DELETE FROM ${t} WHERE user_id = ?`).bind(userId)),
    // голосование в чате (15.10) — по tg_id: свои голоса и свои подборки (чужие голоса в них — тоже)
    ...me.tg_id != null && tables.length ? [
      db.prepare("DELETE FROM inline_vote WHERE tg_id = ? OR poll_id IN (SELECT id FROM inline_poll WHERE owner_tg = ?)").bind(me.tg_id, me.tg_id),
      db.prepare("DELETE FROM inline_poll WHERE owner_tg = ?").bind(me.tg_id)
    ] : [],
    // тестер (ХБ, 17.10): свою строку — по номеру аккаунта, в том числе под старым ником; строку с чужим номером под
    // своим нынешним ником не трогать — это другой человек
    ...me.tg_id != null ? [db.prepare("DELETE FROM tester WHERE tg_id = ? OR (username = ? AND tg_id IS NULL)").bind(me.tg_id, nick2 ?? "")] : nick2 ? [db.prepare("DELETE FROM tester WHERE username = ? AND tg_id IS NULL").bind(nick2)] : [],
    // кого участник привёл (ЗП-37) — у них ссылка на него стирается
    db.prepare("UPDATE user SET invited_by = NULL WHERE invited_by = ?").bind(userId),
    db.prepare("DELETE FROM user WHERE id = ?").bind(userId)
  ]);
  for (const n of nicks) await env.REFERENCE?.delete?.(`seed--${n}.json`);
  console.log(`\u0430\u043A\u043A\u0430\u0443\u043D\u0442 \u0443\u0434\u0430\u043B\u0451\u043D \u043F\u043E \u043F\u0440\u043E\u0441\u044C\u0431\u0435 \u0443\u0447\u0430\u0441\u0442\u043D\u0438\u043A\u0430: ${Object.entries(counts).map(([t, n]) => `${t} ${n}`).join(", ") || "\u0431\u0435\u0437 \u0437\u0430\u043F\u0438\u0441\u0435\u0439"}`);
  return json6({ ok: true, deleted: counts });
}

// worker/probe.ts
var MAX_KB = 63;
var table;
function crc32(data2) {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c2 = n;
      for (let k = 0; k < 8; k++) c2 = c2 & 1 ? 3988292384 ^ c2 >>> 1 : c2 >>> 1;
      table[n] = c2 >>> 0;
    }
  }
  let c = 4294967295;
  for (const b of data2) c = table[(c ^ b) & 255] ^ c >>> 8;
  return (c ^ 4294967295) >>> 0;
}
function paddedGzip(text, pad) {
  const body = new TextEncoder().encode(text);
  const sub = Math.max(0, Math.min(pad, 65535 - 4));
  const xlen = pad > 0 ? sub + 4 : 0;
  const out = new Uint8Array(10 + (xlen ? 2 + xlen : 0) + 5 + body.length + 8);
  const v = new DataView(out.buffer);
  let i = 0;
  out.set([31, 139, 8, xlen ? 4 : 0, 0, 0, 0, 0, 0, 255], 0);
  i = 10;
  if (xlen) {
    v.setUint16(i, xlen, true);
    i += 2;
    out[i++] = 84;
    out[i++] = 77;
    v.setUint16(i, sub, true);
    i += 2;
    for (let k = 0; k < sub; k++) out[i++] = 33 + k * 7919 % 94;
  }
  out[i++] = 1;
  v.setUint16(i, body.length, true);
  i += 2;
  v.setUint16(i, ~body.length & 65535, true);
  i += 2;
  out.set(body, i);
  i += body.length;
  v.setUint32(i, crc32(body), true);
  i += 4;
  v.setUint32(i, body.length, true);
  return out;
}
function probe(url, head) {
  const kb = Math.max(0, Math.min(MAX_KB, Math.floor(Number(url.searchParams.get("kb") ?? "32")) || 0));
  const body = paddedGzip(`tm-probe ok ${kb}
`, kb * 1024);
  return new Response(body, {
    status: 200,
    headers: { ...head, "content-type": "text/plain; charset=utf-8", "content-encoding": "gzip", "cache-control": "no-store" },
    // Workers иначе сожмёт ещё раз; Node поле не знает и пропускает
    ...{ encodeBody: "manual" }
  });
}

// worker/trailers.ts
var TRAILER_KEY = /^(?:(?:tmdb|tv):\d{1,8}|imdb:tt\d{5,10}|wd:Q\d{1,12})$/;
var MAX_TRAILER_KEYS = 40;
function trailerKeys(raw) {
  const out = [];
  for (const k of (raw ?? "").split(",")) {
    const key = k.trim();
    if (!TRAILER_KEY.test(key) || out.includes(key)) continue;
    out.push(key);
    if (out.length >= MAX_TRAILER_KEYS) break;
  }
  return out;
}
function pickWorks(works, keys) {
  const out = {};
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(works, k)) out[k] = works[k];
  return out;
}
var held;
var forgetTrailers = () => {
  held = void 0;
  loading = void 0;
};
var loading;
function trailerWorks(env) {
  if (held && Date.now() - held.checked < 6e4) return Promise.resolve(held.works);
  return loading ??= readTrailerWorks(env).finally(() => {
    loading = void 0;
  });
}
async function readTrailerWorks(env) {
  const object = await env.REFERENCE?.get("trailers.json").catch(() => null);
  if (!object) {
    held = { etag: "", checked: Date.now(), works: {} };
    return held.works;
  }
  if (held && held.etag && held.etag === object.httpEtag) {
    await object.body.cancel?.().catch(() => void 0);
    held.checked = Date.now();
    return held.works;
  }
  try {
    const data2 = JSON.parse(await new Response(object.body).text());
    held = { etag: object.httpEtag, checked: Date.now(), works: data2.works && typeof data2.works === "object" ? data2.works : {} };
  } catch (err) {
    console.error("trailers.json:", err);
    held = { etag: "", checked: Date.now(), works: held?.works ?? {} };
  }
  return held.works;
}
async function getTrailers(env, url) {
  const keys = trailerKeys(url.searchParams.get("keys"));
  const works = keys.length ? await trailerWorks(env) : {};
  return Response.json(pickWorks(works, keys), { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

// worker/loop.ts
var DIFFICULTIES = ["too_easy", "just_right", "too_hard"];
var HONEST_THRESHOLD = 30;
var isDiff = (x) => typeof x === "string" && DIFFICULTIES.includes(x);
var oneHot = (d) => ({ too_easy: d === "too_easy" ? 1 : 0, just_right: d === "just_right" ? 1 : 0, too_hard: d === "too_hard" ? 1 : 0 });
var brier = (p, fact) => DIFFICULTIES.reduce((s, d) => s + (p[d] - (d === fact ? 1 : 0)) ** 2, 0);
var round2 = (x, n = 3) => Math.round(x * 10 ** n) / 10 ** n;
var median4 = (xs) => {
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
      brier: round2(xs.reduce((s, x) => s + brier(x.p.odds, x.o.fact), 0) / xs.length),
      exact: round2(xs.filter((x) => x.p.point === x.o.fact).length / xs.length)
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
    agreement: { humanModel: both.length ? round2(both.filter((o) => o.human === o.model).length / both.length) : void 0, n: both.length },
    abandon: {
      n: abandons.length,
      reasons,
      medianDays: days.length ? round2(median4(days), 1) : void 0,
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
      acceptance: uniqueShown ? round2(start / uniqueShown) : void 0
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
var json7 = (data2, status = 200, extra = {}) => new Response(JSON.stringify(data2), { status, headers: { ...JSON_HEADERS, ...extra } });
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
  const hashed = await tokenHash(token);
  const row = await db.prepare(
    `SELECT user.id AS id, user.settings AS settings, session.expires_at AS expires_at
       FROM session JOIN user ON user.id = session.user_id WHERE session.token = ?`
  ).bind(hashed).first();
  if (!row) return void 0;
  if (Date.parse(row.expires_at) < Date.now()) {
    await db.prepare("DELETE FROM session WHERE token = ?").bind(hashed).run();
    return void 0;
  }
  return { id: row.id, settings: row.settings };
}
var SESSION_DAYS = 90;
async function openSession(db, userId) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await db.batch([
    db.prepare("DELETE FROM session WHERE expires_at < ?").bind(now()),
    db.prepare("DELETE FROM session WHERE user_id = ? AND token NOT IN (SELECT token FROM session WHERE user_id = ? ORDER BY created_at DESC LIMIT 9)").bind(userId, userId),
    db.prepare("INSERT INTO session (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)").bind(await tokenHash(token), userId, now(), expiresAt)
  ]);
  return { token, expiresAt };
}
async function postSession(req, env) {
  const body = await req.json().catch(() => ({}));
  const db = env.DB;
  if (body.initData) {
    if (!env.BOT_TOKEN) return json7({ error: "server_not_configured" }, 500);
    const check = await verifyInitData(body.initData, env.BOT_TOKEN);
    if (!check.ok || !check.user) return json7({ error: "bad_init_data", reason: check.reason }, 401);
    const tg2 = check.user;
    const found = await db.prepare("SELECT id FROM user WHERE tg_id = ?").bind(tg2.id).first();
    const id = found?.id ?? newId("u");
    if (found) {
      await db.prepare("UPDATE user SET seen_at = ?, username = ?, first_name = ? WHERE id = ?").bind(now(), tg2.username ?? null, tg2.first_name ?? null, id).run();
    } else {
      await db.prepare("INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, tg2.id, tg2.username ?? null, tg2.first_name ?? null, now(), now()).run();
      await noteInvite(db, id, check.startParam);
    }
    const owner = isOwner(env, tg2.username, tg2.id);
    if (owner && env.OWNER_SEED) await seedOwner(db, id, env.OWNER_SEED);
    const session = await openSession(db, id);
    return json7({ ...session, user: { id, username: tg2.username, firstName: tg2.first_name, telegram: true, owner } });
  }
  if (body.demo) {
    if (env.ALLOW_DEMO !== "1") return json7({ error: "demo_disabled" }, 403);
    const id = newId("u-anon");
    await db.prepare("INSERT INTO user (id, tg_id, username, first_name, created_at, seen_at) VALUES (?, NULL, NULL, ?, ?, ?)").bind(id, "\u0413\u043E\u0441\u0442\u044C", now(), now()).run();
    const session = await openSession(db, id);
    return json7({ ...session, user: { id, firstName: "\u0413\u043E\u0441\u0442\u044C", telegram: false } });
  }
  return json7({ error: "no_credentials" }, 400);
}
var isOwner = (env, username, tgId) => {
  const id = env.OWNER_TG_ID?.trim();
  if (id) return tgId != null && String(tgId) === id;
  return Boolean(username && env.OWNER_USERNAME && username.toLowerCase() === env.OWNER_USERNAME.replace(/^@/, "").toLowerCase());
};
var nick = (s) => s.trim().replace(/^@/, "").toLowerCase();
async function roleOf(env, username, tgId) {
  if (isOwner(env, username, tgId)) return "admin";
  if (!username) return "user";
  const t = await env.DB.prepare("SELECT tg_id FROM tester WHERE username = ?").bind(nick(username)).first();
  if (!t) return "user";
  if (t.tg_id == null && tgId != null) {
    await env.DB.prepare("UPDATE tester SET tg_id = ? WHERE username = ? AND tg_id IS NULL").bind(tgId, nick(username)).run();
    return "tester";
  }
  return t.tg_id === tgId ? "tester" : "user";
}
async function seedOwner(db, userId, seed) {
  const has = await db.prepare(
    "SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1) + (SELECT COUNT(*) FROM rating WHERE user_id = ?1) + (SELECT COUNT(*) FROM watched WHERE user_id = ?1) AS n"
  ).bind(userId).first();
  if (has && has.n > 0) return;
  const at = now();
  const statements = [
    // история собрана из карточек истории (u-kp…, l-tmdb…) — на главные копии (канон копий, 17.10)
    ...seed.journal.map((e) => db.prepare(
      "INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(userId, e.entryId, canonWork(e.workId), JSON.stringify(canonCard(e.work, canonWork(e.workId))), e.status, e.startedAt ?? null, e.finishedAt ?? null)),
    ...seed.ratings.map((r) => db.prepare(
      "INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, at) VALUES (?, ?, ?, ?, ?)"
    ).bind(userId, canonWork(r.workId), r.rating, r.raw ?? null, at)),
    // порядок присланного списка сохраняем временем отметки: первое в списке — самое свежее
    ...seed.watched.map((w, i) => db.prepare(
      "INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, ?, ?, ?)"
    ).bind(userId, canonWork(w.workId), JSON.stringify(canonCard(w.work, canonWork(w.workId))), w.tmdb ?? null, w.imdb ?? null, new Date(Date.parse(at) - i * 1e3).toISOString()))
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
  const bind = `nick:${row.username.toLowerCase()}`;
  const other = await db.prepare("SELECT 1 AS x FROM seed_applied WHERE seed = ? AND user_id <> ?").bind(bind, userId).first();
  if (other) return;
  await db.prepare("INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)").bind(userId, bind, now()).run();
  const seed = JSON.parse(await new Response(object.body).text());
  const mark = `user:${seed.version}`;
  const done2 = await db.prepare("SELECT 1 AS x FROM seed_applied WHERE user_id = ? AND seed = ?").bind(userId, mark).first();
  if (done2) return;
  const at = Date.parse(now());
  const stamp = (i) => new Date(at - (i + 1) * 1e3).toISOString();
  await db.batch([
    ...seed.watched.map((w, i) => db.prepare(
      "INSERT OR IGNORE INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, 'watched', ?, ?, ?, ?)"
    ).bind(userId, canonWork(w.workId), JSON.stringify(canonCard(w.work, canonWork(w.workId))), w.tmdb ?? null, w.imdb ?? null, stamp(i))),
    ...(seed.ratings ?? []).map((r) => db.prepare(
      "INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(userId, canonWork(r.workId), r.rating, r.raw ?? null, r.work ? JSON.stringify(canonCard(r.work, canonWork(r.workId))) : null, new Date(at).toISOString())),
    db.prepare("INSERT OR IGNORE INTO seed_applied (user_id, seed, at) VALUES (?, ?, ?)").bind(userId, mark, now())
  ]);
}
async function putUserSeed(req, env, username) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json7({ error: "unauthorized" }, 401);
  const key = seedKey(username);
  if (!key) return json7({ error: "bad_username" }, 400);
  if (!env.REFERENCE) return json7({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  let seed;
  try {
    seed = JSON.parse(text);
  } catch {
    return json7({ error: "bad_json" }, 400);
  }
  if (!seed.version || !Array.isArray(seed.watched)) return json7({ error: "bad_seed" }, 400);
  await env.REFERENCE.put(key, text);
  const known = await env.DB.prepare("SELECT 1 AS x FROM user WHERE lower(username) = ?").bind(username.toLowerCase()).first();
  return json7({ ok: true, username, watched: seed.watched.length, ratings: seed.ratings?.length ?? 0, known: Boolean(known) });
}
async function putRating(req, user, db, rawId) {
  const workId = canonWork(rawId);
  const body = await req.json().catch(() => ({}));
  if (body.rating == null) {
    await db.prepare("DELETE FROM rating WHERE user_id = ? AND work_id = ?").bind(user.id, workId).run();
    return json7({ ok: true });
  }
  const rating = Math.round(Number(body.rating));
  if (!(rating >= 1 && rating <= 5)) return json7({ error: "bad_rating" }, 400);
  await db.prepare(
    `INSERT INTO rating (user_id, work_id, rating, raw, work, at) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET rating = excluded.rating, raw = excluded.raw, work = COALESCE(excluded.work, rating.work), at = excluded.at`
  ).bind(user.id, workId, rating, body.raw ?? null, body.work ? JSON.stringify(canonCard(body.work, workId)) : null, now()).run();
  return json7({ ok: true });
}
var AFTER_PACE = /* @__PURE__ */ new Set(["slow", "ok", "fast"]);
var AFTER_HOOK = /* @__PURE__ */ new Set(["plot", "characters", "world", "idea"]);
var AFTER_WORK = /^\S{1,120}$/;
var afterwordOf = (r) => ({
  ...r.worth != null ? { worth: r.worth } : {},
  ...r.pace ? { pace: r.pace } : {},
  ...r.hook ? { hook: r.hook } : {},
  at: r.at
});
async function putAfterword(req, user, db, rawId) {
  let workId;
  try {
    workId = decodeURIComponent(rawId);
  } catch {
    return json7({ error: "bad_work" }, 400);
  }
  if (!AFTER_WORK.test(workId)) return json7({ error: "bad_work" }, 400);
  workId = canonWork(workId);
  const raw = await req.json().catch(() => void 0);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json7({ error: "bad_afterword" }, 400);
  const b = raw;
  const has = (k) => Object.prototype.hasOwnProperty.call(b, k) && b[k] !== void 0;
  if (!has("worth") && !has("pace") && !has("hook")) return json7({ error: "empty" }, 400);
  if (has("worth") && b.worth !== null && !(Number.isInteger(b.worth) && b.worth >= 1 && b.worth <= 5)) {
    return json7({ error: "bad_worth" }, 400);
  }
  if (has("pace") && b.pace !== null && !(typeof b.pace === "string" && AFTER_PACE.has(b.pace))) return json7({ error: "bad_pace" }, 400);
  if (has("hook") && b.hook !== null && !(typeof b.hook === "string" && AFTER_HOOK.has(b.hook))) return json7({ error: "bad_hook" }, 400);
  const val = (k) => has(k) ? b[k] : null;
  const keep = (k) => has(k) ? 0 : 1;
  await db.batch([
    db.prepare(
      `INSERT INTO afterword (user_id, work_id, worth, pace, hook, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
       ON CONFLICT (user_id, work_id) DO UPDATE SET
         worth = CASE WHEN ?7 THEN afterword.worth ELSE excluded.worth END,
         pace = CASE WHEN ?8 THEN afterword.pace ELSE excluded.pace END,
         hook = CASE WHEN ?9 THEN afterword.hook ELSE excluded.hook END,
         at = excluded.at`
    ).bind(user.id, workId, val("worth"), val("pace"), val("hook"), now(), keep("worth"), keep("pace"), keep("hook")),
    db.prepare("DELETE FROM afterword WHERE user_id = ? AND work_id = ? AND worth IS NULL AND pace IS NULL AND hook IS NULL").bind(user.id, workId)
  ]);
  const row = await db.prepare("SELECT worth, pace, hook, at FROM afterword WHERE user_id = ? AND work_id = ?").bind(user.id, workId).first();
  return json7({ ok: true, afterword: row ? afterwordOf(row) : null });
}
var canonOrNull = (v) => typeof v === "string" && v ? canonWork(v) : null;
var levelOf = (v) => typeof v === "number" && Number.isFinite(v) && v > 0 && v <= 10 ? Math.round(v * 10) / 10 : null;
function traitsOf(v) {
  if (!v || typeof v !== "object") return null;
  const t = v;
  const op = {};
  if (t.op && typeof t.op === "object") {
    for (const [k, x] of Object.entries(t.op).slice(0, 12)) {
      if (/^[a-z_]{1,32}$/.test(k) && typeof x === "number" && Number.isFinite(x) && x > 0) op[k] = Math.min(3, Math.round(x * 100) / 100);
    }
  }
  const rg = Array.isArray(t.rg) ? t.rg.filter((r) => typeof r === "string" && /^[a-z_]{1,32}$/.test(r)).slice(0, 8) : [];
  return Object.keys(op).length || rg.length ? JSON.stringify({ ...Object.keys(op).length ? { op } : {}, ...rg.length ? { rg } : {} }) : null;
}
async function noteLevelState(db, userId, v, at) {
  if (!v || typeof v !== "object") return;
  const s = v;
  const num = (x) => typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 10 ? Math.round(x * 10) / 10 : null;
  const center = num(s.center), lo = num(s.lo), hi = num(s.hi), median5 = num(s.median);
  const n = typeof s.n === "number" && Number.isInteger(s.n) && s.n >= 0 ? Math.min(s.n, 1e5) : null;
  if (center == null || lo == null || hi == null || n == null || lo > hi) return;
  const last = await db.prepare("SELECT center, lo, hi, median, n FROM level_state WHERE user_id = ? ORDER BY at DESC LIMIT 1").bind(userId).first();
  if (last && last.center === center && last.lo === lo && last.hi === hi && last.median === median5 && last.n === n) return;
  await db.prepare("INSERT OR IGNORE INTO level_state (user_id, at, center, lo, hi, median, n) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(userId, at, center, lo, hi, median5, n).run();
}
async function postImpressions(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const short = (v, max) => typeof v === "string" && v.length > 0 && v.length <= max ? v : void 0;
  const items = (Array.isArray(body.items) ? body.items : []).filter((i) => i && short(i.recId, 120) && short(i.workId, 120)).slice(0, 20);
  const slateId = short(body.slateId, 120);
  if (!slateId || !items.length) return json7({ error: "no_items" }, 400);
  const energy = typeof body.energy === "string" && /^[\w-]{1,32}$/.test(body.energy) ? body.energy : null;
  const at = now();
  await db.batch(items.map((i) => db.prepare(
    "INSERT INTO impression (id, user_id, slate_id, rec_id, work_id, slot, rank, energy, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(newId("i"), user.id, slateId, i.recId, canonWork(i.workId), short(i.slot, 64) ?? null, typeof i.rank === "number" && Number.isFinite(i.rank) ? i.rank : null, energy, at, levelOf(i.level), traitsOf(i.traits))));
  await noteLevelState(db, user.id, body.state, at);
  return json7({ ok: true, n: items.length });
}
async function postOpen(req, user, db) {
  const b = await req.json().catch(() => ({}));
  const str3 = (v, n = 64) => typeof v === "string" && v ? v.slice(0, n) : null;
  const url = str3(b.url, 500);
  if (!url) return json7({ error: "no_url" }, 400);
  const minutes = typeof b.minutes === "number" && b.minutes > 0 ? Math.min(Math.round(b.minutes), 24 * 60) : null;
  const id = newId("o");
  await db.prepare(
    "INSERT INTO material_open (id, user_id, url, work_id, platform, lens, lens_also, tier, place, shelf, shelves, at, voice_id, minutes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    id,
    user.id,
    url,
    canonOrNull(str3(b.workId, 120)),
    str3(b.platform),
    str3(b.lens),
    str3(b.lensAlso),
    str3(b.tier),
    str3(b.place),
    str3(b.shelf),
    b.shelves ? 1 : 0,
    now(),
    str3(b.voiceId, 120),
    minutes
  ).run();
  return json7({ ok: true, id });
}
async function postDwell(req, user, db, id) {
  const b = await req.json().catch(() => ({}));
  const s = typeof b.seconds === "number" && Number.isFinite(b.seconds) && b.seconds >= 0 ? Math.min(Math.round(b.seconds), 4 * 3600) : null;
  if (s == null) return json7({ error: "bad_seconds" }, 400);
  await db.prepare("UPDATE material_open SET dwell = ? WHERE id = ? AND user_id = ? AND dwell IS NULL").bind(s, id, user.id).run();
  return json7({ ok: true });
}
async function getLoopReport(url, user, env) {
  if (!await ownerOnly(user, env)) return json7({ error: "owner_only" }, 403);
  const all = url.searchParams.get("scope") !== "me";
  return json7({ scope: all ? "all" : "me", ...loopReport(await loopRows(env.DB, all ? void 0 : user.id)) });
}
async function getState(user, db, env) {
  await applyUserSeed(db, env, user.id).catch((err) => console.error("seed", user.id, err));
  const [watched, journal, predictions, verdicts, ratings, profile, dismissals, visits, afterwords] = await Promise.all([
    db.prepare("SELECT work_id, state, work FROM watched WHERE user_id = ? ORDER BY at DESC").bind(user.id).all(),
    db.prepare("SELECT entry_id, work_id, work, status, progress, started_at, finished_at, eagerness, inferred, series FROM journal WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT entry_id, work_id, expected, model, model_p, at FROM prediction WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT url, verdict FROM link_verdict WHERE user_id = ?").bind(user.id).all(),
    db.prepare("SELECT work_id, rating, raw, work, at FROM rating WHERE user_id = ? ORDER BY at").bind(user.id).all(),
    db.prepare("SELECT username, first_name, tg_id FROM user WHERE id = ?").bind(user.id).first(),
    // отказы на фильмы ленты (10.10): последний по каждому фильму за полгода — клиент не берёт их в ленту
    // на срок по причине (src/api/index.ts, `hiddenFromFeed`); «Видел» здесь не нужен — он уже в оценках
    db.prepare(`SELECT work_id, reason, MAX(at) AS at FROM feedback
                WHERE user_id = ? AND action = 'dismiss' AND work_id IS NOT NULL AND coalesce(reason, '') <> 'already_know' AND at >= ?
                GROUP BY work_id`).bind(user.id, new Date(Date.now() - 183 * 864e5).toISOString()).all(),
    // дни захода (ДФ-3): с третьего клиент предлагает ярлык на экран телефона
    db.prepare("SELECT COUNT(*) AS n FROM visit WHERE user_id = ?").bind(user.id).first(),
    // послесловие к просмотренному (17.10)
    db.prepare("SELECT work_id, worth, pace, hook, at FROM afterword WHERE user_id = ? ORDER BY at").bind(user.id).all()
  ]);
  const parse2 = (raw) => typeof raw === "string" ? JSON.parse(raw) : void 0;
  return json7({
    settings: parse2(user.settings) ?? {},
    watched: watched.results.map((r) => ({ workId: r.work_id, watched: r.state === "watched", work: parse2(r.work) })),
    journal: journal.results.map((r) => ({ ...r, work: parse2(r.work), series: parse2(r.series) })),
    predictions: predictions.results,
    verdicts: verdicts.results,
    dismissals: dismissals.results.map((r) => ({ workId: r.work_id, ...r.reason ? { reason: r.reason } : {}, at: r.at })),
    ratings: ratings.results.map((r) => ({ workId: r.work_id, rating: r.rating, ...r.raw != null ? { raw: r.raw } : {}, work: parse2(r.work), at: r.at })),
    afterwords: afterwords.results.map((r) => ({ workId: r.work_id, ...afterwordOf(r) })),
    profile: {
      username: profile?.username ?? void 0,
      firstName: profile?.first_name ?? void 0,
      telegram: profile?.tg_id != null,
      owner: isOwner(env, profile?.username, profile?.tg_id),
      role: await roleOf(env, profile?.username, profile?.tg_id),
      visitDays: visits?.n ?? 0
    }
  });
}
async function putSettings(req, user, db) {
  const raw = await req.json().catch(() => void 0);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json7({ error: "bad_settings" }, 400);
  const patch = raw;
  const current = JSON.parse(user.settings || "{}");
  const merged = { ...current, ...patch };
  const text = JSON.stringify(merged);
  if (text.length > 32e3) return json7({ error: "too_large" }, 413);
  await db.prepare("UPDATE user SET settings = ?, seen_at = ? WHERE id = ?").bind(text, now(), user.id).run();
  return json7(merged);
}
async function putWatched(req, user, db, rawId) {
  const workId = canonWork(rawId);
  const body = await req.json().catch(() => ({}));
  await db.prepare(
    `INSERT INTO watched (user_id, work_id, state, work, tmdb, imdb, at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, work_id) DO UPDATE SET state = excluded.state, work = COALESCE(excluded.work, watched.work), at = excluded.at`
  ).bind(
    user.id,
    workId,
    body.watched === false ? "removed" : "watched",
    body.work ? JSON.stringify(canonCard(body.work, workId)) : null,
    body.tmdb ?? null,
    body.imdb ?? null,
    now()
  ).run();
  return json7({ ok: true });
}
async function postStart(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.workId) return json7({ error: "no_work" }, 400);
  body.workId = canonWork(body.workId);
  if (body.work) body.work = canonCard(body.work, body.workId);
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
  return json7({ entryId });
}
async function postPlan(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.workId) return json7({ error: "no_work" }, 400);
  body.workId = canonWork(body.workId);
  if (body.work) body.work = canonCard(body.work, body.workId);
  const entryId = body.entryId ?? newId("j");
  const eager = Number.isInteger(body.eagerness) && body.eagerness >= 1 && body.eagerness <= 5 ? body.eagerness : null;
  await db.prepare(
    `INSERT INTO journal (user_id, entry_id, work_id, work, status, started_at, eagerness) VALUES (?, ?, ?, ?, 'planned', ?, ?)
     ON CONFLICT (user_id, entry_id) DO NOTHING`
  ).bind(user.id, entryId, body.workId, body.work ? JSON.stringify(body.work) : null, now(), eager).run();
  return json7({ entryId });
}
async function postUnstart(req, user, db, entryId) {
  const body = await req.json().catch(() => ({}));
  const reason = body.reason === "expired" || body.reason === "undo" ? body.reason : "not_watched";
  const row = await db.prepare("SELECT work_id, status FROM journal WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).first();
  if (!row || row.status !== "in_progress") return json7({ ok: true, changed: false });
  await db.prepare("UPDATE journal SET status = 'planned', inferred = NULL WHERE user_id = ? AND entry_id = ?").bind(user.id, entryId).run();
  if (reason !== "undo") {
    await db.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at) VALUES (?, ?, ?, ?, ?, NULL, NULL, NULL, ?)").bind(newId("c"), user.id, entryId, row.work_id, reason, now()).run();
  }
  return json7({ ok: true, changed: true });
}
async function deletePlan(user, db, entryId) {
  await db.prepare("DELETE FROM journal WHERE user_id = ? AND entry_id = ? AND status = 'planned'").bind(user.id, entryId).run();
  return json7({ ok: true });
}
var CHECKIN_STATUS = /* @__PURE__ */ new Set(["finished", "abandoned", "season_finished", "part_finished"]);
async function postCheckIn(req, user, db, entryId) {
  const body = await req.json().catch(() => ({}));
  const worth = Number.isInteger(body.worth) && body.worth >= 1 && body.worth <= 5 ? body.worth : null;
  const worthWhy = worth != null && worth <= 2 && typeof body.worthWhy === "string" && /^[a-z_]{1,32}$/.test(body.worthWhy) ? body.worthWhy : null;
  const status = body.status ?? "finished";
  if (!CHECKIN_STATUS.has(status)) return json7({ error: "bad_status" }, 400);
  const journalStatus = status === "season_finished" || status === "part_finished" ? "in_progress" : status;
  const series = body.book ? bookJson(body.book) : seriesJson(body.series);
  const str3 = (v, max) => typeof v === "string" ? v.slice(0, max) : null;
  const workId = canonWork(str3(body.workId, 120) ?? "");
  const at = now();
  await db.batch([
    db.prepare("INSERT INTO checkin (id, user_id, entry_id, work_id, status, perceived, reason, payload, at, level, traits, worth, worth_why) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(
      newId("c"),
      user.id,
      entryId,
      workId,
      status,
      str3(body.perceived, 64),
      str3(body.reason, 64),
      body.payload ? JSON.stringify(body.payload).slice(0, 4e3) : null,
      at,
      levelOf(body.level),
      traitsOf(body.traits),
      worth,
      worthWhy
    ),
    db.prepare(
      `UPDATE journal SET status = ?, progress = COALESCE(?, progress), series = COALESCE(?, series), finished_at = ? WHERE user_id = ? AND entry_id = ?`
    ).bind(journalStatus, typeof body.progress === "number" && Number.isFinite(body.progress) ? body.progress : null, series, journalStatus === "in_progress" ? null : now(), user.id, entryId),
    // 17.10: «стоило ли» — и в послесловие к произведению (темп и зацепку не трогаем)
    ...worth != null && workId ? [db.prepare(
      `INSERT INTO afterword (user_id, work_id, worth, at) VALUES (?, ?, ?, ?)
       ON CONFLICT (user_id, work_id) DO UPDATE SET worth = excluded.worth, at = excluded.at`
    ).bind(user.id, workId, worth, at)] : []
  ]);
  return json7({ ok: true });
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
  if (!series) return json7({ error: "bad_progress" }, 400);
  await db.prepare("UPDATE journal SET series = ? WHERE user_id = ? AND entry_id = ? AND status = 'in_progress'").bind(series, user.id, entryId).run();
  return json7({ ok: true });
}
async function postFeedback(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.action) return json7({ error: "no_action" }, 400);
  const eager = Number.isInteger(body.eagerness) && body.eagerness >= 1 && body.eagerness <= 5 ? body.eagerness : null;
  await db.prepare("INSERT INTO feedback (id, user_id, rec_id, work_id, action, reason, eagerness, at, level, traits) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(newId("f"), user.id, body.recId ?? null, canonOrNull(body.workId), body.action, body.reason ?? null, eager, now(), levelOf(body.level), traitsOf(body.traits)).run();
  return json7({ ok: true });
}
var IMPORT_ID = /^imp-[a-z0-9-]{4,40}$/;
var JOURNAL_STATUSES = /* @__PURE__ */ new Set(["planned", "in_progress", "finished", "abandoned"]);
var isoOrNull = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 30) : null;
async function postImport(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const importId = body.importId;
  if (!importId || !IMPORT_ID.test(importId)) return json7({ error: "bad_import_id" }, 400);
  const entries = (body.entries ?? []).filter((e) => e.entryId && e.workId && e.status && JOURNAL_STATUSES.has(e.status)).slice(0, 1e4);
  const ratings = (body.ratings ?? []).filter((r) => r.workId && Number.isInteger(r.rating) && r.rating >= 1 && r.rating <= 5).slice(0, 1e4);
  if (!entries.length && !ratings.length) return json7({ error: "nothing" }, 400);
  const at = now();
  const work = (w) => w && typeof w === "object" ? JSON.stringify(w).slice(0, 2e4) : null;
  const statements = [
    ...entries.map((e) => db.prepare(
      "INSERT OR IGNORE INTO journal (user_id, entry_id, work_id, work, status, started_at, finished_at, import_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(user.id, e.entryId.slice(0, 120), canonWork(e.workId.slice(0, 120)), work(canonCard(e.work, canonWork(e.workId.slice(0, 120)))), e.status, isoOrNull(e.startedAt), isoOrNull(e.finishedAt), importId)),
    ...ratings.map((r) => db.prepare(
      "INSERT OR IGNORE INTO rating (user_id, work_id, rating, raw, work, at, import_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).bind(user.id, canonWork(r.workId.slice(0, 120)), r.rating, typeof r.raw === "number" && r.raw >= 0 && r.raw <= 10 ? r.raw : null, work(canonCard(r.work, canonWork(r.workId.slice(0, 120)))), at, importId))
  ];
  for (let i = 0; i < statements.length; i += 500) await db.batch(statements.slice(i, i + 500));
  const counts = await db.prepare(
    "SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND import_id = ?2) AS entries, (SELECT COUNT(*) FROM rating WHERE user_id = ?1 AND import_id = ?2) AS ratings"
  ).bind(user.id, importId).first();
  return json7({
    ok: true,
    importId,
    added: counts?.entries ?? 0,
    rated: counts?.ratings ?? 0,
    kept: entries.length - (counts?.entries ?? 0),
    keptRatings: ratings.length - (counts?.ratings ?? 0)
  });
}
async function deleteImport(user, db, importId) {
  if (!IMPORT_ID.test(importId)) return json7({ error: "bad_import_id" }, 400);
  const counts = await db.prepare(
    "SELECT (SELECT COUNT(*) FROM journal WHERE user_id = ?1 AND import_id = ?2) AS entries, (SELECT COUNT(*) FROM rating WHERE user_id = ?1 AND import_id = ?2) AS ratings"
  ).bind(user.id, importId).first();
  await db.batch([
    db.prepare("DELETE FROM journal WHERE user_id = ? AND import_id = ?").bind(user.id, importId),
    db.prepare("DELETE FROM rating WHERE user_id = ? AND import_id = ?").bind(user.id, importId)
  ]);
  return json7({ ok: true, removed: counts?.entries ?? 0, unrated: counts?.ratings ?? 0 });
}
var EXPORT_NAME = /^[\w.-]{1,80}\.(csv|json)$/;
var EXPORT_TTL_MS = 36e5;
async function postExport(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.name || !EXPORT_NAME.test(body.name) || typeof body.text !== "string") return json7({ error: "bad_export" }, 400);
  if (body.text.length > 8e6) return json7({ error: "too_large" }, 413);
  const id = `ex-${[...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("")}`;
  await db.batch([
    db.prepare("DELETE FROM export_file WHERE at < ?").bind(new Date(Date.now() - EXPORT_TTL_MS).toISOString()),
    db.prepare("INSERT INTO export_file (id, user_id, name, body, at) VALUES (?, ?, ?, ?, ?)").bind(id, user.id, body.name, body.text, now())
  ]);
  return json7({ ok: true, path: `/api/export/${id}/${body.name}` });
}
async function getExport(db, id) {
  const row = await db.prepare("SELECT name, body FROM export_file WHERE id = ? AND at >= ?").bind(id, new Date(Date.now() - EXPORT_TTL_MS).toISOString()).first();
  if (!row) return json7({ error: "not_found" }, 404);
  return new Response(row.body, {
    headers: {
      "content-type": row.name.endsWith(".csv") ? "text/csv; charset=utf-8" : "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${row.name}"`,
      "cache-control": "no-store"
    }
  });
}
async function postSuggestion(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").trim().slice(0, 200);
  if (!title) return json7({ error: "no_title" }, 400);
  if (body.kind !== "work" && body.kind !== "voice") return json7({ error: "bad_kind" }, 400);
  await db.prepare("INSERT INTO suggestion (id, user_id, kind, title, note, context, at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(
    newId("sg"),
    user.id,
    body.kind,
    title,
    (body.note ?? "").trim().slice(0, 500) || null,
    (body.context ?? "").trim().slice(0, 200) || null,
    now()
  ).run();
  return json7({ ok: true });
}
var ISSUE_FIELDS = /* @__PURE__ */ new Set(["title", "year", "people", "synopsis", "image", "duration", "type", "watch", "analyses", "relations", "heroes", "other"]);
async function postWorkIssue(req, user, db) {
  const body = await req.json().catch(() => ({}));
  const workId = canonWork((body.workId ?? "").trim().slice(0, 100));
  const title = (body.title ?? "").trim().slice(0, 200);
  const fields = Array.isArray(body.fields) ? [...new Set(body.fields.filter((f) => typeof f === "string" && ISSUE_FIELDS.has(f)))] : [];
  const note = (body.note ?? "").trim().slice(0, 500);
  if (!workId || !title) return json7({ error: "no_work" }, 400);
  if (!fields.length && !note) return json7({ error: "empty" }, 400);
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
  return json7({ ok: true });
}
async function getWorkIssues(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json7({ error: "unauthorized" }, 401);
  const r = await env.DB.prepare(
    `SELECT i.id, i.work_id, i.title, i.fields, i.note, i.context, i.at, u.username, u.first_name
       FROM work_issue i LEFT JOIN user u ON u.id = i.user_id ORDER BY i.at DESC LIMIT 500`
  ).all();
  return json7({ items: r.results ?? [] });
}
async function getSuggestions(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json7({ error: "unauthorized" }, 401);
  const r = await env.DB.prepare(
    `SELECT s.id, s.kind, s.title, s.note, s.context, s.at, u.username, u.first_name
       FROM suggestion s LEFT JOIN user u ON u.id = s.user_id ORDER BY s.at DESC LIMIT 500`
  ).all();
  return json7({ items: r.results ?? [] });
}
async function putVerdict(req, user, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.url || !body.verdict) return json7({ error: "no_verdict" }, 400);
  await db.prepare(
    `INSERT INTO link_verdict (user_id, url, work_id, verdict, at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (user_id, url) DO UPDATE SET verdict = excluded.verdict, at = excluded.at`
  ).bind(user.id, body.url, canonOrNull(body.workId), body.verdict, now()).run();
  return json7({ ok: true });
}
var OWNER_QUEUE = "owner-queue.json";
var OWNER_KINDS = /* @__PURE__ */ new Set(["check", "lens"]);
async function getTesters(db) {
  const rows = await db.prepare("SELECT username, at FROM tester ORDER BY at").all();
  return json7({ testers: rows.results });
}
async function putTester(req, db) {
  const b = await req.json().catch(() => ({}));
  const u = typeof b.username === "string" ? nick(b.username) : "";
  if (!/^[a-z0-9_]{3,32}$/.test(u)) return json7({ error: "username" }, 400);
  if (b.on === false) await db.prepare("DELETE FROM tester WHERE username = ?").bind(u).run();
  else await db.prepare("INSERT INTO tester (username, at) VALUES (?, ?) ON CONFLICT(username) DO NOTHING").bind(u, now()).run();
  return getTesters(db);
}
async function ownerOnly(user, env) {
  const row = await env.DB.prepare("SELECT username, tg_id FROM user WHERE id = ?").bind(user.id).first();
  return isOwner(env, row?.username, row?.tg_id);
}
async function getOwnerQueue(env) {
  const object = env.REFERENCE ? await env.REFERENCE.get(OWNER_QUEUE) : null;
  if (!object) return json7({ error: "no_queue" }, 404);
  return new Response(object.body, { headers: { ...JSON_HEADERS, "cache-control": "no-store" } });
}
async function getOwnerDecisions(db) {
  const r = await db.prepare("SELECT kind, item_id, body, at FROM owner_decision ORDER BY at").all();
  return json7({ items: (r.results ?? []).map((x) => ({ kind: x.kind, id: x.item_id, at: x.at, ...JSON.parse(x.body) })) });
}
async function putOwnerDecision(req, db) {
  const body = await req.json().catch(() => ({}));
  if (!body.kind || !OWNER_KINDS.has(body.kind) || !body.id || !/^[A-Za-z0-9_:-]{11,16}$/.test(body.id)) return json7({ error: "bad_decision" }, 400);
  const { kind, id, ...rest } = body;
  const text = JSON.stringify(rest);
  if (text.length > 2e3) return json7({ error: "too_long" }, 400);
  await db.prepare(
    `INSERT INTO owner_decision (kind, item_id, body, at) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind, item_id) DO UPDATE SET body = excluded.body, at = excluded.at`
  ).bind(kind, id, text, now()).run();
  return json7({ ok: true });
}
function adminOk(req, env) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  return Boolean(env.ADMIN_TOKEN && token && sameToken(token, env.ADMIN_TOKEN));
}
async function putOwnerQueue(req, env) {
  if (!adminOk(req, env)) return json7({ error: "unauthorized" }, 401);
  if (!env.REFERENCE) return json7({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  try {
    JSON.parse(text);
  } catch {
    return json7({ error: "bad_json" }, 400);
  }
  await env.REFERENCE.put(OWNER_QUEUE, text);
  return json7({ ok: true, bytes: text.length });
}
async function getBehavior(req, env) {
  if (!adminOk(req, env)) return json7({ error: "unauthorized" }, 401);
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
  return json7({
    at: now(),
    withoutOwner: ownerIds.length > 0,
    opens: { ...total[0] ?? { n: 0, users: 0 }, lens, place, shelf, shelves, tier, days },
    users: { all: users?.all_users ?? 0, week: users?.week ?? 0 },
    loop: loopReport(await loopRows(db))
  });
}
var REFERENCE_NAMES = /* @__PURE__ */ new Set(["postsAuto", "essaysAuto", "essayLenses", "sourcesAuto", "filmBaseWiki", "comentions", "meta", "inlineIndex", "heroes", "seriesSeasons", "publicPages", "watchProviders", "freeWatch", "voicePlaylists", "freeRead", "trailers"]);
async function getReference(env, name) {
  if (!REFERENCE_NAMES.has(name)) return json7({ error: "unknown_reference", name }, 404);
  if (!env.REFERENCE) return json7({ error: "no_reference_bucket" }, 404);
  const object = await env.REFERENCE.get(`${name}.json`);
  if (!object) return json7({ error: "not_found", name }, 404);
  return new Response(object.body, { headers: { ...JSON_HEADERS, etag: object.httpEtag, "cache-control": "public, max-age=600" } });
}
async function putReference(req, env, name) {
  const token = /^Bearer\s+(.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!env.ADMIN_TOKEN || !token || !sameToken(token, env.ADMIN_TOKEN)) return json7({ error: "unauthorized" }, 401);
  if (!REFERENCE_NAMES.has(name)) return json7({ error: "unknown_reference", name }, 404);
  if (!env.REFERENCE) return json7({ error: "no_reference_bucket" }, 500);
  const text = await req.text();
  try {
    JSON.parse(text);
  } catch {
    return json7({ error: "bad_json" }, 400);
  }
  const watched = name === "essaysAuto" || name === "postsAuto";
  const before = watched ? await env.REFERENCE.get(`${name}.json`).then((o) => o ? new Response(o.body).text() : void 0).catch(() => void 0) : void 0;
  await env.REFERENCE.put(`${name}.json`, text);
  forgetReference(name);
  if (name === "trailers") forgetTrailers();
  const fresh = watched ? await noteFresh(env, before, text).catch((err) => {
    console.error("noteFresh", err);
    return -1;
  }) : void 0;
  return json7({ ok: true, name, bytes: text.length, ...fresh !== void 0 ? { fresh } : {} });
}
async function getCover(env, id) {
  const key = `cover-${id}-L.jpg`;
  const missing = () => new Response(null, { status: 404, headers: { "cache-control": "public, max-age=3600" } });
  if (!env.REFERENCE) return missing();
  const hit = await env.REFERENCE.get(key);
  const headers = { "content-type": "image/jpeg", "cache-control": "public, max-age=2592000, immutable" };
  if (hit) return new Response(hit.body, { headers });
  const r = await fetch(`https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`, { signal: AbortSignal.timeout(3e4) }).catch(() => void 0);
  const type = r?.headers.get("content-type") ?? "";
  if (!r?.ok || !/^image\//.test(type)) return missing();
  const buf = await r.arrayBuffer();
  if (buf.byteLength < 1024 || buf.byteLength > 3e6) return missing();
  await env.REFERENCE.put(key, buf);
  return new Response(buf, { headers: { ...headers, "content-type": type } });
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
    if (path === "/api/probe") return probe(url, head);
    useBot(env);
    await migrate(env.DB);
    if (path === "/api/health") return json7({ ok: true, at: now() }, 200, head);
    if (path === "/api/telegram" && req.method === "POST") return telegramUpdate(req, env);
    if (path === "/api/session" && req.method === "POST") {
      const res2 = await postSession(req, env);
      return new Response(res2.body, { status: res2.status, headers: { ...JSON_HEADERS, ...head } });
    }
    if (!path.startsWith("/api/")) return await publicPage(req, env, path) ?? json7({ error: "not_found" }, 404, head);
    const refPath = /^\/api\/reference\/([A-Za-z0-9-]+)$/.exec(path);
    if (refPath && req.method === "GET") return withHead(await getReference(env, refPath[1]), head);
    if (refPath && req.method === "PUT") return withHead(await putReference(req, env, refPath[1]), head);
    const coverPath = /^\/api\/cover\/(\d{1,10})$/.exec(path);
    if (coverPath && req.method === "GET") return withHead(await getCover(env, coverPath[1]), head);
    if (path === "/api/trailers" && req.method === "GET") return withHead(await getTrailers(env, url), head);
    if (path === "/api/sources" && req.method === "GET") return withHead(await getSources(env), head);
    const exportPath = /^\/api\/export\/(ex-[0-9a-f]{32})\/[^/]+$/.exec(path);
    if (exportPath && req.method === "GET") return withHead(await getExport(env.DB, exportPath[1]), head);
    const seedPath = /^\/api\/admin\/seed\/([A-Za-z0-9_]+)$/.exec(path);
    if (seedPath && req.method === "PUT") return withHead(await putUserSeed(req, env, seedPath[1]), head);
    if (path === "/api/admin/suggestions" && req.method === "GET") return withHead(await getSuggestions(req, env), head);
    if (path === "/api/admin/work-issues" && req.method === "GET") return withHead(await getWorkIssues(req, env), head);
    if (path === "/api/admin/owner-queue" && req.method === "PUT") return withHead(await putOwnerQueue(req, env), head);
    if (path === "/api/admin/behavior" && req.method === "GET") return withHead(await getBehavior(req, env), head);
    if (path === "/api/admin/funnel" && req.method === "GET") return withHead(await getFunnel(req, env, adminOk(req, env)), head);
    if (path === "/api/admin/growth" && req.method === "GET") return withHead(await getGrowth(req, env, adminOk(req, env)), head);
    if (path === "/api/admin/seeding" || path.startsWith("/api/admin/seeding/")) {
      return withHead(adminOk(req, env) ? await seedingRoute(req, path, env.DB) : json7({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/telegram-webhook" && req.method === "POST") {
      return withHead(adminOk(req, env) ? await adminWebhook(req, env) : json7({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/follow-digest" && req.method === "POST") {
      return withHead(adminOk(req, env) ? await adminDigest(req, env) : json7({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/member" && req.method === "GET") {
      return withHead(adminOk(req, env) ? await memberInfo(env, url.searchParams.get("nick") ?? "") : json7({ error: "unauthorized" }, 401), head);
    }
    if (path === "/api/admin/owner-decisions" && req.method === "GET") {
      return withHead(adminOk(req, env) ? await getOwnerDecisions(env.DB) : json7({ error: "unauthorized" }, 401), head);
    }
    if (path.startsWith("/api/admin/registry") || path.startsWith("/api/admin/inbox")) {
      if (!adminOk(req, env)) return json7({ error: "unauthorized" }, 401, head);
      if (path === "/api/admin/registry" && req.method === "GET") return withHead(await getRegistry(url, env), head);
      if (path === "/api/admin/registry" && req.method === "POST") return withHead(await postRegistry(req, env), head);
      if (path === "/api/admin/registry/version" && req.method === "GET") return withHead(await getRegistryVersion(env), head);
      if (path === "/api/admin/registry/log" && req.method === "GET") return withHead(await getRegistryLog(url, env), head);
      if (path === "/api/admin/inbox" && req.method === "GET") return withHead(await getInbox(url, env), head);
      if (path === "/api/admin/inbox" && req.method === "POST") return withHead(await postInbox(req, env), head);
      if (path === "/api/admin/inbox/result" && req.method === "POST") return withHead(await postInboxResult(req, env), head);
      return json7({ error: "not_found" }, 404, head);
    }
    const user = await whoIs(req, env.DB);
    if (!user) return json7({ error: "unauthorized" }, 401, head);
    await noteVisit(env.DB, user.id).catch((err) => console.error("visit", err));
    const reply = async () => {
      if (path === "/api/state" && req.method === "GET") return getState(user, env.DB, env);
      if (path === "/api/settings" && req.method === "PUT") return putSettings(req, user, env.DB);
      if (path === "/api/feedback" && req.method === "POST") return postFeedback(req, user, env.DB);
      if (path === "/api/import" && req.method === "POST") return postImport(req, user, env.DB);
      if (path === "/api/export" && req.method === "POST") return postExport(req, user, env.DB);
      const importPath = /^\/api\/import\/([^/]+)$/.exec(path);
      if (importPath && req.method === "DELETE") return deleteImport(user, env.DB, decodeURIComponent(importPath[1]));
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
      const dwellPath = /^\/api\/open\/([A-Za-z0-9_-]{1,64})\/dwell$/.exec(path);
      if (dwellPath && req.method === "POST") return postDwell(req, user, env.DB, dwellPath[1]);
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
        if (!await ownerOnly(user, env)) return json7({ error: "owner_only" }, 403);
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
      const afterword = /^\/api\/afterword\/(.+)$/.exec(path);
      if (afterword && req.method === "PUT") return putAfterword(req, user, env.DB, afterword[1]);
      const watched = /^\/api\/watched\/(.+)$/.exec(path);
      if (watched && req.method === "PUT") return putWatched(req, user, env.DB, decodeURIComponent(watched[1]));
      const progress = /^\/api\/journal\/([^/]+)\/progress$/.exec(path);
      if (progress && req.method === "POST") return postProgress(req, user, env.DB, decodeURIComponent(progress[1]));
      const checkin = /^\/api\/journal\/([^/]+)\/checkin$/.exec(path);
      if (checkin && req.method === "POST") return postCheckIn(req, user, env.DB, decodeURIComponent(checkin[1]));
      return json7({ error: "not_found" }, 404);
    };
    const res = await reply();
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(head)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  },
  /** По расписанию (Cloudflare cron; на bothost — таймер server/index.js): сводка подписок раз в день. */
  async scheduled(_event, env) {
    useBot(env);
    await migrate(env.DB);
    await env.DB.prepare("DELETE FROM tg_update WHERE at < ?").bind(new Date(Date.now() - 2 * 864e5).toISOString()).run().catch((err) => console.error("tg_update:", err));
    const r = await followDigest(env);
    if (r.users || r.stopped || r.pausedUntil) console.log(`\u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438: ${JSON.stringify(r)}`);
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  REFERENCE_NAMES,
  forgetMigrations
});
