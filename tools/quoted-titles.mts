// Что каналы называют в кавычках и знаем ли мы эти фильмы.
//   npx tsx tools/quoted-titles.mts [канал ...]
// Нужен для одного решения: если канал даёт мало привязок, дело в нём (не называет фильмов)
// или в нас (называет те, которых нет в справочнике). Первое — повод не брать канал, второе —
// повод расширять базу, и это разные работы. Ровно на этом уже обжигались 22.09: правила
// сопоставления были ни при чём, узким местом оказался справочник.
import { existsSync, readFileSync } from 'node:fs';
import { stemOf } from './title-match.mts';
import { worksIndex } from './works-index.mts';

const args = process.argv.slice(2);
const channels = args.length ? args : JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8'))
  .channels.map((c: { username: string }) => c.username);

/** Ключ сравнения: без кавычек, регистра, «ё» и диакритики — иначе «Расемон» не найдёт
 *  «Расёмон», а «Малхолланд Драйв» не найдёт «Малхолланд драйв». */
const key = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const known = new Set<string>();
/** Русский падеж: «Одиссею», «Обсессии», «Чужого» — это те же фильмы, и считать их
 *  незнакомыми значит завысить пробел в справочнике. Морфологии у нас нет, есть основы —
 *  тот же приём, что в сопоставлении названий. */
const stems: RegExp[] = [];
for (const { work, names } of worksIndex()) {
  for (const n of [...names, work.title]) {
    known.add(key(n));
    try { stems.push(new RegExp(`^${stemOf(n)}$`, 'iu')); } catch { /* имя без основы */ }
  }
}
const knownByStem = (raw: string): boolean => stems.some((re) => re.test(raw.trim()));

// «Сталкер», "Solaris", „Vertigo“ — кавычки у каналов разные, а внутри может быть и год
const QUOTED = /[«"„]([^»"“«„\n]{2,60})[»"“]/g;
const unknown = new Map<string, number>();
let postsTotal = 0;
let quotedTotal = 0;

console.log('канал                 постов  в кавычках  знаем  не знаем');
for (const handle of channels) {
  const file = `.cache/telegram/${handle}.json`;
  if (!existsSync(file)) continue;
  const posts = (JSON.parse(readFileSync(file, 'utf8')).posts ?? []) as { text?: string }[];
  let quoted = 0;
  let hit = 0;
  const seen = new Set<string>();
  for (const p of posts) {
    for (const m of (p.text ?? '').matchAll(QUOTED)) {
      // отрезаем год и оригинальное название в скобках: «Лобстер» (The Lobster, 2015)
      const raw = m[1].replace(/\s*[,(]\s*\d{4}.*$/, '').trim();
      const k = key(raw);
      if (!k || k.split(' ').length > 8) continue;
      quoted += 1;
      if (known.has(k) || knownByStem(raw)) hit += 1;
      else if (!seen.has(k)) { seen.add(k); unknown.set(raw, (unknown.get(raw) ?? 0) + 1); }
    }
  }
  postsTotal += posts.length;
  quotedTotal += quoted;
  const share = quoted ? Math.round((100 * hit) / quoted) : 0;
  console.log(`${handle.padEnd(22)}${String(posts.length).padStart(5)}${String(quoted).padStart(12)}${String(hit).padStart(7)} (${share}%)${String(quoted - hit).padStart(6)}`);
}

const twice = [...unknown.values()].filter((n) => n >= 2).length;
console.log(`\nвсего: постов ${postsTotal}, названий в кавычках ${quotedTotal}`);
console.log(`разных незнакомых названий ${unknown.size}, из них названы не по одному разу ${twice}`);
console.log('чаще всего называют то, чего у нас нет:');
for (const [title, n] of [...unknown.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  console.log(`  ${n} × ${title}`);
}
