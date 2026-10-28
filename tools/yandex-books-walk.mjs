// Обход профиля Яндекс Книг вкладкой Chrome (27.10, слово владельца «пройтись вкладкой в браузере, как с Кинопоиском»):
// открывает «Законченные» (текстовые, аудиокниги, комиксы — переключатель) и «Впечатления», листает до конца в темпе
// человека (пауза 2,5–4,5 с) и сохраняет страницы в .cache/books/yandex/<логин>/ — их разбирает tools/import-yandex-books.mts.
// Скриптом сайт не опрашиваем (robots.txt закрывает /@… и /api/): только то, что показывает открытая вкладка. Капча — стоп,
// обходить не пробуем.
//   node tools/yandex-books-walk.mjs <логин>        (логин — из адреса books.yandex.ru/@<логин>)
// Chrome без окна, свой профиль в .cache/books/yandex/.chrome; окно низкое (700 точек): при высоком первые 20 карточек
// помещаются целиком, прокрутки нет — и следующая страница списка не запрашивается.
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const login = process.argv[2];
if (!login || !/^[A-Za-z0-9_.-]+$/.test(login)) { console.error('node tools/yandex-books-walk.mjs <логин>'); process.exit(2); }
const OUT = `.cache/books/yandex/${login}`;
mkdirSync(OUT, { recursive: true });
const PORT = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', ['--headless=new', `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${process.cwd()}/.cache/books/yandex/.chrome`, '--window-size=1280,700', '--lang=ru', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 20 && !ws; i++) {
  await sleep(500);
  try { const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json(); ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl); } catch {}
}
if (!ws) { chrome.kill(); console.error('Chrome не поднялся'); process.exit(1); }
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const wait = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && wait.has(m.id)) { wait.get(m.id)(m); wait.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; wait.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, returnByValue: true })).result?.result?.value;
await send('Page.enable');

const CARDS = `.book_grid, .audiobook_grid, .comicbook_grid, [data-e2e="impression"]`;
/** открыть, переключить вид (кроме «Текстовые» — он по умолчанию), листать, пока число карточек 10 раз подряд не меняется */
async function walk(path, kind, file) {
  await send('Page.navigate', { url: `https://books.yandex.ru/@${login}/${path}` });
  await sleep(8000);
  if (kind) {
    await ev(`document.querySelector('.user-added-switcher__button')?.click()`); await sleep(1200);
    await ev(`[...document.querySelectorAll('.user-added-switcher__content-option')].find((x) => x.textContent.trim() === ${JSON.stringify(kind)})?.click()`);
    await sleep(5000);
  }
  let last = -1, same = 0;
  for (let i = 0; i < 600 && same < 10; i++) {
    if (/captcha/i.test(await ev('location.href'))) { console.log('  капча — стоп'); return false; }
    const n = await ev(`document.querySelectorAll('${CARDS}').length`);
    if (n === last) same++; else { same = 0; last = n; }
    await ev(`(() => { const c = document.querySelectorAll('${CARDS}'); c[c.length - 1]?.scrollIntoView({ block: 'end' }); window.scrollBy(0, 600); })()`);
    await sleep(2500 + Math.random() * 2000);
    await ev('window.scrollBy(0, -300)'); await sleep(400); await ev('window.scrollTo(0, document.body.scrollHeight)');
  }
  writeFileSync(`${OUT}/${file}`, await ev('document.documentElement.outerHTML'));
  console.log(`  ${path}${kind ? ` · ${kind}` : ''}: карточек ${last} → ${OUT}/${file}`);
  return true;
}

try {
  for (const [path, kind, file] of [['books/finished', '', 'finished-text.html'], ['books/finished', 'Аудиокниги', 'finished-audio.html'],
    ['books/finished', 'Комиксы', 'finished-comics.html'], ['impressions', '', 'impressions.html']]) {
    if (!(await walk(path, kind, file))) break;
    await sleep(4000);
  }
} finally { ws.close(); chrome.kill(); }
