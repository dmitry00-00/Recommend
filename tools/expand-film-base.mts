// Расширение справочника тем, о чём говорят каналы: берём названия, которые они называют в
// кавычках не по одному разу и которых у нас нет, и опознаём их в Wikidata.
//   npx tsx tools/expand-film-base.mts [--min 2] [--limit N]
//
// Почему Wikidata, а не TMDb: у неё лицензия CC0, а решение владельца 23.09 — новые вещи не
// строить на некоммерческих источниках (TMDb в этом списке). Идентификаторы TMDb и IMDb при
// этом никуда не деваются: Wikidata хранит их сама (P4947 и P345), так что ключ привязки
// разборов остаётся прежним, а ходить в TMDb за опознанием больше не нужно.
//
// Замер, ради которого это написано (23.09): двенадцать новых каналов дали 3730 постов и
// всего 33 привязки, при том что названий в кавычках там 7427. В справочнике находилось 5–10%,
// и ровно столько же — у наших нынешних источников. Значит, узкое место не каналы, а база.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { stemOf } from './title-match.mts';
import { worksIndex } from './works-index.mts';
import type { WorkCard } from '../src/types/tmdf.ts';

const arg = (name: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1] : undefined);
const MIN = Number(arg('--min')) || 2;
const LIMIT = Number(arg('--limit')) || 0;
const UA = 'recomend-research/0.1 (local prototype; contact via project owner)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 1. чего мы не знаем ───────────────────────────────────────────────────────
const key = (s: string) => s.normalize('NFD').replace(/\p{M}+/gu, '').toLowerCase()
  .replace(/ё/g, 'е').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const known = new Set<string>();
const stems: RegExp[] = [];
for (const { work, names } of worksIndex()) {
  for (const n of [...names, work.title]) {
    known.add(key(n));
    try { stems.push(new RegExp(`^${stemOf(n)}$`, 'iu')); } catch { /* имя без основы */ }
  }
}

const channels = JSON.parse(readFileSync('tools/telegram-channels.json', 'utf8'))
  .channels as { username: string; role?: string }[];
const QUOTED = /[«"„]([^»"“«„\n]{2,60})[»"“]/g;
const counts = new Map<string, number>();
for (const c of channels) {
  // площадки называют свои премьеры, и это не то, о чём говорят: расширять справочник
  // каталогом онлайн-кинотеатра мы не собирались
  if (c.role === 'platform') continue;
  const file = `.cache/telegram/${c.username}.json`;
  if (!existsSync(file)) continue;
  for (const p of JSON.parse(readFileSync(file, 'utf8')).posts as { text?: string }[]) {
    for (const m of (p.text ?? '').matchAll(QUOTED)) {
      const raw = m[1].replace(/\s*[,(]\s*\d{4}.*$/, '').trim();
      const k = key(raw);
      if (!k || k.split(' ').length > 8) continue;
      if (known.has(k) || stems.some((re) => re.test(raw))) continue;
      counts.set(raw, (counts.get(raw) ?? 0) + 1);
    }
  }
}
// одно и то же название в разных падежах считаем вместе — по ключу без окончаний нельзя,
// поэтому просто складываем формы с общим началом длиной в шесть знаков
const merged = new Map<string, { title: string; n: number }>();
for (const [title, n] of counts) {
  const head = key(title).slice(0, 6);
  const prev = merged.get(head);
  if (!prev) merged.set(head, { title, n });
  else merged.set(head, { title: prev.title.length <= title.length ? prev.title : title, n: prev.n + n });
}
let todo = [...merged.values()].filter((x) => x.n >= MIN).sort((a, b) => b.n - a.n);
if (LIMIT) todo = todo.slice(0, LIMIT);
console.error(`незнакомых названий ${counts.size}, после склейки форм ${merged.size}, к опознанию ${todo.length} (названы ≥${MIN} раз)`);

// ── 2. опознание в Wikidata ───────────────────────────────────────────────────
interface SearchHit { id: string; label?: string; description?: string }
interface Claim { mainsnak?: { datavalue?: { value: unknown } } }
interface Entity {
  labels?: Record<string, { value: string }>;
  claims?: Record<string, Claim[]>;
}

async function api<T>(params: Record<string, string>): Promise<T | undefined> {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA } });
      if (res.ok) return await res.json() as T;
      if (res.status === 429) await sleep(3000 * (attempt + 1));
    } catch { /* сеть дрогнула */ }
    await sleep(800 * (attempt + 1));
  }
  return undefined;
}

const FILM = new Set(['Q11424', 'Q506240', 'Q24869', 'Q202866', 'Q20650540']); // фильм, телефильм, анимационный и т. п.
const id = (c?: Claim) => (c?.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id;
const str = (c?: Claim) => c?.mainsnak?.datavalue?.value as string | undefined;
const time = (c?: Claim) => (c?.mainsnak?.datavalue?.value as { time?: string } | undefined)?.time;

const found: WorkCard[] = [];
const directors = new Map<string, string[]>(); // QID режиссёра → id карточек
const missed: string[] = [];
let done = 0;
for (const { title } of todo) {
  const search = await api<{ search?: SearchHit[] }>({ action: 'wbsearchentities', search: title, language: 'ru', uselang: 'ru', type: 'item', limit: '5' });
  const ids = (search?.search ?? []).map((s) => s.id);
  if (ids.length) {
    const got = await api<{ entities?: Record<string, Entity> }>({ action: 'wbgetentities', ids: ids.join('|'), props: 'labels|claims', languages: 'ru|en' });
    for (const qid of ids) {
      const e = got?.entities?.[qid];
      const kinds = (e?.claims?.P31 ?? []).map((c) => id(c));
      if (!kinds.some((k) => k && FILM.has(k))) continue;
      const tmdb = Number(str(e?.claims?.P4947?.[0]));
      const imdb = str(e?.claims?.P345?.[0]);
      if (!tmdb && !imdb) continue;
      const year = Number(time(e?.claims?.P577?.[0])?.slice(1, 5)) || 0;
      const ru = e?.labels?.ru?.value;
      const en = e?.labels?.en?.value;
      const card: WorkCard = {
        id: `f-wd${qid.slice(1)}`,
        type: 'film',
        title: ru ?? en ?? title,
        ...(en && en !== ru ? { originalTitle: en } : {}),
        year,
        creators: [],
        primaryOperations: [],
        complexityLevel: 0,
        warnings: [],
        barriers: [],
        isNicheMasterpiece: false,
        externalIds: { ...(tmdb ? { tmdb } : {}), ...(imdb ? { imdb } : {}) },
      };
      const director = id(e?.claims?.P57?.[0]);
      if (director) directors.set(director, [...(directors.get(director) ?? []), card.id]);
      found.push(card);
      break;
    }
  }
  if (!found.some((f) => f.title === title) && !ids.length) missed.push(title);
  if (++done % 50 === 0) console.error(`  опознано ${found.length} из ${done}`);
  await sleep(250);
}

// имена режиссёров одним заходом: сами по себе они не ищутся, только по QID из карточек
for (let i = 0; i < [...directors.keys()].length; i += 50) {
  const batch = [...directors.keys()].slice(i, i + 50);
  const got = await api<{ entities?: Record<string, Entity> }>({ action: 'wbgetentities', ids: batch.join('|'), props: 'labels', languages: 'ru|en' });
  for (const qid of batch) {
    const name = got?.entities?.[qid]?.labels?.ru?.value ?? got?.entities?.[qid]?.labels?.en?.value;
    if (!name) continue;
    for (const cardId of directors.get(qid) ?? []) {
      const card = found.find((f) => f.id === cardId);
      if (card) card.creators = [name];
    }
  }
  await sleep(250);
}

// дубли по TMDb: одно название могло прийти в двух формах
const seen = new Set<string>();
const uniq = found.filter((f) => {
  const k = f.externalIds?.tmdb != null ? `tmdb:${f.externalIds.tmdb}` : `imdb:${f.externalIds?.imdb}`;
  if (seen.has(k) || known.has(key(f.title))) return false;
  seen.add(k);
  return true;
});

writeFileSync(new URL('../src/mocks/filmBaseWiki.ts', import.meta.url),
  `// Сгенерировано tools/expand-film-base.mts (${new Date().toISOString().slice(0, 10)}): фильмы, о
// которых говорят каналы, опознанные в Wikidata (CC0). Разметки у этих карточек нет — они нужны,
// чтобы разборы было к чему привязывать, и в подбор не идут.
// Не править руками — перегенерировать.
import type { WorkCard } from '@/types/tmdf';

export const filmBaseWiki: WorkCard[] = ${JSON.stringify(uniq, null, 2)};
`);
console.error(`опознано ${uniq.length} из ${todo.length}; с TMDb ${uniq.filter((f) => f.externalIds?.tmdb != null).length}, только IMDb ${uniq.filter((f) => f.externalIds?.tmdb == null).length}`);
console.error(`не нашлось ничего похожего: ${missed.length}`);
