// Фильмы, которые новый участник вероятнее всего уже видел, — для первых оценок (колода /rate,
// src/mocks/ratingDeck.ts) и для заполнения профилей. Четыре независимых сигнала «видели многие»:
//   люди     — в скольких реальных историях фильм есть: владелец (userHistory + userWatched) и
//              присланные профили seeds/*.json. Выборка маленькая и смещённая, но это живые люди;
//   обзоры   — сколько каналов-обзорщиков (tier: 'review') его разбирали: обзорщик берёт то, что
//              смотрят все, — это массовость на русскоязычной публике (essaysAuto);
//   вики     — просмотры статьи в Википедии за два года (.cache/attention.json);
//   trakt    — зрители на Trakt: мировая мера, для нашей публики слабее;
//   канон    — фильм в списке массового зрителя (src/mocks/massCanon.ts): Гайдай, «Брат», «Гарри
//              Поттер», «Шрек» — то, что видели почти все, но о чём молчат наши каналы (30.09).
//              Да или нет, без перцентиля. Канон вне справочника в список не идёт — о нём
//              отдельная строка отчёта, карточки заводит tools/add-shelf-films.mts.
// Каждый сигнал — в перцентиль среди кандидатов, итог — взвешенная сумма (веса ниже — решение,
// а не замер: мерить нечем, пока нет прогноза «видел / не видел» от новых людей).
// «Размечен» — у фильма есть уровень и операции (или черновик userAnnotations): оценка
// неразмеченного модели ничего не даёт, для колоды годятся только размеченные.
//   npx tsx tools/profile-deck.mts [--top 300]   → .cache/profile-deck.md и .tsv
// Имён участников в выходе нет — только сколько человек из скольких.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex, analysisKey } from './works-index.mts';
import { userWorks } from '../src/mocks/userHistory.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { userAnnotations } from '../src/mocks/userAnnotations.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { writeFileSync as writeDeck } from 'node:fs';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { ratingDeck } from '../src/mocks/ratingDeck.ts';
import { massCanonList } from '../src/mocks/massCanon.ts';
import { canonKeys } from '../src/mocks/filmBaseCurated.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

// 300, а не 150 (30.09): с каноном верх списка шире, и Г1 размечает по нему с запасом
const TOP = Number(process.argv[process.argv.indexOf('--top') + 1]) || 300;
// канон отнимает вес у обзорщиков и Trakt: оба меряют ту же массовость, только косвенно
const W = { people: 0.3, reviews: 0.25, canon: 0.2, wiki: 0.15, trakt: 0.1 };

interface Row { key: string; title: string; year: number; people: number; reviews: number; canon: boolean; wiki: number; wikiLang?: string; trakt: number; annotated: boolean; level?: number; inBase: boolean; inDeck: boolean; score: number }
const rows = new Map<string, Row>();
const row = (key: string, w: Pick<WorkCard, 'title' | 'year'>, inBase: boolean): Row => {
  let r = rows.get(key);
  if (!r) { r = { key, title: w.title, year: w.year, people: 0, reviews: 0, canon: false, wiki: 0, trakt: 0, annotated: false, inBase, inDeck: false, score: 0 }; rows.set(key, r); }
  return r;
};
const isAnnotated = (w: WorkCard) => (w.complexityLevel > 0 && w.primaryOperations.length > 0) || Boolean(userAnnotations[w.id]);

// кандидаты — вся база фильмов; сериалы в колоду не идут
for (const { key, work } of worksIndex({ all: true })) {
  if (work.type !== 'film' || work.format === 'series' || !key.startsWith('tmdb:')) continue;
  row(key, work, true);
}
// разметка: карточка одного фильма бывает в нескольких источниках — хватит любой размеченной
for (const w of [...userWorks, ...watchedWorks]) {
  const k = analysisKey(w);
  if (k && rows.has(k) && isAnnotated(w)) rows.get(k)!.annotated = true;
}
for (const { key, work } of worksIndex({ all: true })) if (rows.has(key) && isAnnotated(work)) rows.get(key)!.annotated = true;
// черновая разметка по фильму (трек Г1) и уровень — для разброса колоды
for (const [key, d] of Object.entries(draftAnnotations)) if (rows.has(key)) { rows.get(key)!.annotated = true; rows.get(key)!.level = d.level; }
for (const w of userWorks) {
  const k = analysisKey(w);
  if (k && rows.has(k) && userAnnotations[w.id]) rows.get(k)!.level ??= userAnnotations[w.id].level;
}
for (const { key, work } of worksIndex({ all: true })) if (rows.has(key) && work.complexityLevel > 0) rows.get(key)!.level ??= work.complexityLevel;

// люди: владелец — одна история из двух файлов; каждый seeds/*.json — ещё один человек
const people: Set<string>[] = [new Set([...userWorks, ...watchedWorks].map(analysisKey).filter((k): k is string => Boolean(k)))];
if (existsSync('seeds')) {
  for (const f of readdirSync('seeds').filter((f) => f.endsWith('.json'))) {
    const seed = JSON.parse(readFileSync(`seeds/${f}`, 'utf8')) as { watched: { tmdb?: number; work: WorkCard }[] };
    const keys = new Set<string>();
    for (const w of seed.watched) {
      if (w.tmdb == null || w.work.format === 'series') continue;
      const key = `tmdb:${w.tmdb}`;
      keys.add(key);
      row(key, w.work, false); // фильма нет в базе — всё равно в список: кандидат в базу
    }
    people.push(keys);
  }
}
for (const r of rows.values()) r.people = people.filter((s) => s.has(r.key)).length;

// обзорщики: разные каналы яруса «обзор» с роликом про фильм
for (const [key, list] of Object.entries(essaysAuto)) {
  const r = rows.get(key);
  if (r) r.reviews = new Set(list.filter((a) => a.tier === 'review').map((a) => a.author)).size;
}
// канон: по ключу, найденному в TMDb (add-shelf-films), или по названию и году в справочнике
const normT = (t: string) => t.toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/g, ' ').trim();
for (const k of canonKeys) { const r = rows.get(k); if (r) r.canon = true; }
const byTitle = new Map<string, Row[]>();
for (const { key, work } of worksIndex({ all: true })) {
  const r = rows.get(key);
  if (!r) continue;
  for (const t of [work.title, work.originalTitle]) if (t) (byTitle.get(normT(t)) ?? byTitle.set(normT(t), []).get(normT(t))!).push(r);
}
const canonOutside: string[] = [];
// ключи из TMDb (add-shelf-films) точнее названия: «Остров» — и Лунгин, и Майкл Бэй. По
// названию и году — только пока ключей нет (карточки канона ещё не заводились)
for (const c of canonKeys.length ? [] : massCanonList) {
  const hit = [c.title, c.original].filter((t): t is string => Boolean(t))
    .flatMap((t) => byTitle.get(normT(t)) ?? []).find((r) => Math.abs(r.year - c.year) <= 1);
  if (hit) hit.canon = true;
  else canonOutside.push(`${c.title} (${c.year})`);
}
if (canonKeys.length) {
  // ключ есть, а фильма среди кандидатов нет (сериал или карточка не завелась); не нашедшихся в
  // TMDb add-shelf-films перечисляет сам, ключей у них нет
  for (const k of canonKeys) if (!rows.has(k)) canonOutside.push(k);
  if (canonKeys.length < massCanonList.length) canonOutside.push(`ещё ${massCanonList.length - canonKeys.length} не нашлись в TMDb`);
}
// внимание: Википедия и Trakt
const attention = existsSync('.cache/attention.json')
  ? JSON.parse(readFileSync('.cache/attention.json', 'utf8')) as Record<string, { views?: number; lang?: string; trakt?: { watchers?: number } }> : {};
for (const [key, a] of Object.entries(attention)) {
  const r = rows.get(key);
  if (r) { r.wiki = a.views ?? 0; r.wikiLang = a.lang; r.trakt = a.trakt?.watchers ?? 0; }
}
// что уже в колоде /rate
// колода — id карточек (u-kp…, c-…, w…): переводим в ключ фильма через все известные карточки
const idToKey = new Map<string, string>();
for (const w of [...userWorks, ...watchedWorks, ...worksIndex({ all: true }).map((x) => x.work)]) {
  const k = analysisKey(w);
  if (k && !idToKey.has(w.id)) idToKey.set(w.id, k);
}
const deckKeys = new Set(ratingDeck.map((id) => idToKey.get(id)).filter((k): k is string => Boolean(k)));
if (deckKeys.size < ratingDeck.length) console.error(`  в колоде ${ratingDeck.length}, опознано ${deckKeys.size}`);
for (const r of rows.values()) r.inDeck = deckKeys.has(r.key);

// перцентиль: доля кандидатов со значением строго меньше; ноль — это ноль, а не «средне»
const all = [...rows.values()];
const pct = (f: (r: Row) => number) => {
  const sorted = all.map(f).sort((a, b) => a - b);
  return (v: number) => (v <= 0 ? 0 : sorted.findIndex((x) => x >= v) / sorted.length);
};
// Википедия — внутри своего языка: у четверти фильмов статья только английская, а её читают
// на порядок больше («Остров проклятых» — 4,1 млн против сотен тысяч у русских статей)
const pctIn = (lang: string | undefined) => {
  const sorted = all.filter((r) => r.wikiLang === lang && r.wiki > 0).map((r) => r.wiki).sort((a, b) => a - b);
  return (v: number) => (v <= 0 || !sorted.length ? 0 : sorted.findIndex((x) => x >= v) / sorted.length);
};
const wikiBy = new Map([...new Set(all.map((r) => r.wikiLang))].map((l) => [l, pctIn(l)]));
const p = { reviews: pct((r) => r.reviews), wiki: (r: Row) => wikiBy.get(r.wikiLang)!(r.wiki), trakt: pct((r) => r.trakt) };
for (const r of all) {
  r.score = W.people * (r.people / people.length) + W.reviews * p.reviews(r.reviews) + W.canon * (r.canon ? 1 : 0)
    + W.wiki * p.wiki(r) + W.trakt * p.trakt(r.trakt);
}
all.sort((a, b) => b.score - a.score);
const top = all.slice(0, TOP);

mkdirSync('.cache', { recursive: true });
const tsv = ['место\tфильм\tгод\tлюди\tобзорщики\tканон\tвики\ttrakt\tразмечен\tв базе\tв колоде\tоценка',
  ...top.map((r, i) => [i + 1, r.title, r.year, `${r.people}/${people.length}`, r.reviews, r.canon ? 'да' : '', r.wiki, r.trakt, r.annotated ? 'да' : '', r.inBase ? 'да' : '', r.inDeck ? 'да' : '', r.score.toFixed(3)].join('\t'))];
writeFileSync('.cache/profile-deck.tsv', tsv.join('\n') + '\n');
const md = [`# Фильмы для первых оценок — ${new Date().toISOString().slice(0, 10)}`, '',
  `Кандидатов ${all.length}, людей в выборке ${people.length}. Веса: люди ${W.people}, обзорщики ${W.reviews}, канон ${W.canon}, Википедия ${W.wiki}, Trakt ${W.trakt}.`, '',
  '| # | фильм | люди | обзорщики | канон | вики, тыс. | trakt, тыс. | размечен | в колоде |', '|---|---|---|---|---|---|---|---|---|',
  ...top.map((r, i) => `| ${i + 1} | ${r.title} (${r.year})${r.inBase ? '' : ' ⁺'} | ${r.people}/${people.length} | ${r.reviews || ''} | ${r.canon ? '✓' : ''} | ${r.wiki ? `${Math.round(r.wiki / 1000)}${r.wikiLang === 'en' ? ' en' : ''}` : ''} | ${r.trakt ? Math.round(r.trakt / 1000) : ''} | ${r.annotated ? '✓' : ''} | ${r.inDeck ? '✓' : ''} |`),
  '', '⁺ — нет в нашей базе фильмов: пришёл только из присланных профилей.',
  ...(canonOutside.length ? ['', `Канон вне справочника — ${canonOutside.length} (заведёт \`npx tsx tools/add-shelf-films.mts\`, после — перезапуск этого отчёта): ${canonOutside.join(', ')}.`] : [])];
writeFileSync('.cache/profile-deck.md', md.join('\n') + '\n');

// фильмы со свидетельством «смотрели» (люди или обзорщики), у которых нет данных о внимании:
// их досчитывает `tools/build-attention.mts --keys .cache/attention-todo.txt`
const todoAttention = all.filter((r) => (r.people > 0 || r.reviews > 0 || r.canon) && !attention[r.key]).map((r) => r.key);
writeFileSync('.cache/attention-todo.txt', todoAttention.join('\n') + '\n');
if (todoAttention.length) console.error(`без данных о внимании при свидетельстве «смотрели»: ${todoAttention.length} → .cache/attention-todo.txt`);
const annotatedTop = top.filter((r) => r.annotated);
console.error(`канон: ${massCanonList.length}, среди кандидатов ${all.filter((r) => r.canon).length}, в топ-${TOP} — ${top.filter((r) => r.canon).length}`);
console.error(`кандидатов ${all.length}, людей ${people.length}; в топ-${TOP}: размечено ${annotatedTop.length}, уже в колоде ${top.filter((r) => r.inDeck).length}, вне базы ${top.filter((r) => !r.inBase).length}`);
console.error('→ .cache/profile-deck.md, .cache/profile-deck.tsv');

// ─── колода /rate (трек Г2): --deck пишет src/mocks/ratingDeck.ts ─────────────
// Правило: только размеченные; самые смотримые сверху; потолок на уровень, чтобы колода не
// стала сплошными блокбастерами (уровень 2) и дала модели разброс; в конце — авторские опоры
// прежней колоды (уровень 7+), которых нет в верхушке: без них вкус снимается с одного угла.
if (process.argv.includes('--deck')) {
  const SIZE = 45;
  const CAP: Record<number, number> = { 1: 4, 2: 8, 3: 10, 4: 10, 5: 8 };
  // id карточки, которую найдёт deckCard: история владельца, пул, каталог, справочник
  const idFor = new Map<string, string>();
  for (const w of [...userWorks, ...worksIndex({ all: true }).map((x) => x.work), ...filmBase, ...filmBaseWiki, ...watchedWorks]) {
    const k = analysisKey(w);
    if (k && !idFor.has(k)) idFor.set(k, w.id);
  }
  const perLevel: Record<number, number> = {};
  const deck: { id: string; title: string; level: number }[] = [];
  for (const r of all) {
    if (deck.length >= SIZE) break;
    if (!r.annotated || r.level == null || !idFor.has(r.key)) continue;
    if ((perLevel[r.level] ?? 0) >= (CAP[r.level] ?? Infinity)) continue;
    perLevel[r.level] = (perLevel[r.level] ?? 0) + 1;
    deck.push({ id: idFor.get(r.key)!, title: r.title, level: r.level });
  }
  // авторские опоры прежней колоды — те, что не вошли и стоят уровня 7+
  const anchors = ['w07', 'w02', 'c-mulholland', 'c-lighthouse', 'u-kp819846', 'w06', 'c-memories'];
  for (const id of anchors) {
    const k = idToKey.get(id);
    if (!k || deck.some((d) => d.id === id || idFor.get(k) === d.id)) continue;
    const r = rows.get(k);
    deck.push({ id, title: r?.title ?? id, level: r?.level ?? 0 });
  }
  const noReg = deck.filter((d) => !workRegisters[d.id] && !d.id.startsWith('w') && !d.id.startsWith('c-')).map((d) => d.title);
  const body = `// Фильмы для первых оценок (холодный старт, экран /rate). Собирает tools/profile-deck.mts --deck
// (${new Date().toISOString().slice(0, 10)}), не руками. Правило:
//   · широко известные — чтобы новый человек набрал десять оценок за минуту, а не листал
//     список в поисках знакомого; самые смотримые сверху (люди, обзорщики, Википедия, Trakt);
//   · только размеченные (операции и уровень, в том числе черновик draftAnnotations):
//     оценка неразмеченного модели ничего не даёт;
//   · потолок на уровень (${Object.entries(CAP).map(([l, n]) => `${l}: ${n}`).join(', ')}) — иначе колода из блокбастеров;
//   · в конце — авторские опоры прежней колоды (уровень 7+): разброс по регистрам и уровню.
// Ключи — id карточек: u-kp… (история владельца), c-… (пул), w… (каталог), остальное — справочник.
// Оценённое отсюда уходит из подбора как виденное — предлагать виденное незачем.

export const ratingDeck: string[] = [
${deck.map((d) => `  ${JSON.stringify(d.id).replace(/"/g, "'")}, // ${d.title} · ${d.level}`).join('\n')}
];
`;
  writeDeck(new URL('../src/mocks/ratingDeck.ts', import.meta.url), body);
  console.error(`→ src/mocks/ratingDeck.ts: ${deck.length} фильмов; по уровням ${JSON.stringify(Object.fromEntries(Object.entries(deck.reduce((m, d) => { m[d.level] = (m[d.level] ?? 0) + 1; return m; }, {} as Record<number, number>))))}${noReg.length ? `; без регистра: ${noReg.join(', ')}` : ''}`);
}
