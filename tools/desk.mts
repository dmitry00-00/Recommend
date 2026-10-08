// Общий пульт на http://127.0.0.1:8721 — вкладки одной страницы:
//   /dash/       — сводка: сбор, конвейер, разметка, точность, разметка для подбора (tools/dash-desk.mts, 04.10);
//   /links/      — пульт ссылок (tools/links-desk.mts): ролики к фильмам и каналы из заметок;
//   /check/      — проверка привязок и конвейер данных (tools/check-desk.mts, 02.10);
//   /channels/   — каналы и профиль канала: ярус, предмет, фокус (tools/channels-desk.mts, 04.10);
//   /lens/       — рубрики роликов: ручная разметка поверх модели (tools/lens-desk.mts, 06.10);
//   /behavior/   — поведение людей: открытия материалов и петля прогноза с сервера (tools/behavior-desk.mts, 06.10);
//   /kinopoisk/  — импорт оценок с Кинопоиска (tools/kinopoisk-desk.mts).
// Запуск двойным щелчком — deploy/desk.command; `npx tsx tools/desk.mts [порт] [вкладка]`.
// Слушает только 127.0.0.1. Меняющие запросы — только со своей страницы: заголовок x-desk (чужой сайт
// в браузере не может поставить его без предварительного запроса CORS, а его мы не разрешаем) и Host
// (против DNS rebinding) — проверка здесь, общая для обеих вкладок.
import { createServer, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { kinopoiskRoute } from './kinopoisk-desk.mts';
import { linksRoute } from './links-desk.mts';
import { checkRoute } from './check-desk.mts';
import { channelsRoute } from './channels-desk.mts';
import { dashRoute } from './dash-desk.mts';
import { lensRoute } from './lens-desk.mts';
import { behaviorRoute } from './behavior-desk.mts';

const PORT = Number(process.argv[2] ?? 8721);
const TABS = { dash: dashRoute, links: linksRoute, check: checkRoute, channels: channelsRoute, lens: lensRoute, behavior: behaviorRoute, kinopoisk: kinopoiskRoute } as const;

const deny = (res: ServerResponse, code: number, error: string) => {
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error }));
};

const server = createServer(async (req, res) => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? '')) return deny(res, 403, 'host');
  const path = new URL(req.url ?? '/', `http://${req.headers.host}`).pathname;
  if (path === '/' || path === '/index.html') { res.writeHead(302, { location: '/dash/' }); return res.end(); }
  // общий каркас вкладок (06.10): полоса вкладок и её стили — одни на все страницы
  const shell = /^\/shell\.(js|css)$/.exec(path);
  if (shell) {
    res.writeHead(200, { 'content-type': shell[1] === 'js' ? 'text/javascript; charset=utf-8' : 'text/css; charset=utf-8', 'cache-control': 'no-store' });
    return res.end(readFileSync(new URL(`./desk-shell.${shell[1]}`, import.meta.url)));
  }
  const m = /^\/(dash|links|check|channels|lens|behavior|kinopoisk)(\/.*)?$/.exec(path);
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
server.listen(PORT, '127.0.0.1', () => console.log(`пульт: http://127.0.0.1:${PORT}/dash/, /links/, /check/, /channels/, /lens/, /behavior/ и /kinopoisk/ — окно не закрывать, пока работаете`));
