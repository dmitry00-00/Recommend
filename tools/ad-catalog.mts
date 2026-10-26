// Каналы соседних тем с биржи telega.in (25.10, по просьбе владельца «собери, расширь»): кроме кино и книг — языки,
// психология, история, культура, путешествия и т. п., чтобы посевы мерили по цене оставшегося, а не по теме.
//
// Только открытые тематические страницы `https://telega.in/catalog/<тема>?page=N` (robots.txt их не закрывает: закрыты
// `?sort=`, `?filter=`, `/c/`, `/api/`). С карточки в списке берём видимое: ник, название, описание, подписчики, ERR.
// Цены и охват в data-* списка (закрытое в интерфейсе) не берём — их дальше берёт tools/ad-prices.mts с открытой
// карточки канала. Один поток, пауза 6–9 с, страниц на тему не больше 8; три ошибки подряд — стоп.
//
//   npx tsx tools/ad-catalog.mts [--themes history,travel] [--pages 8] [--per 30] [--dry] [--force]
// В ночном сборе (tools/collect.mts) — перед ценами; снимок свежее 30 дней — пропуск.
// Итог — .cache/ad-prices/telega-in-catalog.json (все найденные) и выбор в .cache/ad-prices/telega-in-channels.json:
// по теме до --per каналов с ником, от 5 тыс. подписчиков и ERR от 5%, по ожидаемому охвату (подписчики × ERR); у них
// `wide: true` — сборщик цен берёт их без реестра (в реестр каналов кино и книг они не пишутся).
import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs';

const DIR = '.cache/ad-prices';
const OUT = `${DIR}/telega-in-catalog.json`;
const LIST = `${DIR}/telega-in-channels.json`;
const UA = 'Mozilla/5.0 (compatible; FilibriPrices/1.0; monthly check of channel themes for ad planning; +https://t.me/recomend_media_bot)';

/** темы каталога (адрес → название на бирже; адреса — `data-url_name` списка тем на /catalog); кино и книги — в снимке 23.10 */
export const THEMES: Record<string, string> = {
  foreign_languages: 'Иностранные языки',
  psychology_and_relationships: 'Психология и отношения',
  history: 'История',
  education: 'Образование',
  culture_and_events: 'Культура и события',
  art_and_design: 'Искусство и дизайн',
  travel_and_tourism: 'Путешествия и туризм',
  science: 'Наука и технологии',
  curious_facts: 'Любопытные факты',
  video_games: 'Видеоигры',
  music: 'Музыка',
  Blogs: 'Блоги',
  'motivation_and_self-development': 'Мотивация и саморазвитие',
  hobbies_and_activities: 'Хобби и деятельность',
  // 25.10: каналы актёров и шоу-бизнеса (слово владельца об актёрах), досуг
  celebrities_and_lifestyle: 'Знаменитости и образ жизни',
  recreation_and_entertainment: 'Отдых и развлечения',
};

export interface CatalogChannel { u: string; slug: string; theme: string; title: string; desc: string; subs: number | null; err: number | null }

const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const text = (s: string) => unesc(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
/** «57.6K» → 57600 */
const count = (s: string | undefined) => {
  const m = /^([\d.,]+)\s*([KkКкMm])?$/.exec((s ?? '').trim());
  if (!m) return null;
  const v = Number(m[1].replace(',', '.'));
  return Number.isFinite(v) ? Math.round(v * (/[KkКк]/.test(m[2] ?? '') ? 1e3 : /[Mm]/.test(m[2] ?? '') ? 1e6 : 1)) : null;
};

/** Разбор тематической страницы: только видимое. Чистая функция — проверка в tools/road-test.mts. */
export function parseCatalogPage(html: string, theme: string): CatalogChannel[] {
  const out: CatalogChannel[] = [];
  for (const raw of html.split('<div class="channels-item mb-8px').slice(1)) {
    // до списка цен форматов: дальше — data-* с ценами, их не трогаем
    const part = raw.slice(0, 20000).split('data-placements-prices')[0];
    const slug = /href="\/channels\/([^/"]+)\/card/.exec(part)?.[1];
    // в каталоге вперемешку Telegram, MAX и VK (25.10: 131 «нет на бирже» из 300 были не Telegram) — значок площадки
    if (!part.includes('badge middle telegram')) continue;
    const u = /Логотип Телеграм канала @([A-Za-z0-9_]+)/.exec(part)?.[1] ?? (slug && /^[A-Za-z0-9_]{4,}$/.test(slug) ? slug : undefined);
    if (!slug || !u) continue;
    const plain = text(part);
    out.push({
      u, slug, theme,
      title: unesc(/class="font-18px bold" title="([^"]*)"/.exec(part)?.[1] ?? ''),
      desc: text(/info-description[^>]*>([\s\S]*?)<\/div>/.exec(part)?.[1] ?? '').slice(0, 240),
      subs: Number(/channel-users-count[^"]*" data-count="(\d+)"/.exec(part)?.[1] ?? NaN) || count(/Подписчиков:\s*([\d.,]+\s*[KkMm]?)/.exec(plain)?.[1]),
      err: Number(/ERR:\s*([\d.]+)%/.exec(plain)?.[1] ?? NaN) || null,
    });
  }
  return out;
}

/** выбор в список цен: с ником, от 5 тыс. подписчиков, ERR от 5%, по ожидаемому охвату */
export function pickWide(found: CatalogChannel[], per: number, known: Set<string>) {
  const byTheme = new Map<string, CatalogChannel[]>();
  for (const c of found) {
    if (known.has(c.u.toLowerCase()) || (c.subs ?? 0) < 5000 || (c.err ?? 0) < 5) continue;
    (byTheme.get(c.theme) ?? byTheme.set(c.theme, []).get(c.theme)!).push(c);
  }
  return [...byTheme.values()].flatMap((cs) => cs.sort((a, b) => b.subs! * b.err! - a.subs! * a.err!).slice(0, per));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const readJson = <T,>(p: string, dflt: T): T => { try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) as T : dflt; } catch { return dflt; } };
const write = (p: string, v: unknown) => { writeFileSync(`${p}.tmp`, JSON.stringify(v, null, 1)); renameSync(`${p}.tmp`, p); };

async function main() {
  const arg = (k: string) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : undefined; };
  const themes = arg('--themes')?.split(',') ?? Object.keys(THEMES);
  const maxPages = Number(arg('--pages') ?? 8), per = Number(arg('--per') ?? 30);
  mkdirSync(DIR, { recursive: true });
  const store = readJson<{ at: string | null; themes: Record<string, { name: string; pages: number; found: number; error?: string }>; channels: Record<string, CatalogChannel> }>(OUT, { at: null, themes: {}, channels: {} });
  // в ночном сборе — раз в месяц: каталог меняется медленно
  if (!process.argv.includes('--force') && !arg('--themes') && store.at && Date.now() - Date.parse(store.at) < 30 * 864e5) {
    console.log(`telega.in каталог: снят ${store.at.slice(0, 10)}, свежее 30 дней — пропуск (--force — заново)`);
    return;
  }
  // полный проход — каталог заново (25.10): иначе в нём оставались каналы MAX и VK из прохода без фильтра площадки
  if (!arg('--themes')) store.channels = {};
  let fails = 0, first = true;
  outer: for (const slug of themes) {
    const name = THEMES[slug] ?? slug;
    const seen = new Set<string>();
    let pages = 0;
    for (let page = 1; page <= maxPages; page++) {
      if (!first) await sleep(6000 + Math.random() * 3000);
      first = false;
      const url = `https://telega.in/catalog/${slug}${page > 1 ? `?page=${page}` : ''}`;
      try {
        const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(40_000) });
        if (!r.ok) throw new Error(`ответ ${r.status}`);
        const html = await r.text();
        // своя ли страница: адрес темы в canonical, иначе биржа отдала общий каталог
        if (!html.includes(`<link rel="canonical" href="https://telega.in/catalog/${slug}"`)) throw new Error('не тематическая страница (canonical другой)');
        const items = parseCatalogPage(html, name).filter((c) => !seen.has(c.slug));
        fails = 0; pages = page;
        for (const c of items) { seen.add(c.slug); store.channels[c.u.toLowerCase()] ??= c; }
        console.log(`  ${name}, стр. ${page}: ${items.length}`);
        if (!items.length) break;
      } catch (e) {
        console.log(`  ${name}, стр. ${page}: ошибка — ${(e as Error).message}`);
        store.themes[slug] = { name, pages, found: seen.size, error: (e as Error).message };
        if (++fails >= 3) { console.log('три ошибки подряд — стоп'); break outer; }
        break;
      }
    }
    store.themes[slug] = { ...store.themes[slug], name, pages, found: seen.size };
    store.at = new Date().toISOString(); write(OUT, store);
  }
  const list = readJson<{ note?: string; at?: string; channels: { u: string; theme?: string; title?: string; wide?: boolean }[] }>(LIST, { channels: [] });
  // выбор соседних тем — заново каждый раз (25.10): прежний мог включать не Telegram
  list.channels = list.channels.filter((c) => !c.wide);
  const known = new Set(list.channels.map((c) => c.u.toLowerCase()));
  const picked = pickWide(Object.values(store.channels), per, known);
  console.log(`каналов найдено ${Object.keys(store.channels).length}, к ценам добавляется ${picked.length}`);
  if (process.argv.includes('--dry')) return;
  list.channels.push(...picked.map((c) => ({ u: c.u, theme: c.theme, title: c.title, [`subs${new Date().toISOString().slice(8, 10)}${new Date().toISOString().slice(5, 7)}`]: c.subs, wide: true })));
  write(LIST, list);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
