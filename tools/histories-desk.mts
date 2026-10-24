// Вкладка «Истории» общего пульта (tools/desk.mts, http://127.0.0.1:8721/histories/) — 22.10, просьба владельца: всё про
// профили зрителей в одном месте, а не по папкам «Загрузок», seeds/ и очереди. Строка — адресат (tools/addressees.mts):
// канал и профиль, что с профилем у помощника-закладки (в очереди, качается, собран, оценки скрыты, отложен), история в
// seeds/ (сколько оценок, медиана, когда собрана), подборка (tools/outreach-slates.mts → .cache/outreach/slates.json) и
// готов ли текст письма (.cache/outreach/texts-*.md, заголовок «## @канал»). Только чтение: ничего не меняет.
//
// Хост и заголовок x-desk проверяет общий пульт.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { addressees, helperState, seedStats } from './addressees.mts';

const PAGE = new URL('./histories-desk.html', import.meta.url);
const SLATES = '.cache/outreach/slates.json';
const OUT = '.cache/outreach';

const send = (res: ServerResponse, code: number, body: unknown, type = 'application/json; charset=utf-8') => {
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};

interface Slate { seed: string; subs?: number; title?: string; about?: string; kind?: string; top: { title: string; year: number; raw?: number }[];
  picks: { title: string; year: number; type?: string; essays: number; link?: string }[] }
// подборки — файл в сотни килобайт: перечитываем, только когда он поменялся
let slatesMemo: { stamp: number; at?: string; bySeed: Map<string, Slate> } | undefined;
function slates() {
  const stamp = existsSync(SLATES) ? statSync(SLATES).mtimeMs : 0;
  if (slatesMemo?.stamp === stamp) return slatesMemo;
  const j = stamp ? JSON.parse(readFileSync(SLATES, 'utf8')) as { at?: string; rows: Slate[] } : { rows: [] };
  slatesMemo = { stamp, at: j.at, bySeed: new Map(j.rows.map((r) => [r.seed, r])) };
  return slatesMemo;
}

/** тексты писем: «## @канал …» в .cache/outreach/texts-*.md → канал → файл и сам текст */
function texts(): Map<string, { file: string; body: string }> {
  const out = new Map<string, { file: string; body: string }>();
  if (!existsSync(OUT)) return out;
  for (const f of readdirSync(OUT).filter((f) => /^texts-.*\.md$/.test(f)).sort()) {
    for (const part of readFileSync(`${OUT}/${f}`, 'utf8').split(/^## /m).slice(1)) {
      const ch = /^@([\w]+)/.exec(part)?.[1];
      if (ch) out.set(ch.toLowerCase(), { file: f, body: part.slice(part.indexOf('\n') + 1).trim() });
    }
  }
  return out;
}

function data() {
  const sl = slates();
  const tx = texts();
  const rows = addressees().map((a) => {
    const seed = seedStats(a.seed);
    const helper = a.kp ? helperState(a.kp) : undefined;
    // Letterboxd собирается ночью сам (profile-seed --auto); нет истории — значит, ещё не дошла очередь или дневник пуст
    const state = helper?.state ?? (seed ? 'собран' : 'ночью');
    const s = sl.bySeed.get(a.seed);
    return {
      seed: a.seed, site: a.site, channel: a.channel, profile: a.profile, from: a.from, queue: a.queue,
      state, note: helper?.note, files: helper?.files,
      watched: seed?.watched, rated: seed?.rated, median: seed?.median, seedAt: seed?.at,
      subs: s?.subs, kind: s?.kind, title: s?.title, picks: s?.picks.length ?? 0,
      text: a.channel ? Boolean(tx.get(a.channel.toLowerCase())) : false,
    };
  });
  return { slatesAt: sl.at, rows };
}

export async function historiesRoute(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (req.method !== 'GET') return send(res, 404, { error: 'not_found' });
  if (path === '/' || path === '/index.html') return send(res, 200, readFileSync(PAGE, 'utf8'), 'text/html; charset=utf-8');
  if (path === '/api/data') return send(res, 200, data());
  const m = /^\/api\/slate\/([\w.-]+)$/.exec(path);
  if (m) {
    const s = slates().bySeed.get(m[1]);
    const a = addressees().find((x) => x.seed === m[1]);
    const t = a?.channel ? texts().get(a.channel.toLowerCase()) : undefined;
    return send(res, 200, { slate: s ?? null, text: t ?? null, about: s?.about });
  }
  return send(res, 404, { error: 'not_found' });
}
