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
// P3789 — имя в Telegram, а не обязательно канал (бывает личный аккаунт): `known` — канал есть в наших выемках или
// реестре источников (это точно канал), остальные показываются той же ссылкой t.me.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readCache, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { people, workCredits } from './credits-all.mts';
import { sources } from '../src/mocks/sources.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';

// политики и медиаперсоны, чей канал — политика и новости, а не их работы (24.10, слово владельца «исключить»):
// блок «канал автора» их не показывает, посты не собираются. Писатели, режиссёры, комики и блогеры остаются,
// даже если высказываются публично. Новых — дописывать сюда.
const EXCLUDE: Record<string, string> = {
  Q155979: 'Навальный', Q15850: 'Турчинов', Q3874799: 'Зеленский', Q2121094: 'Мединский', Q319121: 'Алекс Джонс',
  Q4419809: 'Симоньян', Q1530559: 'Прилепин', Q295537: 'Лимонов', Q287099: 'Собчак', Q4213414: 'Кара-Мурза',
  Q4312139: 'Назаров', Q4417025: 'Сергейцев', Q96486596: 'Зарубин', Q114670075: 'Курников', Q1978790: 'Невзоров',
  Q2624119: 'Ястржембский', Q1142513: 'Кеосаян', Q4371811: 'Понасенков', Q4379252: 'Притула', Q4451931: 'Тарбаев',
  Q2470718: 'Вячорка', Q1964825: 'Бурляев', Q4136019: 'Герасимов', Q140738: 'Охлобыстин', Q4362393: 'Пивоваров',
  Q1960651: 'Парфёнов', Q89544720: 'Солодников', Q4293956: 'Минаев',
};

// имя в Telegram без публичного канала (24.10: у t.me/s нет превью — личный аккаунт или закрыто): ссылку не показываем
const NO_CHANNEL = new Set(['protancychat', 'michael_zhvanetsky', 'mamonovofficial', 'dyuzhev_d']);

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
  return cand ? { t: cand.title, known: true } : { known: false };
};

export interface PersonChannel { h: string; t?: string; known?: 1 }
const out: Record<string, PersonChannel> = {};
for (const q of [...wanted].sort()) {
  if (q in EXCLUDE) continue;
  const handles = (cache[q]?.length ? cache[q] : extra[q] ? [extra[q]] : []).filter((h) => !NO_CHANNEL.has(h.toLowerCase()));
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
// h — имя в Telegram (P3789 Wikidata или разметка каналов creator), t — название канала, known — канал есть в наших
// выемках или реестре источников. Грузится лениво, со страницей автора (24.10).
export interface PersonChannel { h: string; t?: string; known?: 1 }

export const personChannels: Record<string, PersonChannel> = ${JSON.stringify(out)};
`);
}
