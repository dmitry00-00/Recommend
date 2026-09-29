// Оценки и просмотры участника с Кинопоиска → его профиль на сервере (seeds/<ник>.json, как у
// tools/resolve-seed.mts; на сервер кладёт tools/publish-seed.mts). Много людей и частые
// просьбы — удобнее пульт: deploy/kinopoisk-desk.command (tools/kinopoisk-desk.mts).
//   npx tsx tools/import-kinopoisk.mts <ник в Telegram> <файлы или папки...> [--out файл] [--fast]
// Файлы — страницы профиля, сохранённые из браузера («Сохранить как», по странице на файл):
// новая «Оценки и просмотры» (/user/<id>/votes/, по 20 записей) или старая «Оценки» (по 50),
// а также CSV/список конвертера; папка — все .html/.csv/.txt в ней. Все файлы должны быть
// одного профиля Кинопоиска: страницы двух людей вперемешку скрипт не склеит.
// Что уходит в seeds: просмотренное (всё, что на страницах) и оценки 1–5 с исходной 1–10
// (`raw`: шкала у каждого своя, её читает deriveScale). Ни ника Кинопоиска, ни токенов.
// Как сопоставляется и где кэш — tools/kinopoisk-seed.mts; --fast — без Wikidata.
// Уже лежащий seeds/<ник>.json не перетирается: записи присланного списка (.txt) остаются,
// кинопоисковые заменяются новыми. Папка seeds/ — чужие личные данные, в git не уходит.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { buildSeed, mergeRecords, pagesReport, readPage, validNick, type Page } from './kinopoisk-seed.mts';

const args = process.argv.slice(2);
const flag = (name: string) => { const i = args.indexOf(name); return i < 0 ? false : (args.splice(i, 1), true); };
const option = (name: string) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const fast = flag('--fast');
const out = option('--out');
const [nick = '', ...inputs] = args;
const name = nick.replace(/^@/, '');
if (!validNick(name) || !inputs.length) {
  console.error('npx tsx tools/import-kinopoisk.mts <ник в Telegram> <файлы или папки...> [--out файл] [--fast]');
  process.exit(1);
}

const files = inputs.flatMap((p) => {
  if (!existsSync(p)) { console.error(`нет файла: ${p}`); process.exit(1); }
  return statSync(p).isDirectory()
    ? readdirSync(p).filter((f) => /\.(html?|csv|txt)$/i.test(f)).sort().map((f) => join(p, f))
    : [p];
});
const pages: Page[] = [];
for (const file of files) {
  const page = readPage(basename(file), readFileSync(file, 'utf8'));
  if (page) pages.push(page); else console.error(`  не узнал формат, пропускаю: ${basename(file)}`);
}

const profiles = new Map<string, string[]>();
for (const p of pages) if (p.profile) profiles.set(p.profile, [...(profiles.get(p.profile) ?? []), p.name]);
if (profiles.size > 1) {
  console.error('файлы от разных профилей Кинопоиска — запускайте по одному человеку (или через пульт):');
  for (const list of profiles.values()) console.error(`  ${list.length} файлов: ${list.slice(0, 3).join(', ')}${list.length > 3 ? ', …' : ''}`);
  process.exit(1);
}
const report = pagesReport(pages);
if (report) {
  console.error(`страниц ${report.pages} из ${report.max}${report.repeated.length ? `, повторы: ${report.repeated.join(', ')}` : ''}`);
  if (report.missing.length) console.error(`  ✗ не хватает страниц: ${report.missing.join(', ')}`);
  if (report.lastFull) console.error(`  ? на странице ${report.max} полные 20 записей — возможно, это не последняя`);
}
const records = mergeRecords(pages);
console.error(`записей ${records.length}: фильмов ${records.filter((r) => r.type === 'film').length}, сериалов ${records.filter((r) => r.type === 'series').length}, с оценкой ${records.filter((r) => r.rating).length}`);

try {
  const r = await buildSeed(name, records, {
    fast, target: out, log: (l) => console.error(`  ${l}`),
    progress: (p) => { if (p.done % 50 === 0 || p.done === p.total) console.error(`  ${p.phase}: ${p.done} из ${p.total}`); },
  });
  console.error(`→ ${r.target}: просмотрено ${r.watched}${r.kept ? ` (+${r.kept} из присланного списка)` : ''}, оценок ${r.ratings}, не нашлось ${r.unmatched.length}`);
  if (r.ratings) console.error(`  оценки 1…10: ${r.dist.join(' ')}; медиана ${r.median} — норму шкалы спросить у самого участника`);
  if (r.unmatched.length) console.error(r.unmatched.map((u) => `  ✗ ${u}`).join('\n'));
  console.error(`дальше: npx tsx tools/publish-seed.mts ${name}`);
} catch (err) {
  console.error(`✗ ${(err as Error).message}`);
  process.exit(1);
}
