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
const SHOW_GENRE = /reality|talk show|game show|talent show|news|variety|quiz|dating|cooking show|competition|tabloid|infotainment|magazine format/i;
const SCRIPTED = /sitcom|drama|mockumentary|pseudo-documentary|anim|comedy television series|soap opera|telenovela|science fiction|fantasy|thriller|horror/i;

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
const cards = new Map(worksIndex({ all: true }).filter((w) => w.work.type === 'series' && /^f-wd\d+$/.test(w.work.id)).map((w) => [`Q${w.work.id.slice(4)}`, w.work]));
const qids = [...cards.keys()];
const labels = new Map<string, string[]>();
for (let i = 0; i < qids.length; i += 300) {
  const rows = await sparql(`SELECT ?f ?l WHERE { VALUES ?f { ${qids.slice(i, i + 300).map((q) => `wd:${q}`).join(' ')} }
    { ?f wdt:P31 ?x } UNION { ?f wdt:P136 ?x } ?x rdfs:label ?l FILTER(lang(?l) = 'en') }`);
  for (const r of rows) { const q = r.f.value.split('/').pop()!; labels.set(q, [...(labels.get(q) ?? []), r.l.value]); }
  await sleep(800);
}
const shows = qids.filter((q) => {
  const ls = labels.get(q) ?? [];
  return ls.some((l) => SHOW_CLASS.test(l) || SHOW_GENRE.test(l)) && !ls.some((l) => SCRIPTED.test(l));
}).sort((a, b) => cards.get(a)!.title.localeCompare(cards.get(b)!.title, 'ru'));
console.log(`сериалов с элементом Wikidata: ${qids.length}, из них передач: ${shows.length}`);
for (const q of shows) console.log(`  ${cards.get(q)!.title} (${cards.get(q)!.year}) — ${(labels.get(q) ?? []).filter((l) => SHOW_CLASS.test(l) || SHOW_GENRE.test(l)).join(', ')}`);

if (!DRY) {
  writeFileSync(new URL('../src/mocks/tvPrograms.ts', import.meta.url), `// Сгенерировано tools/tv-programs.mts (${new Date().toISOString().slice(0, 10)}): телепередачи справочника — реалити,
// ток-шоу, конкурсы, игры. Сопоставление роликов и постов их не ищет (tools/works-index.mts). Не править руками.
export const tvPrograms: string[] = [
${shows.map((q) => `  ${JSON.stringify(cards.get(q)!.id)}, // ${cards.get(q)!.title} (${cards.get(q)!.year})`).join('\n')}
];
`);
  console.log('→ src/mocks/tvPrograms.ts');
}
