// Посты каналов из tg-gateway (~/core/services/tg-gateway): замена tools/telegram-fetch.py.
//   npx tsx tools/telegram-pull.mts            забрать новое по курсору
//   npx tsx tools/telegram-pull.mts --full     перечитать всё с нуля (курсор сбрасывается)
//
// Зачем. telegram-fetch.py открывал копию сессии recruit — мимо её замка и её счётчика
// обращений: расход recomend не видел никто, а FloodWait, пойманный им, не останавливал
// recruit. Теперь аккаунтом владеет один процесс — шлюз, а здесь только HTTP к нему.
//
// Выход тот же, что у telegram-fetch.py: `.cache/telegram/<канал>.json` с `source: 'mtproto'`
// (так его узнаёт tools/telegram-export.mts), посты сливаются по id. Курсор шлюза —
// `.cache/telegram/gateway.json`. Список каналов берётся из tools/telegram-channels.json и
// перед каждым забором отправляется шлюзу: второго списка быть не должно.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { hashtags, type Post, type PostLink } from './telegram-export.mts';

const BASE = process.env.TG_GATEWAY_URL ?? 'http://127.0.0.1:8710';
const CONSUMER = 'recomend';
const OUT = process.env.TG_PULL_OUT ?? '.cache/telegram';
const STATE = join(OUT, 'gateway.json');

interface GwLink { url: string; text?: string | null; kind: string }
interface GwPost {
  channel: string; msg_id: number; rev: number; date?: string | null; text: string;
  links: GwLink[]; preview?: { url: string; site?: string | null; title?: string | null } | null;
  forwarded_from?: { title?: string | null; username?: string | null } | null;
}

/** Пост шлюза → наш вид. Заголовок превью — первой строкой текста, как у telegram-fetch.py:
 *  у поста-ссылки название ролика лежит только там, а по первой строке ищется произведение. */
function toPost(p: GwPost): Post | undefined {
  const text = [p.preview?.title, p.text].filter(Boolean).join('\n');
  if (!text) return undefined;
  // кнопки не берём: telegram-fetch.py их не видел, и генераторы на них не рассчитаны
  const links: PostLink[] = p.links
    .filter((l) => l.kind !== 'button')
    .map((l) => ({ url: l.url, ...(l.text ? { text: l.text } : {}) }));
  const forwarded = p.forwarded_from?.title ?? p.forwarded_from?.username ?? undefined;
  return {
    id: p.msg_id,
    date: p.date?.slice(0, 10),
    text,
    tags: hashtags(text),
    links,
    ...(p.preview ? { preview: { url: p.preview.url, ...(p.preview.site ? { site: p.preview.site } : {}), ...(p.preview.title ? { title: p.preview.title } : {}) } } : {}),
    ...(forwarded ? { forwardedFrom: forwarded } : {}),
  };
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, { ...init, headers: { 'content-type': 'application/json' } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status} ${await r.text()}`);
  return r.json() as Promise<T>;
}

const channels = (JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8')).channels as { username: string }[])
  .map((c) => c.username.toLowerCase());
mkdirSync(OUT, { recursive: true });
const state = existsSync(STATE) && !process.argv.includes('--full')
  ? JSON.parse(readFileSync(STATE, 'utf8')) as { cursor: number; channels: string[] }
  : { cursor: 0, channels: [] as string[] };

try {
  await call('/health');
} catch (e) {
  console.error(`шлюз не отвечает (${BASE}) — посты остаются прежними: ${(e as Error).message}`);
  process.exit(2);
}

await call(`/subscriptions/${CONSUMER}`, { method: 'PUT', body: JSON.stringify({ channels: channels.map((handle) => ({ handle })) }) });

const got = new Map<string, Map<number, Post>>();
const take = (p: GwPost) => {
  const post = toPost(p);
  if (!post) return;
  if (!got.has(p.channel)) got.set(p.channel, new Map());
  got.get(p.channel)!.set(post.id, post);
};

// канал, которого у нас ещё не было, добираем целиком: его старые посты могут лежать в архиве
// шлюза с rev меньше нашего курсора (читал для другого потребителя)
for (const ch of channels.filter((c) => !state.channels.includes(c) && state.cursor > 0)) {
  let after = 0;
  for (;;) {
    const r = await call<{ posts: GwPost[]; cursor: number; more: boolean }>(`/posts?consumer=${CONSUMER}&channel=${ch}&after=${after}&limit=2000`);
    r.posts.forEach(take);
    after = r.cursor;
    if (!r.more) break;
  }
}

let cursor = state.cursor;
for (;;) {
  const r = await call<{ posts: GwPost[]; cursor: number; more: boolean }>(`/posts?consumer=${CONSUMER}&after=${cursor}&limit=2000`);
  r.posts.forEach(take);
  cursor = r.cursor;
  if (!r.more) break;
}

let added = 0;
for (const [ch, posts] of got) {
  const file = join(OUT, `${ch}.json`);
  const existing = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) as { name?: string; posts?: Post[] } : {};
  const byId = new Map((existing.posts ?? []).map((p) => [p.id, p]));
  for (const [id, p] of posts) { if (!byId.has(id)) added += 1; byId.set(id, p); }
  writeFileSync(file, JSON.stringify({
    name: existing.name ?? ch,
    username: ch,
    source: 'mtproto',
    via: 'tg-gateway',
    fetchedAt: new Date().toISOString().slice(0, 19) + '+00:00',
    posts: [...byId.values()].sort((a, b) => a.id - b.id),
  }));
  console.log(`  ${ch}: пришло ${posts.size}, всего ${byId.size}`);
}
writeFileSync(STATE, JSON.stringify({ cursor, channels, at: new Date().toISOString() }, null, 1));
console.log(`новых постов: ${added}, курсор ${cursor} → ${OUT}`);
