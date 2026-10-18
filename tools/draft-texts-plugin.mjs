// Тексты «что делает» черновиков — отдельным ленивым куском (18.10, аудит скорости, волна 2: бюджет первой загрузки).
//
// Черновая разметка фильмов и сериалов (src/mocks/draftAnnotations.ts, seriesAnnotations.ts) нужна первой ленте: подбор
// (src/lib/model) берёт операции, уровень, барьеры, предупреждения, нишевость и уверенность. Строка «что делает» (последний
// аргумент `a(…)`) — только текст для глаз: шторка рекомендации, «подобрать словами», подборки, «вместе». А весит она
// две трети модулей: ~530 из ~800 КБ brotli. Плагин делит модули при сборке (и в dev), исходники и генераторы не трогая:
//   · сам модуль приходит в браузер без текстов — у каждой записи `what: ''`;
//   · src/mocks/draftTexts.ts (в исходнике — пустые списки) получает тексты обоих модулей списками строк в порядке
//     обхода `walkDrafts` (src/mocks/draftTexts.ts) — тот же обход в браузере кладёт их на место (`fillDrafts`).
// Порядок не по исходнику, а по итоговому объекту: модуль исполняется здесь же (esbuild снимает типы), так что
// повторный ключ или сезон с числовым ключом не собьют счёт. Сверка: в облегчённом модуле обход даёт столько же записей
// и все они пусты — иначе сборка падает, а не отдаёт тексты не тем фильмам.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { transform } from 'esbuild';

const root = process.cwd();
/** модуль → имя экспорта с разметкой; порядок — как у списков в draftTexts.ts */
const SOURCES = [
  { file: 'src/mocks/draftAnnotations.ts', name: 'draftAnnotations', out: 'draftTexts' },
  { file: 'src/mocks/seriesAnnotations.ts', name: 'seriesAnnotations', out: 'seriesTexts' },
];
const TEXTS = 'src/mocks/draftTexts.ts';

/** Последний строковый аргумент `a(…)` после уверенности — текст «что делает». */
const WHAT = /(,\s*'(?:high|medium|low)',\s*)'(?:[^'\\\n]|\\.)*'(\s*\))/g;

/** Тот же обход, что `walkDrafts` в src/mocks/draftTexts.ts: запись, затем её сезоны по порядку ключей. */
function walk(map, visit) {
  for (const d of Object.values(map)) {
    visit(d);
    if (d.seasons) for (const s of Object.values(d.seasons)) visit(s);
  }
}

async function run(code) {
  const js = (await transform(code, { loader: 'ts', format: 'esm' })).code;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}

const norm = (id) => id.split('?')[0];
const cache = new Map(); // файл → { src, lean, texts }

async function split(file) {
  const abs = resolve(root, file);
  const src = await readFile(abs, 'utf8');
  const hit = cache.get(file);
  if (hit?.src === src) return hit;
  const { name } = SOURCES.find((s) => s.file === file);
  const full = (await run(src))[name];
  const texts = [];
  walk(full, (d) => texts.push(d.what));
  const lean = src.replace(WHAT, "$1''$2");
  let n = 0;
  let filled = 0;
  walk((await run(lean))[name], (d) => { n += 1; if (d.what) filled += 1; });
  if (n !== texts.length || filled) {
    throw new Error(`draft-texts: ${file} — в облегчённом модуле ${n} записей (${filled} с текстом), в исходном ${texts.length}`);
  }
  const out = { src, lean, texts };
  cache.set(file, out);
  return out;
}

export function draftTexts() {
  return {
    name: 'draft-texts',
    enforce: 'pre',
    async transform(code, id) {
      const path = norm(id);
      const source = SOURCES.find((s) => path === resolve(root, s.file));
      if (source) return { code: (await split(source.file)).lean, map: null };
      if (path !== resolve(root, TEXTS)) return undefined;
      const lists = [];
      for (const s of SOURCES) {
        this.addWatchFile(resolve(root, s.file));
        const { texts } = await split(s.file);
        // JSON.parse строки быстрее разбирается, чем литерал массива (V8)
        lists.push(`export const ${s.out}: string[] = JSON.parse(${JSON.stringify(JSON.stringify(texts))});`);
      }
      return { code: `${code.replace(/^export const \w+: string\[\] = \[\];$/gm, '')}\n${lists.join('\n')}\n`, map: null };
    },
  };
}
