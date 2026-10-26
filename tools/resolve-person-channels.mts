// Канал автора на его странице (24.10, слово владельца): режиссёр, сценарист, создатель сериала, писатель со своей
// страницей (/person/:id) и его Telegram — блок «канал автора» и посты канала о его же работах. Пишет
// src/mocks/personChannels.ts (приложение грузит его лениво, со страницей автора).
//   npx tsx tools/resolve-person-channels.mts [--fresh] [--dry]
//
// Кто: все люди из workCredits (tools/credits-all.mts) — у каждого есть страница с работами.
// Что: P3789 (Telegram username) из Wikidata — SPARQL пачками по VALUES, с паузой, User-Agent проекта (wikidata-lib).
// Кэш — .cache/person-channels.json (по элементу, «нет» тоже — пустым списком): повторный прогон спрашивает только новых.
// Сверх Wikidata — разметка каналов соседним агентом (.cache/outreach/channel-categories-2410.json, категория creator):
// канал, у которого там указан элемент Wikidata человека (поле q/wikidata/person), добавляется, если у человека в
// Wikidata канала нет. Остальные creator-каналы без элемента — в .cache/person-channels-unmatched.json, свести руками.
// И списки владельца — tools/curated-channels.json (25.10, подборка каналов режиссёров «Новостей кинопроизводства»).
// P3789 — имя в Telegram, а не обязательно канал (бывает личный аккаунт): `known` — канал есть в наших выемках или
// реестре источников (это точно канал), остальные показываются той же ссылкой t.me.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readCache, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { people, workCredits } from './credits-all.mts';
import { sources } from '../src/mocks/sources.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';
import { EXCLUDE, NO_CHANNEL } from './person-exclude.mts';

const FRESH = process.argv.includes('--fresh');
const DRY = process.argv.includes('--dry');
const BATCH = 300;
const HANDLE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

const wanted = new Set<string>();
for (const line of Object.values(workCredits)) for (const part of line.split(',')) {
  const q = part.split(':')[0];
  if (/^Q\d+$/.test(q)) wanted.add(q);
}
const cache = FRESH ? {} : readCache<Record<string, string[]>>('person-channels.json', {});
const todo = [...wanted].filter((q) => !(q in cache));
console.error(`людей со страницей: ${wanted.size}, спросить Wikidata: ${todo.length}`);

type Row = Record<string, { value: string } | undefined>;
for (let i = 0; i < todo.length && !DRY; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const r = await sparql<{ results: { bindings: Row[] } }>(`SELECT ?p ?u WHERE {
    VALUES ?p { ${chunk.map((q) => `wd:${q}`).join(' ')} }
    ?p wdt:P3789 ?u
  }`);
  for (const q of chunk) cache[q] = [];
  for (const row of r.results.bindings) {
    const q = row.p!.value.split('/').pop()!;
    const u = row.u!.value.trim().replace(/^@/, '');
    if (HANDLE.test(u) && !cache[q].includes(u)) cache[q].push(u);
  }
  writeCache('person-channels.json', cache);
  console.error(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}`);
  await sleep(1500);
}

// разметка соседнего агента: формат ещё не устоялся — берём массив записей или словарь handle → запись
type Cat = { handle?: string; username?: string; category?: string; categories?: string[]; q?: string; wikidata?: string; person?: string };
const CATS = '.cache/outreach/channel-categories-2410.json';
const extra: Record<string, string> = {};
const unmatched: string[] = [];
if (existsSync(CATS)) {
  const raw = JSON.parse(readFileSync(CATS, 'utf8')) as Cat[] | Record<string, Cat | string>;
  const rows: Cat[] = Array.isArray(raw) ? raw
    : Object.entries(raw).map(([h, v]) => (typeof v === 'string' ? { handle: h, category: v } : { handle: h, ...v }));
  for (const c of rows) {
    const h = (c.handle ?? c.username ?? '').replace(/^@/, '');
    const creator = c.category === 'creator' || c.categories?.includes('creator');
    if (!creator || !HANDLE.test(h)) continue;
    const q = [c.q, c.wikidata, c.person].find((x) => x && /^Q\d+$/.test(x));
    if (q && wanted.has(q)) extra[q] = h; else unmatched.push(h);
  }
  console.error(`разметка каналов: creator с элементом человека ${Object.keys(extra).length}, без элемента ${unmatched.length}`);
} else console.error(`разметки каналов (${CATS}) ещё нет — только Wikidata`);

// списки владельца (25.10, tools/curated-channels.json): канал человека с элементом — к его странице, если в
// Wikidata канала нет; `main` — главнее канала из Wikidata (тот заброшен, `stale` — убрать); `gone` — имени больше нет
interface Curated { h: string; n: string; q?: string; t?: string; role: string; main?: 1; stale?: 1; gone?: 1 }
const curated = (JSON.parse(readFileSync('tools/curated-channels.json', 'utf8')) as { people: Curated[] }).people;
const stale = new Set(curated.filter((c) => c.stale || c.gone).map((c) => c.h.toLowerCase()));
const curatedTitle = new Map(curated.filter((c) => c.t).map((c) => [c.h.toLowerCase(), c.t!]));
const listed: Record<string, { main: string[]; rest: string[] }> = {};
for (const c of curated) {
  if (!c.q || c.stale || c.gone || !HANDLE.test(c.h)) continue;
  const x = listed[c.q] ??= { main: [], rest: [] };
  (c.main ? x.main : x.rest).push(c.h);
}
console.error(`списки владельца: с элементом ${Object.keys(listed).length}, из них со страницей ${Object.keys(listed).filter((q) => wanted.has(q)).length}`);

// канал точно канал: есть выемка, он в реестре источников или среди кандидатов; имя — оттуда же
const titleOf = (h: string): { t?: string; known: boolean } => {
  const low = h.toLowerCase();
  const src = sources.find((s) => s.platform === 'telegram' && s.handle.toLowerCase() === low);
  if (src) return { t: src.title, known: true };
  const path = `.cache/telegram/${h}.json`;
  if (existsSync(path)) {
    try { return { t: (JSON.parse(readFileSync(path, 'utf8')) as { name?: string }).name, known: true }; } catch { /* битая выемка */ }
  }
  const cand = sourceCandidates.find((c) => c.handle?.toLowerCase() === low);
  return cand ? { t: cand.title, known: true } : { t: curatedTitle.get(low), known: false };
};

export interface PersonChannel { h: string; t?: string; known?: 1 }
const out: Record<string, PersonChannel> = {};
for (const q of [...wanted].sort()) {
  if (q in EXCLUDE) continue;
  const wd = cache[q]?.length ? cache[q] : extra[q] ? [extra[q]] : [];
  const handles = [...new Set([...(listed[q]?.main ?? []), ...wd, ...(listed[q]?.rest ?? [])])]
    .filter((h) => !NO_CHANNEL.has(h.toLowerCase()) && !stale.has(h.toLowerCase()));
  if (!handles.length) continue;
  // несколько имён — первым то, что мы знаем как канал
  const h = handles.find((x) => titleOf(x).known) ?? handles[0];
  const { t, known } = titleOf(h);
  // имя выемки бывает просто ником — тогда без названия, экран покажет @ник
  out[q] = { h, ...(t && t.toLowerCase() !== h.toLowerCase() ? { t } : {}), ...(known ? { known: 1 as const } : {}) };
}
const n = Object.keys(out).length;
console.error(`с Telegram: ${n} из ${wanted.size}, из них известные нам каналы: ${Object.values(out).filter((c) => c.known).length}`);
for (const [q, c] of Object.entries(out).slice(0, 15)) console.error(`  ${q} ${people[q]?.name ?? '?'} → @${c.h}${c.t ? ` (${c.t})` : ''}`);
if (!DRY) {
  writeFileSync('.cache/person-channels-unmatched.json', JSON.stringify(unmatched, null, 1));
  writeFileSync(new URL('../src/mocks/personChannels.ts', import.meta.url),
    `// Сгенерировано tools/resolve-person-channels.mts — руками не править. Автор (элемент Wikidata) → его Telegram:
// h — имя в Telegram (P3789 Wikidata, разметка каналов creator или списки владельца), t — название канала, known — канал есть в наших
// выемках или реестре источников. Грузится лениво, со страницей автора (24.10).
export interface PersonChannel { h: string; t?: string; known?: 1 }

export const personChannels: Record<string, PersonChannel> = ${JSON.stringify(out)};
`);
}
