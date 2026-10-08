// Публичные страницы для поисковиков (ЗП-15, 07.10): /film/<ключ>, /author/<канал>, /sitemap.xml, /robots.txt.
// Обычный HTML без скриптов — Яндекс и Google читают его сразу, без рендера приложения. Что показывать — справочник
// `publicPages` (tools/public-pages.mts: только фильмы с подтверждённым русским разбором), сами разборы — `essaysAuto`.
// Кнопка ведёт в мини-приложение на карточку фильма (`startapp=w-…`, метка источника `--sseo` — видно в воронке).
// Заголовки роликов показываем (они и так публичны, а человек пришёл из поиска сам), спойлеры — пометкой; в сводке
// подписок, которую бот присылает в чат без спроса, заголовок со спойлерами скрыт.
import type { Env } from './env';
import { reference } from './follow';

const BOT = 'recomend_media_bot';
const SITE = 'Transformative Media';
const PER_PAGE = 40;

interface PageWork { t: string; o?: string; y?: number; c?: string[]; w?: string; p?: string; s?: 1 }
interface PageAuthor { n: string; u: string; e?: 1; b?: 1 }
interface PublicPages { works: Record<string, PageWork>; authors: Record<string, PageAuthor>; at: string }
interface Analysis { title: string; author: string; url: string; spoilerLevel?: number; publishedAt?: string; unverified?: boolean; tier?: string; language?: string; durationMinutes?: number }

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
/** Ключ в адресе: `tmdb:496243` → `tmdb-496243` (двоеточие в пути поисковики любят меньше). */
export const keyToPath = (key: string) => key.replace(':', '-');
const pathToKey = (p: string) => p.replace(/^([a-z]{2,10})-/, '$1:');
const startapp = (key: string) => `https://t.me/${BOT}?startapp=w-${key.replace(':', '_')}--sseo`;
const year = (w: PageWork) => (w.y ? ` (${w.y})` : '');
const shown = (list: Analysis[] | undefined) => (list ?? []).filter((a) => !a.unverified && (a.language ?? 'ru') === 'ru');

/** Адрес сайта: PUBLIC_ORIGIN, если задан, иначе — откуда пришёл запрос (за прокси bothost — https). */
function origin(req: Request, env: Env): string {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/+$/, '');
  const u = new URL(req.url);
  const proto = req.headers.get('x-forwarded-proto') ?? (u.hostname === 'localhost' || u.hostname === '127.0.0.1' ? u.protocol.replace(':', '') : 'https');
  return `${proto}://${req.headers.get('host') ?? u.host}`;
}

// автор → его разборы: считаем один раз на версию справочника
let byAuthor: { src: unknown; map: Map<string, { key: string; a: Analysis }[]> } | undefined;
function authorIndex(essays: Record<string, Analysis[]>): Map<string, { key: string; a: Analysis }[]> {
  if (byAuthor?.src === essays) return byAuthor.map;
  const map = new Map<string, { key: string; a: Analysis }[]>();
  for (const [key, list] of Object.entries(essays)) for (const a of shown(list)) {
    const k = norm(a.author);
    map.set(k, [...(map.get(k) ?? []), { key, a }]);
  }
  byAuthor = { src: essays, map };
  return map;
}

function page(o: { title: string; description: string; canonical: string; image?: string; body: string; jsonLd?: unknown }): Response {
  const html = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<link rel="canonical" href="${esc(o.canonical)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.description)}">
<meta property="og:url" content="${esc(o.canonical)}">
${o.image ? `<meta property="og:image" content="${esc(o.image)}">\n` : ''}${o.jsonLd ? `<script type="application/ld+json">${JSON.stringify(o.jsonLd).replace(/</g, '\\u003c')}</script>\n` : ''}<style>
:root{--bg:#faf8f4;--ink:#1d1b18;--muted:#6b665e;--line:#e4dfd6;--accent:#2f5d8a;--card:#fff}
@media (prefers-color-scheme:dark){:root{--bg:#161513;--ink:#ece8e1;--muted:#a19b91;--line:#2c2a26;--accent:#8ab4e0;--card:#1e1d1a}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 48px}a{color:var(--accent)}header.site{font-size:14px;color:var(--muted);margin-bottom:16px}
header.site a{color:inherit;text-decoration:none}.hero{display:flex;gap:16px;align-items:flex-start}.hero img{width:120px;border-radius:8px;flex:none}.hero>div{min-width:0}
body{overflow-wrap:anywhere}
h1{font-size:26px;line-height:1.2;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 12px}.what{font-size:18px;margin:12px 0}
.cta{display:inline-block;margin:8px 0 24px;padding:12px 18px;border-radius:10px;background:var(--accent);color:var(--bg);text-decoration:none;font-weight:600}
h2{font-size:18px;margin:28px 0 8px}ul{list-style:none;padding:0;margin:0}li{padding:10px 0;border-top:1px solid var(--line)}
li .who{font-weight:600}li .meta{color:var(--muted);font-size:14px}footer{margin-top:40px;color:var(--muted);font-size:13px}
</style>
</head>
<body><main>
<header class="site"><a href="/">${SITE}</a> — подбор фильмов на шаг сложнее того, что вы любите, и разборы к ним</header>
${o.body}
<footer>Ролики и посты принадлежат их авторам; здесь — только ссылки. Подбор под ваш вкус — в мини-приложении Telegram.</footer>
</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

const notFound = () => new Response('Страница не найдена', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } });

function analysisItem(a: Analysis, slugOf: Map<string, string>): string {
  const slug = slugOf.get(norm(a.author));
  const who = slug ? `<a class="who" href="/author/${encodeURIComponent(slug)}">${esc(a.author)}</a>` : `<span class="who">${esc(a.author)}</span>`;
  return `<li>${who}<br>${link(a)}</li>`;
}

const link = (a: Analysis) => {
  const meta = [a.tier === 'essay' ? 'эссе' : 'обзор', a.durationMinutes ? `${a.durationMinutes} мин` : '', a.publishedAt ? a.publishedAt.slice(0, 4) : '', (a.spoilerLevel ?? 0) >= 2 ? 'спойлеры' : ''].filter(Boolean).join(' · ');
  return `<a href="${esc(a.url)}" rel="noopener" target="_blank">«${esc(a.title)}»</a><br><span class="meta">${meta}</span>`;
};

/** Фильм в списке автора: название и до трёх его роликов. */
function filmItem(key: string, w: PageWork, xs: Analysis[]): string {
  const more = xs.length > 3 ? `<br><span class="meta">и ещё ${xs.length - 3}</span>` : '';
  return `<li><a class="who" href="/film/${keyToPath(key)}">${esc(w.t)}${year(w)}</a>${xs.slice(0, 3).map((a) => `<br>${link(a)}`).join('')}${more}</li>`;
}

async function data(env: Env) {
  const [pages, essays] = await Promise.all([reference<PublicPages>(env, 'publicPages'), reference<Record<string, Analysis[]>>(env, 'essaysAuto')]);
  if (!pages || !essays) return undefined;
  const slugOf = new Map(Object.entries(pages.authors).map(([slug, a]) => [norm(a.n), slug]));
  return { pages, essays, slugOf };
}

async function filmPage(req: Request, env: Env, rawKey: string): Promise<Response> {
  const d = await data(env);
  const key = pathToKey(rawKey);
  const w = d?.pages.works[key];
  if (!d || !w) return notFound();
  const list = shown(d.essays[key]).sort((a, b) => Number(b.tier === 'essay') - Number(a.tier === 'essay') || (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const essays = list.filter((a) => a.tier === 'essay');
  const reviews = list.filter((a) => a.tier !== 'essay');
  const kind = w.s ? 'сериала' : 'фильма';
  const by = w.c?.length ? `${w.s ? 'создатель' : 'режиссёр'} ${w.c.join(', ')}` : '';
  const sub = [w.o, w.y, by].filter(Boolean).join(' · ');
  const canonical = `${origin(req, env)}/film/${keyToPath(key)}`;
  const section = (title: string, xs: Analysis[]) => (xs.length ? `<h2>${title} · ${xs.length}</h2><ul>${xs.slice(0, PER_PAGE).map((a) => analysisItem(a, d.slugOf)).join('')}</ul>` : '');
  const body = `<div class="hero">${w.p ? `<img src="${esc(w.p)}" alt="${esc(w.t)}">` : ''}<div>
<h1>${esc(w.t)}${year(w)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ''}
${w.w ? `<p class="what">${esc(w.w)}</p>` : ''}</div></div>
<a class="cta" href="${startapp(key)}">Открыть в Telegram — что смотреть после</a>
${section('Разборы и эссе', essays)}${section('Обзоры', reviews)}`;
  const description = `${w.t}${year(w)}: ${list.length} ${list.length === 1 ? 'разбор' : 'разборов'} ${kind} — ${[...new Set(list.map((a) => a.author))].slice(0, 3).join(', ')}.${w.w ? ` ${w.w}` : ''}`.slice(0, 300);
  const jsonLd = {
    '@context': 'https://schema.org', '@type': w.s ? 'TVSeries' : 'Movie', name: w.t, ...(w.o ? { alternateName: w.o } : {}),
    ...(w.y ? { dateCreated: String(w.y) } : {}), ...(w.c?.length ? { [w.s ? 'creator' : 'director']: w.c.map((name) => ({ '@type': 'Person', name })) } : {}),
    ...(w.p ? { image: w.p } : {}), url: canonical,
  };
  return page({ title: `${w.t}${year(w)} — разборы и обзоры ${kind} | ${SITE}`, description, canonical, image: w.p, body, jsonLd });
}

async function authorPage(req: Request, env: Env, slug: string): Promise<Response> {
  const d = await data(env);
  const a = d?.pages.authors[slug];
  if (!d || !a) return notFound();
  const items = (authorIndex(d.essays).get(norm(a.n)) ?? []).filter((x) => d.pages.works[x.key])
    .sort((x, y) => (y.a.publishedAt ?? '').localeCompare(x.a.publishedAt ?? ''));
  // по фильму: свежие первыми
  const films = new Map<string, Analysis[]>();
  for (const x of items) films.set(x.key, [...(films.get(x.key) ?? []), x.a]);
  const canonical = `${origin(req, env)}/author/${encodeURIComponent(slug)}`;
  const role = a.b ? 'о книгах и экранизациях' : a.e ? 'видеоэссе о кино' : 'обзоры кино';
  const body = `<h1>${esc(a.n)}</h1><p class="sub">${role} · <a href="${esc(a.u)}" rel="noopener" target="_blank">канал автора</a></p>
<a class="cta" href="https://t.me/${BOT}?startapp=--sseo">Открыть в Telegram</a>
<h2>Фильмы · ${films.size}, разборов · ${items.length}</h2><ul>${[...films].slice(0, 150).map(([key, xs]) => filmItem(key, d.pages.works[key], xs)).join('')}</ul>`;
  const names = [...films.keys()].slice(0, 5).map((k) => d.pages.works[k].t).join(', ');
  return page({ title: `${a.n} — ${role} | ${SITE}`, description: `${a.n}: ${items.length} разборов ${films.size} фильмов — ${names}.`.slice(0, 300), canonical, body });
}

async function sitemap(req: Request, env: Env): Promise<Response> {
  const pages = await reference<PublicPages>(env, 'publicPages');
  if (!pages) return notFound();
  const base = origin(req, env);
  const day = pages.at.slice(0, 10);
  const urls = [...Object.keys(pages.works).map((k) => `${base}/film/${keyToPath(k)}`), ...Object.keys(pages.authors).map((s) => `${base}/author/${encodeURIComponent(s)}`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${esc(u)}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

function robots(req: Request, env: Env): Response {
  const text = `User-agent: *\nAllow: /film/\nAllow: /author/\nDisallow: /api/\nDisallow: /kp-api/\n\nSitemap: ${origin(req, env)}/sitemap.xml\n`;
  return new Response(text, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=86400' } });
}

/** Публичный адрес — ответ, иначе undefined (запрос идёт дальше, к API). Выключено, пока в окружении нет
 *  `PUBLIC_PAGES=1` (решение владельца 07.10: наработанное оставить, включить позже вместе с Яндекс Вебмастером). */
export async function publicPage(req: Request, env: Env, path: string): Promise<Response | undefined> {
  if (env.PUBLIC_PAGES !== '1') return undefined;
  if (req.method !== 'GET' && req.method !== 'HEAD') return undefined;
  if (path === '/robots.txt') return robots(req, env);
  if (path === '/sitemap.xml') return sitemap(req, env);
  let m = /^\/film\/([a-z]{2,10}-[A-Za-z0-9_.-]{1,40})$/.exec(path);
  if (m) return filmPage(req, env, m[1]);
  m = /^\/author\/([^/]{1,80})$/.exec(path);
  if (m) { let slug = m[1]; try { slug = decodeURIComponent(slug); } catch { return notFound(); } return authorPage(req, env, slug); }
  return undefined;
}

export const isPublicPath = (p: string) => p === '/robots.txt' || p === '/sitemap.xml' || p.startsWith('/film/') || p.startsWith('/author/');
