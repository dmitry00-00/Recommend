// Tag Genome 2021 по нашим фильмам: 1084 тега с непрерывной степенью применимости.
//   npx tsx tools/build-taggenome.mts [--fetch]
// Зачем: у тропов теги дискретные и разреженные (15 тысяч, половина по одному разу), а здесь
// компактный словарь, где у каждого фильма есть значение по каждому тегу. Это ближе к тому,
// что нам нужно от разметки: не «встречается ли приём», а «насколько это про него».
// Лицензия — CC BY-NC 3.0 (Kotkov et al. 2021; Vig et al. 2012): указание авторства
// обязательно, коммерческое использование — нет. Сырые файлы лежат в .cache (не в репозитории).
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { zipIndex, zipSave } from './remote-zip.mts';
import { worksIndex } from './works-index.mts';

const ARCHIVE = 'https://files.grouplens.org/datasets/tag-genome-2021/genome_2021.zip';
const dir = new URL('../.cache/taggenome/', import.meta.url);
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

if (process.argv.includes('--fetch')) {
  // из архива на 1.8 ГБ нужны три файла — берём их Range-запросами
  const idx = await zipIndex(ARCHIVE);
  for (const name of ['raw/metadata.json', 'raw/tags.json', 'scores/tagdl.csv']) {
    const entry = idx.find((e) => e.name.endsWith(name));
    if (!entry) throw new Error(`нет в архиве: ${name}`);
    await zipSave(entry, ARCHIVE, new URL(name.split('/').pop()!, dir));
    console.log(`взято ${name}: ${(entry.size / 1e6).toFixed(1)} МБ`);
  }
}

const imdbByTmdb: Record<string, string | null> = JSON.parse(readFileSync(new URL('../.cache/imdb-by-tmdb.json', import.meta.url), 'utf8'));
const ours = new Map<string, { key: string; title: string; year: number }>();
for (const { key, work } of worksIndex()) {
  if (work.type !== 'film') continue;
  const imdb = work.externalIds?.imdb ?? (work.externalIds?.tmdb != null ? imdbByTmdb[String(work.externalIds.tmdb)] : null);
  if (imdb && !ours.has(imdb)) ours.set(imdb, { key, title: work.title, year: work.year });
}

// metadata.json: imdbId без «tt» и с ведущими нулями — приводим к нашему виду
const itemByImdb = new Map<string, number>();
for (const line of readFileSync(new URL('metadata.json', dir), 'utf8').split('\n')) {
  if (!line) continue;
  const m = /"imdbId":\s*"(\d+)".*?"item_id":\s*(\d+)/.exec(line);
  if (m) itemByImdb.set(`tt${m[1].padStart(7, '0')}`, Number(m[2]));
}
const wanted = new Map<number, string>();
for (const [imdb] of ours) {
  const item = itemByImdb.get(imdb);
  if (item != null) wanted.set(item, imdb);
}
console.log(`наших фильмов: ${ours.size} | есть в MovieLens: ${wanted.size} (${Math.round((100 * wanted.size) / ours.size)}%)`);

// tagdl.csv: 10.5 млн строк «тег, фильм, значение» — читаем потоком, держим только своё
const scores = new Map<string, Map<string, number>>();
const tagSeen = new Set<string>();
let rows = 0;
const rl = createInterface({ input: createReadStream(new URL('tagdl.csv', dir)), crlfDelay: Infinity });
for await (const line of rl) {
  if (!line || line.startsWith('tag,')) continue;
  rows++;
  const second = line.lastIndexOf(',', line.lastIndexOf(',') - 1);
  const tag = line.slice(0, second);
  const rest = line.slice(second + 1);
  const comma = rest.indexOf(',');
  const item = Number(rest.slice(0, comma));
  tagSeen.add(tag);
  const imdb = wanted.get(item);
  if (!imdb) continue;
  const got = scores.get(imdb) ?? new Map<string, number>();
  got.set(tag, Number(rest.slice(comma + 1)));
  scores.set(imdb, got);
}
const tags = [...tagSeen].sort();
console.log(`строк в таблице: ${rows} | тегов: ${tags.length} | наших фильмов со значениями: ${scores.size} (${Math.round((100 * scores.size) / ours.size)}% от всех наших)`);

const films: Record<string, { key: string; title: string; year: number; scores: number[] }> = {};
for (const [imdb, got] of scores) {
  const meta = ours.get(imdb)!;
  films[imdb] = { ...meta, scores: tags.map((t) => Number((got.get(t) ?? 0).toFixed(4))) };
}
writeFileSync(new URL('../.cache/taggenome.json', import.meta.url), JSON.stringify({ tags, films }));
console.log('→ .cache/taggenome.json:', Object.keys(films).length, 'фильмов ×', tags.length, 'тегов');
