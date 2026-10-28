// Яндекс Книги → книжная история (27.10, профиль @SbSubzero по просьбе владельца): страницы профиля, сохранённые
// обходом tools/yandex-books-walk.mjs (вкладка Chrome, прокрутка в темпе человека) в .cache/books/yandex/<логин>/ →
// seeds/books/yandex-<логин>.json в формате tools/book-profile-seed.mts (source / watched / ratings / unmatched).
// Сам импорт к Яндексу не обращается: robots.txt закрывает профили (/@…) и /api/ для роботов, поэтому только то, что
// открыто вкладкой по слову владельца.
//   npx tsx tools/import-yandex-books.mts <логин> [--dry]
// Что берём: «Законченные» (books/finished — текстовые, аудиокниги, комиксы: три переключателя) — прочитано; «Впечатления»
// (impressions) — «Советую» → raw 8, «Не советую» → raw 4 (оценка 4 и 2, шкала raw 1–10 как у Goodreads); книга с
// впечатлением, но не в «Законченных», тоже прочитана. «Добавленные» и «Открытые» — полка, не история: не берём.
// Сопоставление — makeMatcher из tools/import-livelib.mts (название + фамилия автора по каталогу bookBase, без сети).
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeMatcher, type LlBook } from './import-livelib.mts';

const [login] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const DRY = process.argv.includes('--dry');
if (!login || !/^[A-Za-z0-9_.-]+$/.test(login)) { console.error('npx tsx tools/import-yandex-books.mts <логин> [--dry]'); process.exit(2); }
const SRC = `.cache/books/yandex/${login}`;
if (!existsSync(SRC)) { console.error(`нет страниц: ${SRC} (сначала node tools/yandex-books-walk.mjs ${login})`); process.exit(2); }

const unent = (s: string) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
interface YBook { id: string; title: string; author?: string; kind: 'books' | 'audiobooks' | 'comicbooks'; raw?: number; finished?: boolean }

/** карточки книг страницы: ссылка /books|audiobooks|comicbooks/<id> с title и авторы карточки (authors-list title) */
function cards(html: string, from: string): { id: string; kind: YBook['kind']; title: string; author?: string; chunk: string }[] {
  const out: ReturnType<typeof cards> = [];
  const parts = html.split(new RegExp(`(?=<(?:div|li) [^>]*class="(?:${from}))`));
  for (const c of parts.slice(1)) {
    // «Народное творчество» — не автор («Калевала»): без него книга сводится по одному названию
    const au = /class="authors-list[^"]*" title="([^"]*)"/.exec(c)?.[1]?.replace(/^Народное творчество$/, '') || undefined;
    const author = au ? { author: unent(au).trim() } : {};
    const a = /<a href="\/(books|audiobooks|comicbooks)\/([A-Za-z0-9]+)" title="([^"]*)"/.exec(c);
    if (a) { out.push({ kind: a[1] as YBook['kind'], id: a[2], title: unent(a[3]).trim(), ...author, chunk: c }); continue; }
    // снятая с площадки книга («недоступно»): ссылки нет, название — в <div class="book__title"><div title="…">
    const t = /class="(?:book|audiobook|comicbook)__title"><div title="([^"]*)"/.exec(c)?.[1];
    const kind = (/^<(?:div|li) class="(audio|comic)?book/.exec(c)?.[1] ?? '') + 'books' as YBook['kind'];
    if (t) out.push({ kind, id: `t:${unent(t).trim()}|${au ?? ''}`, title: unent(t).trim(), ...author, chunk: c });
  }
  return out;
}

const books = new Map<string, YBook>();
const files = readdirSync(SRC).filter((f) => f.endsWith('.html')).sort();
for (const f of files.filter((x) => x.startsWith('finished'))) {
  const html = readFileSync(join(SRC, f), 'utf8');
  for (const c of cards(html, '(?:book|audiobook|comicbook) (?:book|audiobook|comicbook)_grid')) {
    const key = `${c.kind}/${c.id}`;
    books.set(key, { ...books.get(key), id: c.id, kind: c.kind, title: c.title, ...(c.author ? { author: c.author } : {}), finished: true });
  }
}
let impressions = 0;
for (const f of files.filter((x) => x.startsWith('impressions'))) {
  const html = readFileSync(join(SRC, f), 'utf8');
  for (const part of html.split('data-e2e="impression" ').slice(1)) {
    const verdict = /data-e2e="emotion\.thumbsup"/.test(part) ? 8 : /data-e2e="emotion\.thumbsdown"/.test(part) ? 4 : undefined;
    const c = cards(part, '(?:book|audiobook|comicbook) (?:book|audiobook|comicbook)_list')[0];
    // «Рекомендации команды Яндекс Книг» — подборка самой площадки, не книга
    if (!c || !c.author) continue;
    impressions++;
    const key = `${c.kind}/${c.id}`;
    books.set(key, { ...books.get(key), id: c.id, kind: c.kind, title: c.title, author: c.author, ...(verdict ? { raw: verdict } : {}) });
  }
}
console.log(`${SRC}: страниц ${files.length}, законченных ${[...books.values()].filter((b) => b.finished).length}, впечатлений о книгах ${impressions}`);

const { bookBase } = await import('../src/mocks/bookBase.ts');
const { bookWorks } = await import('../src/mocks/bookWorks.ts');
const { applyWorkFixes } = await import('../src/lib/workFixesTable.ts');
// каталог с правками (русские названия переводных книг, у которых в Wikidata только английская метка)
const match = makeMatcher(bookBase.map((b) => applyWorkFixes(b)), bookWorks);
type Seed = {
  source: { site: 'yandex'; user: string }; resolvedAt: string;
  watched: { workId: string }[]; ratings: { workId: string; rating: 1 | 2 | 3 | 4 | 5; raw: number }[];
  unmatched: { ref: string; title: string; author?: string; raw?: number; kind: string; why: string }[];
};
const seen = new Set<string>(), rated = new Map<string, Seed['ratings'][number]>(), unmatched: Seed['unmatched'] = [];
const why = new Map<string, number>();
for (const b of books.values()) {
  const r = match({ id: b.id, title: b.title, ...(b.author ? { author: b.author } : {}) } as LlBook);
  if ('miss' in r) {
    why.set(r.miss, (why.get(r.miss) ?? 0) + 1);
    unmatched.push({ ref: `yandex:${b.kind}/${b.id}`, title: b.title, ...(b.author ? { author: b.author } : {}), ...(b.raw ? { raw: b.raw } : {}), kind: b.kind, why: r.miss });
    continue;
  }
  seen.add(r.workId);
  if (b.raw) rated.set(r.workId, { workId: r.workId, rating: Math.round(b.raw / 2) as 2 | 4, raw: b.raw });
}
const seed: Seed = { source: { site: 'yandex', user: login }, resolvedAt: new Date().toISOString(),
  watched: [...seen].map((workId) => ({ workId })), ratings: [...rated.values()], unmatched };
const file = `seeds/books/yandex-${login}.json`;
console.log(`${DRY ? '(--dry) ' : ''}→ ${file}: книг ${books.size}, в каталоге ${seen.size}, оценок ${rated.size}; вне каталога ${unmatched.length}`);
if (why.size) console.log(`  мимо: ${[...why].map(([k, v]) => `${k} ${v}`).join(' · ')}`);
if (!DRY) {
  mkdirSync('seeds/books', { recursive: true });
  writeFileSync(`${file}.tmp`, `${JSON.stringify(seed, null, 1)}\n`);
  renameSync(`${file}.tmp`, file);
}
