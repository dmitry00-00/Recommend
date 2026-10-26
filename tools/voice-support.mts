// Как поддержать автора (25.10, панель «Поддержать» на странице голоса, флаг `support`): по выемкам каналов
// (.cache/telegram/<канал>.json — описание канала, кнопки и ссылки собственных постов, tg-gateway) — какие сервисы
// донатов у автора и какая ссылка у каждого.
//
// Только собственное: посты-пересылки и рекламные (erid, #реклама, «реклама», «партнёрский») — мимо, иначе автору
// приписался бы чужой Boosty из рекламы. Описание канала — сильнее постов (там автор сам пишет, как его поддержать).
// Ссылка у сервиса — самая частая; порядок сервисов — по частоте у автора. Tribute — только ссылки на страницу автора
// (`t.me/tribute/app?startapp=…`, `web.tribute.tg/…`), рекламные переходы Tribute (`away`, `?t=ad`) — мимо.
// Patreon — только профиль (`patreon.com/<имя>`), ссылка на отдельный пост профилем не считается.
//   npx tsx tools/voice-support.mts [--dry]
// Пишет src/mocks/voiceSupport.ts (канал в нижнем регистре → [{s, u, from}]), грузится лениво со страницей голоса.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { ChannelInfo, Post } from './telegram-export.mts';

const DIR = '.cache/telegram';
const AD = /\berid\b|#реклама|\bреклама\b|партн[её]рск|промокод/i;

export type Service = 'boosty' | 'tribute' | 'patreon' | 'tbank' | 'donationalerts' | 'donatty' | 'cloudtips';
/** ссылка → сервис и её нормальный вид; не сервис донатов или не страница автора — undefined */
export function supportLink(raw: string): { s: Service; u: string } | undefined {
  let url: URL;
  try { url = new URL(raw.startsWith('http') ? raw : `https://${raw}`); } catch { return undefined; }
  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  const seg = url.pathname.split('/').filter(Boolean);
  if (host === 'boosty.to' && seg[0] && !['app', 'auth', 'about'].includes(seg[0])) return { s: 'boosty', u: `https://boosty.to/${seg[0]}` };
  if (host === 't.me' && seg[0]?.toLowerCase() === 'tribute' && seg[1] === 'app' && url.searchParams.get('startapp')) {
    return { s: 'tribute', u: `https://t.me/tribute/app?startapp=${url.searchParams.get('startapp')}` };
  }
  if (host === 'web.tribute.tg' && seg.length >= 2 && !seg.includes('away') && url.searchParams.get('t') !== 'ad') {
    return { s: 'tribute', u: `https://web.tribute.tg/${seg.slice(0, 2).join('/')}` };
  }
  if (host === 'patreon.com' && seg[0] && !['posts', 'join', 'login', 'home', 'search', 'c'].includes(seg[0].toLowerCase())) {
    return { s: 'patreon', u: `https://www.patreon.com/${seg[0]}` };
  }
  if (host === 'patreon.com' && seg[0] === 'c' && seg[1]) return { s: 'patreon', u: `https://www.patreon.com/c/${seg[1]}` };
  if ((host === 'tbank.ru' || host === 'tinkoff.ru') && seg[0] === 'cf' && seg[1]) return { s: 'tbank', u: `https://www.tbank.ru/cf/${seg[1]}` };
  if (host === 'donationalerts.com' && seg[0] === 'r' && seg[1]) return { s: 'donationalerts', u: `https://www.donationalerts.com/r/${seg[1]}` };
  if (host === 'donatty.com' && seg[0]) return { s: 'donatty', u: `https://donatty.com/${seg[0]}` };
  if (host === 'pay.cloudtips.ru' && seg[0] === 'p' && seg[1]) return { s: 'cloudtips', u: `https://pay.cloudtips.ru/p/${seg[1]}` };
  return undefined;
}
const URLS = /(?:https?:\/\/)?(?:www\.)?(?:boosty\.to|t\.me\/tribute|web\.tribute\.tg|patreon\.com|tbank\.ru|tinkoff\.ru|donationalerts\.com|donatty\.com|pay\.cloudtips\.ru)\/[^\s)\]»"']+/gi;

export interface SupportLink { s: Service; u: string; from: 'about' | 'posts' }
/** Сервисы автора по выемке канала. Чистая функция — проверка в tools/road-test.mts. */
export function supportOf(data: { channel?: ChannelInfo; posts?: Post[] }): SupportLink[] {
  const score = new Map<string, { s: Service; u: string; n: number; about: boolean }>();
  const note = (raw: string, w: number, about: boolean) => {
    const l = supportLink(raw);
    if (!l) return;
    const x = score.get(l.u) ?? { ...l, n: 0, about: false };
    x.n += w; x.about ||= about;
    score.set(l.u, x);
  };
  for (const m of data.channel?.about?.match(URLS) ?? []) note(m, 10, true);
  for (const p of data.posts ?? []) {
    if (p.forwardedFrom || AD.test(p.text)) continue;
    const seen = new Set<string>();
    for (const raw of [...(p.text.match(URLS) ?? []), ...(p.links ?? []).map((l) => l.url), ...(p.buttons ?? []).map((b) => b.url)]) {
      if (seen.has(raw)) continue;
      seen.add(raw);
      note(raw, 1, false);
    }
  }
  // у сервиса — самая частая ссылка; сервисы — по сумме
  const bySvc = new Map<Service, { best: { u: string; n: number; about: boolean }; total: number }>();
  for (const x of score.values()) {
    const cur = bySvc.get(x.s);
    if (!cur) bySvc.set(x.s, { best: x, total: x.n });
    else { cur.total += x.n; if (x.n > cur.best.n) cur.best = x; }
  }
  return [...bySvc.entries()].sort((a, b) => b[1].total - a[1].total)
    .map(([s, v]) => ({ s, u: v.best.u, from: v.best.about ? 'about' as const : 'posts' as const }));
}

// страница голоса для канала без разборов (25.10): только каналы о кино и книгах — не «прочее» (бокс, косплей, стримы)
// и не мемы; пиратским поддержку не показываем вовсе
const NO_PAGE = new Set(['other', 'memes', 'pirate']);

if (import.meta.url === `file://${process.argv[1]}`) {
  const reg = new Map((JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')).channels as { username: string; category?: string }[])
    .map((c) => [c.username.toLowerCase(), c.category]));
  const out: Record<string, SupportLink[]> = {};
  const titles: Record<string, string> = {};
  const counts = new Map<Service, number>();
  let channels = 0;
  for (const f of readdirSync(DIR).filter((x) => x.endsWith('.json') && x !== 'gateway.json')) {
    let data: { username?: string; name?: string; channel?: ChannelInfo; posts?: Post[] };
    try { data = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')); } catch { continue; }
    channels++;
    const links = supportOf(data);
    if (!links.length) continue;
    const h = (data.username ?? f.replace(/\.json$/, '')).toLowerCase();
    const cat = reg.get(h);
    if (cat === 'pirate') continue;
    out[h] = links;
    if (cat && !NO_PAGE.has(cat)) titles[h] = data.name ?? h;
    for (const l of links) counts.set(l.s, (counts.get(l.s) ?? 0) + 1);
  }
  const n = Object.keys(out).length;
  console.log(`каналов: ${channels}, с поддержкой: ${n} (${Math.round((100 * n) / Math.max(1, channels))}%)`);
  console.log([...counts].sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s} ${c} (${Math.round((100 * c) / Math.max(1, n))}%)`).join(' · '));
  if (!process.argv.includes('--dry')) {
    writeFileSync(new URL('../src/mocks/voiceSupport.ts', import.meta.url),
      `// Сгенерировано tools/voice-support.mts — руками не править. Канал (ник в нижнем регистре) → как поддержать автора:
// s — сервис, u — ссылка на страницу автора, from — откуда (описание канала или собственные посты). Порядок — по частоте
// у автора. Грузится лениво, со страницей голоса (флаг \`support\`, 25.10).
export type SupportService = 'boosty' | 'tribute' | 'patreon' | 'tbank' | 'donationalerts' | 'donatty' | 'cloudtips';
export interface SupportLink { s: SupportService; u: string; from: 'about' | 'posts' }

export const voiceSupport: Record<string, SupportLink[]> = ${JSON.stringify(out)};

// канал о кино или книгах (по реестру) → название: страница голоса и без разборов — ради «Поддержать»
export const voiceSupportTitles: Record<string, string> = ${JSON.stringify(titles)};
`);
  }
}
