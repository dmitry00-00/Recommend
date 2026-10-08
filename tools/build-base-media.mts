// Картинки, описание и регистр для карточек справочника, которые пришли без них (30.09).
//   npx tsx tools/build-base-media.mts [--all] [--dry]     — ключ TMDb из .env.local
// Карточки из Wikidata (`filmBaseWiki`, `filmBaseMarkup`) — это название, год и режиссёр: ни
// обложки, ни кадра, ни регистра. Пока они жили в поиске и справочнике таблицы, этого хватало;
// в колоде /rate и в ленте (трек Г2) такая карточка — пустая плитка, а подбор не знает её
// регистра. По умолчанию — только фильмы с черновой разметкой (кандидаты в колоду и подбор),
// `--all` — все карточки без обложки.
// Выход — src/mocks/baseMedia.ts: id карточки → обложка, кадр, описание, страны, длительность,
// регистр (tools/register-tags.mts, теми же жанрами и ключевыми словами TMDb, что у всех).
// Дополняется, не затирается. Приложение накладывает его на справочник при загрузке.
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { analysisKey } from './works-index.mts';
import { pick, tagSource } from './register-tags.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import { isSeries } from '../src/lib/media.ts';

loadEnvFile();
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');

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

const targets = [...filmBaseWiki, ...filmBaseMarkup, ...filmBasePopular, ...filmBaseWorld].filter((w) => {
  const k = analysisKey(w);
  if (!k?.startsWith('tmdb:') || isSeries(w)) return false;
  if (before[w.id]?.coverUrl && before[w.id]?.registers) return false;
  if (w.coverUrl && w.registers?.length) return false;
  return ALL || Boolean(draftAnnotations[k]);
});
console.error(`карточек без обложки или регистра: ${targets.length}${ALL ? '' : ' (с черновой разметкой; все — --all)'}`);

const out: Record<string, Partial<WorkCard>> = { ...before };
let covers = 0;
let n = 0;
for (const w of targets) {
  const id = w.externalIds!.tmdb!;
  const m = w.coverUrl ? undefined : await client.movie(id).catch(() => undefined);
  const t = await tags(id).catch(() => ({ genres: [], keywords: [] }));
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
