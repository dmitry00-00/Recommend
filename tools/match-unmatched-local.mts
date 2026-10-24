// Неопознанное из историй Кинопоиска (unmatchedKinopoisk в seeds/*.json) → карточка своего справочника по названию (24.10).
// После tools/match-unmatched-wikidata.mts осталось ~6,1 тыс. номеров, 5,8 тыс. из них Wikidata не знает по номеру
// Кинопоиска, а в справочнике (filmBase*, seriesBase*, кандидаты — tools/base-have.mts) многие из них есть: «Сёгун» 2024,
// «Бар „Один звонок“». Внешних сервисов здесь нет: ни Кинопоиска, ни TMDb, ни Wikidata — только свои файлы.
// Сопоставление — по образцу ~/recruit (tools/title-match.mts): нормализация (регистр, ё/е, кавычки, тире, знаки), без
// морфологии и fuzzy; границы — `\p{L}` с флагом u (в JavaScript `\w` кириллицы не знает). Порядок ступеней = приоритет:
//   1. номер Кинопоиска у карточки справочника тот же;
//   2. название (своё, оригинальное или русский синоним Wikidata — src/mocks/altTitles.ts) + год ±1 + вид (фильм/сериал);
//   3. «… Расширенная / Режиссёрская / Чёрно-белая версия» → основная карточка, тем же сторожем (номер Кинопоиска версии
//      карточке не приписываем — у версии он свой).
// Сторожа: ровно одна карточка-кандидат (копии одной вещи — src/mocks/workAliases.ts — одна), год ±1 (у названия из одного
// слова и у синонима — точный: тёзки в соседних годах; синоним — от двух слов), вид тот же, у карточки нет другого номера Кинопоиска,
// на карточку не претендуют два разных номера. Сериал с подзаголовком («Атака титанов: Выбор без сожалений» — OVA, не
// сезон) и фильм, сошедшийся только без подзаголовка, — не опознаём, они в отчёте среди отвергнутых.
// Не задвоить в замере (tools/taste-eval.mts сводит записи к tmdb: → imdb: → id; две записи одной вещи — одна в обучении,
// другая в проверке): карточка, которая у человека уже есть под любым своим ключом или копией (основная версия рядом с
// расширенной), в историю не добавляется — строка только снимается из неопознанного.
//   npx tsx tools/match-unmatched-local.mts           — пробный прогон: отчёт .cache/wikidata-kp/report-local.md, файлы не трогает
//   npx tsx tools/match-unmatched-local.mts --apply   — то же и запись историй; перед ней копия seeds/ в .cache/seeds-backup-2410/
// Запись — как у match-unmatched-wikidata: оценка из скачанных страниц профиля, свежую историю (автоимпорт) откладываем.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { mergeRecords, readPage, splitBundle, type Page } from './kinopoisk-seed.mts';
import { addressees, HELPER_DIR, kpSeed } from './addressees.mts';
import { baseWorks, qidOfCard } from './base-have.mts';
import { idsOf } from './works-index.mts';
import { altTitles } from '../src/mocks/altTitles.ts';
import { aliasesOf, canon } from '../src/lib/canon.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

const APPLY = process.argv.includes('--apply');
const SEEDS = 'seeds';
const DIR = '.cache/wikidata-kp';
const BACKUP = '.cache/seeds-backup-2410';
/** история моложе этого — её, возможно, прямо сейчас пишет автоимпорт: откладываем в конец */
const FRESH_MS = 120e3;
mkdirSync(DIR, { recursive: true });

// ─── строки unmatched ─────────────────────────────────────────────────────────
// формат buildSeed: «Название (год) — kinopoisk.ru/film|series/<номер>/»
interface Line { title: string; year?: number; type: 'film' | 'series'; kp: string; raw: string }
const LINE = /^(.*?)(?: \((\d{4})\))? — kinopoisk\.ru\/(film|series)\/(\d+)\/$/;
function parseLine(s: string): Line | undefined {
  const m = LINE.exec(s);
  if (!m) return undefined;
  return { title: m[1] === '(без названия)' ? '' : m[1], ...(m[2] ? { year: Number(m[2]) } : {}), type: m[3] as Line['type'], kp: m[4], raw: s };
}
type Entry = { workId: string; work?: unknown; tmdb?: number; imdb?: string; from?: 'kinopoisk' };
type Seed = { username?: string; version?: string; watched: Entry[];
  ratings?: { workId: string; rating: number; raw?: number; work?: unknown }[]; unmatchedKinopoisk?: string[] };
const seedFiles = () => readdirSync(SEEDS).filter((f) => f.endsWith('.json')).sort();

// ─── нормализация названия ────────────────────────────────────────────────────
// регистр, ё/е, кавычки и апострофы прочь, тире/дефис/знаки → пробел; «&#x27;» и прочие сущности в строках Кинопоиска есть
const ENT: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
const decode = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);
const norm = (s: string) => decode(s).toLowerCase().replace(/ё/g, 'е')
  .replace(/[«»„“”"'’‘`´]/g, '').replace(/&/g, ' и ')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
/** версия той же вещи в хвосте названия (24.10, по строкам: «Майор Гром: Чумной Доктор. Расширенная версия» — 30 человек,
 *  «Лига справедливости Зака Снайдера: Черно-белая версия» — 23, «Иван Васильевич меняет всё. Режиссёрская версия» — 10).
 *  Не версия: «Специальное издание» (у «Мастеров меча онлайн» — пересказ), «Special Extended Edition Scenes» (допы),
 *  «Полная инверсия» (перемонтаж «Необратимости» в прямом порядке — другой просмотр). */
const VERSION = /\s*[.:,–—-]?\s*\(?(?:(?:расширенн|режисс[её]рск|ч[её]рно-бел|цветн|полн|театральн)\p{L}*\s+версия|director'?s\s+cut|extended\s+(?:cut|edition))\)?\s*$/iu;
const stripVersion = (t: string): string | undefined => { const d = decode(t); const s = d.replace(VERSION, '').trim(); return s !== d.trim() && s ? s : undefined; };
/** «Основа: подзаголовок» / «Основа. Подзаголовок» — основа, если она от двух букв */
const head = (t: string): string | undefined => { const m = /^(.+?)\s*[:.]\s+\S/u.exec(decode(t)); return m && norm(m[1]).length >= 2 ? m[1] : undefined; };
const oneWord = (n: string) => !n.includes(' ');

// ─── справочник ───────────────────────────────────────────────────────────────
interface Card { work: WorkCard; keys: Set<string>; kp?: string }
/** ключи карточки для «уже есть у человека»: id, копии, tmdb (фильм), imdb, kp, элемент Wikidata, сериал TMDb из id */
function keysOfWork(id: string, w: { type?: string; externalIds?: WorkCard['externalIds'] } | undefined): string[] {
  const e = w?.externalIds;
  const tv = /^[a-z]-tmdbtv(\d+)$/.exec(id)?.[1];
  const q = e?.wikidata ?? (/^[fb]-wd(\d+)$/.exec(id)?.[1] ? `Q${/^[fb]-wd(\d+)$/.exec(id)![1]}` : undefined);
  return [id, canon(id), ...(tv ? [`tv:${tv}`] : []), ...(e?.tmdb != null && w?.type !== 'series' ? [`tmdb:${e.tmdb}`] : []),
    ...(e?.imdb ? [`imdb:${e.imdb}`] : []), ...(e?.kinopoisk != null ? [`kp:${e.kinopoisk}`] : []), ...(q ? [`wd:${q}`] : [])];
}
const cards: Card[] = [];
const byName = new Map<string, Set<Card>>(); // нормализованное название → карточки
const byKp = new Map<string, Card[]>();
const nameKind = new Map<Card, Map<string, 'название' | 'оригинальное' | 'синоним'>>();
for (const { work, keys } of baseWorks()) {
  if (work.type !== 'film' && work.type !== 'series') continue;
  const ids = idsOf(work);
  const full = { ...work, ...(ids ? { externalIds: ids } : {}) };
  const ks = new Set([...keysOfWork(work.id, full), ...keys, ...aliasesOf(work.id)]);
  const q = qidOfCard(work);
  if (q) ks.add(`wd:${q}`);
  const card: Card = { work: full, keys: ks, ...(ids?.kinopoisk != null ? { kp: String(ids.kinopoisk) } : {}) };
  cards.push(card);
  if (card.kp) byKp.set(card.kp, [...(byKp.get(card.kp) ?? []), card]);
  const names = new Map<string, 'название' | 'оригинальное' | 'синоним'>();
  const add = (s: string | undefined, k: 'название' | 'оригинальное' | 'синоним') => { const n = s ? norm(s) : ''; if (n && !names.has(n)) names.set(n, k); };
  add(work.title, 'название'); add(work.originalTitle, 'оригинальное');
  for (const k of keys) for (const a of altTitles[k] ?? []) add(a, 'синоним');
  nameKind.set(card, names);
  for (const n of names.keys()) { const set = byName.get(n) ?? new Set(); set.add(card); byName.set(n, set); }
}
/** две карточки — одна вещь, если делят ключ (копии в справочнике, ещё не сведённые таблицей) */
const same = (a: Card, b: Card) => a === b || [...a.keys].some((k) => !k.startsWith('kp:') && b.keys.has(k) && k !== '');
function distinct(list: Card[]): Card[] {
  const out: Card[] = [];
  for (const c of list) if (!out.some((o) => same(o, c))) out.push(c);
  return out;
}

// ─── сопоставление одной строки ───────────────────────────────────────────────
type How = 'номер Кинопоиска' | 'название' | 'оригинальное' | 'синоним' | 'версия';
type Why = 'без названия' | 'без года' | 'нет в справочнике' | 'название есть, год не сходится' | 'название и год есть, вид не сходится'
  | 'несколько карточек' | 'у карточки другой номер Кинопоиска' | 'сериал с подзаголовком (часть/спин-офф)'
  | 'фильм сходится только без подзаголовка' | 'версия: год переиздания' | 'на карточку претендуют два номера'
  | 'синоним слабый (одно слово или номер части)' | 'одно слово: год ±1, не точный';
interface Hit { card: Card; how: How }

/** кандидаты по названию n: с тем же видом и годом (±1, у одного слова — точно) */
// Синоним Wikidata слабее своего названия (пробный прогон 24.10): «Слабое звено» 2001 (русская версия шоу) ловилось на
// британское Weakest Link 2000, «Спецназ 2» 2003 и «Возвращение Мухтара 2» 2005 — на первые сезоны (синоним элемента
// сериала), «Монстр» 2026 — на «Искажённый». Поэтому у синонима — точный год, от двух слов, и числа строки есть в
// собственном названии карточки.
const digits = (s: string) => s.split(' ').filter((x) => /^\d+$/.test(x));
function byTitle(n: string, l: Line): { hit?: Card[]; why?: Why } {
  const all = [...(byName.get(n) ?? [])].filter((c) => nameKind.get(c)!.get(n) !== 'синоним'
    || (!oneWord(n) && digits(n).every((d) => digits(norm(`${c.work.title} ${c.work.originalTitle ?? ''}`)).includes(d))));
  if (!all.length) return { why: byName.has(n) ? 'синоним слабый (одно слово или номер части)' : 'нет в справочнике' };
  const tol = (c: Card) => (oneWord(n) || nameKind.get(c)!.get(n) === 'синоним' ? 0 : 1);
  const yearOk = all.filter((c) => c.work.year > 0 && Math.abs(c.work.year - l.year!) <= tol(c));
  if (!yearOk.length) return { why: oneWord(n) && all.some((c) => Math.abs(c.work.year - l.year!) === 1) ? 'одно слово: год ±1, не точный' : 'название есть, год не сходится' };
  const kindOk = distinct(yearOk.filter((c) => c.work.type === l.type));
  if (!kindOk.length) return { why: 'название и год есть, вид не сходится' };
  return { hit: kindOk };
}

function match(l: Line): Hit | Why {
  // 1. номер Кинопоиска уже приписан карточке (вид — сторожем: номер в Wikidata бывает приписан не тому элементу)
  const byNum = distinct((byKp.get(l.kp) ?? []).filter((c) => c.work.type === l.type));
  if (byNum.length === 1) return { card: byNum[0], how: 'номер Кинопоиска' };
  if (!l.title) return 'без названия';
  if (!l.year) return 'без года';
  // 2. название
  const n = norm(l.title);
  const t = byTitle(n, l);
  if (t.hit) {
    if (t.hit.length > 1) return 'несколько карточек';
    const card = t.hit[0];
    if (card.kp && card.kp !== l.kp) return 'у карточки другой номер Кинопоиска';
    return { card, how: nameKind.get(card)!.get(n)! };
  }
  // 3. версия той же вещи
  const base = stripVersion(l.title);
  if (base) {
    const v = byTitle(norm(base), l);
    if (v.hit?.length === 1) return { card: v.hit[0], how: 'версия' };
    if (v.hit) return 'несколько карточек';
    if (v.why === 'название есть, год не сходится') return 'версия: год переиздания';
    return v.why!;
  }
  // подзаголовок: только для отчёта — сериал «Основа: …» это часть или спин-офф, фильм без подзаголовка — тёзка/часть цикла
  const h = head(l.title);
  if (h && byTitle(norm(h), l).hit) return l.type === 'series' ? 'сериал с подзаголовком (часть/спин-офф)' : 'фильм сходится только без подзаголовка';
  return t.why!;
}

// ─── оценки из скачанных страниц (как в match-unmatched-wikidata) ──────────────
const kpOfSeed = new Map<string, string>();
for (const a of addressees()) if (a.kp) kpOfSeed.set(a.seed, a.kp);
if (existsSync(HELPER_DIR)) for (const kp of readdirSync(HELPER_DIR)) if (!kpOfSeed.has(kpSeed(kp))) kpOfSeed.set(kpSeed(kp), kp);
/** kp → оценка 1–10 из страниц профиля; страниц нет — undefined */
function ratingsOf(seed: string): Map<string, number> | undefined {
  const kp = kpOfSeed.get(seed);
  if (!kp) return undefined;
  const dirs = [join(HELPER_DIR, kp), join(dirname(HELPER_DIR), kp)].filter((d) => existsSync(d) && statSync(d).isDirectory());
  const pages: Page[] = [];
  for (const d of dirs) for (const f of readdirSync(d).filter((x) => /\.(html?|csv|txt)$/i.test(x)).sort()) {
    for (const part of splitBundle(f, readFileSync(join(d, f), 'utf8'))) { const p = readPage(part.name, part.text); if (p) pages.push(p); }
  }
  if (!pages.length) return undefined;
  const out = new Map<string, number>();
  for (const r of mergeRecords(pages)) if (r.externalIds?.kinopoisk != null && r.rating != null && r.rating > 0) out.set(String(r.externalIds.kinopoisk), r.rating);
  return out;
}

// ─── проход ───────────────────────────────────────────────────────────────────
const lines = new Map<string, Line[]>(); // файл → строки
for (const f of seedFiles()) {
  const s = JSON.parse(readFileSync(join(SEEDS, f), 'utf8')) as Seed;
  const ls = (s.unmatchedKinopoisk ?? []).map(parseLine).filter((x): x is Line => Boolean(x));
  if (ls.length) lines.set(f, ls);
}
const firstLine = new Map<string, Line>();
for (const l of [...lines.values()].flat()) if (!firstLine.has(l.kp)) firstLine.set(l.kp, l);
const allKp = [...firstLine.keys()];
console.error(`карточек справочника (фильмы и сериалы) ${cards.length}; историй с неопознанным ${lines.size}, номеров ${allKp.length}`);

const result = new Map<string, Hit | Why>();
for (const [kp, l] of firstLine) result.set(kp, match(l));
// на одну карточку — два разных номера не-версий (у Кинопоиска бывают дубли, но чаще это тёзки): оба мимо
const claim = new Map<Card, string[]>();
for (const [kp, r] of result) if (typeof r === 'object' && r.how !== 'версия') claim.set(r.card, [...(claim.get(r.card) ?? []), kp]);
for (const kps of claim.values()) if (kps.length > 1) for (const kp of kps) result.set(kp, 'на карточку претендуют два номера');

if (APPLY && !existsSync(BACKUP)) { cpSync(SEEDS, BACKUP, { recursive: true }); console.error(`копия seeds/ → ${BACKUP}/`); }

const stat = { files: 0, changed: 0, written: 0, watchedAdded: 0, ratingsAdded: 0, linesMatched: 0, dupes: 0, noPages: 0 };
const deferred: string[] = [];
/** по номеру: людей добавлено / уже было / оценок */
const perKp = new Map<string, { added: number; had: number; rated: number }>();

function processSeed(f: string, force = false): 'done' | 'fresh' {
  const path = join(SEEDS, f);
  const before = statSync(path).mtimeMs;
  // счёт — свой, в общий только по завершении: отложенную историю посчитаем при повторе
  const st = Object.fromEntries(Object.keys(stat).map((k) => [k, 0])) as typeof stat;
  const per: [string, keyof NonNullable<ReturnType<typeof perKp.get>>][] = [];
  const commit = () => {
    for (const k of Object.keys(st) as (keyof typeof stat)[]) stat[k] += st[k];
    for (const [kp, k] of per) { const e = perKp.get(kp) ?? { added: 0, had: 0, rated: 0 }; e[k]++; perKp.set(kp, e); }
    return 'done' as const;
  };
  if (!force && Date.now() - before < FRESH_MS) return 'fresh';
  const s = JSON.parse(readFileSync(path, 'utf8')) as Seed;
  const ls = (s.unmatchedKinopoisk ?? []).map(parseLine).filter((x): x is Line => Boolean(x));
  // точные совпадения раньше версий: основная карточка у человека — из строки самой вещи, версия только снимается
  const hits = ls.filter((l) => typeof result.get(l.kp) === 'object')
    .sort((a, b) => Number((result.get(a.kp) as Hit).how === 'версия') - Number((result.get(b.kp) as Hit).how === 'версия'));
  st.files++;
  if (!hits.length) return commit();
  st.changed++;
  const rated = ratingsOf(f.replace(/\.json$/, ''));
  if (!rated) st.noPages++;
  // что у человека уже есть — под любым ключом и копией
  const have = new Set<string>();
  for (const e of [...s.watched, ...(s.ratings ?? [])]) for (const k of keysOfWork(e.workId, e.work as WorkCard | undefined)) have.add(k);
  for (const e of s.watched) { if (e.tmdb != null) have.add(`tmdb:${e.tmdb}`); if (e.imdb) have.add(`imdb:${e.imdb}`); }
  const haveR = new Set((s.ratings ?? []).map((r) => canon(r.workId)));
  const drop = new Set<string>();
  for (const l of hits) {
    const { card, how } = result.get(l.kp) as Hit;
    drop.add(l.raw);
    st.linesMatched++;
    if ([...card.keys].some((k) => have.has(k))) { st.dupes++; per.push([l.kp, 'had']); continue; } // уже есть — строка просто опознана
    for (const k of card.keys) have.add(k);
    const ids = card.work.externalIds ?? {};
    // номер Кинопоиска — карточке строки самой вещи; у версии он свой, основной не приписываем
    const work: WorkCard = how === 'версия' || ids.kinopoisk != null ? card.work : { ...card.work, externalIds: { ...ids, kinopoisk: Number(l.kp) } };
    s.watched.push({
      workId: work.id, work, from: 'kinopoisk',
      ...(work.type !== 'series' && ids.tmdb != null ? { tmdb: ids.tmdb } : {}),
      ...(ids.imdb ? { imdb: ids.imdb } : {}),
    });
    st.watchedAdded++;
    per.push([l.kp, 'added']);
    const raw = rated?.get(l.kp);
    if (raw != null && !haveR.has(work.id)) {
      (s.ratings ??= []).push({ workId: work.id, rating: Math.min(5, Math.max(1, Math.round(raw / 2))), raw, work });
      haveR.add(work.id);
      st.ratingsAdded++;
      per.push([l.kp, 'rated']);
    }
  }
  s.unmatchedKinopoisk = (s.unmatchedKinopoisk ?? []).filter((u) => !drop.has(u));
  // версия — как у buildSeed: хэш просмотренного и оценок
  s.version = createHash('sha1').update(JSON.stringify({ watched: s.watched, ratings: s.ratings ?? [] })).digest('hex').slice(0, 12);
  if (APPLY) {
    if (statSync(path).mtimeMs !== before) return 'fresh'; // пока читали — переписали
    writeFileSync(`${path}.tmp`, JSON.stringify(s, null, 2));
    renameSync(`${path}.tmp`, path);
    st.written++;
  }
  return commit();
}

for (const f of lines.keys()) if (processSeed(f) === 'fresh') deferred.push(f);
// отложенные — когда автоимпорт их допишет и они «остынут» (ждём до 6 минут)
for (let t = 0; deferred.length && t < 24; t++) {
  console.error(`отложено ${deferred.length} (пишутся сейчас): ${deferred.join(', ')} — жду 15 с`);
  await new Promise((r) => setTimeout(r, 15e3));
  for (const f of [...deferred]) if (processSeed(f) === 'done') deferred.splice(deferred.indexOf(f), 1);
}

// ─── итоги ────────────────────────────────────────────────────────────────────
const people = new Map<string, number>(); // номер → в скольких историях
for (const ls of lines.values()) for (const kp of new Set(ls.map((l) => l.kp))) people.set(kp, (people.get(kp) ?? 0) + 1);
const matched = allKp.filter((k) => typeof result.get(k) === 'object');
const howCount: Record<string, number> = {};
for (const k of matched) { const h = (result.get(k) as Hit).how; howCount[h] = (howCount[h] ?? 0) + 1; }
const why: Record<string, number> = {};
for (const k of allKp) { const r = result.get(k); if (typeof r === 'string') why[r] = (why[r] ?? 0) + 1; }
const series = matched.filter((k) => (result.get(k) as Hit).card.work.type === 'series').length;
const linesTotal = [...lines.values()].flat().length;
const cell = (s: string) => s.replace(/\|/g, '\\|');
const row = (k: string) => {
  const l = firstLine.get(k)!, r = result.get(k)!;
  if (typeof r === 'string') return `| ${people.get(k)} | ${cell(l.title)} | ${l.year ?? ''} | ${l.type} | ${k} | ${r} |`;
  const w = r.card.work, p = perKp.get(k) ?? { added: 0, had: 0, rated: 0 };
  return `| ${people.get(k)} | ${cell(l.title)} | ${l.year ?? ''} | ${l.type} | ${k} | ${r.how} | ${cell(w.title)}${w.originalTitle && w.originalTitle !== w.title ? ` / ${cell(w.originalTitle)}` : ''} | ${w.year} | ${w.id} | +${p.added} / было ${p.had} / оценок +${p.rated} |`;
};
const byPeople = (a: string, b: string) => (people.get(b)! - people.get(a)!) || a.localeCompare(b);
// для проверки глазами: по одной-две с каждой ступени, остальное — по числу людей
const sample: string[] = [];
for (const h of ['версия', 'синоним', 'оригинальное', 'номер Кинопоиска', 'название'] as How[]) {
  const of = matched.filter((k) => (result.get(k) as Hit).how === h).sort(byPeople);
  sample.push(...of.slice(0, h === 'название' ? 15 : 2));
}
const sample15 = [...new Set(sample)].slice(0, 15);

const out = [
  `# Неопознанное Кинопоиска → свой справочник по названию (${new Date().toISOString().slice(0, 16)}, ${APPLY ? '--apply' : 'пробный прогон'})`, '',
  `- справочник: ${cards.length} карточек фильмов и сериалов (tools/base-have.mts, без лишних копий и убранного)`,
  `- историй с неопознанным: ${lines.size}; строк: ${linesTotal}; номеров Кинопоиска: ${allKp.length}`,
  `- опознано: ${matched.length} номеров (фильмов ${matched.length - series}, сериалов ${series}); строк ${stat.linesMatched}; ступени: ${Object.entries(howCount).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  `- в истории: просмотренного +${stat.watchedAdded} (уже было под другим ключом или копией ${stat.dupes}), оценок +${stat.ratingsAdded}; историй с опознанным ${stat.changed}${APPLY ? `, записано ${stat.written}` : ''}; из них без скачанных страниц (оценок не взять) ${stat.noPages}`,
  `- осталось неопознанным: ${allKp.length - matched.length} номеров, ${linesTotal - stat.linesMatched} строк; почему: ${Object.entries(why).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')}`,
  ...(deferred.length ? [`- НЕ обработаны (так и пишутся): ${deferred.join(', ')}`] : []),
  '', '## 15 примеров опознанного для проверки глазами', '',
  '| людей | строка Кинопоиска | год | вид | номер | как | карточка | год | id | людям |', '|---|---|---|---|---|---|---|---|---|---|',
  ...sample15.map(row),
  '', '## Топ-30 опознанного по числу людей', '',
  '| людей | строка Кинопоиска | год | вид | номер | как | карточка | год | id | людям |', '|---|---|---|---|---|---|---|---|---|---|',
  ...matched.sort(byPeople).slice(0, 30).map(row),
  '', '## Топ-30 отвергнутого (название в справочнике есть, сторож не пустил)', '',
  '| людей | название | год | вид | номер | почему |', '|---|---|---|---|---|---|',
  ...allKp.filter((k) => { const r = result.get(k); return typeof r === 'string' && r !== 'нет в справочнике' && r !== 'без года' && r !== 'без названия'; })
    .sort(byPeople).slice(0, 30).map(row),
  '', '## Топ-20 того, чего в справочнике нет', '',
  '| людей | название | год | вид | номер | почему |', '|---|---|---|---|---|---|',
  ...allKp.filter((k) => result.get(k) === 'нет в справочнике').sort(byPeople).slice(0, 20).map(row),
].join('\n');
writeFileSync(`${DIR}/report-local${APPLY ? '-apply' : ''}.md`, out + '\n');
console.log(out);
