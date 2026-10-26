// Актёры с каналом в Telegram (25.10, слово владельца: «значительная часть российского кинобизнеса ведёт каналы в
// Telegram — использовать их присутствие, не акцентируясь в функционале»). Не все роли подряд: только актёры
// произведений справочника, у которых в Wikidata есть P3789 (имя в Telegram), — их мало, и каждый к месту. Тип ролей
// приложения (`CreditRole`) не трогаем: актёр не входит в почерк и в людей карточки; страница человека
// (/person/:id) показывает его по этому справочнику. Пишет src/mocks/actorChannels.ts (грузится лениво).
//   npx tsx tools/resolve-actor-channels.mts [--fresh] [--dry]
//
// Что спрашиваем: VALUES ?w (элементы произведений из .cache/credits.json, пачками по 150) — ?w wdt:P161 ?a.
// ?a wdt:P3789 ?u, имя по-русски и по-английски. Пауза 1,5 с, User-Agent проекта (wikidata-lib). Кэш —
// .cache/actor-channels.json: какие произведения спрошены и что нашли; повторный прогон спрашивает только новые.
// Исключения — tools/person-exclude.mts (политики и медиаперсоны, личные аккаунты), как у авторов. Сверх Wikidata —
// актёры из списков владельца (tools/curated-channels.json, role: actor).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { readCache, sleep, sparql, writeCache } from './wikidata-lib.mts';
import { sources } from '../src/mocks/sources.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';
import { EXCLUDE, NO_CHANNEL } from './person-exclude.mts';

const FRESH = process.argv.includes('--fresh');
const DRY = process.argv.includes('--dry');
const BATCH = 150;
const HANDLE = /^[A-Za-z][A-Za-z0-9_]{3,31}$/;

// произведение справочника → его элемент Wikidata (tools/resolve-credits.mts)
const credits = JSON.parse(readFileSync('.cache/credits.json', 'utf8')) as Record<string, { q?: string }>;
const keysOfQ = new Map<string, string[]>();
for (const [key, v] of Object.entries(credits)) if (v.q && /^Q\d+$/.test(v.q)) keysOfQ.set(v.q, [...(keysOfQ.get(v.q) ?? []), key]);

interface Found { n?: string; en?: string; tg: string[]; works: string[] }
type Cache = { done: string[]; actors: Record<string, Found> };
const cache: Cache = FRESH ? { done: [], actors: {} } : readCache<Cache>('actor-channels.json', { done: [], actors: {} });
const done = new Set(cache.done);
const todo = [...keysOfQ.keys()].filter((q) => !done.has(q));
console.error(`произведений с элементом: ${keysOfQ.size}, спросить Wikidata: ${todo.length}`);

type Row = Record<string, { value: string } | undefined>;
for (let i = 0; i < todo.length && !DRY; i += BATCH) {
  const chunk = todo.slice(i, i + BATCH);
  const r = await sparql<{ results: { bindings: Row[] } }>(`SELECT ?w ?a ?u ?ru ?en WHERE {
    VALUES ?w { ${chunk.map((q) => `wd:${q}`).join(' ')} }
    ?w wdt:P161 ?a . ?a wdt:P3789 ?u .
    OPTIONAL { ?a rdfs:label ?ru FILTER(LANG(?ru) = "ru") }
    OPTIONAL { ?a rdfs:label ?en FILTER(LANG(?en) = "en") }
  }`);
  for (const row of r.results.bindings) {
    const w = row.w!.value.split('/').pop()!, a = row.a!.value.split('/').pop()!;
    const u = row.u!.value.trim().replace(/^@/, '');
    const x = cache.actors[a] ?? (cache.actors[a] = { tg: [], works: [] });
    if (row.ru?.value) x.n = row.ru.value;
    if (row.en?.value) x.en = row.en.value;
    if (HANDLE.test(u) && !x.tg.includes(u)) x.tg.push(u);
    if (!x.works.includes(w)) x.works.push(w);
  }
  chunk.forEach((q) => done.add(q));
  cache.done = [...done];
  writeCache('actor-channels.json', cache);
  console.error(`  ${Math.min(i + BATCH, todo.length)}/${todo.length}: актёров с Telegram ${Object.keys(cache.actors).length}`);
  await sleep(1500);
}

// списки владельца (25.10, tools/curated-channels.json): актёр с элементом, у которого в Wikidata нет P3789, —
// его роли спрашиваем отдельно (?w wdt:P161 wd:<актёр>), канал — из списка
interface Curated { h: string; n: string; q?: string; t?: string; role: string; gone?: 1; stale?: 1 }
const curated = (JSON.parse(readFileSync('tools/curated-channels.json', 'utf8')) as { people: Curated[] }).people
  .filter((c) => c.role === 'actor' && c.q && !c.gone && !c.stale && HANDLE.test(c.h));
const curatedTitle = new Map(curated.filter((c) => c.t).map((c) => [c.h.toLowerCase(), c.t!]));
for (const c of curated) {
  const x = cache.actors[c.q!];
  if (x?.tg.length) continue;
  if (!x?.works.length && !DRY) {
    const r = await sparql<{ results: { bindings: Row[] } }>(`SELECT ?w WHERE { ?w wdt:P161 wd:${c.q} }`);
    const works = r.results.bindings.map((b) => b.w!.value.split('/').pop()!).filter((w) => keysOfQ.has(w));
    cache.actors[c.q!] = { n: c.n, tg: [], works };
    writeCache('actor-channels.json', cache);
    await sleep(1500);
  }
  const y = cache.actors[c.q!];
  if (y) y.tg = [c.h];
}

// канал точно канал: есть выемка, он в реестре источников или среди кандидатов (как у авторов)
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

export interface ActorChannel { n: string; en?: string; h: string; t?: string; known?: 1; works: string[] }
// профессии (25.10): P161 — «в ролях», туда попадают и те, кто в документальном кино играет себя (политики,
// спортсмены). Ставим только тех, у кого в P106 есть актёрская профессия и нет политической (правило 24.10:
// каналы политиков и медиаперсон не показываем). Кэш — `occ` в .cache/actor-channels.json.
const ACTOR = new Set(['Q33999', 'Q10800557', 'Q10798782', 'Q2405480', 'Q2259451', 'Q948329', 'Q4610556', 'Q465501', 'Q17307272']);
const POLITICAL = new Set(['Q82955', 'Q11499147', 'Q15253558', 'Q1476215', 'Q193391', 'Q372436', 'Q16533', 'Q1930187']);
const occ = (cache as Cache & { occ?: Record<string, string[]> }).occ ??= {};
const needOcc = Object.keys(cache.actors).filter((q) => !(q in occ));
for (let i = 0; i < needOcc.length && !DRY; i += 200) {
  const chunk = needOcc.slice(i, i + 200);
  const r = await sparql<{ results: { bindings: Row[] } }>(`SELECT ?a ?o WHERE { VALUES ?a { ${chunk.map((q) => `wd:${q}`).join(' ')} } ?a wdt:P106 ?o }`);
  for (const q of chunk) occ[q] = [];
  for (const b of r.results.bindings) occ[b.a!.value.split('/').pop()!].push(b.o!.value.split('/').pop()!);
  writeCache('actor-channels.json', cache);
  await sleep(1500);
}
// актёры, у которых политическая профессия в P106 есть, но ставим их (26.10, слово владельца «пусть будут»)
const KEEP = new Set(['Q2685', 'Q3400285', 'Q140738', 'Q1964825', 'Q1142513']); // Шварценеггер, Певцов, Охлобыстин, Бурляев, Кеосаян
const actorLike = (q: string) => (occ[q] ?? []).some((o) => ACTOR.has(o)) && (KEEP.has(q) || !(occ[q] ?? []).some((o) => POLITICAL.has(o)));

// вид имени (25.10, tools/register-actor-channels.mts по t.me/s): `none` — открытой ленты нет, это личный аккаунт или
// пустое имя — на страницу не ставим (вести людей в личку актёра незачем)
const kinds = existsSync('.cache/actor-channel-kinds.json')
  ? JSON.parse(readFileSync('.cache/actor-channel-kinds.json', 'utf8')) as Record<string, 'channel' | 'none'> : {};
const out: Record<string, ActorChannel> = {};
for (const [q, a] of Object.entries(cache.actors).sort(([x], [y]) => x.localeCompare(y))) {
  if (q in EXCLUDE || !actorLike(q)) continue;
  const handles = a.tg.filter((h) => !NO_CHANNEL.has(h.toLowerCase()) && kinds[h.toLowerCase()] !== 'none');
  // «Михаил Олегович Ефремов» → «Михаил Ефремов»: русская метка Wikidata бывает с отчеством, в титрах его нет
  const name = (a.n?.replace(/^(\S+)\s+\S+(?:ович|евич|ич|овна|евна|ична|инична)\s+(\S+)$/u, '$1 $2')) ?? a.en;
  if (!handles.length || !name) continue;
  const h = handles.find((x) => titleOf(x).known) ?? handles[0];
  const { t, known } = titleOf(h);
  const works = [...new Set(a.works.flatMap((w) => keysOfQ.get(w) ?? []))].sort();
  out[q] = { n: name, ...(a.en && a.en !== name ? { en: a.en } : {}), h, ...(t && t.toLowerCase() !== h.toLowerCase() ? { t } : {}), ...(known ? { known: 1 as const } : {}), works };
}
const n = Object.keys(out).length;
console.error(`актёров с Telegram: ${n}, из них известные нам каналы: ${Object.values(out).filter((c) => c.known).length}`);
for (const [q, c] of Object.entries(out).sort((x, y) => y[1].works.length - x[1].works.length).slice(0, 20)) {
  console.error(`  ${q} ${c.n} → @${c.h}${c.t ? ` (${c.t})` : ''} · ролей у нас ${c.works.length}`);
}
if (!DRY) {
  writeFileSync(new URL('../src/mocks/actorChannels.ts', import.meta.url),
    `// Сгенерировано tools/resolve-actor-channels.mts — руками не править. Актёр (элемент Wikidata) с каналом в Telegram:
// n — имя (по-русски, иначе по-английски), en — по-английски (сверка с титрами TMDb), h — имя в Telegram (P3789), t — название канала, known — канал есть в наших выемках или реестре, works — ключи
// произведений справочника, где он играл (P161). Только актёры с Telegram; грузится лениво, со страницей человека (25.10).
export interface ActorChannel { n: string; en?: string; h: string; t?: string; known?: 1; works: string[] }

export const actorChannels: Record<string, ActorChannel> = ${JSON.stringify(out)};
`);
}
