// Кого читают те, кого читаем мы → src/mocks/sourcesAuto.ts.
//   npx tsx tools/build-source-index.mts <канал>=<папка|result.json> [ещё…]
// Вход тот же, что у индекса разборов, — официальный экспорт Telegram Desktop. Два сигнала:
//   • ссылка на другой канал в посте — слабый: ссылаются и на рекламу, и на друзей;
//   • репост чужого поста — сильный: канал поставил чужой текст к себе в ленту.
// Реклама считается отдельно (у неё в посте «erid» или «реклама») и из кандидатов уходит:
// рекламная ссылка — не рекомендация.
// Ни на один из найденных каналов мы не ходим: всё, что мы про них знаем, лежит в наших же
// экспортах. Дальше их смотрит человек — кураторская, экран «Источники».
import { writeFileSync } from 'node:fs';
import { parseArgs, readExport } from './telegram-export.mts';
import { sources } from '../src/mocks/sources.ts';
import type { SourceCandidate } from '../src/types/tmdf.ts';

const args = parseArgs(process.argv.slice(2));
const mine = new Set(args.map((a) => a.username.toLowerCase()));
const known = new Set(sources.map((s) => s.handle.toLowerCase()));

/** Служебные адреса t.me — это не каналы. */
const SERVICE = new Set(['s', 'c', 'joinchat', 'addstickers', 'addemoji', 'addlist', 'addtheme', 'share',
  'proxy', 'socks', 'setlanguage', 'bg', 'iv', 'boost', 'login', 'confirmphone', 'telegram', 'contact']);
const REKLAMA = /(?:^|\W)(?:erid|реклама|рекламодател|партн[её]рский материал)/i;
/** Первая строка поста — чтобы было видно, в каком разговоре встретился канал. */
const firstLine = (text: string): string => {
  const line = text.replace(/https?:\/\/\S+/g, ' ').split('\n').map((l) => l.trim()).find(Boolean) ?? '';
  return line.length > 90 ? `${line.slice(0, 88).trimEnd()}…` : line;
};

interface Cand {
  handle?: string;
  /** как подписывают ссылку на него в тексте — бывает и куском фразы («это создал») */
  titles: Map<string, number>;
  /** как подписан его репост — это настоящее название канала, его ставит сам Telegram */
  fwdTitles: Map<string, number>;
  mentions: number;
  reposts: number;
  ads: number;
  by: Set<string>;
  lastAt?: string;
  sample?: string;
}
const cands = new Map<string, Cand>();
const at = (key: string): Cand => cands.get(key) ?? cands.set(key, {
  titles: new Map(), fwdTitles: new Map(), mentions: 0, reposts: 0, ads: 0, by: new Set(),
}).get(key)!;

/** Как подписали ссылку на канал — это его название; репост подписан только названием, без
 *  адреса. Через эту таблицу репост и ссылка сходятся в одного кандидата. */
const handleByTitle = new Map<string, string>();
const stats = { posts: 0, links: 0, reposts: 0, ads: 0 };
/** Репосты откладываем до конца: чей это канал, часто становится известно позже — из ссылки
 *  в другом посте или вовсе у другого нашего источника. */
const forwards: { name: string; channel: string; date?: string; sample: string; ad: boolean }[] = [];
const myTitles = new Set<string>();

for (const { username, path } of args) {
  const { title, posts } = readExport(path);
  const channel = title ?? username;
  myTitles.add(channel.toLowerCase());
  for (const p of posts) {
    stats.posts += 1;
    const ad = REKLAMA.test(p.text);
    if (ad) stats.ads += 1;
    for (const l of p.links) {
      const m = /^https?:\/\/t\.me\/(?:s\/)?([A-Za-z0-9_]{4,32})(?:\/|$|\?)/.exec(l.url);
      const handle = m?.[1];
      if (!handle) continue;
      const low = handle.toLowerCase();
      if (SERVICE.has(low) || low.endsWith('bot') || mine.has(low) || known.has(low)) continue;
      stats.links += 1;
      const c = at(`@${low}`);
      c.handle ??= handle;
      c.mentions += 1;
      c.by.add(channel);
      if (ad) c.ads += 1;
      if (l.text && !/^@|^https?:/.test(l.text) && l.text.length <= 60) {
        c.titles.set(l.text, (c.titles.get(l.text) ?? 0) + 1);
        handleByTitle.set(l.text.toLowerCase(), handle);
      }
      if (!c.lastAt || (p.date && p.date > c.lastAt)) { c.lastAt = p.date; c.sample = firstLine(p.text); }
    }
    if (p.forwardedFrom) forwards.push({ name: p.forwardedFrom, channel, date: p.date, sample: firstLine(p.text), ad });
  }
}

for (const f of forwards) {
  const handle = handleByTitle.get(f.name.toLowerCase());
  const low = handle?.toLowerCase();
  if (low && (mine.has(low) || known.has(low))) continue;
  if (myTitles.has(f.name.toLowerCase())) continue; // канал репостит сам себя
  stats.reposts += 1;
  const c = at(handle ? `@${low}` : `~${f.name.toLowerCase()}`);
  c.handle ??= handle;
  c.fwdTitles.set(f.name, (c.fwdTitles.get(f.name) ?? 0) + 1);
  c.reposts += 1;
  c.by.add(f.channel);
  if (f.ad) c.ads += 1;
  if (!c.lastAt || (f.date && f.date > c.lastAt)) { c.lastAt = f.date; c.sample = f.sample; }
}

/** Вес кандидата: сойтись на канале двум нашим источникам дороже любого числа упоминаний
 *  одним — это уже не совпадение. Поэтому число ссылок и репостов идёт с потолком: у
 *  «Кинопоиска» три сотни репостов из собственных же каналов-спутников, и без потолка они
 *  занимают весь список. */
const score = (c: Cand): number => c.by.size * 10 + Math.min(c.reposts, 30) * 3 + Math.min(c.mentions, 30);
// единичное упоминание одним каналом — шум; реклама — не рекомендация
const passed = [...cands.entries()]
  .filter(([, c]) => (c.reposts >= 2 || c.mentions >= 3 || c.by.size >= 2) && c.ads * 2 <= c.mentions + c.reposts);
console.error(`порог прошли ${passed.length}, из них с публичным именем ${passed.filter(([, c]) => c.handle).length}, `
  + `рекомендованы тремя и более нашими каналами ${passed.filter(([, c]) => c.by.size >= 3).length}`);
const out: SourceCandidate[] = passed
  .sort((a, b) => score(b[1]) - score(a[1]))
  .slice(0, 80)
  .map(([key, c]) => {
    // название репоста ставит сам Telegram — ему верим сразу; подпись ссылки бывает куском
    // фразы («это создал», «здесь»), поэтому берём её, только если так подписывают часто
    const top = (m: Map<string, number>) => [...m].sort((a, b) => b[1] - a[1])[0];
    const linked = top(c.titles);
    const title = top(c.fwdTitles)?.[0]
      ?? (linked && linked[1] >= 3 && linked[1] >= c.mentions * 0.15 ? linked[0] : undefined);
    return {
      id: `srcc-${key.slice(1)}`,
      title: title ?? `@${c.handle ?? key.slice(1)}`,
      ...(c.handle ? { handle: c.handle, url: `https://t.me/${c.handle}` } : {}),
      mentions: c.mentions,
      reposts: c.reposts,
      by: [...c.by].sort(),
      ...(c.lastAt ? { lastAt: c.lastAt } : {}),
      ...(c.sample ? { sample: c.sample } : {}),
    };
  });

writeFileSync(new URL('../src/mocks/sourcesAuto.ts', import.meta.url),
  `// Сгенерировано tools/build-source-index.mts (${new Date().toISOString().slice(0, 10)}): каналы, на которые
// ссылаются и которые репостят наши источники. Это кандидаты, а не источники: кто из них
// говорит о кино, а кто попал за компанию — решает человек в кураторской.
// Не править руками — перегенерировать.
import type { SourceCandidate } from '@/types/tmdf';

export const sourceCandidates: SourceCandidate[] = ${JSON.stringify(out, null, 2)};
`);
console.error(`постов ${stats.posts}, ссылок на чужие каналы ${stats.links}, репостов ${stats.reposts}, рекламных постов ${stats.ads}`);
console.error(`кандидатов ${cands.size} → в файл ${out.length}`);
for (const c of out.slice(0, 25)) {
  const name = c.handle && c.title !== `@${c.handle}` ? `${c.title} @${c.handle}` : c.title;
  console.error(`  репостов ${String(c.reposts).padStart(3)} ссылок ${String(c.mentions).padStart(3)} — ${name} (от: ${c.by.join(', ')})`);
}
