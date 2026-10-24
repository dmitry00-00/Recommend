// Известность по просмотрам Википедии (23.10, опыты fameViews и fameViewsRu, src/lib/model/experiments.ts): уровни 0–3 из
// просмотров статей за 24 месяца (tools/build-pageviews.mts → .cache/pageviews/pool-2310.json; данные Викимедиа, CC0) вместо
// нынешнего fame (разделы Википедии и месяцы в топе, tools/build-fame.mts). Доли уровней — как у нынешнего fame на пуле
// первой ленты (по выгрузке .cache/eval/dump-frozen), чтобы приглушение громкого било по стольким же фильмам, а менялось
// только какие именно. Два варианта: «мир» — max(ru, en / k), k — медиана en/ru у фильмов с обеими статьями; «ru» —
// только русская статья («популярно у русскоязычных»). Ключ — как у разборов: tmdb:<id> фильм, imdb:<tt…> сериал.
// В таблице — только ключи, у которых просмотры собраны (у кого статьи нет — 0); нет ключа — лента берёт прежний fame.
//   npx tsx tools/build-fame-views.mts [--dump .cache/eval/dump-frozen] — пишет src/mocks/fameViews.ts
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n: string) => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const DUMP = opt('--dump') ?? '.cache/eval/dump-frozen';
const pool = JSON.parse(readFileSync('.cache/pageviews/pool-2310.json', 'utf8')) as { cols: string[]; rows: Record<string, (string | number | null)[]> };
const col = (c: string) => pool.cols.indexOf(c);
const [RU_T, EN_T, RU, EN, FIRST] = ['ruTitle', 'enTitle', 'ru24', 'en24', 'firstPool'].map(col);

// просмотры собраны: у каждой найденной статьи есть число (нет статьи — 0 просмотров)
const views = new Map<string, { ru: number; en: number; first: boolean }>();
let pending = 0;
for (const [key, r] of Object.entries(pool.rows)) {
  if ((r[RU_T] && r[RU] == null) || (r[EN_T] && r[EN] == null)) { pending++; continue; }
  views.set(key, { ru: Number(r[RU] ?? 0), en: Number(r[EN] ?? 0), first: r[FIRST] === 1 });
}

// доли нынешних уровней на пуле первой ленты: ключ → fame из выгрузки
const fameNow = new Map<string, number>();
for (const f of readdirSync(DUMP).filter((f) => f.endsWith('.json'))) {
  const d = JSON.parse(readFileSync(`${DUMP}/${f}`, 'utf8')) as { ok: boolean; feats: string[]; rows: (string | number | null)[][] };
  if (!d.ok) continue;
  const j = d.feats.indexOf('fame') + 2;
  for (const r of d.rows) if (!fameNow.has(r[0] as string)) fameNow.set(r[0] as string, Number(r[j] ?? 0));
}
const share = (l: number) => [...fameNow.values()].filter((x) => x >= l).length / fameNow.size;
const shares = [3, 2, 1].map(share);

const both = [...views.values()].filter((v) => v.ru > 0 && v.en > 0).map((v) => v.en / v.ru).sort((a, b) => a - b);
const K = both[Math.floor(both.length / 2)];
const world = (v: { ru: number; en: number }) => Math.max(v.ru, v.en / K);
const onlyRu = (v: { ru: number; en: number }) => v.ru;
/** пороги уровней 3, 2, 1 по пулу первой ленты: доля «не ниже уровня» — как у нынешнего fame */
const cuts = (score: (v: { ru: number; en: number }) => number) => {
  const xs = [...views.values()].filter((v) => v.first).map(score).sort((a, b) => b - a);
  return shares.map((s) => xs[Math.max(0, Math.round(s * xs.length) - 1)]);
};
const cw = cuts(world), cr = cuts(onlyRu);
const level = (x: number, c: number[]) => (x >= c[0] ? 3 : x >= c[1] ? 2 : x >= c[2] && x > 0 ? 1 : 0);

const entries = [...views].map(([k, v]) => `${k}=${level(world(v), cw)}${level(onlyRu(v), cr)}`).sort();
const changed = [...views].filter(([k, v]) => fameNow.has(k) && level(world(v), cw) !== fameNow.get(k)).length;
const body = `// Сгенерировано tools/build-fame-views.mts (${new Date().toISOString().slice(0, 10)}): известность по просмотрам статей Википедии
// за 24 месяца (данные Викимедиа, CC0) — опыты fameViews и fameViewsRu. Строка «ключ=МР»: М — уровень «мир» (max(ru, en/${K.toFixed(2)})),
// Р — только русская статья; 0 — тихое. Пороги (просмотров за 24 мес.) 3/2/1: мир ${cw.map((x) => Math.round(x)).join(' / ')}, ru ${cr.map((x) => Math.round(x)).join(' / ')}.
// Доли уровней — как у нынешнего fame на пуле первой ленты (${shares.map((s) => `${(s * 100).toFixed(1)}%`).join(' / ')}). Не править руками.
export const fameViews = ${JSON.stringify(entries.join(' '))};
`;
writeFileSync('src/mocks/fameViews.ts', body);
console.log(`ключей ${views.size} (просмотры не собраны ещё у ${pending}); k=${K.toFixed(2)}; пороги мир ${cw.map(Math.round).join('/')}, ru ${cr.map(Math.round).join('/')}; ` +
  `уровень «мир» отличается от нынешнего у ${changed} из ${[...views.keys()].filter((k) => fameNow.has(k)).length}; файл ${(body.length / 1024).toFixed(0)} КБ`);
