// Порнография и эротика во всём справочнике кино (18.10, волна В): правило tools/adult-lib.mts (P31/P136 Wikidata с
// подклассами) — по всем фильмам и сериалам справочника с элементом Wikidata, а не только по новым карточкам
// grow-film-base: фильмы заводят и expand-film-base, и grow-from-channels, и прежние прогоны роста.
//   • порно → src/mocks/withheldWorks.ts `withheldWorks` (нет в приложении совсем);
//   • эротика → `heldWorks` (карточка есть, в подбор не идёт и черновой разметки не получает) — только вне канона: меньше
//     --erotic-canon (25) разделов Википедии. Жанр «эротика» в Wikidata стоит и у «Жизни Адель», «С широко закрытыми
//     глазами», «Пианистки», «Последнего танго в Париже», «Служанки» — их из подбора убирать без владельца нельзя; такие —
//     списком в выводе («эротика в каноне — решать владельцу»), в словарь не пишутся.
// Пишет свой раздел в конце каждого словаря (между отметками «tools/adult-sweep.mts»), раздел перегенерируется целиком;
// записи, что уже есть в словаре руками, не повторяет. Без --write — только список.
//   npx tsx tools/adult-sweep.mts [--write] [--fresh]
// Ночной сбор (tools/collect.mts) — после роста справочника, до канона копий.
import { readFileSync, writeFileSync } from 'node:fs';
import { baseWorks, qidOfCard } from './base-have.mts';
import { adultOf } from './adult-lib.mts';
import { withheldWorks, heldWorks } from '../src/mocks/withheldWorks.ts';

const WRITE = process.argv.includes('--write');
const FRESH = process.argv.includes('--fresh');
const FILE = new URL('../src/mocks/withheldWorks.ts', import.meta.url);
const BEGIN = '  // ── tools/adult-sweep.mts: ', END = '  // ── конец раздела tools/adult-sweep.mts';

const cards = baseWorks({ aliases: true }).filter(({ work }) => work.type !== 'book');
const byQ = new Map<string, { key: string; title: string; year?: number; module: string }[]>();
let noQ = 0;
for (const { module, work, keys } of cards) {
  const q = qidOfCard(work);
  if (!q || !keys[0]) { noQ++; continue; }
  byQ.set(q, [...(byQ.get(q) ?? []), { key: keys[0], title: work.title, year: work.year, module }]);
}
console.error(`фильмов и сериалов справочника: ${cards.length}, с элементом Wikidata — ${byQ.size} элементов (без элемента ${noQ} — не проверяются)`);
const kinds = await adultOf(byQ.keys(), { fresh: FRESH });
const EROTIC_CANON = Number(process.argv[process.argv.indexOf('--erotic-canon') + 1]) || 25;
// число разделов Википедии у эротики — одним запросом на 400 элементов
const links = new Map<string, number>();
{
  const ero = [...kinds].filter(([, k]) => k === 'erotic').map(([q]) => q);
  for (let i = 0; i < ero.length; i += 400) {
    const part = ero.slice(i, i + 400);
    const r = await fetch('https://query.wikidata.org/sparql', { method: 'POST',
      body: new URLSearchParams({ query: `SELECT ?f ?n WHERE { VALUES ?f { ${part.map((q) => `wd:${q}`).join(' ')} } ?f wikibase:sitelinks ?n }` }),
      headers: { 'User-Agent': 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)', Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' } }).catch(() => undefined);
    const j = r?.ok ? await r.json().catch(() => undefined) as { results: { bindings: Record<string, { value: string }>[] } } | undefined : undefined;
    if (!j) { console.error('  разделы эротики не получены — эротику в этот раз не пишу'); process.exit(3); }
    for (const b of j.results.bindings) links.set(b.f.value.split('/').pop()!, Number(b.n.value));
    await new Promise((res) => setTimeout(res, 1000));
  }
}
const eroticCanon: string[] = [];

// раздел своего прежнего прогона не в счёт «уже есть руками»: он перегенерируется. Раздел только растёт: карточка, убранная
// им в withheldWorks, справочником больше не отдаётся (base-have) и в следующий раз не проверяется — её запись остаётся
const src = readFileSync(FILE, 'utf8');
const own = (dict: string) => {
  const at = src.indexOf(`${BEGIN}${dict}`);
  if (at < 0) return new Map<string, string>();
  const end = src.indexOf(END, at);
  return new Map([...src.slice(at, end).matchAll(/^  '([^']+)': '[^']*', \/\/ (.*)$/gm)].map((m) => [m[1], m[2]]));
};
const ownPorn = own('порнография'), ownErotic = own('эротика');
const porn = new Map<string, string>(ownPorn), erotic = new Map<string, string>([...ownErotic].filter(([k]) => !ownPorn.has(k)));
for (const [q, kind] of kinds) for (const c of byQ.get(q) ?? []) {
  const label = `${c.title}${c.year ? ` (${c.year})` : ''} — ${q}, ${c.module}`;
  if (kind === 'porn' && !(c.key in withheldWorks && !ownPorn.has(c.key))) porn.set(c.key, label);
  if (kind === 'erotic' && (links.get(q) ?? 0) >= EROTIC_CANON) { eroticCanon.push(`${c.title}${c.year ? ` (${c.year})` : ''} — ${links.get(q)} разд. (${q}, ${c.module})`); continue; }
  if (kind === 'erotic' && !(c.key in heldWorks && !ownErotic.has(c.key)) && !(c.key in withheldWorks)) erotic.set(c.key, label);
}
for (const k of porn.keys()) erotic.delete(k);
console.log(`порно: ${porn.size}`);
for (const l of [...porn.values()].sort()) console.log(`  ${l}`);
console.log(`эротика (вне канона, меньше ${EROTIC_CANON} разделов): ${erotic.size}`);
for (const l of [...erotic.values()].sort()) console.log(`  ${l}`);
console.log(`эротика в каноне — решать владельцу, в словарь не пишется: ${eroticCanon.length}`);
for (const l of eroticCanon.sort()) console.log(`  ${l}`);
// по названию похоже, а по классу и жанру — нет (у элемента их часто нет вовсе): только список — проверить руками
const LOOKS = /(?:^|[^\p{L}])(?:sex|секс|порно|porn|xxx|эрот|erotic|hentai|хентай)/iu;
const looks = cards.filter(({ work, keys }) => LOOKS.test(`${work.title} ${work.originalTitle ?? ''}`) && !kinds.has(qidOfCard(work) ?? '')
  && !(keys[0] in withheldWorks) && !(keys[0] in heldWorks));
console.log(`по названию похоже на взрослое, класса и жанра нет — проверить руками: ${looks.length}`);
for (const { work, module, keys } of looks) console.log(`  ${work.title}${work.year ? ` (${work.year})` : ''} — ${keys[0]}, ${module}`);
if (!WRITE) process.exit(0);

const block = (dict: string, m: Map<string, string>) => [`${BEGIN}${dict} (${new Date().toISOString().slice(0, 10)}), не править руками — перегенерировать ──`,
  // значение — одно слово, название и элемент — в комментарии: словарь едет в первой загрузке (src/api/index.ts импортирует
  // его статически), а комментарии сборка выбрасывает — 330 записей с подписью весили 7 КБ сжатыми (бюджет tools/load-budget.mjs)
  ...[...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => `  '${k}': '${dict === 'порнография' ? 'порно' : 'эротика'}', // ${l.replace(/\n/g, ' ')}`), `${END} ──`].join('\n');
/** раздел в словаре `name`: заменить прежний или вставить перед закрывающей скобкой словаря */
function put(text: string, name: string, dict: string, m: Map<string, string>): string {
  const start = text.indexOf(`export const ${name}: Record<string, string> = {`);
  if (start < 0) throw new Error(`нет словаря ${name}`);
  const close = text.indexOf('\n};', start);
  const at = text.indexOf(`${BEGIN}${dict}`, start);
  if (at >= 0 && at < close) {
    const end = text.indexOf('\n', text.indexOf(END, at));
    return text.slice(0, at) + block(dict, m) + text.slice(end);
  }
  return `${text.slice(0, close)}\n${block(dict, m)}${text.slice(close)}`;
}
let out = put(src, 'withheldWorks', 'порнография', porn);
out = put(out, 'heldWorks', 'эротика', erotic);
writeFileSync(FILE, out);
console.error(`→ src/mocks/withheldWorks.ts: порно ${porn.size} (withheldWorks), эротика ${erotic.size} (heldWorks)`);
