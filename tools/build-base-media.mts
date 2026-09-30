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
import { existsSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { analysisKey } from './works-index.mts';
import { pick, tagSource } from './register-tags.mts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import { filmBaseWiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import type { WorkCard } from '../src/types/tmdf.ts';

loadEnvFile();
const key = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;
if (!key) { console.error('нужен TMDB_API_KEY (или VITE_TMDB_API_KEY) в .env.local'); process.exit(1); }
const ALL = process.argv.includes('--all');
const DRY = process.argv.includes('--dry');

const file = new URL('../src/mocks/baseMedia.ts', import.meta.url);
const before: Record<string, Partial<WorkCard>> = existsSync(file)
  ? (await import('../src/mocks/baseMedia.ts')).baseMedia : {};
const client = tmdbFromEnv(key)!;
const { tags, save } = tagSource(key, '.cache/tmdb-tags.json');

const targets = [...filmBaseWiki, ...filmBaseMarkup].filter((w) => {
  const k = analysisKey(w);
  if (!k?.startsWith('tmdb:') || w.format === 'series') return false;
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
writeFileSync(file, `// Сгенерировано tools/build-base-media.mts (${new Date().toISOString().slice(0, 10)}): обложки, кадры, описание и
// регистр для карточек справочника из Wikidata, у которых их не было. Данные TMDb. Дополняется,
// не затирается. Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const baseMedia: Record<string, Partial<WorkCard>> = ${JSON.stringify(out, null, 1)};
`);
console.error(`→ src/mocks/baseMedia.ts: ${Object.keys(out).length} карточек`);
