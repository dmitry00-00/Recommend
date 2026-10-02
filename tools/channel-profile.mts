// Профиль канала (02.10): о каких вселенных и людях канал говорит — приоритет, а не привязка.
//   npx tsx tools/channel-profile.mts [--report]     → .cache/channel-profiles.json
//
// Зачем. Заголовок «Королева», «Дракон», «Наследник» неоднозначен, а канал, у которого девять
// роликов из десяти о «Песни льда и огня», почти наверняка и здесь о ней. Профиль считается по тому,
// что уже известно о канале:
//   · решения людей и привязки с уликой (год, оригинальное название, хэштег) — вес 1;
//   · непроверенные привязки — вес 0,25: они ошибаются чаще, но их много;
//   · ролики о франшизе и о человеке (src/mocks/essaysAbout.ts) — вес 1, сразу к цели.
// Произведение даёт голос своей вселенной (граф связей Ж1) и своим людям (режиссёр, создатель
// сериала, автор книги — workCredits Д2). Ручной фокус — `focus` у канала в src/mocks/sources.ts —
// сильнее посчитанного.
//
// Профиль «сильный», если в нём есть доля от 40% у одной вселенной или одного человека при весе от
// 12, — или задан руками. Его читают опознаватель (tools/match-videos.mts: тёзки разводятся в пользу
// фокуса, совпадение вне фокуса — без подтверждения) и вкладка «Проверка» (пометка «вне профиля»).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { sources } from '../src/mocks/sources.ts';
import { inUniverse, peopleOfKey, universeOfKey, universeTitle } from './about-lib.mts';
import { relationNodes } from '../src/mocks/workRelations.ts';
import { people } from '../src/mocks/people.ts';
import { channelMeta } from './youtube-channels.mts';

export interface ChannelProfile {
  /** вес всего, что известно о канале */
  n: number;
  /** [элемент Wikidata, доля] — по убыванию, до 8 */
  universes: [string, number][];
  persons: [string, number][];
  /** фокус: руками (sources.ts) или посчитанный (доля от STRONG_SHARE) — тёзки разводятся в его пользу */
  focus: string[];
  /** преобладание: вселенная с долей от DOMINANT_SHARE (или ручной фокус) — совпадение вне него
   *  уходит без улики, на проверку. Люди преобладанием не бывают: у канала о Нолане хватает и других
   *  фильмов (замер 02.10: «Вслушивание» — 3 верных из 4 вне Нолана) */
  dominant: string[];
  manual?: boolean;
}
export const PROFILES = new URL('../.cache/channel-profiles.json', import.meta.url);
export const STRONG_SHARE = 0.4;
export const STRONG_N = 12;
export const DOMINANT_SHARE = 0.75;

/** Произведение в фокусе: его вселенная или люди в списке; вселенная — и по ядру людей. */
export function inFocusKey(key: string, focus: Iterable<string>): boolean {
  const ps = new Set(peopleOfKey(key));
  for (const q of focus) {
    if (relationNodes[q] ? inUniverse(key, q) : ps.has(q)) return true;
  }
  return false;
}

export function readProfiles(): Record<string, ChannelProfile> {
  try { return existsSync(PROFILES) ? JSON.parse(readFileSync(PROFILES, 'utf8')) as Record<string, ChannelProfile> : {}; } catch { return {}; }
}

/** Цели произведения для профиля: вселенная и люди. */
export function targetsOfKey(key: string): string[] {
  const u = universeOfKey(key);
  return [...(u ? [u] : []), ...peopleOfKey(key)];
}

// ─── сборка ───────────────────────────────────────────────────────────────────
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const root = new URL('../', import.meta.url);
  const generated = <T,>(file: string): T => {
    const p = new URL(file, root);
    if (!existsSync(p)) return {} as T;
    const src = readFileSync(p, 'utf8');
    return JSON.parse(src.slice(src.indexOf('= {') + 2, src.lastIndexOf(';'))) as T;
  };
  type A = { author: string; evidence?: string; unverified?: boolean; tier?: string };
  const essaysAuto = generated<Record<string, A[]>>('src/mocks/essaysAuto.ts');
  const about = generated<{ universe?: Record<string, A[]>; person?: Record<string, A[]> }>('src/mocks/essaysAbout.ts');

  const acc = new Map<string, { n: number; u: Map<string, number>; p: Map<string, number> }>();
  const of = (ch: string) => acc.get(ch) ?? acc.set(ch, { n: 0, u: new Map(), p: new Map() }).get(ch)!;
  const add = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w);
  for (const [key, list] of Object.entries(essaysAuto)) {
    const u = universeOfKey(key);
    const ps = peopleOfKey(key);
    for (const a of list) {
      const w = a.unverified ? 0.25 : 1;
      const c = of(a.author);
      c.n += w;
      if (u) add(c.u, u, w);
      for (const q of ps) add(c.p, q, w / ps.length);
    }
  }
  for (const [kind, map] of [['u', about.universe ?? {}], ['p', about.person ?? {}]] as const) {
    for (const [q, list] of Object.entries(map)) for (const a of list) { const c = of(a.author); c.n += 1; add(c[kind], q, 1); }
  }

  // ручной фокус: канал в sources.ts по нику → название канала из выгрузки
  const titleByHandle = new Map(Object.values(channelMeta()).filter((m) => m.handle).map((m) => [m.handle!.toLowerCase(), m.title]));
  const manual = new Map<string, string[]>();
  for (const s of sources) if (s.focus?.length) manual.set(titleByHandle.get(s.handle.toLowerCase()) ?? s.title, s.focus);

  const out: Record<string, ChannelProfile> = {};
  const top = (m: Map<string, number>, n: number): [string, number][] =>
    [...m].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => [k, Math.round((v / n) * 100) / 100]);
  for (const [ch, c] of acc) {
    if (c.n < 1) continue;
    const universes = top(c.u, c.n), persons = top(c.p, c.n);
    const strong = c.n >= STRONG_N ? [...universes, ...persons].filter(([, s]) => s >= STRONG_SHARE).map(([q]) => q) : [];
    const m = manual.get(ch);
    const dominant = c.n >= STRONG_N ? universes.filter(([, s]) => s >= DOMINANT_SHARE).map(([q]) => q) : [];
    out[ch] = { n: Math.round(c.n * 10) / 10, universes, persons, focus: m ?? strong, dominant: m ?? dominant, ...(m ? { manual: true } : {}) };
  }
  for (const [ch, f] of manual) if (!out[ch]) out[ch] = { n: 0, universes: [], persons: [], focus: f, dominant: f, manual: true };
  mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
  writeFileSync(PROFILES, JSON.stringify(out, null, 1));

  const name = (q: string) => universeTitle(q) ?? people[q as keyof typeof people]?.name ?? q;

  // для страницы автора (/voice/:id, блок «О чём говорит»): вселенные и люди с долей от 8%, до шести
  const forApp: Record<string, { n: number; top: { id: string; kind: 'universe' | 'person'; title: string; share: number }[]; focus: string[] }> = {};
  for (const [ch, p] of Object.entries(out)) {
    if (p.n < 5 && !p.manual) continue;
    const top = [...p.universes.map(([q, s]) => ({ id: q, kind: 'universe' as const, share: s })), ...p.persons.map(([q, s]) => ({ id: q, kind: 'person' as const, share: s }))]
      .filter((x) => x.share >= 0.08).sort((a, b) => b.share - a.share).slice(0, 6)
      .map((x) => ({ ...x, title: name(x.id) }));
    if (top.length || p.focus.length) forApp[ch] = { n: p.n, top, focus: p.focus };
  }
  writeFileSync(new URL('../src/mocks/channelProfiles.ts', import.meta.url),
    `// Сгенерировано tools/channel-profile.mts (${new Date().toISOString().slice(0, 10)}): о каких вселенных и людях говорит канал.
// Ключ — название канала, как у разбора (author). Доля — от всего, что о канале известно; непроверенные
// привязки идут с весом 0,25. Не править руками — перегенерировать.
export const channelProfiles: Record<string, { n: number; top: { id: string; kind: 'universe' | 'person'; title: string; share: number }[]; focus: string[] }> = ${JSON.stringify(forApp, null, 1)};
`);
  const focused = Object.entries(out).filter(([, p]) => p.focus.length);
  console.error(`профили: ${Object.keys(out).length} каналов, с фокусом ${focused.length} (руками ${[...manual.keys()].length})`);
  if (process.argv.includes('--report')) {
    for (const [ch, p] of focused.sort((a, b) => b[1].n - a[1].n)) {
      console.error(`  ${ch} (${p.n}${p.manual ? ', руками' : ''}${p.dominant.length ? ', преобладает' : ''}): ${p.focus.map((q) => `${name(q)} ${Math.round(([...p.universes, ...p.persons].find(([k]) => k === q)?.[1] ?? 0) * 100)}%`).join(', ')}`);
    }
  }
  console.log(`профили каналов: ${Object.keys(out).length}, с фокусом ${focused.length}`);
}
