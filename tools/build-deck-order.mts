// Балл колоды первых оценок (23.10, опыт `deckOrder`, src/lib/deckOrder.ts): «сначала известное, о чём мнения расходятся»
// — HELF по историям зрителей seeds/*.json. Один человек под несколькими историями — один (tools/seed-identity.mts), оценки —
// z в его шкале (tools/item-sim-data.mts, как у consensus и itemSim), у фильма — число оценивших, энтропия по пяти корзинам
// z, разброс z и HELF. В таблицу — только фильмы колод (ratingDeck.ts, ratingDeckEn.ts; ключи — по снимку колоды
// deckCards.ts) и только оценённые не меньше чем DECK_ORDER.minPeople людьми: ключ фильма → балл, ни имён, ни оценок людей.
// Подробности (по каждой карточке и лучшие по HELF вне колоды — без имён) — в .cache/deck-order/ (вне git).
//   npx tsx tools/build-deck-order.mts [--min 20]   → src/mocks/deckOrder.ts (колода грузит её лениво, ≈2 КБ)
// Перезапускать, когда меняется колода (и после tools/build-deck-cards.mts) или копятся новые истории.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { consensusKeys } from '../src/lib/model/consensus.ts';
import type { RatedFilm } from '../src/lib/model/itemSim.ts';
import { DECK_ORDER, helf, zBin } from '../src/lib/deckOrder.ts';
import { peopleFilms } from './item-sim-data.mts';

/** Сводка по фильмам: ключ (любой из consensusKeys) → номер фильма; у фильма — оценки по корзинам, Σz, Σz²; у человека —
 *  его вклад (номер фильма, корзина, z), чтобы замер вычитал его (tools/deck-order-eval.mts). */
export interface FilmStats {
  index: Map<string, number>;
  keys: string[][];
  bins: Int32Array[]; sz: Float64Array; sz2: Float64Array;
  people: Map<string, { f: Int32Array; bin: Uint8Array; z: Float32Array }>;
}
export function filmStats(people: Map<string, RatedFilm[]>): FilmStats {
  const index = new Map<string, number>(), keys: string[][] = [];
  const idOf = (ks: string[]) => {
    let f = ks.map((k) => index.get(k)).find((x) => x != null);
    if (f == null) { f = keys.length; keys.push([]); }
    for (const k of ks) if (!index.has(k)) { index.set(k, f); keys[f].push(k); }
    return f;
  };
  const per = new Map<string, { f: number; bin: number; z: number }[]>();
  for (const [who, films] of people) {
    const seen = new Set<number>(), mine: { f: number; bin: number; z: number }[] = [];
    for (const x of films) {
      if (!x.keys.length) continue;
      const f = idOf(x.keys);
      if (seen.has(f)) continue;
      seen.add(f);
      mine.push({ f, bin: zBin(x.z), z: x.z });
    }
    per.set(who, mine);
  }
  const M = keys.length;
  const s: FilmStats = { index, keys, bins: Array.from({ length: M }, () => new Int32Array(5)), sz: new Float64Array(M), sz2: new Float64Array(M), people: new Map() };
  for (const [who, mine] of per) {
    s.people.set(who, { f: Int32Array.from(mine, (x) => x.f), bin: Uint8Array.from(mine, (x) => x.bin), z: Float32Array.from(mine, (x) => x.z) });
    for (const x of mine) { s.bins[x.f][x.bin]++; s.sz[x.f] += x.z; s.sz2[x.f] += x.z * x.z; }
  }
  return s;
}

/** n, нормированная энтропия, нормированный log числа оценивших, среднее и разброс z, HELF */
export function filmRow(s: FilmStats, f: number, people: number) {
  const b = s.bins[f], n = b.reduce((x, y) => x + y, 0);
  let h = 0; for (const c of b) if (c) { const p = c / n; h -= p * Math.log(p); }
  const mean = n ? s.sz[f] / n : 0;
  return { n, h: h / Math.log(5), lf: Math.min(1, Math.log(n) / Math.log(people)), mean, sd: n ? Math.sqrt(Math.max(0, s.sz2[f] / n - mean * mean)) : 0, helf: helf(b, people) };
}

/** колоды по снимку (deckCards.ts): id карточки, название, год, ключи фильма */
export async function deckLists(): Promise<Record<'ru' | 'en', { id: string; title: string; year?: number; keys: string[] }[]>> {
  const { deckCards, deckSource } = await import('../src/mocks/deckCards.ts');
  const { ratingDeck } = await import('../src/mocks/ratingDeck.ts');
  const { ratingDeckEn } = await import('../src/mocks/ratingDeckEn.ts');
  if (deckSource.ru !== ratingDeck.join(',') || deckSource.en !== ratingDeckEn.join(','))
    console.error('! снимок колоды (deckCards.ts) снят с другой колоды — сначала npx tsx tools/build-deck-cards.mts');
  const of = (l: 'ru' | 'en') => deckCards[l].map((w) => ({ id: w.id, title: w.title, year: w.year, keys: consensusKeys(w.type, w.externalIds) }));
  return { ru: of('ru'), en: of('en') };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const argv = process.argv.slice(2);
  const MIN = Number(argv[argv.indexOf('--min') + 1] || 20);
  const people = peopleFilms(MIN);
  const P = people.size;
  const s = filmStats(people);
  const decks = await deckLists();
  const r3 = (x: number) => Math.round(x * 1000) / 1000;
  const table: Record<string, number> = {};
  const lines: string[] = [];
  const deckFilms = new Set<number>();
  for (const l of ['ru', 'en'] as const) {
    const rows = decks[l].map((d, at) => {
      const f = d.keys.map((k) => s.index.get(k)).find((x) => x != null);
      if (f != null) deckFilms.add(f);
      const r = f != null ? filmRow(s, f, P) : undefined;
      if (r && r.n >= DECK_ORDER.minPeople && d.keys.length) table[d.keys[0]] = r3(r.helf);
      return { ...d, at, r };
    });
    const scored = rows.filter((x) => x.r && x.r.n >= DECK_ORDER.minPeople).sort((a, b) => b.r!.helf - a.r!.helf || a.at - b.at);
    const order = [...scored, ...rows.filter((x) => !scored.includes(x))];
    lines.push(`\n## Колода ${l}: ${rows.length} карточек, с баллом ${scored.length}`, '', '| HELF-место | сейчас | фильм | n | H′ | LF | z ср. | z разброс | HELF |', '|---|---|---|---|---|---|---|---|---|');
    order.forEach((x, i) => lines.push(`| ${i + 1} | ${x.at + 1} | ${x.title} (${x.year ?? '—'}) | ${x.r?.n ?? 0} | ${x.r ? x.r.h.toFixed(2) : '—'} | ${x.r ? x.r.lf.toFixed(2) : '—'} | ${x.r ? x.r.mean.toFixed(2) : '—'} | ${x.r ? x.r.sd.toFixed(2) : '—'} | ${x.r && x.r.n >= DECK_ORDER.minPeople ? x.r.helf.toFixed(3) : '—'} |`));
  }
  // лучшие по HELF вне колод — фильмы (не сериалы), n ≥ minPeople; названия — вторым проходом по историям
  const all = s.keys.map((_, f) => ({ f, r: filmRow(s, f, P) })).filter((x) => x.r.n >= DECK_ORDER.minPeople);
  const top = all.filter((x) => !deckFilms.has(x.f) && !s.keys[x.f].some((k) => k.startsWith('tmdbtv:'))).sort((a, b) => b.r.helf - a.r.helf).slice(0, 60);
  const want = new Map(top.flatMap((x) => s.keys[x.f].map((k) => [k, x.f] as const)));
  const title = new Map<number, string>();
  for (const file of readdirSync('seeds').filter((x) => x.endsWith('.json'))) {
    if (title.size >= top.length) break;
    let ratings: { workId: string; work?: { type?: string; title?: string; year?: number; externalIds?: { tmdb?: number; imdb?: string } } }[];
    try { ratings = (JSON.parse(readFileSync(`seeds/${file}`, 'utf8')) as { ratings?: typeof ratings }).ratings ?? []; } catch { continue; }
    for (const r of ratings) {
      if (!r.work?.title) continue;
      const f = consensusKeys(r.work.type ?? 'film', r.work.externalIds).map((k) => want.get(k)).find((x) => x != null);
      if (f != null && !title.has(f)) title.set(f, `${r.work.title} (${r.work.year ?? '—'})`);
    }
  }
  lines.push(`\n## Лучшие по HELF вне колод (фильмы, n ≥ ${DECK_ORDER.minPeople}): не добавлены — решение владельца`, '', '| место | фильм | n | H′ | LF | z ср. | HELF |', '|---|---|---|---|---|---|---|');
  top.forEach((x, i) => lines.push(`| ${i + 1} | ${title.get(x.f) ?? s.keys[x.f][0]} | ${x.r.n} | ${x.r.h.toFixed(2)} | ${x.r.lf.toFixed(2)} | ${x.r.mean.toFixed(2)} | ${x.r.helf.toFixed(3)} |`));
  // энтропия корзин и разброс z — одно и то же или нет
  const xs = all.map((x) => x.r.h), ys = all.map((x) => x.r.sd);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let cxy = 0, cxx = 0, cyy = 0; xs.forEach((x, i) => { cxy += (x - mx) * (ys[i] - my); cxx += (x - mx) ** 2; cyy += (ys[i] - my) ** 2; });
  const corr = cxy / Math.sqrt(cxx * cyy);

  const day = new Date().toISOString().slice(0, 10);
  const entries = Object.entries(table).sort(([a], [b]) => a.localeCompare(b));
  const text = `// Сгенерировано tools/build-deck-order.mts (${day}): балл колоды первых оценок — HELF (src/lib/deckOrder.ts, опыт \`deckOrder\`)
// по историям зрителей (людей ${P}, у фильма не меньше ${DECK_ORDER.minPeople}). Только фильмы колод; ни имён, ни оценок людей. Не править руками.
export const deckOrder: Record<string, number> = ${JSON.stringify(Object.fromEntries(entries))};
`;
  writeFileSync('src/mocks/deckOrder.ts', text);
  mkdirSync('.cache/deck-order', { recursive: true });
  writeFileSync(`.cache/deck-order/deck-order-${day}.md`, `# Порядок колоды по HELF (${day})\n\nЛюдей ${P} (истории ≥ ${MIN} оценок), фильмов с n ≥ ${DECK_ORDER.minPeople}: ${all.length}. ` +
    `Корреляция нормированной энтропии корзин z и разброса z по этим фильмам: ${corr.toFixed(2)}.\n` +
    `H′ — энтропия по 5 корзинам z / ln 5; LF — ln n / ln ${P}; HELF — 2·H′·LF/(H′+LF).\n${lines.join('\n')}\n`);
  console.log(`людей ${P}, фильмов с n ≥ ${DECK_ORDER.minPeople}: ${all.length}; в таблице ${entries.length} (колоды ru ${decks.ru.length}, en ${decks.en.length}) → src/mocks/deckOrder.ts, ${(Buffer.byteLength(text) / 1024).toFixed(1)} КБ; H′~разброс z: r=${corr.toFixed(2)} · .cache/deck-order/deck-order-${day}.md`);
}
