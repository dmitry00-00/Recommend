// Картинки, описание и регистр для карточек справочника, которые пришли без них (30.09).
//   npx tsx tools/build-base-media.mts [--all] [--dry]     — ключ TMDb из .env.local
// Карточки из Wikidata (`filmBaseWiki`, `filmBaseMarkup`) — это название, год и режиссёр: ни
// обложки, ни кадра, ни регистра. Пока они жили в поиске и справочнике таблицы, этого хватало;
// в колоде /rate и в ленте (трек Г2) такая карточка — пустая плитка, а подбор не знает её
// регистра. По умолчанию — только фильмы с черновой разметкой (кандидаты в колоду и подбор),
// `--all` — все карточки без обложки.
//   --deck — только колода первых оценок /rate (ratingDeck, ratingDeckEn; ТВ-10, 14.10): её карточки из справочника самых
//   смотримых (`filmBase`) тоже без кадра, а колода картинок с сети не дозапрашивает. Регистр таким не пишем, если он
//   есть в workRegisters: иначе запись отсюда перебила бы его (`withRegisters` берёт свой регистр карточки первым).
// Осторожно с размером: baseMedia.ts — в первой загрузке (tools/load-budget.mjs). Черновиков на 14.10 ~12 тыс., без
// кадра из них ~8,4 тыс. фильмов — прогон без --deck добавит их все, ~0,4 МБ сжатыми, и сборка упрётся в бюджет.
// Выход — src/mocks/baseMedia.ts: id карточки → обложка, кадр, описание, страны, длительность,
// регистр (tools/register-tags.mts, теми же жанрами и ключевыми словами TMDb, что у всех).
// Дополняется, не затирается. Приложение накладывает его на справочник при загрузке.
// Фильм без TMDb (ключ `wd:Q…`, 18.10) — постер из Wikimedia Commons (P18 элемента), прямым адресом upload.wikimedia.org.
// Ленивые модули справочника (filmBaseLinks, filmBaseTail, filmBaseMore — не в первой загрузке): их фильмам без TMDb постер
// Commons ищется всегда (другого источника картинки у них нет: TMDb о них не знает), а пишется в src/mocks/baseMediaLate.ts —
// тоже ленивый, иначе первая загрузка выросла бы на их постеры (18.10). Фильмам с TMDb из ленивых модулей картинку, как и
// прежде, приносит приложение при показе (src/lib/resolve withImages).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { analysisKey } from './works-index.mts';
import { commonsImage, FREE_IMAGE, wd } from './wikidata-lib.mts';
import { pick, tagSource } from './register-tags.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { filmBaseLinks } from '../src/mocks/filmBaseLinks.ts';
import { filmBaseTail } from '../src/mocks/filmBaseTail.ts';
import { filmBaseMore } from '../src/mocks/filmBaseMore.ts';
import { baseMediaLate } from '../src/mocks/baseMediaLate.ts';
import { draftAnnotations } from './draft-annotations.mts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';
import { BLURB_SHARDS, shardOf } from '../src/lib/shard.ts';
import { filmBase } from '../src/mocks/filmBase.ts';
import { ratingDeck } from '../src/mocks/ratingDeck.ts';
import { ratingDeckEn } from '../src/mocks/ratingDeckEn.ts';
import { workRegisters } from '../src/mocks/workRegisters.ts';

loadEnvFile();
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');
const DECK = process.argv.includes('--deck');
const inDeck = new Set([...ratingDeck, ...ratingDeckEn]);

const file = new URL('../src/mocks/baseMedia.ts', import.meta.url);
// описание — отдельным файлом (07.10): оно нужно только в раскрытой карточке, а с ним справочник обложек весил
// 3,6 МБ при каждом старте приложения; приложение подгружает его, когда открывают «Сюжет»
// и разложено на 16 долей по id (src/lib/shard.ts): «Сюжет» подгружает одну, около 60 КБ
const blurbDir = new URL('../src/mocks/baseBlurbs/', import.meta.url);
const blurbsBefore: Record<string, string> = {};
for (let i = 0; i < BLURB_SHARDS; i++) {
  const f = new URL(`${String(i).padStart(2, '0')}.ts`, blurbDir);
  if (existsSync(f)) Object.assign(blurbsBefore, (await import(f.href)).blurbs);
}
const before: Record<string, Partial<WorkCard>> = existsSync(file)
  ? Object.fromEntries(Object.entries((await import('../src/mocks/baseMedia.ts')).baseMedia).map(([id, m]) => [id, { ...m, ...(blurbsBefore[id] ? { blurb: blurbsBefore[id] } : {}) }])) : {};
const client = tmdbFromEnv(key)!;
const { tags, save } = tagSource(key, '.cache/tmdb-tags.json');

// справочник самых смотримых (`filmBase`, ТВ-10) — последним: его карточки приложение тоже накладывает на baseMedia
const targets = [...filmBaseWiki, ...filmBaseMarkup, ...filmBasePopular, ...filmBaseWorld, ...filmBaseChannels, ...filmBase].filter((w) => {
  const k = analysisKey(w);
  if (!k?.startsWith('tmdb:') || isSeries(w)) return false;
  if (DECK) return inDeck.has(w.id) && !w.coverUrl && !before[w.id]?.coverUrl;
  if (before[w.id]?.coverUrl && before[w.id]?.registers) return false;
  if (w.coverUrl && w.registers?.length) return false;
  return ALL || Boolean(draftAnnotations[k]);
});
console.error(`карточек без обложки или регистра: ${targets.length}${DECK ? ' (колода /rate)' : ALL ? '' : ' (с черновой разметкой; все — --all)'}`);

const out: Record<string, Partial<WorkCard>> = { ...before };
let covers = 0;
let n = 0;
for (const w of targets) {
  const id = w.externalIds!.tmdb!;
  const m = w.coverUrl ? undefined : await client.movie(id).catch(() => undefined);
  // свой регистр карточки (workRegisters) главнее — его не перебиваем и за ключевыми словами не ходим
  const own = Boolean(workRegisters[w.id]?.length);
  const t = own ? { genres: [], keywords: [] } : await tags(id).catch(() => ({ genres: [], keywords: [] }));
  const registers = pick(t.genres, t.keywords);
  out[w.id] = {
    ...out[w.id],
    ...(m?.coverUrl ? { coverUrl: m.coverUrl, stillUrl: m.stillUrl, imageSource: m.imageSource } : {}),
    ...(m?.blurb ? { blurb: m.blurb } : {}),
    ...(m?.countries?.length ? { countries: m.countries } : {}),
    ...(!w.durationMinutes && m?.durationMinutes ? { durationMinutes: m.durationMinutes } : {}),
    ...(registers.length ? { registers } : {}),
  };
  if (m?.coverUrl) covers += 1;
  n += 1;
  if (n % 50 === 0) console.error(`  ${n}/${targets.length}`);
}
// фильм без TMDb (ключ `wd:Q…`, решение владельца 17.10; 18.10): постер — изображение элемента (P18) из Wikimedia Commons,
// прямым адресом upload.wikimedia.org и только свободное (общественное достояние, CC0); описания, стран и регистра у него
// отсюда нет — TMDb о нём не знает. Кэш ответов — .cache/commons-posters.json (пустая запись — файла нет или лицензия не та)
const wdTargets = [...filmBaseWiki, ...filmBaseMarkup, ...filmBasePopular, ...filmBaseWorld, ...filmBaseChannels, ...filmBase].filter((w) => {
  const k = analysisKey(w);
  if (!k?.startsWith('wd:') || isSeries(w) || w.type !== 'film' || w.coverUrl || before[w.id]?.coverUrl) return false;
  return DECK ? inDeck.has(w.id) : ALL || Boolean(draftAnnotations[k]);
});
const lateBefore: Record<string, Partial<WorkCard>> = { ...baseMediaLate };
const firstIds = new Set(wdTargets.map((w) => w.id));
const lateTargets = DECK ? [] : [...filmBaseLinks, ...filmBaseTail, ...filmBaseMore].filter((w) => {
  const k = analysisKey(w);
  return k?.startsWith('wd:') && !isSeries(w) && w.type === 'film' && !w.coverUrl && !before[w.id]?.coverUrl && !firstIds.has(w.id);
});
const late: Record<string, Partial<WorkCard>> = { ...lateBefore };
if (wdTargets.length || lateTargets.length) {
  const POSTERS = '.cache/commons-posters.json';
  const cache: Record<string, { file?: string; url?: string; license?: string }> = existsSync(POSTERS) ? JSON.parse(readFileSync(POSTERS, 'utf8')) : {};
  let wdCovers = 0;
  const asked = [...wdTargets, ...lateTargets];
  for (let i = 0; i < asked.length; i += 50) {
    const part = asked.slice(i, i + 50).filter((w) => !cache[analysisKey(w)!]);
    const qids = part.map((w) => analysisKey(w)!.slice(3));
    const ents = qids.length ? (await wd<{ entities?: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }> }>(
      { action: 'wbgetentities', ids: qids.join('|'), props: 'claims' }).catch(() => ({ entities: undefined }))).entities : undefined;
    for (const w of part) {
      const k = analysisKey(w)!;
      const f = ents?.[k.slice(3)]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
      if (!ents) continue;
      if (!f) { cache[k] = {}; continue; }
      try { cache[k] = { file: f, ...await commonsImage(f, 500) }; } catch (e) { console.error(`  commons ${f}: ${(e as Error).message}`); }
      await new Promise((r) => setTimeout(r, 1000));
    }
    // ответы не теряются, если прогон снимут: кэш — каждые 500 элементов
    if (!DRY && i % 500 === 450) writeFileSync(POSTERS, JSON.stringify(cache));
    if (i % 500 === 450) console.error(`  commons: ${i + 50}/${asked.length}`);
  }
  let lateCovers = 0;
  for (const w of lateTargets) {
    const c = cache[analysisKey(w)!];
    if (!c?.url || !FREE_IMAGE.test(c.license ?? '')) continue;
    late[w.id] = { coverUrl: c.url, imageSource: 'wikimedia_commons' };
    lateCovers += 1;
  }
  if (lateTargets.length) console.error(`ленивые модули, фильмы без TMDb: ${lateTargets.length}, постер из Commons у ${lateCovers} → baseMediaLate.ts`);
  for (const w of wdTargets) {
    const c = cache[analysisKey(w)!];
    if (!c?.url || !FREE_IMAGE.test(c.license ?? '')) continue;
    out[w.id] = { ...out[w.id], coverUrl: c.url, imageSource: 'wikimedia_commons' };
    wdCovers += 1;
  }
  if (!DRY) writeFileSync(POSTERS, JSON.stringify(cache));
  console.error(`фильмы без TMDb: ${wdTargets.length}, постер из Commons у ${wdCovers}`);
}
if (!DRY) writeFileSync(new URL('../src/mocks/baseMediaLate.ts', import.meta.url), `// Сгенерировано tools/build-base-media.mts (${new Date().toISOString().slice(0, 10)}): постеры ленивых карточек справочника (filmBaseLinks, filmBaseTail,
// filmBaseMore) без TMDb — изображение элемента Wikidata (P18) из Wikimedia Commons, только свободное. Не в первой загрузке:
// грузится со справочником этих карточек (src/api/index.ts, loadFilmLinks). Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const baseMediaLate: Record<string, Partial<WorkCard>> = ${JSON.stringify(late, null, 1)};
`);
save();
console.error(`обложек ${covers}, с регистром ${targets.filter((w) => out[w.id]?.registers?.length).length} из ${targets.length}`);
if (DRY) process.exit(0);
const shards: Record<string, Record<string, string>> = {};
for (const [id, m] of Object.entries(out)) if (m.blurb) (shards[shardOf(id)] ??= {})[id] = m.blurb;
for (const m of Object.values(out)) delete m.blurb;
mkdirSync(blurbDir, { recursive: true });
for (let i = 0; i < BLURB_SHARDS; i++) {
  const n = String(i).padStart(2, '0');
  writeFileSync(new URL(`${n}.ts`, blurbDir), `// Сгенерировано tools/build-base-media.mts: описания карточек справочника (TMDb), доля ${n} из ${BLURB_SHARDS} по id
// (src/lib/shard.ts) — подгружается, когда раскрывают «Сюжет» (src/api, getPlot). Не править руками.
export const blurbs: Record<string, string> = ${JSON.stringify(shards[n] ?? {}, null, 1)};
`);
}
writeFileSync(file, `// Сгенерировано tools/build-base-media.mts (${new Date().toISOString().slice(0, 10)}): обложки, кадры, описание и
// регистр для карточек справочника из Wikidata, у которых их не было. Данные TMDb. Дополняется,
// не затирается. Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const baseMedia: Record<string, Partial<WorkCard>> = ${JSON.stringify(out, null, 1)};
`);
console.error(`→ src/mocks/baseMedia.ts: ${Object.keys(out).length} карточек`);
