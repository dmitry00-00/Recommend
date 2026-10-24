// Проверка разбора закладки LiveLib (23.10): llParse из tools/livelib-helper.js на своих, выдуманных страницах — без
// браузера и без LiveLib (настоящую разметку мы не видели и не скачиваем). DOM — крошечный разборщик HTML ниже: ровно то,
// чем пользуется llParse (childNodes, nodeType, tagName, nodeValue, getAttribute). Плюс сопоставление и шкала импорта.
//
//   npx tsx tools/livelib-helper-test.mts
//
// Страница А — «как могла бы быть» LiveLib: карточки div.book-item-manage, заголовки месяцев, боковые «похожие книги»
// (должны отпасть), оценки пятью способами (догадка по числу, schema.org, «Моя оценка», звёзды значками в user-rating,
// без оценки), постраничник …/read/~7. Страница Б — таблица, абсолютные ссылки и ?page=. Страница В — без списка.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeMatcher, scale } from './import-livelib.mts';

// ─── крошечный DOM ──────────────────────────────────────────────────────────
interface N { nodeType: 1 | 3; tagName: string; nodeValue: string; attrs: Record<string, string>; childNodes: N[]; getAttribute(n: string): string | null }
const VOID = /^(area|base|br|col|embed|hr|img|input|link|meta|source|track|wbr)$/i;
const RAW = /^(script|style)$/i;
const ent = (s: string) => s.replace(/&(nbsp|amp|lt|gt|quot|#39|#x([0-9a-f]+)|#(\d+));/gi, (_, n, h, d) =>
  h ? String.fromCodePoint(parseInt(h, 16)) : d ? String.fromCodePoint(Number(d)) : ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" } as Record<string, string>)[n.toLowerCase()]);
const el = (tag: string, attrs: Record<string, string> = {}): N => ({ nodeType: 1, tagName: tag.toUpperCase(), nodeValue: '', attrs, childNodes: [], getAttribute: (n) => attrs[n.toLowerCase()] ?? null });
function parseHtml(html: string): N {
  const root = el('body');
  const stack = [root];
  const re = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/gi;
  for (let m; (m = re.exec(html));) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) { top.childNodes.push({ ...el('#text'), nodeType: 3, nodeValue: ent(m[5]) }); continue; }
    if (m[1]) { const i = stack.map((x) => x.tagName).lastIndexOf(m[1].toUpperCase()); if (i > 0) stack.length = i; continue; }
    if (!m[2]) continue;
    const attrs: Record<string, string> = {};
    for (const a of (m[3] ?? '').matchAll(/([^\s=>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) attrs[a[1].toLowerCase()] = ent(a[2] ?? a[3] ?? a[4] ?? '');
    const node = el(m[2], attrs);
    if (/^(html|body|head)$/i.test(m[2])) continue;
    top.childNodes.push(node);
    if (RAW.test(m[2])) { const end = html.toLowerCase().indexOf(`</${m[2].toLowerCase()}`, re.lastIndex); re.lastIndex = end < 0 ? html.length : end; continue; }
    if (!VOID.test(m[2]) && !m[4]) stack.push(node);
  }
  return root;
}

// ─── llParse из закладки ────────────────────────────────────────────────────
const src = readFileSync(new URL('./livelib-helper.js', import.meta.url), 'utf8');
const body = src.slice(src.indexOf('/* разбор: начало'), src.indexOf('/* разбор: конец */'));
assert.ok(body.length > 1000, 'не нашёл в закладке границы разбора');
type Book = { id: string; title: string; author?: string; authorIds?: string[]; stars?: number; rateFrom?: string; at?: string; atMonth?: boolean; atFrom?: string; isbn?: string; url: string };
type Parsed = { books: Book[]; page: number; last: number; cards: number; kind?: string; rated: number; guessed: number; dated: number };
const llParse = new Function(`${body}\nreturn llParse;`)() as (root: N, path: string) => Parsed;

// ─── страница А ─────────────────────────────────────────────────────────────
const card = (id: string, slug: string, title: string, authors: [string, string][], extra = '') => `
  <div class="book-item-manage" id="book-item-${id}">
    <div class="book-item__inner">
      <a href="/book/${id}-${slug}" class="book-item__link"><img class="book-item__cover" alt="${title}" src="https://i.livelib.ru/boocover/${id}/200/x.jpg"></a>
      <div class="brow-data">
        <a class="brow-book-name with-cycle" href="/book/${id}-${slug}" title="${title}">${title}</a>
        <div class="brow-authors">${authors.map(([aid, name]) => `<a class="brow-book-author" href="/author/${aid}-x">${name}</a>`).join(', ')}</div>
        <div class="brow-ratings"><span class="rating-book" title="Средняя оценка книги">4.391</span>${extra}</div>
        <a href="/book/${id}-${slug}/reviews">Читать отзывы (1&nbsp;234)</a>
      </div>
    </div>
  </div>`;
const pageA = `<!doctype html><html><head><title>Прочитанное testreader — LiveLib</title>
<script>window.__INIT = { user: 1, csrf: "abc" }; if (a < b) {}</script><style>.x{color:red}</style></head>
<body>
<header class="header"><a href="/">LiveLib</a> <a href="/reader/me">Моя полка</a> <a href="/book/1000999999-reklamnaya-kniga">Книга дня</a></header>
<main class="main">
  <h1>Прочитанное</h1>
  <div class="blist-biglist">
    <h3 class="period">Октябрь 2026</h3>
    ${card('1000123456', 'master-i-margarita-mihail-bulgakov', 'Мастер и Маргарита', [['1234', 'Михаил Булгаков']], '<span class="rating-value stars-color-orange">4.5</span>')}
    ${card('1000654321', 'shining', 'Сияние', [['77', 'Стивен Кинг']], '<div itemprop="review" itemscope><div itemprop="reviewRating" itemscope><meta itemprop="ratingValue" content="3"><span>3</span></div></div>')}
    <h3 class="period">Сентябрь 2026</h3>
    ${card('1000000777', 'piknik', '«Пикник на обочине»', [['5', 'Аркадий Стругацкий'], ['6', 'Борис Стругацкий']], '<span class="label">Моя оценка: 5</span>')}
    ${card('1000000888', 'dracula', 'Дракула', [['8', 'Брэм Стокер']], '<span class="date">Прочитано: 12 сентября 2026</span>')}
    ${card('1000000999', 'onegin', 'Евгений Онегин', [['9', 'Александр Пушкин']], '<div class="user-rating"><i class="star star-full"></i><i class="star star-full"></i><i class="star star-full"></i><i class="star star-half"></i><i class="star"></i></div> <span>ISBN: 978-5-17-090000-1</span>')}
  </div>
  <div class="pagination"><a href="/reader/testreader/read/~2">2</a><a href="/reader/testreader/read/~3">3</a><a href="/reader/testreader/read/~7">7</a></div>
</main>
<aside class="sidebar"><h4>Похожие книги</h4><ul>
  <li class="side-book"><a href="/book/1000111111-a">Книга А</a></li>
  <li class="side-book"><a href="/book/1000111112-b">Книга Б</a></li>
  <li class="side-book"><a href="/book/1000111113-c">Книга В</a></li>
</ul></aside>
<footer><a href="/author/1-x">Автор месяца</a></footer>
</body></html>`;

const a = llParse(parseHtml(pageA), '/reader/testreader/read');
assert.equal(a.books.length, 5, `страница А: ждали 5 книг, вышло ${a.books.length}: ${a.books.map((b) => b.title).join(' | ')}`);
assert.equal(a.kind, 'div.book-item-manage');
assert.deepEqual([a.page, a.last], [1, 7]);
const by = Object.fromEntries(a.books.map((b) => [b.id, b]));
assert.equal(by['1000123456'].title, 'Мастер и Маргарита');
assert.equal(by['1000123456'].author, 'Михаил Булгаков');
assert.deepEqual(by['1000123456'].authorIds, ['1234']);
assert.equal(by['1000123456'].stars, 4.5);
assert.equal(by['1000123456'].rateFrom, 'guess', 'среднее 4.391 не должно стать оценкой — оценка 4.5 по догадке');
assert.equal(by['1000123456'].at, '2026-10-01'); assert.equal(by['1000123456'].atFrom, 'header'); assert.equal(by['1000123456'].atMonth, true);
assert.equal(by['1000123456'].url, '/book/1000123456-master-i-margarita-mihail-bulgakov');
assert.deepEqual([by['1000654321'].stars, by['1000654321'].rateFrom, by['1000654321'].at], [3, 'schema', '2026-10-01']);
assert.equal(by['1000000777'].title, 'Пикник на обочине', 'кавычки-ёлочки снимаются');
assert.equal(by['1000000777'].author, 'Аркадий Стругацкий, Борис Стругацкий');
assert.deepEqual([by['1000000777'].stars, by['1000000777'].rateFrom, by['1000000777'].at], [5, 'text', '2026-09-01']);
assert.equal(by['1000000888'].stars, undefined, 'без оценки — без оценки (среднее не берём)');
assert.deepEqual([by['1000000888'].at, by['1000000888'].atFrom, by['1000000888'].atMonth], ['2026-09-12', 'card', undefined]);
assert.deepEqual([by['1000000999'].stars, by['1000000999'].rateFrom, by['1000000999'].isbn], [3.5, 'label', '9785170900001']);
assert.ok(!a.books.some((b) => /^1000111/.test(b.id) || b.id === '1000999999'), 'боковые и шапка не в списке');
assert.deepEqual([a.rated, a.guessed, a.dated], [4, 1, 5]);

// ─── страница Б: таблица, абсолютные ссылки, ?page= ─────────────────────────
const row = (id: string, title: string, author: string, mine: string, date: string) => `<tr class="row">
  <td><a href="https://www.livelib.ru/book/${id}-x"><img alt="${title}"></a></td>
  <td><a href="https://www.livelib.ru/book/${id}-x">${title}</a><br><a href="https://www.livelib.ru/author/${id.slice(-3)}-y">${author}</a></td>
  <td class="avg">4,12</td><td><span title="Ваша оценка: ${mine} из 5" class="r">${mine}</span></td><td><time datetime="${date}">${date}</time></td></tr>`;
const pageB = `<table class="books"><tbody>
  ${row('2000000001', 'Мы', 'Евгений Замятин', '4', '2025-01-15')}
  ${row('2000000002', 'Оно', 'Стивен Кинг', '2,5', '2025-02-03')}
</tbody></table><nav><a href="/reader/Иван_Чит/read?page=2">дальше</a><a href="/reader/Иван_Чит/read?page=4">4</a></nav>`;
const b = llParse(parseHtml(pageB), '/reader/Иван_Чит/read?page=1');
assert.equal(b.books.length, 2);
assert.equal(b.kind, 'tr.row');
assert.deepEqual(b.books.map((x) => [x.title, x.author, x.stars, x.rateFrom, x.at]), [
  ['Мы', 'Евгений Замятин', 4, 'title', '2025-01-15'], ['Оно', 'Стивен Кинг', 2.5, 'title', '2025-02-03']]);
assert.equal(b.books[0].url, '/book/2000000001-x');
assert.deepEqual([b.page, b.last], [1, 4]);

// ─── страница В: списка нет ─────────────────────────────────────────────────
const c = llParse(parseHtml('<main><h1>Читатель скрыл полки</h1><a href="/reader/x">профиль</a></main>'), '/reader/x/read');
assert.equal(c.books.length, 0);

// ─── импорт: шкала и сопоставление ──────────────────────────────────────────
assert.deepEqual([scale(0.5), scale(1), scale(2.5), scale(3.5), scale(4.5), scale(5)],
  [{ raw: 1, rating: 1 }, { raw: 2, rating: 1 }, { raw: 5, rating: 3 }, { raw: 7, rating: 4 }, { raw: 9, rating: 5 }, { raw: 10, rating: 5 }]);
const match = makeMatcher([
  { id: 'b-wd1', title: 'Мастер и Маргарита', creators: ['Михаил Булгаков'] },
  { id: 'b-wd2', title: 'Мы', creators: ['Евгений Замятин'] },
  { id: 'b-wd3', title: 'Оно', originalTitle: 'It', creators: ['Стивен Кинг'] },
  { id: 'b-wd4', title: 'Пикник на обочине', creators: ['Аркадий Стругацкий', 'Борис Стругацкий'] },
  { id: 'b-wd5', title: 'Сияние', creators: ['Стивен Кинг'] },
  { id: 'b-wd6', title: 'Сияние', creators: ['Другой Автор'] },
  { id: 'b-wd7', title: 'Дракула', creators: ['Брэм Стокер'] },
], { '9785170900001': { wd: 'Q7' } });
assert.deepEqual(match({ id: '1', title: 'Мастер и Маргарита', author: 'Михаил Булгаков' }), { workId: 'b-wd1' });
assert.deepEqual(match({ id: '2', title: 'Мы', author: 'Евгений Замятин' }), { workId: 'b-wd2' }, 'короткое — с автором можно');
assert.ok('miss' in match({ id: '3', title: 'Мы' }), 'короткое без автора — мимо');
assert.deepEqual(match({ id: '4', title: 'Пикник на обочине', author: 'Борис Стругацкий, Аркадий Стругацкий' }), { workId: 'b-wd4' });
assert.deepEqual(match({ id: '5', title: 'Сияние', author: 'Стивен Кинг' }), { workId: 'b-wd5' }, 'одноимённые — по автору');
assert.ok('miss' in match({ id: '6', title: 'Сияние' }), 'одноимённые без автора — мимо');
assert.ok('miss' in match({ id: '7', title: 'Мастер и Маргарита', author: 'Кто-то Другой' }), 'автор другой — мимо');
assert.deepEqual(match({ id: '8', title: 'Евгений Онегин', isbn: '9785170900001' }), { workId: 'b-wd7' }, 'ISBN главнее названия');
assert.deepEqual(match({ id: '9', title: 'Мастер и Маргарита: роман', author: 'М. Булгаков' }), { workId: 'b-wd1' }, 'подзаголовок отрезается');
console.log('livelib-helper: разбор и импорт — ок');
