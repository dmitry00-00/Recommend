// Публикация индексов на сервер (трек В1): приложение берёт свежие разборы оттуда, а не из
// сборки, — обновление данных больше не требует перезаливки архива.
//   npx tsx tools/publish-reference.mts            — всё, что умеем публиковать
//   npx tsx tools/publish-reference.mts --dry      — только посчитать, ничего не отправлять
// Куда и чем: TM_SERVER (по умолчанию https://bot-1791394986-4062-dmitriy-00.bothost.tech) и TM_ADMIN_TOKEN — тот же
// токен, что в переменной ADMIN_TOKEN у бота на bothost. Оба — в .env.local.
import { existsSync, readFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { essayLenses } from '../src/mocks/essayLenses.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';
import { filmBaseWiki as wiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';
import { filmBasePopular } from '../src/mocks/filmBasePopular.ts';
import { filmBaseWorld } from '../src/mocks/filmBaseWorld.ts';

// вписанное людьми в таблицу разметки едет на сервер тем же справочником: клиенту всё равно,
// откуда карточка — из каналов или из таблицы; и то, что люди ищут (топы Википедии, 05.10) —
// так новые фильмы находятся поиском сразу после публикации, без пересборки приложения
const filmBaseWiki = [...wiki, ...filmBaseMarkup, ...filmBasePopular, ...filmBaseWorld];
import { comentions } from '../src/mocks/comentions.ts';
import { buildInlineIndex } from './inline-index.mts';
import { buildHeroesIndex } from './heroes-index.mts';
import { buildPublicPages } from './public-pages.mts';

loadEnvFile();
const dry = process.argv.includes('--dry');
const server = (process.env.TM_SERVER ?? 'https://bot-1791394986-4062-dmitriy-00.bothost.tech').replace(/\/+$/, '');
const token = process.env.TM_ADMIN_TOKEN;
if (!dry && !token) { console.error('нет TM_ADMIN_TOKEN в .env.local — публиковать нечем'); process.exit(1); }

const materials = [...Object.values(postsAuto), ...Object.values(essaysAuto)].flat();
const meta = {
  generatedAt: new Date().toISOString(),
  works: new Set([...Object.keys(postsAuto), ...Object.keys(essaysAuto)]).size,
  materials: materials.length,
  unverified: materials.filter((a) => a.unverified).length,
  filmBaseWiki: filmBaseWiki.length,
  sources: sourceCandidates.length,
};
const payloads: [string, unknown][] = [
  // герои для подписок (06.10) и рубрики — раньше индексов разборов: сервер сверяет свежее с ними
  ['heroes', buildHeroesIndex()], ['essayLenses', essayLenses],
  ['postsAuto', postsAuto], ['essaysAuto', essaysAuto], ['sourcesAuto', sourceCandidates],
  ['filmBaseWiki', filmBaseWiki], ['comentions', comentions], ['meta', meta],
  // инлайн-поиск бота (06.10): герои и произведения — сервер ищет по нему сам
  ['inlineIndex', buildInlineIndex()],
  // публичные страницы для поисковиков (ЗП-15, 07.10): какие фильмы и авторы получают страницу. Выключено до решения
  // владельца (07.10): публикуется только с PUBLIC_PAGES=1 — вместе с тем же флагом сервера
  ...(process.env.PUBLIC_PAGES === '1' ? [['publicPages', buildPublicPages()] as [string, unknown]] : []),
  // сезоны сериалов (ЗП-17, 07.10): сервер пишет «вышел новый сезон» в утренней сводке — tools/series-seasons.mts
  ...(existsSync('.cache/series-seasons.json') ? [['seriesSeasons', JSON.parse(readFileSync('.cache/series-seasons.json', 'utf8'))] as [string, unknown]] : []),
];
let failed = 0;
for (const [name, data] of payloads) {
  const body = JSON.stringify(data);
  if (dry) { console.log(`${name}: ${(body.length / 1024).toFixed(0)} КБ`); continue; }
  const res = await fetch(`${server}/api/reference/${name}`, {
    method: 'PUT', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body,
  }).catch((err: Error) => ({ ok: false, status: 0, statusText: err.message }) as Response);
  console.log(`${name}: ${(body.length / 1024).toFixed(0)} КБ → ${res.ok ? 'ок' : `ошибка ${res.status} ${res.statusText}`}`);
  if (!res.ok) failed += 1;
}
console.log(`индекс: ${meta.works} фильмов, ${meta.materials} материалов, не подтверждено ${meta.unverified}`);
process.exit(failed ? 1 : 0);
