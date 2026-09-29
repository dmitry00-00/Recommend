// Выгрузка таблиц для разметки людьми: фильмы, авторы и пары «фильм — разбор».
//   npx tsx tools/export-markup.mts [--all] [--limit N] [--out .cache/markup]
//
// Зачем. Привязка разбора к фильму сделана регекспом по названию и человеком не подтверждена:
// ролик про «Тёмного рыцаря» ловится на слово «Джокер». Решает это не более хитрое правило,
// а человек, который открыл ссылку и посмотрел. То же самое умеет кабинет участника в самом
// приложении (LinkCheck), но таблицу можно раздать тем, у кого приложения нет.
//
// Формат — TSV: открывается в Google Sheets и Excel без разговоров про разделители и про то,
// запятая в «Любовь, смерть и роботы» — это поле или название. Табуляции и переводы строк
// внутри значений заменяются пробелом.
//
// По умолчанию в пары идёт только неподтверждённое — ровно то, что приложение отдаёт в
// задания. `--all` добавляет и подтверждённое уликой: пригодится, чтобы замерить, насколько
// улики вообще правы.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { essays } from '../src/mocks/essays.ts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { voices, voiceKeys } from '../src/mocks/voices.ts';
import { watchedWorks } from '../src/mocks/userWatched.ts';
import { worksIndex } from './works-index.mts';
import type { ExternalAnalysis, Voice } from '../src/types/tmdf.ts';

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(name);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const OUT = opt('--out') ?? '.cache/markup';
const LIMIT = Number(opt('--limit') ?? 0) || Infinity;
const ALL = flag('--all');

/** Одно значение в клетке: таблица не должна разъехаться из-за переноса строки в заголовке. */
const cell = (v: unknown): string =>
  v == null ? '' : String(v).replace(/[\t\r\n]+/g, ' ').trim();
const tsv = (rows: unknown[][]): string => rows.map((r) => r.map(cell).join('\t')).join('\n') + '\n';

/** Где материал лежит — тем и определяется автор. Повторяет src/lib/voices.ts (там же
 *  объяснение, почему по каналу, а не по полю `author`): приложению нужен браузерный модуль,
 *  инструменту — узла, общего импорта между ними нет. */
const byId = new Map(voices.map((v) => [v.id, v]));
const voiceKeyOf = (a: ExternalAnalysis): string => {
  const handle = /^tg-([^-]+)-/.exec(a.id)?.[1];
  return handle ? `tg:${handle}` : `yt:${a.author}`;
};
const voiceOf = (a: ExternalAnalysis): Voice =>
  byId.get(voiceKeys[voiceKeyOf(a)] ?? '')
  ?? { id: voiceKeyOf(a), title: a.author, short: a.author, role: 'author', outlets: [] };

// ---------- что вообще есть ----------
const all: Record<string, ExternalAnalysis[]> = {};
for (const src of [essays, essaysAuto, postsAuto]) {
  for (const [k, v] of Object.entries(src)) all[k] = [...(all[k] ?? []), ...v];
}
const cards = new Map(worksIndex().map((w) => [w.key, w.work]));
const watched = new Set(watchedWorks.map((w) => w.externalIds?.tmdb).filter(Boolean).map((id) => `tmdb:${id}`));

mkdirSync(OUT, { recursive: true });

// ---------- фильмы ----------
const filmRows: unknown[][] = [[
  'ключ', 'название', 'год', 'режиссёр', 'tmdb', 'imdb', 'материалов', 'подтверждено', 'смотрел_владелец',
]];
for (const [key, list] of Object.entries(all).sort((a, b) => b[1].length - a[1].length)) {
  const w = cards.get(key);
  filmRows.push([
    key, w?.title ?? '—', w?.year, w?.creators?.[0], w?.externalIds?.tmdb, w?.externalIds?.imdb,
    list.length, list.filter((a) => !a.unverified).length, watched.has(key) ? 'да' : '',
  ]);
}
writeFileSync(join(OUT, 'films.tsv'), tsv(filmRows));

// ---------- авторы ----------
const stat = new Map<string, { v: Voice; n: number; ok: number; works: Set<string> }>();
for (const [key, list] of Object.entries(all)) {
  for (const a of list) {
    const v = voiceOf(a);
    const r = stat.get(v.id) ?? { v, n: 0, ok: 0, works: new Set<string>() };
    r.n += 1; if (!a.unverified) r.ok += 1; r.works.add(key);
    stat.set(v.id, r);
  }
}
const outlet = (v: Voice, kind: string) => v.outlets.find((o) => o.kind === kind)?.url ?? '';
const voiceRows: unknown[][] = [[
  'id', 'автор', 'роль', 'youtube', 'telegram', 'чат', 'материалов', 'подтверждено', 'фильмов', 'в_справочнике',
]];
for (const r of [...stat.values()].sort((a, b) => b.n - a.n)) {
  voiceRows.push([
    r.v.id, r.v.title, r.v.role, outlet(r.v, 'youtube'), outlet(r.v, 'telegram'), outlet(r.v, 'chat'),
    r.n, r.ok, r.works.size, byId.has(r.v.id) ? 'да' : '',
  ]);
}
writeFileSync(join(OUT, 'voices.tsv'), tsv(voiceRows));

// ---------- пары «фильм — разбор»: это и есть работа ----------
const pairRows: unknown[][] = [[
  'фильм', 'год', 'автор', 'площадка', 'заголовок', 'ссылка', 'дата',
  'вердикт', 'заметка', 'ключ_фильма', 'id_материала', 'улика',
]];
let n = 0;
for (const [key, list] of Object.entries(all)) {
  const w = cards.get(key);
  if (!w) continue; // без карточки вопрос «тот ли фильм» задать не о чем
  for (const a of list) {
    if (!ALL && !a.unverified) continue;
    if (n >= LIMIT) break;
    n += 1;
    pairRows.push([
      w.title, w.year, voiceOf(a).title, a.platform, a.title, a.url, a.publishedAt,
      '', '', key, a.id, a.unverified ? '' : (a.evidence ?? 'вручную'),
    ]);
  }
}
writeFileSync(join(OUT, 'pairs.tsv'), tsv(pairRows));

writeFileSync(join(OUT, 'КАК-РАЗМЕЧАТЬ.txt'), `Пары «фильм — разбор»: тот ли это фильм?

Файл pairs.tsv. Откройте ссылку и ответьте в столбце «вердикт» одним словом:

  да        — материал разбирает именно этот фильм
  нет       — разбирает другой фильм или просто упоминает этот
  не знаю   — по ссылке не понять

«Упоминает» — это «нет». Список фильмов года, где наш фильм назван одной строкой,
разбором не является: в карточке он окажется обманом.

Столбец «заметка» — свободный, для случаев вроде «на самом деле про вторую часть».
Столбцы «ключ_фильма» и «id_материала» не трогайте: по ним ответы вернутся в базу.

Строк: ${pairRows.length - 1}. Одна строка — примерно 20 секунд.
`);

const say = (s: string) => console.log(s);
say(`${OUT}/`);
say(`  films.tsv   ${filmRows.length - 1} фильмов`);
say(`  voices.tsv  ${voiceRows.length - 1} авторов (в справочнике ${[...stat.values()].filter((r) => byId.has(r.v.id)).length})`);
say(`  pairs.tsv   ${pairRows.length - 1} пар${ALL ? ' (все)' : ' на разметку (только неподтверждённые)'}`);
say(`  КАК-РАЗМЕЧАТЬ.txt`);
