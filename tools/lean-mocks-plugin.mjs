// Облегчение кусков справочника при сборке (18.10, аудит скорости, волна 3А) — исходники и генераторы не трогая, как
// tools/draft-texts-plugin.mjs:
//   · src/mocks/people.ts приходит в браузер без `originalName` (~110 из ~385 КБ brotli): имя в оригинале нужно только
//     странице человека и сверке «тот ли это человек» (getPerson, getStats), а подписи карточек — по-русски. Имена в
//     оригинале — отдельным ленивым куском src/mocks/peopleOriginal.ts (в исходнике — пустой), их кладёт на место
//     `loadPeopleOriginal` (src/api/index.ts). Сверка: облегчённый модуль плюс кусок дают ровно исходный объект — иначе
//     сборка падает;
//   · src/mocks/filmBaseLateIds.ts (в исходнике — пустая строка) получает id карточек filmBasePopular.ts и
//     filmBaseWorld.ts, кроме убранных владельцем (withheldWorks.ts, тот же отбор, что у tools/publish-reference.mts), —
//     по ним приложение решает, качать ли эти ~475 КБ, когда справочник фильмов пришёл с сервера (`lateCovered`).
// Модули исполняются здесь же (esbuild снимает типы): у них только `import type`.
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { transform } from 'esbuild';

const root = process.cwd();
const PEOPLE = 'src/mocks/people.ts';
const PEOPLE_ORIGINAL = 'src/mocks/peopleOriginal.ts';
const LATE_IDS = 'src/mocks/filmBaseLateIds.ts';
const LATE_SOURCES = [
  { file: 'src/mocks/filmBasePopular.ts', name: 'filmBasePopular' },
  { file: 'src/mocks/filmBaseWorld.ts', name: 'filmBaseWorld' },
];
const WITHHELD = 'src/mocks/withheldWorks.ts';

async function run(code) {
  const js = (await transform(code, { loader: 'ts', format: 'esm' })).code;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
}
const norm = (id) => id.split('?')[0];
const read = (file) => readFile(resolve(root, file), 'utf8');

/** `,"originalName":"…"` в строке-объекте JSON (генератор пишет по человеку в строке). */
const ORIGINAL = /,"originalName":"(?:[^"\\\n]|\\.)*"/g;
let peopleCache;
async function splitPeople() {
  const src = await read(PEOPLE);
  if (peopleCache?.src === src) return peopleCache;
  const full = (await run(src)).people;
  const lean = src.replace(ORIGINAL, '');
  const leanPeople = (await run(lean)).people;
  const original = {};
  for (const [id, p] of Object.entries(full)) if (p.originalName != null) original[id] = p.originalName;
  // сверка: облегчённый + имена в оригинале = исходный
  const back = Object.fromEntries(Object.entries(leanPeople).map(([id, p]) => [id, id in original ? { ...p, originalName: original[id] } : p]));
  if (!isDeepStrictEqual(back, full) || Object.values(leanPeople).some((p) => 'originalName' in p)) {
    throw new Error(`lean-mocks: ${PEOPLE} — облегчённый модуль с именами в оригинале не сходится с исходным`);
  }
  peopleCache = { src, lean, original };
  return peopleCache;
}

let lateCache;
async function lateIds() {
  const srcs = await Promise.all([...LATE_SOURCES.map((s) => read(s.file)), read(WITHHELD)]);
  const key = srcs.join('\u0000');
  if (lateCache?.key === key) return lateCache.packed;
  const { isWithheld } = await run(srcs.at(-1));
  const ids = new Set();
  for (const [i, s] of LATE_SOURCES.entries()) for (const w of (await run(srcs[i]))[s.name]) if (!isWithheld(w)) ids.add(w.id);
  const nums = [];
  const other = [];
  for (const id of ids) { const m = /^f-wd(\d+)$/.exec(id); if (m) nums.push(Number(m[1])); else other.push(id); }
  nums.sort((a, b) => a - b);
  const deltas = nums.map((n, i) => (n - (i ? nums[i - 1] : 0)).toString(36));
  if (other.some((id) => /[,|]/.test(id))) throw new Error('lean-mocks: id с запятой или «|» — список не собрать');
  const packed = `${deltas.join(',')}|${other.join(',')}`;
  lateCache = { key, packed };
  return packed;
}

export function leanMocks() {
  return {
    name: 'lean-mocks',
    enforce: 'pre',
    async transform(code, id) {
      const path = norm(id);
      if (path === resolve(root, PEOPLE)) return { code: (await splitPeople()).lean, map: null };
      if (path === resolve(root, PEOPLE_ORIGINAL)) {
        this.addWatchFile(resolve(root, PEOPLE));
        const { original } = await splitPeople();
        // JSON.parse строки быстрее разбирается, чем литерал объекта (V8)
        return { code: `export const peopleOriginal: Record<string, string> = JSON.parse(${JSON.stringify(JSON.stringify(original))});\n`, map: null };
      }
      if (path === resolve(root, LATE_IDS)) {
        for (const f of [...LATE_SOURCES.map((s) => s.file), WITHHELD]) this.addWatchFile(resolve(root, f));
        return { code: `export const lateFilmIds: string = ${JSON.stringify(await lateIds())};\n`, map: null };
      }
      return undefined;
    },
  };
}
