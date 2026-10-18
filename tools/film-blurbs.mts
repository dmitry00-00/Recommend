// Описание фильма без TMDb для «Сюжета» (18.10). Владелец решил заводить фильмы без номера TMDb — ключ `wd:Q…`
// (src/lib/keys.ts): советская и российская анимация, короткий метр, хвост мирового кино (~2 тыс.). Описание фильма у нас
// приходит из TMDb (src/lib/resolve/tmdb.ts, `blurb`), у таких его нет — «Сюжет» говорил «описания нет».
//   npx tsx tools/film-blurbs.mts [--reports DIR] [--limit N] [--minutes M] [--fresh] [--dry]
// Как у книг (tools/book-blurbs.mts): вступление статьи русской Википедии, дословно (без пересказа), под текстом в
// «Сюжете» — ссылка на статью: лицензия CC BY-SA (src/components/WorkSheet.tsx, `source`). Отличие от книг — обрезка
// (tools/film-blurbs-lib.mts): справка в начале («— советский мультфильм 1969 года режиссёра …») в карточке уже есть
// (год, режиссёр, вид), её снимаем; премии, съёмки, роли — тоже не сюжет. Если во вступлении сюжета нет, берём первый
// абзац раздела «Сюжет» (дальше — спойлеры концовки). Ни того, ни другого — статья-заготовка, не берём.
// Цели: карточки справочника с ключом `wd:` без своего описания (works-index) и — пока справочник пишется — кандидаты
// из отчётов tools/grow-film-base.mts (`--reports DIR`: *.json с `missing[]`, ключ `wd:`). Элемент Wikidata → статья
// русской Википедии (wbgetentities, sitelinks) → вступление (API Википедии, prop=extracts, exintro, plaintext; пачками по
// 20 — больше extracts со вступлением не отдаёт) → при нужде раздел «Сюжет» (вики-текст статьи, prop=revisions, по 20).
// Бережно: пауза между запросами, maxlag, UA как в tools/build-fame.mts. Кэш — .cache/film-blurbs/ (sitelinks.json,
// intro.json, plot.json): повторный прогон спрашивает только новое; --fresh — заново, --limit — первые N целей,
// --minutes — остановиться по времени (записав, что успели). Итог — .cache/film-blurbs.json (с отсеянным и причинами)
// и src/mocks/filmBlurbs.ts (ключ → { ru: { t, u } }, формат книжного bookBlurbs: ленивый модуль, getPlot).
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { filmBlurb, plotFromWikitext, type FilmBlurbResult } from './film-blurbs-lib.mts';

const argv = process.argv.slice(2);
const opt = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const FRESH = argv.includes('--fresh');
const DRY = argv.includes('--dry');
const LIMIT = Number(opt('--limit') ?? Infinity);
const DEADLINE = opt('--minutes') ? Date.now() + Number(opt('--minutes')) * 60_000 : Infinity;
const REPORTS = opt('--reports');
const UA = 'transformative-media/0.1 (film analysis index; contact via repository README)';
const DIR = '.cache/film-blurbs';
mkdirSync(DIR, { recursive: true });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const late = () => Date.now() > DEADLINE;

// ── кэш ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const load = <T,>(name: string): T => (!FRESH && existsSync(`${DIR}/${name}`) ? JSON.parse(readFileSync(`${DIR}/${name}`, 'utf8')) as T : {} as T);
const save = (name: string, data: unknown) => {
  const tmp = `${DIR}/${name}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, `${DIR}/${name}`);
};
/** Q → название статьи русской Википедии (null — статьи нет) */
const sitelinks = load<Record<string, string | null>>('sitelinks.json');
/** название статьи → вступление (null — статьи нет или неоднозначность) */
const intros = load<Record<string, string | null>>('intro.json');
/** название статьи → первый абзац раздела «Сюжет» (null — раздела нет) */
const plots = load<Record<string, string | null>>('plot.json');

// ── цели ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Target = { q: string; title: string; year?: number };
const targets = new Map<string, Target>();
try {
  // справочник: фильмы с ключом `wd:` (без TMDb), у которых нет своего описания
  const { worksIndex } = await import('./works-index.mts');
  for (const w of worksIndex({ all: true })) {
    if (w.work.type === 'book' || !w.key.startsWith('wd:') || w.work.synopsis?.trim() || w.work.blurb?.trim()) continue;
    targets.set(w.key.slice(3), { q: w.key.slice(3), title: w.work.title, year: w.work.year || undefined });
  }
} catch (e) {
  console.error(`справочник не прочитан (${(e as Error).message.split('\n')[0]}) — только отчёты`);
}
const fromBase = targets.size;
if (REPORTS) {
  for (const f of readdirSync(REPORTS).filter((f) => /\.json$/.test(f))) {
    const j = JSON.parse(readFileSync(`${REPORTS}/${f}`, 'utf8')) as { missing?: { key?: string; qid?: string; title?: string; year?: number }[] };
    for (const m of j.missing ?? []) {
      if (!m.key?.startsWith('wd:') || !m.qid || targets.has(m.qid)) continue;
      targets.set(m.qid, { q: m.qid, title: m.title ?? '', year: m.year || undefined });
    }
  }
}
const all = [...targets.values()].sort((a, b) => Number(a.q.slice(1)) - Number(b.q.slice(1))).slice(0, LIMIT);
console.error(`целей: ${all.length} (справочник ${fromBase}, отчёты ${targets.size - fromBase})`);

// ── запросы ─────────────────────────────────────────────────────────────────────────────────────────────────────────
async function get<T>(url: string): Promise<T | undefined> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30_000) }).catch(() => undefined);
    if (r?.ok) {
      const j = await r.json().catch(() => undefined) as (T & { error?: { code?: string } }) | undefined;
      // maxlag: сервер занят — ждём, как просит
      if (j && j.error?.code !== 'maxlag') return j;
    } else if (r && r.status !== 429 && r.status < 500) return undefined;
    // 429 «too many requests» (18.10: Википедию в это же время спрашивал tools/grow-film-base.mts) — ждём дольше
    await sleep(Math.max(Number(r?.headers.get('retry-after') ?? 0) * 1000, (r?.status === 429 ? 15_000 : 2000) * 2 ** a));
  }
  return undefined;
}

// 1) статья русской Википедии у элемента — по 50 элементов
{
  type Entities = { entities?: Record<string, { missing?: string; redirects?: { from: string; to: string }; sitelinks?: Record<string, { title: string }> }>; error?: { code?: string } };
  // один удалённый или слитый элемент в пачке — и wbgetentities отвечает ошибкой на всю пачку (no-such-entity):
  // делим пополам, пока не останется он один (он — «нет статьи»)
  const ask = async (ids: string[]): Promise<void> => {
    const j = await get<Entities>(`https://www.wikidata.org/w/api.php?${new URLSearchParams({ action: 'wbgetentities', ids: ids.join('|'), props: 'sitelinks', sitefilter: 'ruwiki', redirects: 'yes', format: 'json', maxlag: '5' })}`);
    await sleep(500);
    if (j?.entities) {
      const got = Object.values(j.entities);
      for (const q of ids) sitelinks[q] = (j.entities[q] ?? got.find((e) => e.redirects?.from === q))?.sitelinks?.ruwiki?.title ?? null;
      return;
    }
    if (j?.error?.code === 'no-such-entity') {
      if (ids.length === 1) { sitelinks[ids[0]] = null; return; }
      await ask(ids.slice(0, ids.length >> 1));
      await ask(ids.slice(ids.length >> 1));
      return;
    }
    console.error(`  wikidata: нет ответа (${ids[0]}…)`);
  };
  const todo = all.filter((t) => !(t.q in sitelinks)).map((t) => t.q);
  for (let i = 0; i < todo.length && !late(); i += 50) {
    await ask(todo.slice(i, i + 50));
    save('sitelinks.json', sitelinks);
  }
}

type Page = { title: string; missing?: boolean; extract?: string; pageprops?: { disambiguation?: string } };
type Query = { query?: { normalized?: { from: string; to: string }[]; redirects?: { from: string; to: string }[]; pages?: Page[] } };
const api = (params: Record<string, string>) =>
  get<Query>(`https://ru.wikipedia.org/w/api.php?${new URLSearchParams({ action: 'query', format: 'json', formatversion: '2', redirects: '1', maxlag: '5', ...params })}`);
/** Ответ на запрошенное название: с учётом нормализации и перенаправлений. */
const pageFor = (q: Query, asked: string): Page | undefined => {
  let t = asked;
  for (const n of q.query?.normalized ?? []) if (n.from === t) t = n.to;
  for (const r of q.query?.redirects ?? []) if (r.from === t) t = r.to;
  return q.query?.pages?.find((p) => p.title === t);
};
// знаки ударения («Ёжик в тума́не») — для словаря, не для описания
const clean = (t: string | undefined) => t?.replace(/́/g, '').trim() || null;

// 2) вступления — по 20 статей
{
  const todo = [...new Set(all.map((t) => sitelinks[t.q]).filter((a): a is string => !!a && !(a in intros)))];
  for (let i = 0; i < todo.length && !late(); i += 20) {
    const titles = todo.slice(i, i + 20);
    const j = await api({ prop: 'extracts|pageprops', ppprop: 'disambiguation', exintro: '1', explaintext: '1', exlimit: '20', titles: titles.join('|') });
    if (!j?.query) { console.error(`  википедия: нет ответа на пачку ${i}`); continue; }
    for (const a of titles) {
      const p = pageFor(j, a);
      intros[a] = !p || p.missing || p.pageprops?.disambiguation !== undefined ? null : clean(p.extract);
    }
    save('intro.json', intros);
    if ((i / 20) % 10 === 9) console.error(`  вступления: ${Math.min(i + 20, todo.length)} из ${todo.length}`);
    await sleep(1000);
  }
}

// 3) раздел «Сюжет» — только там, где во вступлении сюжета нет. Статья целиком через extracts — по одной на запрос, и
// на 18.10 Википедия отвечала на это 429; поэтому — вики-текст (prop=revisions) пачкой по 20, раздел режем сами
// (plotFromWikitext: ссылки, шаблоны, сноски — в простой текст)
const result = (t: Target): FilmBlurbResult | undefined => {
  const a = sitelinks[t.q];
  if (a === undefined) return undefined;
  if (a === null) return { skip: 'нет статьи' };
  const intro = intros[a];
  if (intro === undefined) return undefined;
  if (intro === null) return { skip: 'нет вступления' };
  return filmBlurb(intro, a in plots ? plots[a] : undefined);
};
{
  const todo = [...new Set(all.filter((t) => { const r = result(t); return r && 'need' in r; }).map((t) => sitelinks[t.q]!))];
  type Rev = { title: string; missing?: boolean; revisions?: { slots?: { main?: { content?: string } } }[] };
  for (let i = 0; i < todo.length && !late(); i += 20) {
    const titles = todo.slice(i, i + 20);
    const j = await api({ prop: 'revisions', rvprop: 'content', rvslots: 'main', titles: titles.join('|') }) as Query & { query?: { pages?: Rev[] } } | undefined;
    if (!j?.query) { console.error(`  «Сюжет»: нет ответа на пачку ${i}`); continue; }
    for (const a of titles) {
      const p = pageFor(j, a) as Rev | undefined;
      const wiki = p?.revisions?.[0]?.slots?.main?.content;
      plots[a] = wiki ? clean(plotFromWikitext(wiki) ?? undefined) : null;
    }
    save('plot.json', plots);
    if ((i / 20) % 10 === 9) console.error(`  «Сюжет»: ${Math.min(i + 20, todo.length)} из ${todo.length}`);
    await sleep(1500);
  }
}
save('plot.json', plots);

// ── итог ────────────────────────────────────────────────────────────────────────────────────────────────────────────
type Blurb = { t: string; u: string };
const out: Record<string, { ru: Blurb }> = {};
const skipped: Record<string, number> = {};
const report: { key: string; title: string; year?: number; article?: string; from?: string; text?: string; skip?: string }[] = [];
let pending = 0;
for (const t of all) {
  const r = result(t);
  const a = sitelinks[t.q] ?? undefined;
  const base = { key: `wd:${t.q}`, title: t.title, ...(t.year ? { year: t.year } : {}), ...(a ? { article: a } : {}) };
  if (!r || 'need' in r) { pending++; continue; }
  if ('skip' in r) { skipped[r.skip] = (skipped[r.skip] ?? 0) + 1; report.push({ ...base, skip: r.skip }); continue; }
  // ссылка читаемая (кириллица как есть — браузер закодирует сам): справочник легче на треть; кодируем только то, что
  // ломает адрес
  const u = `https://ru.wikipedia.org/wiki/${a!.replace(/ /g, '_').replace(/[%?#"<>&+]/g, encodeURIComponent)}`;
  out[base.key] = { ru: { t: r.text, u } };
  report.push({ ...base, from: r.from, text: r.text });
}
// убранное и отложенное (withheldWorks.ts: порно, эротика вне канона, эзотерика, 18.10) — без описаний: карточек нет,
// а справочник лежит в публичном репозитории
const { withheldWorks, heldWorks } = await import('../src/mocks/withheldWorks.ts');
for (const k of Object.keys(out)) if (k in withheldWorks || k in heldWorks) delete out[k];
const got = Object.keys(out).length;
console.log(`целей ${all.length}: описание — ${got} (из вступления ${report.filter((r) => r.from === 'intro').length}, из «Сюжета» ${report.filter((r) => r.from === 'plot').length}); `
  + `не взято — ${Object.entries(skipped).map(([k, v]) => `${k} ${v}`).join(', ') || '0'}${pending ? `; не успели — ${pending}` : ''}`);
if (DRY) process.exit(0);
writeFileSync('.cache/film-blurbs.json', JSON.stringify({ at: new Date().toISOString(), targets: all.length, got, skipped, pending, items: report }, null, 1));
writeFileSync('src/mocks/filmBlurbs.ts', `// Сгенерировано tools/film-blurbs.mts — руками не править.
// Фильм без TMDb (ключ wd:) → вступление статьи русской Википедии (или первый абзац «Сюжета») и ссылка на неё.
// Лицензия CC BY-SA: под текстом в «Сюжете» — ссылка на статью. Подгружается, когда раскрывают «Сюжет» (src/api, getPlot).
export type FilmBlurb = { t: string; u: string };
export const filmBlurbs: Record<string, { ru?: FilmBlurb }> = ${JSON.stringify(out, null, 1)};
`);
console.log('→ .cache/film-blurbs.json, src/mocks/filmBlurbs.ts');
