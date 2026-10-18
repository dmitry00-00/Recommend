// Публикация индексов на сервер (трек В1): приложение берёт свежие разборы оттуда, а не из
// сборки, — обновление данных больше не требует перезаливки архива.
//   npx tsx tools/publish-reference.mts            — всё, что умеем публиковать
//   npx tsx tools/publish-reference.mts --dry      — только посчитать, ничего не отправлять
//   npx tsx tools/publish-reference.mts --out <папка> — записать файлами в папку (DATA_DIR/reference локального сервера),
//     без сети и токена (18.10, аудит скорости, волна 3А: стенд замеров не должен знать адрес боевого)
// Куда и чем: TM_SERVER (по умолчанию https://bot-1791394986-4062-dmitriy-00.bothost.tech) и TM_ADMIN_TOKEN — тот же
// токен, что в переменной ADMIN_TOKEN у бота на bothost. Оба — в .env.local.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { WatchProviders } from '../src/lib/cinemas.ts';
import type { TrailersFile } from '../worker/trailers.ts';
import { loadEnvFile } from './env-file.mts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { essayLenses } from '../src/mocks/essayLenses.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';
import { filmBaseWiki as wiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';
import { filmBaseChannels } from '../src/mocks/filmBaseChannels.ts';
import { isWithheld } from '../src/mocks/withheldWorks.ts';
import { essays as curatedEssays } from '../src/mocks/essays.ts';
import { externalAnalyses as detailAnalyses } from '../src/mocks/index.ts';
import { analysisShardName, buildEssayIndex } from '../src/lib/essayIndex.ts';

// вписанное людьми в таблицу разметки едет на сервер тем же справочником: клиенту всё равно,
// откуда карточка — из каналов или из таблицы; и то, что люди ищут (топы Википедии, 05.10) —
// так новые фильмы находятся поиском сразу после публикации, без пересборки приложения
// и фильмы из загрузок каналов студий и агрегаторов (tools/grow-from-channels.mts, 10.10)
// убранное владельцем (withheldWorks.ts) на сервер не едет
const filmBaseWiki = [...wiki, ...filmBaseMarkup, ...filmBasePopular, ...filmBaseWorld, ...filmBaseChannels].filter((w) => !isWithheld(w));
import { comentions } from '../src/mocks/comentions.ts';
import { buildInlineIndex } from './inline-index.mts';
import { buildHeroesIndex } from './heroes-index.mts';
import { buildPublicPages } from './public-pages.mts';

loadEnvFile();
const dry = process.argv.includes('--dry');
const outArg = process.argv.find((a, i, all) => all[i - 1] === '--out');
// стоп публикации (18.10): пока справочник пишется по частям, на боевой сервер уезжать нечему — `.cache/publish.hold`
// (в файле — причина); снять — удалить файл. --dry работает и при стопе
// --only a,b (18.10) — только названные справочники, например трейлеры после выкладки, пока справочник фильмов
// под стопом: явный выбор, стоп для них не действует
const onlyArg = process.argv.find((a, i, all) => all[i - 1] === '--only');
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim()).filter(Boolean)) : undefined;
if (!dry && !only && !outArg && existsSync('.cache/publish.hold')) {
  console.error(`публикация остановлена: ${readFileSync('.cache/publish.hold', 'utf8').trim() || '.cache/publish.hold'}`);
  process.exit(0);
}
// контур Global (ЗП-26): `--global` — тот же набор на Cloudflare (TM_GLOBAL_SERVER, TM_GLOBAL_ADMIN_TOKEN); «где
// смотреть» — регионы TM_GLOBAL_REGIONS (по умолчанию IN, US, GB), бесплатная классика не едет: её ролики проверены
// на доступность из России
const global = process.argv.includes('--global');
const server = (global ? process.env.TM_GLOBAL_SERVER ?? '' : process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = global ? process.env.TM_GLOBAL_ADMIN_TOKEN : process.env.TM_ADMIN_TOKEN;
if (global && !server) { console.error('нет TM_GLOBAL_SERVER в .env.local — куда публиковать Global'); process.exit(1); }
if (!dry && !outArg && !token) { console.error(`нет ${global ? 'TM_GLOBAL_ADMIN_TOKEN' : 'TM_ADMIN_TOKEN'} в .env.local — публиковать нечем`); process.exit(1); }
const globalRegions = (): string[] => (process.env.TM_GLOBAL_REGIONS ?? 'IN,US,GB').split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
// общий сервер (11.10, bothost в Нидерландах, все языки) — все регионы справочника (TM_WATCH_REGIONS, по умолчанию RU, IN,
// US, GB); Global — свои
const regions = global ? globalRegions() : (process.env.TM_WATCH_REGIONS ?? 'RU,IN,US,GB').split(',').map((r) => r.trim().toUpperCase()).filter(Boolean);
/** «где смотреть» только своих регионов. У иностранных — без аренды и покупки: в Индии, США и Британии их у каждого
 *  второго фильма с десяток (Amazon, Apple, Google, YouTube…), и справочник вырастал в восемь раз; подбор и «Мои
 *  подписки» смотрят на подписку и бесплатное, а остальное — по ссылке «где смотреть» */
const ownRegions = (w: WatchProviders): WatchProviders => {
  const works: WatchProviders['works'] = {};
  for (const [k, byRegion] of Object.entries(w.works)) {
    const own = Object.fromEntries(Object.entries(byRegion).filter(([r]) => regions.includes(r))
      // ссылку у фильма приложение собирает само (themoviedb.org/movie/<id>/watch), у сериала номера /tv/ у него нет
      .map(([r, x]) => [r, r === 'RU' ? x : { ...(x.l && !k.startsWith('tmdb:') ? { l: x.l } : {}), ...(x.s ? { s: x.s } : {}), ...(x.f ? { f: x.f } : {}), ...(x.a ? { a: x.a } : {}) }])
      .filter(([, x]) => Object.keys(x as object).some((key) => key !== 'l')));
    if (Object.keys(own).length) works[k] = own;
  }
  return { ...w, regions, works };
};

/** Трейлеры для Global: пометка ru:0 (закрыт в России) там лишняя */
const withoutRu = (t: TrailersFile): TrailersFile => ({
  ...t, works: Object.fromEntries(Object.entries(t.works).map(([k, list]) => [k, list.map(({ ru: _ru, ...x }) => x)])),
});

const materials = [...Object.values(postsAuto), ...Object.values(essaysAuto)].flat();
const meta = {
  generatedAt: new Date().toISOString(),
  works: new Set([...Object.keys(postsAuto), ...Object.keys(essaysAuto)]).size,
  materials: materials.length,
  unverified: materials.filter((a) => a.unverified).length,
  filmBaseWiki: filmBaseWiki.length,
  sources: sourceCandidates.length,
};
const essayParts = buildEssayIndex(essaysAuto, postsAuto, essayLenses, curatedEssays, detailAnalyses);
/** Производные от индексов разборов: едут с ними и в `--only`, иначе индекс разойдётся с полными файлами. Старый сервер
 *  (до 18.10) таких имён не знает и отвечает 404 unknown_reference — это не сбой: клиент тогда берёт полные файлы. */
const derived = (name: string) => name === 'essayIndex' || name.startsWith('analyses-');
if (only && ['essaysAuto', 'postsAuto', 'essayLenses'].some((n) => only.has(n))) {
  only.add('essayIndex');
  for (const s of Object.keys(essayParts.shards)) only.add(analysisShardName(s));
}
const payloads: [string, unknown][] = [
  // герои для подписок (06.10) и рубрики — раньше индексов разборов: сервер сверяет свежее с ними
  ['heroes', buildHeroesIndex()], ['essayLenses', essayLenses],
  ['postsAuto', postsAuto], ['essaysAuto', essaysAuto],
  // индекс разборов первой ленты и доли по ключу (18.10, аудит скорости, волна 3А, src/lib/essayIndex.ts) — после полных
  // файлов, индекс последним: клиент сверяет версию долей с индексом и при расхождении берёт полные файлы
  ...Object.entries(essayParts.shards).map(([s, data]) => [analysisShardName(s), data] as [string, unknown]),
  ['essayIndex', essayParts.index],
  ['sourcesAuto', sourceCandidates],
  ['filmBaseWiki', filmBaseWiki], ['comentions', comentions], ['meta', meta],
  // инлайн-поиск бота (06.10): герои и произведения — сервер ищет по нему сам
  ['inlineIndex', buildInlineIndex()],
  // публичные страницы для поисковиков (ЗП-15, 07.10): какие фильмы и авторы получают страницу. Выключено до решения
  // владельца (07.10): публикуется только с PUBLIC_PAGES=1 — вместе с тем же флагом сервера
  ...(process.env.PUBLIC_PAGES === '1' ? [['publicPages', buildPublicPages()] as [string, unknown]] : []),
  // сезоны сериалов (ЗП-17, 07.10): сервер пишет «вышел новый сезон» в утренней сводке — tools/series-seasons.mts
  ...(existsSync('.cache/series-seasons.json') ? [['seriesSeasons', JSON.parse(readFileSync('.cache/series-seasons.json', 'utf8'))] as [string, unknown]] : []),
  // где смотреть по подписке (ЗП-42, 10.10): лента ставит вперёд доступное без доплаты — tools/watch-providers.mts
  ...(existsSync('.cache/watch-providers.json') ? [['watchProviders', ownRegions(JSON.parse(readFileSync('.cache/watch-providers.json', 'utf8')))] as [string, unknown]] : []),
  // бесплатная легальная классика (ЗП-43, 10.10): правообладатели на YouTube, Викисклад, архив — tools/free-watch.mts
  // подборки голосов (ЗП-45, шаг 3, 11.10): плейлисты эссеистов как полки — tools/voice-playlists.mts
  ...(existsSync('.cache/voice-playlists.json') ? [['voicePlaylists', JSON.parse(readFileSync('.cache/voice-playlists.json', 'utf8'))] as [string, unknown]] : []),
  // читать бесплатно и легально (книги, 11.10): Викитека, Gutenberg, Internet Archive — tools/free-read.mts
  ...(existsSync('.cache/free-read.json') ? [['freeRead', JSON.parse(readFileSync('.cache/free-read.json', 'utf8'))] as [string, unknown]] : []),
  ...(!global && existsSync('.cache/free-watch.json') ? [['freeWatch', JSON.parse(readFileSync('.cache/free-watch.json', 'utf8'))] as [string, unknown]] : []),
  // трейлеры заранее (17.10): TMDb, Wikidata, каналы прокатчиков, проверка YouTube — tools/trailers.mts; сервер отдаёт их
  // по ключам (GET /api/trailers). В Global — без пометки «закрыт в России»: там она ничего не значит
  ...(existsSync('.cache/trailers.json') ? [['trailers', global ? withoutRu(JSON.parse(readFileSync('.cache/trailers.json', 'utf8'))) : JSON.parse(readFileSync('.cache/trailers.json', 'utf8'))] as [string, unknown]] : []),
];
let failed = 0;
/** доли разборов — одной строкой в отчёте: их 64 */
const shardLog = { n: 0, kb: 0, skipped: 0, failed: 0 };
for (const [name, data] of payloads) {
  if (only && !only.has(name)) continue;
  const body = JSON.stringify(data);
  const quiet = name.startsWith('analyses-');
  if (quiet) { shardLog.n += 1; shardLog.kb += body.length / 1024; }
  if (dry) { if (!quiet) console.log(`${name}: ${(body.length / 1024).toFixed(0)} КБ`); continue; }
  if (outArg) {
    mkdirSync(outArg, { recursive: true });
    writeFileSync(join(outArg, `${name}.json.tmp`), body);
    renameSync(join(outArg, `${name}.json.tmp`), join(outArg, `${name}.json`));
    if (!quiet) console.log(`${name}: ${(body.length / 1024).toFixed(0)} КБ → ${outArg}`);
    continue;
  }
  const res = await fetch(`${server}/api/reference/${name}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  }).catch((err: Error) => ({ ok: false, status: 0, statusText: err.message }) as Response);
  // старый сервер не знает производных имён — пропуск, не сбой
  const older = !res.ok && res.status === 404 && derived(name) && (await res.text().catch(() => '')).includes('unknown_reference');
  if (quiet) { if (older) shardLog.skipped += 1; else if (!res.ok) shardLog.failed += 1; }
  else console.log(`${name}: ${(body.length / 1024).toFixed(0)} КБ → ${res.ok ? 'ок' : older ? 'сервер старее, пропуск' : `ошибка ${res.status} ${res.statusText}`}`);
  if (!res.ok && !older) failed += 1;
}
if (shardLog.n) {
  const how = dry ? '' : outArg ? ` → ${outArg}` : shardLog.skipped ? ' → сервер старее, пропуск' : shardLog.failed ? ` → ошибок ${shardLog.failed}` : ' → ок';
  console.log(`доли разборов: ${shardLog.n} по ~${(shardLog.kb / shardLog.n).toFixed(0)} КБ${how}`);
}
console.log(`индекс: ${meta.works} фильмов, ${meta.materials} материалов, не подтверждено ${meta.unverified}`);
process.exit(failed ? 1 : 0);
