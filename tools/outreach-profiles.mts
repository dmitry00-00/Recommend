// Таблица рассылки ЗП-46 (09.10): Telegram-каналы, чей автор оставил ссылку на свой профиль на кино-сервисе.
// Такой автор — готовый искушённый зритель: по профилю собирается его лента (tools/profile-seed.mts для
// Letterboxd и Trakt; Кинопоиск и Кинориум — страницы сохраняет владелец, скриптами их не обходим), и в личку
// ему можно прийти уже с ней. Откуда каналы:
//   1. ночной поиск шлюза (~/core/services/tg-gateway/searches/recomend.json) по адресам профилей:
//      находки `GET /found` вида posts — ссылка на профиль часто прямо в найденном посте;
//   2. прошлая таблица Кинопоиска (.cache/outreach/kp-channels.json, 64 канала от 09.10);
//   3. ники в аргументах.
// По каждому каналу — открытая страница t.me (название, описание, подписчики) и поиск по каналу на t.me/s
// по каждому сервису: так находятся ссылки и в других постах. Ответы t.me кешируются в .cache/outreach/tme/.
// Выход — .cache/outreach/channels.tsv/.json, по подписчикам; колонка «сервис» — где у автора есть профиль.
// Пишет в личку только владелец со своего аккаунта, не из сессии шлюза.
//   npx tsx tools/outreach-profiles.mts [ник …] [--fresh]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = '.cache/outreach';
const CACHE = `${OUT}/tme`;
const GATEWAY = process.env.TG_GATEWAY_URL ?? 'http://127.0.0.1:8710';
const fresh = process.argv.includes('--fresh');
const extra = process.argv.slice(2).filter((a) => !a.startsWith('--')).map((a) => a.replace(/^@|^https?:\/\/t\.me\//g, ''));

type Service = 'Кинопоиск' | 'Letterboxd' | 'Trakt' | 'Кинориум';
/** как сервис ищется на t.me/s и как из текста достаётся ник профиля; служебные пути Letterboxd — не профили */
const SERVICES: { name: Service; query: string; re: RegExp; url: (id: string) => string; seed: string }[] = [
  { name: 'Кинопоиск', query: 'kinopoisk.ru/user', re: /kinopoisk\.ru\/user\/([\w-]+)/gi, url: (id) => `https://www.kinopoisk.ru/user/${id}/`, seed: 'страницы вручную → import-kinopoisk' },
  { name: 'Letterboxd', query: 'letterboxd.com', re: /letterboxd\.com\/(?!(?:film|films|list|lists|journal|about|pro|settings|search|tag|director|actor|studio|crew|year|people|activity|welcome|sign-in|create-account|apps|legal|showdown|hq)\b)([A-Za-z0-9_]+)/gi, url: (id) => `https://letterboxd.com/${id}/`, seed: 'profile-seed letterboxd:' },
  { name: 'Trakt', query: 'trakt.tv/users', re: /trakt\.tv\/users\/([\w.-]+)/gi, url: (id) => `https://trakt.tv/users/${id}`, seed: 'profile-seed trakt:' },
  { name: 'Кинориум', query: 'kinorium.com/user', re: /kinorium\.com\/user\/(\d+)/gi, url: (id) => `https://ru.kinorium.com/user/${id}/`, seed: 'страницы вручную' },
];

const UA = 'Mozilla/5.0 (Macintosh) recomend-outreach/0.1';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** curl, а не fetch: так же, как прошлый сбор (у fetch на t.me бывают обрывы TLS) */
async function tme(path: string, key: string): Promise<string> {
  const file = `${CACHE}/${key}.html`;
  if (!fresh && existsSync(file)) return readFileSync(file, 'utf8');
  await sleep(1000);
  const html = execFileSync('curl', ['-s', '-m', '20', '-A', UA, '-H', 'Accept-Language: ru', `https://t.me/${path}`], { encoding: 'utf8', maxBuffer: 20 << 20 });
  writeFileSync(file, html);
  return html;
}

const unescape = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const meta = (html: string, prop: string) => unescape(new RegExp(`<meta property="${prop}" content="([^"]*)"`).exec(html)?.[1] ?? '');
const subsOf = (extra: string): number | undefined => {
  const m = /([\d\s.,]+)\s*([KM])?\s*(?:subscribers|подписчик)/i.exec(extra.replace(/ /g, ' '));
  if (!m) return undefined;
  return Math.round(Number(m[1].replace(/\s/g, '').replace(',', '.')) * (m[2]?.toUpperCase() === 'K' ? 1e3 : m[2]?.toUpperCase() === 'M' ? 1e6 : 1));
};

/** профили по сервисам из текста — со счётом упоминаний */
function profilesIn(text: string): Map<Service, Map<string, number>> {
  const out = new Map<Service, Map<string, number>>();
  for (const s of SERVICES) {
    for (const [, id] of text.matchAll(s.re)) {
      const url = s.url(s.name === 'Letterboxd' ? id.toLowerCase() : id);
      const m = out.get(s.name) ?? new Map<string, number>();
      out.set(s.name, m.set(url, (m.get(url) ?? 0) + 1));
    }
  }
  return out;
}
const merge = (into: Map<Service, Map<string, number>>, from: Map<Service, Map<string, number>>) => {
  for (const [s, ids] of from) {
    const m = into.get(s) ?? new Map<string, number>();
    for (const [u, n] of ids) m.set(u, (m.get(u) ?? 0) + n);
    into.set(s, m);
  }
};

/** Чей профиль. Каналы ссылаются и на чужие (рецензия друга, режиссёр, сам сервис), поэтому свой — тот,
 *  чей ник похож на канал или название (общий кусок от четырёх букв) или что стоит в описании; иначе —
 *  единственный упомянутый не раз; остальное — «проверить». */
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9а-я]/g, '');
function owner(url: string, channel: string, title: string, about: string): boolean {
  if (about.includes(url.replace(/^https:\/\/(www\.|ru\.)?/, '').replace(/\/$/, ''))) return true;
  const id = squash(url.replace(/\/$/, '').split('/').pop() ?? '');
  if (id.length < 4 || /^\d+$/.test(id)) return false;
  for (const name of [squash(channel), squash(title)]) {
    for (let i = 0; i + 4 <= id.length; i += 1) if (name.includes(id.slice(i, i + 4))) return true;
  }
  return false;
}

interface Row {
  channel: string; title: string; subs?: number; kind: string; services: Service[]; profiles: string[]; others: string[]; seed: string;
  cinema: boolean; ads: boolean; contact: string; post: string; about: string; known: boolean; from: string[];
}

// 1–3: кандидаты
const candidates = new Map<string, { from: Set<string>; profiles: Map<Service, Map<string, number>>; post?: string }>();
const add = (ch: string, from: string, profiles?: Map<Service, Map<string, number>>, post?: string) => {
  const key = ch.toLowerCase();
  const c = candidates.get(key) ?? { from: new Set(), profiles: new Map() };
  c.from.add(from);
  if (profiles) merge(c.profiles, profiles);
  if (post && !c.post) c.post = post;
  candidates.set(key, c);
};
try {
  const res = await fetch(`${GATEWAY}/found?consumer=recomend&limit=100000`);
  const found = ((await res.json()) as { found: { kind: string; query?: string; channel: string; msg_id: number; text?: string; post?: { links?: string[] } }[] }).found;
  let n = 0;
  for (const f of found) {
    if (f.kind !== 'posts') continue; // в ответах ссылку оставил комментатор, а не автор канала
    const profiles = profilesIn([f.text ?? '', ...(f.post?.links ?? [])].join('\n'));
    if (!profiles.size && !SERVICES.some((s) => s.query === f.query)) continue;
    add(f.channel, 'поиск шлюза', profiles, `https://t.me/${f.channel}/${f.msg_id}`);
    n += 1;
  }
  console.error(`шлюз: находок с профилями ${n}`);
} catch (err) {
  console.error(`шлюз недоступен (${(err as Error).message}) — без новых находок`);
}
if (existsSync(`${OUT}/kp-channels.json`)) {
  for (const r of JSON.parse(readFileSync(`${OUT}/kp-channels.json`, 'utf8')) as { channel: string; kp?: string[]; post?: string }[]) {
    add(r.channel, 'таблица КП', r.kp?.length ? new Map([['Кинопоиск', new Map(r.kp.map((u) => [u, 1]))]]) : undefined, r.post || undefined);
  }
}
for (const ch of extra) add(ch, 'вручную');

const registry = JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')) as { channels: { username: string }[] };
const known = new Set(registry.channels.map((c) => c.username.toLowerCase()));

mkdirSync(CACHE, { recursive: true });
const rows: Row[] = [];
for (const [key, c] of candidates) {
  const page = await tme(key, `${key}`);
  const extraLine = unescape(/<div class="tgme_page_extra">\s*([^<]*)<\/div>/.exec(page)?.[1] ?? '').trim();
  const subs = subsOf(extraLine);
  const kind = subs != null ? 'channel' : /bot$/i.test(key) ? 'bot' : extraLine.startsWith('@') ? 'user' : 'other';
  const channel = /<meta property="og:url" content="https:\/\/t\.me\/([\w]+)"/.exec(page)?.[1] ?? key;
  if (kind === 'channel') {
    for (const s of SERVICES) {
      const html = await tme(`s/${key}?q=${encodeURIComponent(s.query)}`, `${key}.${s.query.replace(/\W+/g, '_')}`);
      const ids = profilesIn(unescape(html)).get(s.name);
      if (!ids?.size) continue;
      merge(c.profiles, new Map([[s.name, ids]]));
      const posts = [...html.matchAll(/data-post="([^"]+)"/g)].map((m) => m[1]);
      if (!c.post && posts.length) c.post = `https://t.me/${posts[posts.length - 1]}`;
    }
  }
  const title = meta(page, 'og:title');
  const about = meta(page, 'og:description');
  // в описании тоже бывает «КП: kinopoisk.ru/user/…»
  merge(c.profiles, profilesIn(about));
  // по сервису — свой профиль, если он угадывается; остальные ссылки — в «ещё ссылки»
  const own = new Map<Service, string>();
  const others: string[] = [];
  for (const s of SERVICES) {
    const ids = [...(c.profiles.get(s.name) ?? [])].filter(([u]) => !/letterboxd\.com\/official\//.test(u)).sort((a, b) => b[1] - a[1]);
    const mine = ids.find(([u]) => owner(u, key, title, about))?.[0] ?? (ids.length === 1 && ids[0][1] >= 2 ? ids[0][0] : undefined);
    if (mine) own.set(s.name, mine);
    others.push(...ids.map(([u]) => u).filter((u) => u !== mine));
  }
  const services = [...own.keys()];
  const seed = services.map((name) => {
    const s = SERVICES.find((x) => x.name === name)!;
    if (!s.seed.endsWith(':')) return `${name}: ${s.seed}`;
    return `npx tsx tools/${s.seed.replace(' ', '.mts ')}${own.get(name)!.replace(/\/$/, '').split('/').pop()}`;
  }).join(' · ');
  const contacts = [...new Set([...about.matchAll(/@([A-Za-z]\w{3,})|t\.me\/([A-Za-z]\w{3,})/g)].map((m) => (m[1] ?? m[2])))]
    .filter((h) => h.toLowerCase() !== key && !/bot$/i.test(h));
  rows.push({
    channel, title, subs, kind, services, seed,
    profiles: [...own.values()], others,
    cinema: /кино|фильм|сериал|синема|cinema|film|movie/i.test(`${title} ${about}`),
    ads: /реклам|сотруднич|по вопросам|ads\b|promo/i.test(about),
    contact: contacts.map((h) => `@${h}`).join(' '),
    post: c.post ?? '', about: about.replace(/\s+/g, ' '), known: known.has(key), from: [...c.from],
  });
  console.error(`${channel}: ${kind} ${subs ?? ''} ${services.join(', ') || '—'}`);
}

rows.sort((a, b) => (b.subs ?? -1) - (a.subs ?? -1));
writeFileSync(`${OUT}/channels.json`, JSON.stringify(rows, null, 1));
const head = ['канал', 'подписчиков', 'название', 'сервис', 'профиль', 'как собрать ленту', 'ещё ссылки (чьи — проверить)', 'кино', 'реклама', 'контакт', 'в реестре', 'откуда', 'пост', 'описание'];
const tsv = [head, ...rows.filter((r) => r.kind === 'channel').map((r) => [
  `@${r.channel}`, r.subs ?? '', r.title, r.services.join(', '), r.profiles.join(' '), r.seed, r.others.join(' '), r.cinema ? 'да' : '', r.ads ? 'да' : '',
  r.contact, r.known ? 'да' : '', r.from.join(', '), r.post, r.about,
])].map((cols) => cols.map((x) => String(x).replace(/[\t\n]/g, ' ')).join('\t')).join('\n');
writeFileSync(`${OUT}/channels.tsv`, `${tsv}\n`);

const ch = rows.filter((r) => r.kind === 'channel');
const by = (s: Service) => ch.filter((r) => r.services.includes(s)).length;
console.error(`\n→ ${OUT}/channels.tsv: каналов ${ch.length} (не каналы: ${rows.length - ch.length}); профиль — Кинопоиск ${by('Кинопоиск')}, Letterboxd ${by('Letterboxd')}, Trakt ${by('Trakt')}, Кинориум ${by('Кинориум')}; свой не угадан ${ch.filter((r) => !r.services.length).length} (ссылки есть у ${ch.filter((r) => !r.services.length && r.others.length).length})`);
