// Список прочитанного читателя → книги в справочник и профиль (11.10): тир-лист автора канала («Ламполоджи»),
// присланный список. Два выхода, и они разные по смыслу:
//   · .cache/book-lists/<имя>.json — только названия и авторы: их заводит в справочник tools/build-book-base.mts
//     (источник 5), это не личные данные;
//   · seeds/<имя>-books.json — оценки читателя (UserSeed): только локально, как все профили ЗП-46 — удалить при
//     отказе или через неделю тишины.
//   npx tsx tools/book-list.mts <файл .txt или .docx> <имя> ["почему, одной строкой"]
//
// Формат: строка-заголовок яруса, под ней книги «Название» Автор (маркеры •, -, * и номера — мимо). Ярус → оценка:
// известные названия (ТИРЫ) или по порядку — первый ярус 5, последний 1. Книга ищется в справочнике по названию (и
// русскому, и оригинальному) с той же фамилией автора; не нашлась — после пересборки справочника прогнать ещё раз.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { worksIndex } from './works-index.mts';
import { sameSurname } from './book-bridge.mts';

const [file, name, why] = process.argv.slice(2);
if (!file || !name || !existsSync(file)) { console.error('npx tsx tools/book-list.mts <файл .txt|.docx> <имя> ["почему"]'); process.exit(2); }
// .docx — текстом через textutil (macOS); .txt — как есть
const text = file.endsWith('.docx') ? execFileSync('textutil', ['-convert', 'txt', '-stdout', file], { encoding: 'utf8' }) : readFileSync(file, 'utf8');

/** известные названия ярусов; остальное — по порядку */
const TIERS: Record<string, 1 | 2 | 3 | 4 | 5> = {
  'база базовая': 5, 'хорошая книга': 4, 'не для всех': 3, 'ниже среднего': 2, 'кал говна': 1, 'вредное говно': 1, 'объект моей ненависти': 1,
  s: 5, a: 4, b: 3, c: 2, d: 1, f: 1,
};
type Row = { tier: string; title: string; author: string };
const rows: Row[] = [];
const tiers: string[] = [];
let tier = '';
for (const line of text.split('\n')) {
  // строка с маркером — книга, даже без кавычек («• Рассказы Акутагавы»); без маркера и без кавычек — ярус
  const bullet = /^\s*(?:[•*\-–—]|\d+[.)])/u.test(line);
  const l = line.replace(/^[\s•*\-–—\d.)]+/u, '').trim();
  if (!l) continue;
  const m = /^[«"“]([^»"”]+)[»"”]\s*(.*)$/u.exec(l);
  if (!m && !bullet) { tier = l; if (!tiers.includes(l)) tiers.push(l); continue; }
  rows.push(m ? { tier, title: m[1].replace(/\s*\(.*?\)\s*/g, ' ').trim(), author: m[2].replace(/\(.*?\)/g, '').trim() } : { tier, title: l, author: '' });
}
const ratingOf = (t: string): 1 | 2 | 3 | 4 | 5 => {
  const known = TIERS[t.toLowerCase()];
  if (known) return known;
  const i = tiers.indexOf(t), n = Math.max(tiers.length - 1, 1);
  return Math.max(1, Math.min(5, Math.round(5 - (4 * i) / n))) as 1 | 2 | 3 | 4 | 5;
};

// справочник: книги по названию
const fold = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const books = worksIndex({ all: true }).filter((w) => w.work.type === 'book');
const byTitle = new Map<string, typeof books>();
for (const w of books) for (const n of new Set([w.work.title, w.work.originalTitle, ...(w.bookNames ?? [])].filter(Boolean) as string[])) {
  const k = fold(n);
  (byTitle.get(k) ?? byTitle.set(k, []).get(k)!).push(w);
}
const authorsOf = (a: string) => a.split(/\s+и\s+|,\s*|\s*&\s*/).map((x) => x.trim()).filter(Boolean);
const found = rows.map((r) => {
  const cands = byTitle.get(fold(r.title)) ?? [];
  const named = authorsOf(r.author);
  const hit = cands.find((w) => !named.length || w.work.creators.some((c) => named.some((x) => sameSurname(x, c)))) ?? (named.length ? undefined : cands[0]);
  return { ...r, rating: ratingOf(r.tier), workId: hit?.work.id };
});

mkdirSync('.cache/book-lists', { recursive: true });
writeFileSync(`.cache/book-lists/${name}.json`, JSON.stringify({ why: why ?? `Список прочитанного: ${name}`, books: rows.map(({ title, author }) => ({ title, author })) }, null, 1));
const hits = found.filter((f) => f.workId);
mkdirSync('seeds', { recursive: true });
writeFileSync(`seeds/${name}-books.json`, JSON.stringify({
  source: `${why ?? name}; локально, удалить при отказе или через неделю тишины`,
  watched: hits.map((h) => ({ workId: h.workId })), ratings: hits.map((h) => ({ workId: h.workId, rating: h.rating })),
}, null, 1));
console.log(`книг в списке ${rows.length} (ярусы: ${tiers.map((t) => `${t} → ${ratingOf(t)}`).join(', ')})`);
console.log(`в справочнике ${hits.length}; названия → .cache/book-lists/${name}.json (их заведёт build-book-base), оценки → seeds/${name}-books.json`);
const miss = found.filter((f) => !f.workId);
if (miss.length) console.log(`не нашлось ${miss.length}: ${miss.slice(0, 30).map((m) => m.title).join(', ')}${miss.length > 30 ? '…' : ''}`);
