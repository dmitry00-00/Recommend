// Публикация индексов на сервер (трек В1): приложение берёт свежие разборы оттуда, а не из
// сборки, — обновление данных больше не требует перезаливки архива.
//   npx tsx tools/publish-reference.mts            — всё, что умеем публиковать
//   npx tsx tools/publish-reference.mts --dry      — только посчитать, ничего не отправлять
// Куда и чем: TM_SERVER (по умолчанию https://recomend.bothost.tech) и TM_ADMIN_TOKEN — тот же
// токен, что в переменной ADMIN_TOKEN у бота на bothost. Оба — в .env.local.
import { loadEnvFile } from './env-file.mts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { sourceCandidates } from '../src/mocks/sourcesAuto.ts';
import { filmBaseWiki as wiki } from '../src/mocks/filmBaseWiki.ts';
import { filmBaseMarkup } from '../src/mocks/filmBaseMarkup.ts';

// вписанное людьми в таблицу разметки едет на сервер тем же справочником: клиенту всё равно,
// откуда карточка — из каналов или из таблицы
const filmBaseWiki = [...wiki, ...filmBaseMarkup];
import { comentions } from '../src/mocks/comentions.ts';

loadEnvFile();
const dry = process.argv.includes('--dry');
const server = (process.env.TM_SERVER ?? 'https://recomend.bothost.tech').replace(/\/+$/, '');
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
  ['postsAuto', postsAuto], ['essaysAuto', essaysAuto], ['sourcesAuto', sourceCandidates],
  ['filmBaseWiki', filmBaseWiki], ['comentions', comentions], ['meta', meta],
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
