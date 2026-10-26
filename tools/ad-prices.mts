// Цены рекламы в каналах реестра с биржи telega.in (25.10, вкладка «Путь» пульта — tools/road-desk.mts).
//
// Только открытая карточка канала `https://telega.in/channels/<ник>/card` (видна без входа, robots.txt её не закрывает;
// правила биржи об автоматическом сборе молчат — разбор .cache/outreach/ad-prices-sources-2510.md). Не ходим: `/c/<ник>`,
// `/api/`, `?sort=`/`?filter=`; закрытое в интерфейсе (CPV в data-*, просмотры под замком, цены из data-* каталога) не
// берём. Каналы — из .cache/ad-prices/telega-in-channels.json (снимок каталога 23.10), и только те, что есть в реестре,
// плюс соседние темы (`wide`, tools/ad-catalog.mts, 25.10).
// Один поток, пауза 6–9 с, без cookies; канал с карточкой свежее 6 дней пропускаем, «нет на бирже» (404) — 30 дней.
// Три ошибки подряд — стоп (биржа против — не настаиваем).
//
//   npx tsx tools/ad-prices.mts [--max 20] [--only krylovme] [--force]
// Итог — .cache/ad-prices/telega-in.json: по каналу статус и снимки (подписчики, цены форматов, охват 24 ч, ERR, ER,
// публикаций в день, заказы). CPM и прогноз цены подписчика считает пульт.
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';

const DIR = '.cache/ad-prices';
const LIST = `${DIR}/telega-in-channels.json`;
const OUT = `${DIR}/telega-in.json`;
const UA = 'Mozilla/5.0 (compatible; FilibriPrices/1.0; weekly check of ~80 channels for ad planning; +https://t.me/recomend_media_bot)';
const FRESH_DAYS = 6, ABSENT_DAYS = 30;

export interface TelegaSnapshot {
  at: string;
  subs: number | null;
  /** цены форматов в ₽: «1/24», «2/48», «3/72», «30 дней», «Нативный» */
  prices: Record<string, number>;
  reach24: number | null;
  err24: number | null;
  er: number | null;
  postsPerDay: number | null;
  /** изменение подписчиков за 30 дней */
  subsMonth: number | null;
  orders: number | null;
  ordersRepeat: number | null;
}
export interface TelegaChannel { status: 'ok' | 'absent' | 'error'; checkedAt: string; error?: string; snapshots: TelegaSnapshot[] }
export type TelegaStore = { updatedAt: string | null; channels: Record<string, TelegaChannel> };

const strip = (s: string) => s.replace(/<[^>]+>/g, '|').replace(/\s+/g, ' ').replace(/\|(\s*\|)+/g, '|').replace(/^[|\s]+|[|\s]+$/g, '');
/** «18 181.80», «7094.0», «33.4K», «-1304», «21.3%» → число; «lock_outline», «--» → null */
const num = (s: string | undefined): number | null => {
  if (!s) return null;
  const m = /^([+-−]?[\d\s ]*[\d](?:[.,]\d+)?)\s*([KkКкMm])?%?$/.exec(s.trim());
  if (!m) return null;
  const v = Number(m[1].replace(/[\s ]/g, '').replace(',', '.').replace('−', '-'));
  return Number.isFinite(v) ? v * (/[KkКк]/.test(m[2] ?? '') ? 1e3 : /[Mm]/.test(m[2] ?? '') ? 1e6 : 1) : null;
};

/** Разбор открытой карточки канала. Чистая функция — проверка в tools/road-test.mts. */
export function parseTelegaCard(html: string, at = new Date().toISOString()): TelegaSnapshot {
  const desc = /<meta name="description" content="([^"]*)"/.exec(html)?.[1] ?? '';
  const prices: Record<string, number> = {};
  for (const m of html.matchAll(/format-control__name">([^<]+)<\/div>([\s\S]{0,400}?)<\/div><\/div>/g)) {
    const v = num(strip(m[2]).replace(/\|?₽.*/, '').replace('|', ''));
    if (v != null) prices[m[1].trim()] = v;
  }
  // пары «подпись | значение» в блоках карточки (порядок у блоков разный — ищем подпись с любой стороны)
  const pairs: [string, string][] = [];
  for (const m of html.matchAll(/(?:partners__item|statistic__item|analitic-telega|analitic-history)[-_a-z]*">([\s\S]{0,300}?)<\/div>\s*<\/div>/g)) {
    const parts = strip(m[1]).split('|').map((x) => x.trim()).filter(Boolean);
    if (parts.length >= 2) pairs.push([parts.slice(0, -1).join(' '), parts.at(-1)!], [parts.slice(1).join(' '), parts[0]]);
  }
  const find = (re: RegExp) => { for (const [label, value] of pairs) if (re.test(label)) { const v = num(value); if (v != null) return v; } return null; };
  return {
    at,
    subs: Number(/Подписчиков:\s*(\d+)/.exec(desc)?.[1] ?? NaN) || find(/^(?:group )?Подписчики:?$/),
    prices,
    reach24: find(/^Средний охват \(24ч\)$/),
    err24: find(/^ERR за 24 часа$/),
    er: find(/^(?:thumb_up )?ER$/),
    postsPerDay: find(/Публикаций в день/),
    subsMonth: find(/^за месяц$/),
    orders: find(/^Выполненных заказов/),
    ordersRepeat: find(/^Повторных заказов/),
  };
}

const readJson = <T,>(p: string, dflt: T): T => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : dflt; } catch { return dflt; } };
export const readStore = (): TelegaStore => readJson<TelegaStore>(OUT, { updatedAt: null, channels: {} });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const max = Number(arg('--max') ?? 200), only = arg('--only')?.toLowerCase(), force = process.argv.includes('--force');
  // wide (25.10) — каналы соседних тем из tools/ad-catalog.mts: в реестре кино и книг их нет и не будет
  const list = readJson<{ channels: { u: string; wide?: boolean }[] }>(LIST, { channels: [] }).channels;
  const registry = new Set(readJson<{ channels: { username: string }[] }>('tools/telegram-channels.json', { channels: [] }).channels.map((c) => c.username.toLowerCase()));
  const store = readStore();
  const now = Date.now();
  const due = list.filter((c) => c.wide || registry.has(c.u.toLowerCase())).map((c) => c.u).filter((u) => !only || u.toLowerCase() === only).filter((u) => {
    if (force || only) return true;
    const c = store.channels[u];
    if (!c) return true;
    return now - Date.parse(c.checkedAt) > (c.status === 'absent' ? ABSENT_DAYS : FRESH_DAYS) * 864e5;
  }).slice(0, max);
  console.log(`telega.in: каналов в списке ${list.length}, к проверке ${due.length}`);
  mkdirSync(DIR, { recursive: true });
  const save = () => { store.updatedAt = new Date().toISOString(); writeFileSync(`${OUT}.tmp`, JSON.stringify(store, null, 1)); renameSync(`${OUT}.tmp`, OUT); };
  let fails = 0, ok = 0, absent = 0;
  for (const [i, u] of due.entries()) {
    if (i) await sleep(6000 + Math.random() * 3000);
    const prev = store.channels[u]?.snapshots ?? [];
    const at = new Date().toISOString();
    try {
      const r = await fetch(`https://telega.in/channels/${encodeURIComponent(u)}/card`, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(30_000) });
      if (r.status === 404) { store.channels[u] = { status: 'absent', checkedAt: at, snapshots: prev }; absent++; fails = 0; save(); continue; }
      if (!r.ok) throw new Error(`ответ ${r.status}`);
      const snap = parseTelegaCard(await r.text(), at);
      if (!Object.keys(snap.prices).length && snap.subs == null) throw new Error('на карточке нет ни цены, ни подписчиков — разметка сменилась?');
      // снимков — не больше 26 (полгода по неделе)
      store.channels[u] = { status: 'ok', checkedAt: at, snapshots: [...prev, snap].slice(-26) };
      ok++; fails = 0; save();
      console.log(`  @${u}: ${snap.subs ?? '—'} подп., 1/24 ${snap.prices['1/24'] ?? '—'} ₽, охват ${snap.reach24 ?? '—'}`);
    } catch (e) {
      store.channels[u] = { status: 'error', checkedAt: at, error: (e as Error).message, snapshots: prev }; save();
      console.log(`  @${u}: ошибка — ${(e as Error).message}`);
      if (++fails >= 3) { console.log('три ошибки подряд — стоп'); break; }
    }
  }
  console.log(`telega.in: карточек ${ok}, нет на бирже ${absent}, ошибок ${Object.values(store.channels).filter((c) => c.status === 'error').length}`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
