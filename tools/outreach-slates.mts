// Подборки адресатам (ЗП-46, 22.10): для каждого собранного профиля зрителя, у которого известен канал, — лента
// приложения по его истории (две порции, как «Ещё фильмы») и его любимое из истории (к чему отсылать в письме).
// Адресаты — tools/addressees.mts (очередь Кинопоиска, присланное владельцем, находки шлюза).
// Лента — тем же кодом, что в приложении (vite в Node, как tools/seed-slate.mts), на каждого заново.
// Ссылка на карточку — в бот с меткой источника `--szp46`: в воронке видно, кто пришёл из личных подборок.
// Пишет только владелец со своего аккаунта; здесь — материал для текста, не рассылка.
//   npx tsx tools/outreach-slates.mts [--only kp_,letterboxd-]
// Выход — .cache/outreach/slates.json и slates.md (вне git: чужие истории).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { addressees } from './addressees.mts';
import { paramOf } from '../worker/inlineIndex.ts';

const argv = process.argv.slice(2);
const ONLY = (() => { const i = argv.indexOf('--only'); return i >= 0 ? argv[i + 1].split(',') : undefined; })();
const BOT = 'recomend_media_bot';
const SOURCE = '--szp46';

// кто кому — общий список адресатов (tools/addressees.mts)
const list = addressees();
// канал: подписчики, название, описание — открытая страница t.me/<канал> (кэш .cache/outreach/tme/, как у
// tools/outreach-profiles.mts); у личного аккаунта подписчиков нет — так и отличаем
const un = (x: string) => x.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#33;/g, '!').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
async function tme(channel: string): Promise<{ subs?: number; title?: string; about?: string; kind: 'канал' | 'группа' | 'личный' }> {
  const f = `.cache/outreach/tme/${channel}.html`;
  let html = existsSync(f) ? readFileSync(f, 'utf8') : '';
  if (!html) {
    html = await fetch(`https://t.me/${channel}`, { headers: { 'user-agent': 'Mozilla/5.0' } }).then((r) => r.text()).catch(() => '');
    if (html) { mkdirSync('.cache/outreach/tme', { recursive: true }); writeFileSync(f, html); }
    await new Promise((r) => setTimeout(r, 800));
  }
  const extra = un(/<div class="tgme_page_extra">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '').replace(/\s+/g, ' ');
  const m = /([\d\s.,]+)\s*([KM])?\s*(?:subscribers|подписчик)/i.exec(extra);
  const subs = m ? Math.round(Number(m[1].replace(/\s/g, '').replace(',', '.')) * (m[2] === 'K' ? 1e3 : m[2] === 'M' ? 1e6 : 1)) : undefined;
  const meta = (prop: string) => un(new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html)?.[1] ?? '');
  return { subs, title: meta('og:title'), about: meta('og:description').slice(0, 200), kind: subs != null ? 'канал' : /members|участник/.test(extra) ? 'группа' : 'личный' };
}

const todo = list.filter((a) => existsSync(`seeds/${a.seed}.json`) && (!ONLY || ONLY.some((p) => a.seed.startsWith(p))));
console.error(`адресатов с историей: ${todo.length} из ${list.length}`);

// ─── приложение в Node ─────────────────────────────────────────────────────────
const mem = new Map<string, string>();
const g = globalThis as Record<string, unknown>;
g.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, String(v)), removeItem: (k: string) => mem.delete(k), clear: () => mem.clear(), key: () => null, length: 0 };
g.sessionStorage = g.localStorage;
g.location = new URL('http://localhost/?fresh');
g.window = globalThis; g.addEventListener = () => {}; g.removeEventListener = () => {};
const realTimeout = globalThis.setTimeout;
g.setTimeout = ((fn: () => void, ms?: number, ...rest: unknown[]) => realTimeout(fn, (ms ?? 0) <= 300 ? 0 : ms, ...rest)) as typeof setTimeout;
g.document = { documentElement: { lang: 'ru', dataset: {}, style: { setProperty() {} } }, addEventListener() {}, querySelector: () => null, createElement: () => ({ style: {} }) };
const vite = await createServer({ root: process.cwd(), server: { middlewareMode: true, hmr: false, watch: null }, appType: 'custom', logLevel: 'error', optimizeDeps: { noDiscovery: true, include: [] },
  plugins: [{ name: 'outreach-slates', enforce: 'post', transform(code, id) { if (id.endsWith('/src/api/index.ts')) return `${code}\nexport const __hydrate = hydrate;`; } }] });

interface Work { id: string; title: string; originalTitle?: string; year: number; type: string; blurb?: string; externalIds?: { tmdb?: number; imdb?: string }; countries?: string[] }
interface SeedFile { watched: { workId: string; work?: Work }[]; ratings?: { workId: string; rating: number; raw?: number; work?: Work }[] }
const keyOf = (w: Work) => (w.externalIds?.tmdb ? `${w.type === 'film' ? 'tmdb' : 'tmdbtv'}:${w.externalIds.tmdb}` : w.externalIds?.imdb ? `imdb:${w.externalIds.imdb}` : undefined);
const linkOf = (w: Work) => { const k = keyOf(w); const p = k && paramOf(k); return p ? `https://t.me/${BOT}?startapp=${p}${SOURCE}` : undefined; };

const out: unknown[] = [];
for (const a of todo) {
  const seed = JSON.parse(readFileSync(`seeds/${a.seed}.json`, 'utf8')) as SeedFile;
  const ratings = seed.ratings ?? [];
  mem.clear(); mem.set('tm.fresh', '1');
  vite.moduleGraph.invalidateAll();
  try {
    const api = await vite.ssrLoadModule('/src/api/index.ts');
    await api.getRatingDeck();
    const at = new Date().toISOString();
    api.__hydrate({ settings: {}, predictions: [], verdicts: [],
      watched: seed.watched.map((w) => ({ workId: w.workId, watched: true, ...(w.work ? { work: w.work } : {}) })),
      ratings: ratings.map((r) => ({ workId: r.workId, rating: r.rating, ...(r.raw != null ? { raw: r.raw } : {}), ...(r.work ? { work: r.work } : {}), at })) });
    type Item = { work: Work; slot: string; explanation?: { what?: string }; analyses?: unknown[] };
    const first = await api.getSlate('normal') as { items: Item[]; coldStart?: unknown };
    if (first.coldStart) { console.error(`${a.seed}: мало оценок в справочнике`); continue; }
    const second = await api.getSlate('normal', first.items.map((r) => r.work.id)) as { items: Item[] };
    const picks = [...first.items, ...second.items].filter((r, i, all) => all.findIndex((x) => x.work.id === r.work.id) === i).map((r) => ({
      title: r.work.title, original: r.work.originalTitle, year: r.work.year, type: r.work.type, key: keyOf(r.work),
      essays: r.analyses?.length ?? 0, what: r.explanation?.what, blurb: r.work.blurb?.slice(0, 300), link: linkOf(r.work),
    }));
    // любимое: самые высокие оценки (свои «десятки» и «девятки»), что есть в справочнике с названием
    const top = [...ratings].filter((r) => r.raw != null && r.work?.title).sort((x, y) => y.raw! - x.raw!).slice(0, 12)
      .map((r) => ({ title: r.work!.title, year: r.work!.year, raw: r.raw }));
    const raws = ratings.map((r) => r.raw).filter((x): x is number => x != null).sort((x, y) => x - y);
    const ch = a.channel ? await tme(a.channel) : undefined;
    out.push({ ...a, ...(ch ?? {}), watched: seed.watched.length, rated: raws.length, median: raws[Math.floor(raws.length / 2)], top, picks });
    console.error(`${a.seed} (@${a.channel ?? '—'}): ${picks.length} в ленте`);
  } catch (err) { console.error(`${a.seed}: ${(err as Error).message}`); }
}
await vite.close();

type Row = { seed: string; channel: string | null; profile: string; subs?: number; rated: number; median?: number; top: { title: string; year: number; raw?: number }[];
  picks: { title: string; year: number; essays: number; link?: string }[] };
const rows = (out as Row[]).sort((x, y) => (y.subs ?? -1) - (x.subs ?? -1) || y.rated - x.rated);
writeFileSync('.cache/outreach/slates.json', JSON.stringify({ at: new Date().toISOString(), rows }, null, 1));
writeFileSync('.cache/outreach/slates.md', [
  `# Подборки адресатам — ${new Date().toISOString().slice(0, 10)}`, '',
  ...rows.flatMap((r) => [
    `## ${r.channel ? `@${r.channel}` : r.seed}${r.subs ? ` · ${r.subs} подписчиков` : ''}`,
    `${r.profile} · оценок ${r.rated}, медиана ${r.median ?? '—'}`, '',
    `Любит: ${r.top.slice(0, 8).map((t) => `${t.title} (${t.year}) — ${t.raw}`).join('; ')}`, '',
    ...r.picks.map((p, i) => `${i + 1}. ${p.title} (${p.year})${p.essays ? ` · разборов ${p.essays}` : ''}${p.link ? ` · ${p.link}` : ''}`), '',
  ]),
].join('\n'));
console.log(`подборок: ${rows.length} → .cache/outreach/slates.md`);
