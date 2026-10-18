// Порнография и эротика во всём справочнике кино (18.10, волна В): правило tools/adult-lib.mts (P31/P136 Wikidata с
// подклассами) — по всем фильмам и сериалам справочника с элементом Wikidata, а не только по новым карточкам
// grow-film-base: фильмы заводят и expand-film-base, и grow-from-channels, и прежние прогоны роста.
//   • порно → src/mocks/withheldWorks.ts `withheldWorks` (нет в приложении совсем);
//   • эротика → `heldWorks` (карточка есть, в подбор не идёт и черновой разметки не получает).
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

// раздел своего прежнего прогона не в счёт «уже есть руками»: он перегенерируется. Раздел только растёт: карточка, убранная
// им в withheldWorks, справочником больше не отдаётся (base-have) и в следующий раз не проверяется — её запись остаётся
const src = readFileSync(FILE, 'utf8');
const own = (dict: string) => {
  const at = src.indexOf(`${BEGIN}${dict}`);
  if (at < 0) return new Map<string, string>();
  const end = src.indexOf(END, at);
  return new Map([...src.slice(at, end).matchAll(/^  '([^']+)': ("(?:[^"\\]|\\.)*"),$/gm)].map((m) => [m[1], JSON.parse(m[2]) as string]));
};
const ownPorn = own('порнография'), ownErotic = own('эротика');
const porn = new Map<string, string>(ownPorn), erotic = new Map<string, string>([...ownErotic].filter(([k]) => !ownPorn.has(k)));
for (const [q, kind] of kinds) for (const c of byQ.get(q) ?? []) {
  const label = `${c.title}${c.year ? ` (${c.year})` : ''} — ${kind === 'porn' ? 'порнография' : 'эротика'} по P31/P136 Wikidata (${q}, ${c.module})`;
  if (kind === 'porn' && !(c.key in withheldWorks && !ownPorn.has(c.key))) porn.set(c.key, label);
  if (kind === 'erotic' && !(c.key in heldWorks && !ownErotic.has(c.key)) && !(c.key in withheldWorks)) erotic.set(c.key, label);
}
for (const k of porn.keys()) erotic.delete(k);
console.log(`порно: ${porn.size}`);
for (const l of [...porn.values()].sort()) console.log(`  ${l}`);
console.log(`эротика: ${erotic.size}`);
for (const l of [...erotic.values()].sort()) console.log(`  ${l}`);
if (!WRITE) process.exit(0);

const block = (dict: string, m: Map<string, string>) => [`${BEGIN}${dict} (${new Date().toISOString().slice(0, 10)}), не править руками — перегенерировать ──`,
  ...[...m].sort(([a], [b]) => a.localeCompare(b)).map(([k, l]) => `  ${JSON.stringify(k).replace(/^"|"$/g, "'")}: ${JSON.stringify(l)},`), `${END} ──`].join('\n');
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
