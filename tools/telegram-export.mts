// Чтение официального экспорта Telegram Desktop («Экспорт истории чата»), HTML или JSON.
// Это собственные данные владельца, полученные штатной кнопкой клиента, а не парсинг t.me.
// Отсюда берут посты два генератора: индекс разборов (build-telegram-index.mts) и
// индекс каналов, на которые ссылаются наши источники (build-source-index.mts).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
/** «16 августа 2021, 19:05:07» → 2021-08-16. */
export function ruDate(title: string): string | undefined {
  const m = /^(\d{1,2}) ([а-я]+) (\d{4})/.exec(title);
  const month = m ? MONTHS.indexOf(m[2]) : -1;
  return m && month >= 0 ? `${m[3]}-${String(month + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}` : undefined;
}

const ENTITIES: Record<string, string> = { '&quot;': '"', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&#39;': "'", '&nbsp;': ' ' };
export const untag = (html: string): string => html
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, '')
  .replace(/&(?:quot|amp|lt|gt|#39|nbsp);/g, (e) => ENTITIES[e] ?? e)
  .replace(/[ \t]+/g, ' ')
  .trim();

/** Ссылка из поста вместе с тем, как её подписали: подпись у ссылки на чужой канал —
 *  обычно его название («странствия некроманта»), а его больше взять неоткуда. */
export interface PostLink { url: string; text?: string }

export interface Post {
  id: number;
  date?: string;
  /** текст поста вместе с заголовком превью: по нему ищем название произведения */
  text: string;
  /** #рубрики канала в нижнем регистре, без решётки */
  tags: string[];
  /** все ссылки поста — и в тексте, и в превью */
  links: PostLink[];
  /** превью ссылки, если пост — это ссылка: у статьи и ролика заголовок лежит здесь */
  preview?: { url: string; site?: string; title?: string };
  /** переслано из другого канала — тогда автор поста не наш канал */
  forwardedFrom?: string;
}

/** Хэштеги поста: у каналов это рубрики («#спгс», «#тревожныйсмотр», «#постердня»), и
 *  по ним видно, что за пост, ещё до чтения текста. Берём из готового текста — так
 *  работает и для HTML-экспорта, и для JSON. */
export function hashtags(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s(«"])#([\p{L}\d_]{2,40})/gu)) out.add(m[1].toLowerCase());
  return [...out];
}

/** Разбор HTML-экспорта: messages.html, messages2.html и так далее. */
function fromHtml(dir: string): { title?: string; posts: Post[] } {
  const files = readdirSync(dir).filter((f) => /^messages\d*\.html$/.test(f))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0] ?? 1) - Number(/\d+/.exec(b)?.[0] ?? 1));
  const posts: Post[] = [];
  let title: string | undefined;
  for (const file of files) {
    const html = readFileSync(join(dir, file), 'utf8');
    title ??= untag(/<div class="page_header[^"]*">[\s\S]*?<div class="name bold">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '') || undefined;
    for (const block of html.split('<div class="message ').slice(1)) {
      if (block.startsWith('service')) continue;
      const id = Number(/^[^>]*id="message(\d+)"/.exec(block)?.[1]);
      if (!id) continue;
      const dateTitle = /class="pull_right date details" title="([^"]+)"/.exec(block)?.[1] ?? '';
      const text = /<div class="text">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '';
      // пост-ссылка: заголовок превью несёт название ролика или статьи, а сам текст бывает пустым
      const previewTitle = /<div class="webpage_title[^"]*">([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '';
      const href = /<a class="webpage_preview[^"]*" href="([^"]+)"/.exec(block)?.[1];
      const site = untag(/<div class="webpage_site[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(block)?.[1] ?? '');
      // «Forwarded from две в Москве» — подпись репоста; язык подписи зависит от языка клиента
      const forwarded = /<div class="forwarded_from details">([\s\S]*?)<\/div>/.exec(block)?.[1];
      const body = [untag(previewTitle), untag(text)].filter(Boolean).join('\n');
      if (!body) continue;
      const links: PostLink[] = [];
      for (const m of block.matchAll(/<a href="(https?:[^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
        const label = untag(m[2]);
        links.push({ url: m[1], ...(label && label !== m[1] ? { text: label } : {}) });
      }
      posts.push({
        id,
        date: ruDate(dateTitle),
        text: body,
        tags: hashtags(body),
        links,
        ...(href ? { preview: { url: href, site: site || undefined, title: untag(previewTitle) || undefined } } : {}),
        ...(forwarded ? { forwardedFrom: untag(forwarded).replace(/^(?:Forwarded from|Переслано от|Переслано из)\s+/i, '') } : {}),
      });
    }
  }
  return { title, posts };
}

interface Entity { type: string; text?: string; href?: string }
interface Message { id: number; type?: string; date?: string; text?: string | (string | Entity)[]; text_entities?: Entity[]; forwarded_from?: string }
interface Export { name?: string; messages?: Message[] }

/** Текст поста: экспорт кладёт его либо строкой, либо кусками со ссылками. */
const plain = (t: Message['text']): string =>
  typeof t === 'string' ? t : (t ?? []).map((x) => (typeof x === 'string' ? x : x.text ?? '')).join('');

function fromJson(file: string): { title?: string; posts: Post[] } {
  const data = JSON.parse(readFileSync(file, 'utf8')) as Export;
  const posts: Post[] = [];
  for (const m of data.messages ?? []) {
    if (m.type && m.type !== 'message') continue;
    const text = plain(m.text);
    if (!text) continue;
    const links: PostLink[] = [];
    for (const e of m.text_entities ?? []) {
      if (e.type === 'link' && e.text) links.push({ url: e.text });
      if (e.type === 'text_link' && e.href) links.push({ url: e.href, ...(e.text ? { text: e.text } : {}) });
    }
    posts.push({
      id: m.id,
      date: m.date?.slice(0, 10),
      text,
      tags: hashtags(text),
      links,
      ...(links[0] ? { preview: { url: links[0].url } } : {}),
      ...(m.forwarded_from ? { forwardedFrom: m.forwarded_from } : {}),
    });
  }
  return { title: data.name, posts };
}

/** Файл, который пишет tools/telegram-fetch.py: посты уже в нашем виде, разбирать нечего.
 *  Отдельный формат, а не подделка под экспорт Desktop: у экспорта в JSON теряются заголовок
 *  и сайт превью, а по ним генераторы узнают ролик и статью. */
interface Fetched { name?: string; username?: string; source?: string; posts?: Post[] }

function readOne(path: string): { title?: string; posts: Post[] } {
  if (statSync(path).isDirectory()) return fromHtml(path);
  const data = JSON.parse(readFileSync(path, 'utf8')) as Fetched & Export;
  if (data.source === 'mtproto') return { title: data.name, posts: data.posts ?? [] };
  return fromJson(path);
}

/** Папка HTML-экспорта, файл result.json или выемка через MTProto; можно перечислить
 *  несколько через запятую — тогда посты сливаются по id. Так канал читается сразу из
 *  старого экспорта и из свежей выемки, и пересечение между ними не удваивается. */
export function readExport(path: string): { title?: string; posts: Post[] } {
  const parts = path.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 1) return readOne(parts[0]);
  const byId = new Map<number, Post>();
  let title: string | undefined;
  for (const part of parts) {
    const read = readOne(part);
    title ??= read.title;
    for (const post of read.posts) byId.set(post.id, post);
  }
  return { title, posts: [...byId.values()].sort((a, b) => a.id - b.id) };
}

/** Аргументы генераторов: «канал=путь». Имя канала задаётся явно — в экспорте его нет,
 *  а выводить из ссылок внутри постов нельзя: у elcinema рекламная ссылка встречается
 *  чаще собственной. */
interface ChannelList { channels?: { username: string; paths: string[]; role?: string }[] }

const home = (p: string) => p.replace(/^~/, process.env.HOME ?? '~');

export function parseArgs(argv: string[]): { username: string; path: string; role?: string }[] {
  // без аргументов берём постоянный список каналов: держать его в истории шелла — верный
  // способ однажды пересобрать индекс не по тем каналам
  const listFile = argv.length === 0 || argv[0] === '--channels'
    ? new URL(argv[1] ?? 'telegram-channels.json', import.meta.url)
    : undefined;
  if (listFile) {
    const list = JSON.parse(readFileSync(listFile, 'utf8')) as ChannelList;
    const args = (list.channels ?? [])
      .map((c) => ({ username: c.username, role: c.role, path: c.paths.map(home).filter((p) => existsSync(p)).join(',') }))
      .filter((a) => a.path);
    if (!args.length) {
      console.error(`в списке ${listFile.pathname} нет ни одного существующего пути`);
      process.exit(1);
    }
    return args;
  }
  const args = argv.map((a) => {
    const [username, ...rest] = a.split('=');
    return { username, path: rest.join('=').split(',').map(home).join(',') };
  });
  if (args.some((a) => !a.path)) {
    console.error('нужно «канал=путь», например episodesfilm=~/Downloads/ChatExport_ЭПИЗОДЫ');
    console.error('путей можно несколько через запятую: канал=экспорт,.cache/telegram/канал.json');
    console.error('без аргументов читается tools/telegram-channels.json');
    process.exit(1);
  }
  return args;
}
