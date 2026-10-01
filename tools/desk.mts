// Общий пульт на http://127.0.0.1:8721 — две вкладки одной страницы:
//   /links/      — пульт ссылок (tools/links-desk.mts): ролики к фильмам и каналы из заметок;
//   /kinopoisk/  — импорт оценок с Кинопоиска (tools/kinopoisk-desk.mts).
// Запуск двойным щелчком — deploy/desk.command; `npx tsx tools/desk.mts [порт] [вкладка]`.
// Слушает только 127.0.0.1. Меняющие запросы — только со своей страницы: заголовок x-desk (чужой сайт
// в браузере не может поставить его без предварительного запроса CORS, а его мы не разрешаем) и Host
// (против DNS rebinding) — проверка здесь, общая для обеих вкладок.
import { createServer, type ServerResponse } from 'node:http';
import { kinopoiskRoute } from './kinopoisk-desk.mts';
import { linksRoute } from './links-desk.mts';

const PORT = Number(process.argv[2] ?? 8721);
const TABS = { links: linksRoute, kinopoisk: kinopoiskRoute } as const;

const deny = (res: ServerResponse, code: number, error: string) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error }));
};

const server = createServer(async (req, res) => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? '')) return deny(res, 403, 'host');
  const path = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
  if (path === '/' || path === '/index.html') { res.writeHead(302, { location: '/links/' }); return res.end(); }
  const m = /^\/(links|kinopoisk)(\/.*)?$/.exec(path);
  if (!m) return deny(res, 404, 'not_found');
  // без косой черты на конце относительные адреса страницы («api/state») уехали бы мимо вкладки
  if (!m[2]) { res.writeHead(302, { location: `/${m[1]}/` }); return res.end(); }
  if (req.method !== 'GET' && req.headers['x-desk'] !== '1') return deny(res, 403, 'x-desk');
  try {
    await TABS[m[1] as keyof typeof TABS](req, res, m[2]);
  } catch (err) {
    if (!res.headersSent) deny(res, 500, (err as Error).message);
  }
});
server.listen(PORT, '127.0.0.1', () => console.log(`пульт: http://127.0.0.1:${PORT}/links/ и /kinopoisk/ — окно не закрывать, пока работаете`));
