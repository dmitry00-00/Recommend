// Порнография и эротика по Wikidata (18.10, координатор волны В: в срезах --ru-shorts и хвоста кино нашлись «Зелёное порно»,
// «Hentai Sex School», «Sex-вампир в России»). Правило — по классу (P31) и жанру (P136) элемента, с подклассами (P279*):
//   • порно — порнографический фильм (Q185529) и хентай (Q172067) с подклассами всегда; порнография (Q291) с подклассами —
//     кроме веток эротики ниже (сексплотейшн и мягкая порнография числятся в Wikidata подклассами порнографии, и без этого
//     в порно попадали «Эммануэль», «Шоугёлз», «Супер Майк», «Глен или Гленда»). В справочник не идёт вовсе: сборщики не
//     заводят, уже заведённое — в withheldWorks;
//   • эротика — эротический фильм (Q599558), мягкая порнография (Q2000136), сексплотейшн (Q2292320), эротический триллер
//     (Q2439025), пинку эйга (Q1194365), «секс-фильм» (Q2275499) и подклассы, кроме секс-комедии (Q2991560: «Американский
//     пирог», итальянские commedia sexy — комедии, не эротика). Карточка остаётся (поиск, страница), но в подбор не идёт —
//     heldWorks, как эзотерика и агитки (решение владельца 13.10);
//   • `OVERRIDE` — известные фильмы, у которых жанр «порнофильм» в Wikidata спорен: им — эротика (карточка остаётся,
//     в подбор нет), а решение — за владельцем.
// Классы-корни раскрываются один раз (кэш .cache/adult-classes.json, при смене корней — заново); ответы по элементам —
// .cache/adult-wd.json (элемент → 'porn' | 'erotic' | ''), повторный прогон спрашивает только новые элементы.
//   import { adultOf } from './adult-lib.mts';  const kinds = await adultOf(['Q…', …]);  // Map: только найденное
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UA = 'recomend/0.1 (https://github.com/dmitry00-00/Recommend)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** всегда порно */
const HARD_ROOTS = ['Q185529', 'Q172067'];
/** порно, кроме веток эротики */
const PORN_ROOTS = ['Q291'];
const EROTIC_ROOTS = ['Q599558', 'Q2000136', 'Q2292320', 'Q2439025', 'Q1194365', 'Q2275499'];
/** 18.10: «Калигула» (1979) и «Сербский фильм» (2010) — жанр «порнофильм» в Wikidata; не убираем совсем, а откладываем */
const OVERRIDE: Record<string, AdultKind> = { Q217685: 'erotic', Q300552: 'erotic' };
/** не эротика: секс-комедия и её подклассы */
const NOT_EROTIC_ROOTS = ['Q2991560'];
const SIG = JSON.stringify([HARD_ROOTS, PORN_ROOTS, EROTIC_ROOTS, NOT_EROTIC_ROOTS]);
/** ответы по элементам хранят сами классы из всех веток — перестановка правил (что порно, что эротика) не требует спрашивать
 *  заново; заново — только если сменился набор корней */
const ITEM_SIG = JSON.stringify([...HARD_ROOTS, ...PORN_ROOTS, ...EROTIC_ROOTS, ...NOT_EROTIC_ROOTS].sort());
const root = new URL('../', import.meta.url);
const CLASSES = new URL('.cache/adult-classes.json', root);
const CACHE = new URL('.cache/adult-wd.json', root);

type Row = Record<string, { value: string } | undefined>;
async function sparql(query: string): Promise<Row[] | undefined> {
  for (let a = 0; a < 5; a++) {
    const r = await fetch('https://query.wikidata.org/sparql', {
      method: 'POST', body: new URLSearchParams({ query }),
      headers: { 'User-Agent': UA, Accept: 'application/sparql-results+json', 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(90000),
    }).catch(() => undefined);
    if (r?.ok) { const j = await r.json().catch(() => undefined) as { results: { bindings: Row[] } } | undefined; if (j) return j.results.bindings; }
    // 429 — Wikidata просит подождать
    await sleep(r?.status === 429 ? (Number(r.headers.get('retry-after')) || 60) * 1000 : 3000 * (a + 1));
  }
  return undefined;
}
const qid = (u?: { value: string }) => u?.value.split('/').pop() ?? '';

async function closure(roots: string[]): Promise<Set<string>> {
  const rows = await sparql(`SELECT DISTINCT ?c WHERE { VALUES ?r { ${roots.map((q) => `wd:${q}`).join(' ')} } ?c wdt:P279* ?r }`);
  if (!rows) throw new Error('adult-lib: подклассы не получены');
  return new Set([...roots, ...rows.map((b) => qid(b.c))]);
}
let sets: { porn: Set<string>; erotic: Set<string>; any: Set<string> } | undefined;
async function classSets() {
  if (sets) return sets;
  const saved = existsSync(CLASSES) ? JSON.parse(readFileSync(CLASSES, 'utf8')) as { sig: string; porn: string[]; erotic: string[]; any: string[] } : undefined;
  if (saved?.sig === SIG && saved.any) return (sets = { porn: new Set(saved.porn), erotic: new Set(saved.erotic), any: new Set(saved.any) });
  const hard = await closure(HARD_ROOTS);
  await sleep(1000);
  const notErotic = await closure(NOT_EROTIC_ROOTS);
  await sleep(1000);
  const eroticTree = await closure(EROTIC_ROOTS);
  await sleep(1000);
  const pornTree = await closure(PORN_ROOTS);
  const porn = new Set([...hard, ...[...pornTree].filter((c) => !eroticTree.has(c))]);
  const erotic = new Set([...eroticTree].filter((c) => !notErotic.has(c) && !porn.has(c)));
  const any = new Set([...hard, ...pornTree, ...eroticTree, ...notErotic]);
  writeFileSync(CLASSES, JSON.stringify({ sig: SIG, porn: [...porn], erotic: [...erotic], any: [...any] }));
  return (sets = { porn, erotic, any });
}

export type AdultKind = 'porn' | 'erotic';
/** Порно или эротика среди элементов — Map только найденного. Не получилось спросить — элемент не в счёт (спросится в
 *  следующий раз) и предупреждение в stderr. */
export async function adultOf(qids: Iterable<string>, { fresh = false }: { fresh?: boolean } = {}): Promise<Map<string, AdultKind>> {
  const { porn, erotic, any } = await classSets();
  const cache: Record<string, string[]> & { _sig?: string } = !fresh && existsSync(CACHE) ? JSON.parse(readFileSync(CACHE, 'utf8')) : {};
  if ((cache as { _sig?: string })._sig !== ITEM_SIG || Object.values(cache).some((v) => typeof v === 'string' && v !== ITEM_SIG)) {
    for (const k of Object.keys(cache)) delete cache[k];
    (cache as { _sig?: string })._sig = ITEM_SIG;
  }
  const list = [...qids];
  const ask = [...new Set(list)].filter((q) => /^Q\d+$/.test(q) && !(q in cache));
  let lost = 0;
  for (let i = 0; i < ask.length; i += 400) {
    const part = ask.slice(i, i + 400);
    const rows = await sparql(`SELECT ?f ?c WHERE { VALUES ?f { ${part.map((q) => `wd:${q}`).join(' ')} } ?f wdt:P31|wdt:P136 ?c }`);
    if (!rows) { lost += part.length; continue; }
    for (const q of part) cache[q] = [];
    for (const b of rows) {
      const f = qid(b.f), c = qid(b.c);
      if (any.has(c) && !cache[f].includes(c)) cache[f].push(c);
    }
    if ((i / 400) % 10 === 9) writeFileSync(CACHE, JSON.stringify(cache));
    await sleep(1000);
  }
  writeFileSync(CACHE, JSON.stringify(cache));
  if (lost) console.error(`  порно и эротика: ${lost} элементов не спрошено (Wikidata не ответила) — спросятся в следующий раз`);
  const out = new Map<string, AdultKind>();
  for (const q of list) {
    const cs = cache[q];
    if (!Array.isArray(cs)) continue;
    const k: AdultKind | undefined = cs.some((c) => porn.has(c)) ? 'porn' : cs.some((c) => erotic.has(c)) ? 'erotic' : undefined;
    if (k) out.set(q, OVERRIDE[q] ?? k);
  }
  return out;
}
