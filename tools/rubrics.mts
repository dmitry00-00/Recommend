// Рубрики каналов (02.10): повторяющиеся куски заголовков — «КИНОЧАЙ №57», «[ОВПН]», «Кино и Кофе»,
// «Обзор фильма», «Три товарища» у «Нового Телевидения». Это имя рубрики, а не название фильма.
//   npx tsx tools/rubrics.mts      → .cache/rubrics.json
//
// Заголовок режется на куски по « | », « / », « — », « - », «: » и скобкам; числа сводятся к «n»
// («КИНОЧАЙ №57» и «№52» — одна рубрика). Рубрика — кусок, который у канала встречается от 5 раз и
// не реже чем в 3% роликов. Опознаватель вырезает рубрики из заголовка перед поиском названия
// (tools/match-videos.mts, `stripRubrics`) — кроме тех, что сами называют произведение из фокуса
// канала («A Song of Ice and Fire» у Preston Jacobs — это и есть предмет). Исход рубрики по решениям
// людей (верно / ошибка) — в кандидатах стоп-слов (tools/stopwords.mts).
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

export const RUBRICS = new URL('../.cache/rubrics.json', import.meta.url);
export const normRubric = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[#№]\s*\d+/g, '#n').replace(/\d+/g, 'n')
  .replace(/[«»"“”„]/g, '').replace(/\s+/g, ' ').trim();
const SPLIT = /\s[|/—–-]\s|\s*\|\s*|\s\/\/\s|:\s/;
const BRACKETS = /\[([^\]]{2,40})\]|\(([^)]{2,40})\)/g;

/** Куски заголовка: [исходный текст куска, нормализованный]. */
export function segments(title: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of title.matchAll(BRACKETS)) out.push([m[0], normRubric(m[1] ?? m[2])]);
  for (const part of title.replace(BRACKETS, ' ').split(SPLIT)) if (part.trim()) out.push([part, normRubric(part)]);
  return out;
}

export function readRubrics(): Record<string, string[]> {
  try { return existsSync(RUBRICS) ? JSON.parse(readFileSync(RUBRICS, 'utf8')).channels as Record<string, string[]> : {}; } catch { return {}; }
}

/** Вырезатель рубрик: заголовок без кусков-рубрик своего канала; `keep` — куски, которые оставить. */
export function rubricStripper(byChannel = readRubrics(), keep?: (segment: string, channel: string) => boolean): (title: string, channel?: string) => string {
  const sets = new Map(Object.entries(byChannel).map(([ch, list]) => [ch, new Set(list)]));
  return (title, channel) => {
    const set = channel ? sets.get(channel) : undefined;
    if (!set?.size) return title;
    let t = title;
    for (const [raw, n] of segments(title)) if (set.has(n) && !(keep?.(raw, channel!))) t = t.replace(raw, ' ');
    t = t.replace(/\s*(?:[|/—–-]\s*){2,}/g, ' | ').replace(/^[\s|/—–:-]+|[\s|/—–:-]+$/g, '').replace(/\s{2,}/g, ' ').trim();
    return t || title;   // весь заголовок — рубрика: оставляем как был
  };
}

if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const dump = JSON.parse(readFileSync(new URL('../.cache/youtube/videos.json', import.meta.url), 'utf8')) as { title: string; channel: string }[];
  const by = new Map<string, string[]>();
  for (const v of dump) (by.get(v.channel) ?? by.set(v.channel, []).get(v.channel)!).push(v.title);
  const channels: Record<string, string[]> = {};
  const counts: Record<string, Record<string, number>> = {};
  for (const [ch, titles] of by) {
    if (titles.length < 15) continue;
    const cnt = new Map<string, number>();
    for (const t of titles) for (const s of new Set(segments(t).map(([, n]) => n))) if (s.length >= 3 && s.length <= 40) cnt.set(s, (cnt.get(s) ?? 0) + 1);
    const rub = [...cnt].filter(([s, n]) => n >= 5 && n / titles.length >= 0.03 && /\p{L}{3}/u.test(s)).sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (rub.length) { channels[ch] = rub.map(([s]) => s); counts[ch] = Object.fromEntries(rub); }
  }
  mkdirSync(new URL('../.cache/', import.meta.url), { recursive: true });
  writeFileSync(RUBRICS, JSON.stringify({ at: new Date().toISOString(), channels, counts }, null, 1));
  console.log(`рубрики: ${Object.values(channels).flat().length} у ${Object.keys(channels).length} каналов`);
}
