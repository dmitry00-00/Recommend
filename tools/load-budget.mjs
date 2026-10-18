// Бюджет первой загрузки (РР-0, 14.10): сколько скриптов приложение качает до первой ленты — точка входа со своими
// статическими зависимостями плюс куски ядра (`coreImports`) и справочника фильмов (`loadFilms()`; книги грузятся
// отдельно, РР-1) в src/api/index.ts, сжатыми brotli, как их отдаёт сервер. Превышен бюджет — код выхода 1, сборка
// падает: рост справочника (РР-2…РР-7) не должен незаметно утяжелять старт. Списки кусков читаются из исходника, так что
// новый `import('@/mocks/…')` в ядре или справочнике попадает в счёт сам. Индексы, которые сервер отдаёт свежими
// (essaysAuto, postsAuto, filmBaseChannels), — запасные копии из сборки, в счёт не идут: с сервером они не качаются.
// 18.10 (волна 3А) так же — filmBaseWiki, filmBaseMarkup (их несёт справочник сервера) и filmBasePopular, filmBaseWorld
// (качаются, только если справочник сервера старее сборки, `lateCovered`); английский словарь — только английскому
// интерфейсу. Справочники сервера (/api/reference, публикует tools/publish-reference.mts) в счёт не идут вовсе: до
// первой ленты из них теперь качаются индекс разборов (~50 КБ), справочник фильмов (~750 КБ) и доли разборов карточек.
//   node tools/load-budget.mjs [папка сборки = dist] [--report]
// Нужен манифест Vite (build.manifest в vite.config.ts).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brotliCompressSync, constants } from 'node:zlib';

/** Бюджет, КБ brotli. 14.10: замер 3 023 КБ (РР-0), после РР-1 (книги по требованию) — 2 692; ещё ~1,5 МБ индексов
 *  отдаёт сервер — вместе ДФ-21 и видел ~4,5 МБ в сети. 18.10 (аудит скорости, волна 2): 2 749 → 2 087 у bothost —
 *  тексты «что делает» черновиков ушли ленивым куском (tools/draft-texts-plugin.mjs, ~600 КБ). 18.10 (волна 3А): 2 087 →
 *  ~1 430 у bothost — запасные копии справочника фильмов по требованию, имена людей в оригинале и английский словарь
 *  отдельными кусками (tools/lean-mocks-plugin.mjs, src/main.tsx). Поднимать — только решением, с записью в HANDOFF: что выросло
 *  и почему иначе нельзя; опускать — после РР-5 (справочник с сервера по частям). */
const BUDGET_KB = 2750;

const args = process.argv.slice(2);
const dir = args.find((a) => !a.startsWith('--')) ?? 'dist';
const manifest = JSON.parse(readFileSync(join(dir, '.vite', 'manifest.json'), 'utf8'));
const api = readFileSync('src/api/index.ts', 'utf8');

/** `import('@/…')` внутри первого `Promise.all([…])` после метки. */
function importsAfter(marker) {
  const at = api.indexOf(marker);
  if (at < 0) throw new Error(`load-budget: не нашёл «${marker}» в src/api/index.ts`);
  const start = api.indexOf('Promise.all([', at);
  const end = api.indexOf('])', start);
  return [...api.slice(start, end).matchAll(/import\('@\/([^']+)'\)/g)].map((m) => m[1]);
}
const lazy = [...importsAfter('const coreImports = '), ...importsAfter('filmsLoad ??= ')];

/** Ключ манифеста по пути модуля: src/mocks/x → src/mocks/x.ts или src/mocks/x/index.ts. */
function entryOf(mod) {
  for (const k of [`src/${mod}.ts`, `src/${mod}.tsx`, `src/${mod}/index.ts`]) if (manifest[k]) return k;
  throw new Error(`load-budget: нет куска для «@/${mod}» в манифесте`);
}

const files = new Map(); // файл → откуда
function take(key, why) {
  const e = manifest[key];
  if (!e || files.has(e.file)) return;
  files.set(e.file, why);
  for (const css of e.css ?? []) if (!files.has(css)) files.set(css, why);
  for (const k of e.imports ?? []) take(k, why);
}
const entry = Object.keys(manifest).find((k) => manifest[k].isEntry);
take(entry, 'вход');
// приложение (18.10, волна 3А) — динамический кусок входа, но качается сразу (modulepreload в index.html); английский
// словарь (src/i18n/en.ts) — только при английском интерфейсе, в счёт не идёт
// (в манифесте он то `src/boot.tsx`, то `_boot-<хеш>.js` — смотря, сочла ли его сборка фасадом)
const boot = Object.keys(manifest).find((k) => k === 'src/boot.tsx' || /^_boot-[\w-]+\.js$/.test(k));
if (boot) take(boot, 'вход');
for (const mod of lazy) take(entryOf(mod), `@/${mod}`);

const rows = [...files].map(([file, why]) => {
  const buf = readFileSync(join(dir, file));
  const br = brotliCompressSync(buf, { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_SIZE_HINT]: buf.length } }).length;
  return { file, why, raw: buf.length, br };
});
const total = rows.reduce((s, r) => s + r.br, 0) / 1024;
if (args.includes('--report')) {
  for (const r of rows.sort((a, b) => b.br - a.br)) console.log(`${String(Math.round(r.br / 1024)).padStart(6)} КБ  ${r.why}  ${r.file}`);
}
const line = `первая загрузка: ${Math.round(total)} КБ brotli из ${BUDGET_KB} (${rows.length} файлов)`;
if (total > BUDGET_KB) {
  console.error(`✗ ${line} — бюджет превышен. Что тяжелее всего: node tools/load-budget.mjs ${dir} --report`);
  process.exit(1);
}
console.log(`✓ ${line}`);
