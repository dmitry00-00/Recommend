// Телепередачи в справочнике (OPS-9, 11.10): топы Википедии принесли вместе с сериалами реалити, ток-шоу,
// конкурсы и игры — «Битва экстрасенсов», «Голос», «Что? Где? Когда?», «Форт Боярд». Ролик об эфире такой
// передачи — не разбор произведения («КАК ЗАГНИВАЕТ ШОУ ГОЛОС», «Битва экстрасенсов (Кибер-ведьма…) | Обзор»),
// поэтому сопоставление их не ищет (`works-index`: без названий и без тегов). Карточки остаются — поиск их находит.
//
//   npx tsx tools/tv-programs.mts [--dry]
//
// Передача — по Wikidata: класс (P31) игрового, вокального, новостного шоу, варьете, викторины, радиопередачи или жанр
// (P136) реалити, ток-шоу, конкурса, кулинарного шоу, юмористических новостей. Голый класс «телепрограмма» не в счёт:
// он стоит и у сериалов («Ночной агент»). Признак постановочного — ситком, драма, мокьюментари, анимация — сильнее:
// «Реальные пацаны» (реалити + ситком) и «Мультреалити» — сериалы. «True crime» — тоже не признак: так помечены и
// драмы («Невероятное», «Притворство»).
import { writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';

const DRY = process.argv.includes('--dry');
const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SHOW_CLASS = /game show|talent show|news program|variety show|quiz|radio program|comedy news|live broadcast|mind game|WWE programs|talk show/i;
const SHOW_GENRE = /reality|talk show|game show|talent show|news|variety|quiz|dating|cooking show|competition|tabloid|infotainment|magazine format|music television|music program/i;
// ток-шоу и юмористические новости — передача, даже если жанром стоит и «comedy television series» («Last Week
// Tonight with John Oliver»); у постановочного с элементами реалити («Реальные пацаны») такого жанра нет
const STRONG_SHOW = /talk show|comedy news/i;
const SCRIPTED = /sitcom|drama|mockumentary|pseudo-documentary|anim|comedy television series|soap opera|telenovela|science fiction|fantasy|thriller|horror/i;
// описание элемента (11.10): у индийских и британских шоу класс часто голый «television series» — «Bigg Boss
// Kannada», «MasterChef India», «The Kapil Sharma Show»; в описании — «Indian reality television show»,
// «American reality court show», «Indian television comedy show»
const SHOW_DESC = /reality|game show|talk show|chat show|court show|cooking (?:show|programme)|quiz|talent (?:show|hunt)|variety show|dance (?:show|competition)|singing competition|(?:comedy|television comedy) (?:show|programme)|news (?:program|programme|show)/i;
// скетч-шоу («Наша Russia») — постановочное, это сериал
const SCRIPTED_DESC = /sitcom|drama|soap opera|telenovela|anim|web series|mockumentary|scripted|sketch/i;
// передачи, которые Wikidata не помечает ни классом, ни жанром, ни описанием (разметчики семнадцатого захода их пропустили
// как реалити, телеигры, трансляции и новости, 13.10): по IMDb, карточка любого справочника
const MANUAL_IMDB = new Set([
  'tt1628033', // Top Gear
  'tt0383126', // Разрушители легенд
  'tt0040053', // Шоу Эда Салливана
  'tt1401882', // WWE Superstars
  'tt0783198', // Saturday Night's Main Event (рестлинг)
  'tt0065323', // Monday Night Football
  'tt0470013', // Высшая лига КВН
  'tt4934214', // Taskmaster
  'tt5201844', // Один в один!
  'tt23743442', // The Traitors
  'tt23731242', // Perfect Match
  'tt27498421', // I'm a Celebrity… South Africa
  'tt9909248', // Race Across the World
  'tt5189220', // SAS: Who Dares Wins
  'tt10541088', // Ферма Кларксона
  'tt2486436', // Just for Laughs Gags (скрытая камера)
  'tt3402548', // Comedy Nights with Kapil
  'tt4958826', // +100500
  'tt27598192', // Что было дальше?
  'tt6085558', // Большая разница
  'tt0764672', // 24 Oras (новости)
  'tt0985264', // День домино
  'tt4573370', // Следствие вели… (вердикт владельца: ролик о передаче — не про фильм)
  'tt0386950', // Расследования авиакатастроф
  'tt0462133', // Секунды до катастрофы
  'tt1513168', // Сквозь червоточину
  'tt1433058', // Жизнь после людей
  'tt0190211', // Zoboomafoo
  'tt13650480', // Marvel Studios: Легенды (промо-нарезки)
]);

type Row = Record<string, { value: string }>;
async function sparql(q: string): Promise<Row[]> {
  for (let a = 0; a < 4; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query: q }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    await sleep(3000 * (a + 1));
  }
  throw new Error('wikidata: нет ответа');
}

// сериалы справочника с элементом Wikidata (карточки `f-wd<число>`); у фильмов передач нет
const allSeries = worksIndex({ all: true }).filter((w) => w.work.type === 'series');
const cards = new Map(allSeries.filter((w) => /^f-wd\d+$/.test(w.work.id)).map((w) => [`Q${w.work.id.slice(4)}`, w.work]));
// передачи из ручного списка — любой карточкой, не только `f-wd`
const manual = allSeries.filter((w) => w.work.externalIds?.imdb && MANUAL_IMDB.has(w.work.externalIds.imdb)).map((w) => w.work);
const qids = [...cards.keys()];
const labels = new Map<string, string[]>();
const desc = new Map<string, string>();
for (let i = 0; i < qids.length; i += 300) {
  const rows = await sparql(`SELECT ?f ?l WHERE { VALUES ?f { ${qids.slice(i, i + 300).map((q) => `wd:${q}`).join(' ')} }
    { ?f wdt:P31 ?x } UNION { ?f wdt:P136 ?x } ?x rdfs:label ?l FILTER(lang(?l) = 'en') }`);
  for (const r of rows) { const q = r.f.value.split('/').pop()!; labels.set(q, [...(labels.get(q) ?? []), r.l.value]); }
  const descs = await sparql(`SELECT ?f ?d WHERE { VALUES ?f { ${qids.slice(i, i + 300).map((q) => `wd:${q}`).join(' ')} }
    ?f schema:description ?d FILTER(lang(?d) = 'en') }`);
  for (const r of descs) desc.set(r.f.value.split('/').pop()!, r.d.value);
  await sleep(800);
}
const byDesc = (q: string) => { const d = desc.get(q) ?? ''; return SHOW_DESC.test(d) && !SCRIPTED_DESC.test(d); };
const shows = qids.filter((q) => {
  const ls = labels.get(q) ?? [];
  if (ls.some((l) => STRONG_SHOW.test(l))) return true;
  if (ls.some((l) => SCRIPTED.test(l))) return false;
  return ls.some((l) => SHOW_CLASS.test(l) || SHOW_GENRE.test(l)) || byDesc(q);
}).sort((a, b) => cards.get(a)!.title.localeCompare(cards.get(b)!.title, 'ru'));
console.log(`сериалов с элементом Wikidata: ${qids.length}, из них передач: ${shows.length}`);
for (const q of shows) console.log(`  ${cards.get(q)!.title} (${cards.get(q)!.year}) — ${[...(labels.get(q) ?? []).filter((l) => SHOW_CLASS.test(l) || SHOW_GENRE.test(l)), ...(byDesc(q) ? [`«${desc.get(q)}»`] : [])].join(', ')}`);
const found = new Set(shows.map((q) => cards.get(q)!.id));
const extra = manual.filter((w) => !found.has(w.id)).sort((a, b) => a.title.localeCompare(b.title, 'ru'));
console.log(`из ручного списка (не помечены Wikidata): ${extra.length} из ${MANUAL_IMDB.size}`);
for (const w of extra) console.log(`  ${w.title} (${w.year}) — ${w.externalIds?.imdb}`);
const out = [...shows.map((q) => cards.get(q)!), ...extra].sort((a, b) => a.title.localeCompare(b.title, 'ru'));

if (!DRY) {
  writeFileSync(new URL('../src/mocks/tvPrograms.ts', import.meta.url), `// Сгенерировано tools/tv-programs.mts (${new Date().toISOString().slice(0, 10)}): телепередачи справочника — реалити,
// ток-шоу, конкурсы, игры. Сопоставление роликов и постов их не ищет (tools/works-index.mts). Не править руками.
export const tvPrograms: string[] = [
${out.map((w) => `  ${JSON.stringify(w.id)}, // ${w.title} (${w.year})`).join('\n')}
];
`);
  console.log('→ src/mocks/tvPrograms.ts');
}
