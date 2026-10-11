// Профиль Telegram-канала как зрителя (09.10): проверить подбор на искушённых зрителях — авторах каналов.
// Два источника:
//   1. рейтинг-список — пост, где автор выстроил просмотренное «от того, что понравилось больше, к тому, что
//      не понравилось вообще» (у «Эпизодов» — накопительный за год): строки `"Название" (Страна, реж. Имя)`.
//      Место в списке → оценка 1–5 (верхняя пятая — «Отлично», нижняя десятая — «Мимо»). Берётся последний такой пост;
//   2. разобранное в постах — фильмы, к которым индекс разборов (src/mocks/postsAuto.ts) привязал посты канала:
//      видел, без оценки (о плохом тоже пишут).
// Фильм ищется сначала в справочнике (название + год + фамилия режиссёра), иначе в TMDb (2026 → 2025 → без года,
// режиссёр должен совпасть). Выход — seeds/tg-<канал>.json в формате присланных списков (UserSeed): его читает
// tools/seed-slate.mts, а publish-seed положит на сервер под ником автора, если тот захочет войти со своей историей.
//   npx tsx tools/channel-seed.mts episodesfilm [a_researcher …]
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnvFile } from './env-file.mts';
import { worksIndex } from './works-index.mts';
import { postsAuto } from '../src/mocks/postsAuto.ts';
import { tmdbFromEnv } from '../src/lib/resolve/index.ts';
import type { WorkCard } from '../src/types/tmdf.ts';
import type { UserSeed } from '../worker/env.ts';

loadEnvFile();
const tmdb = tmdbFromEnv(process.env.TMDB_API_KEY || process.env.VITE_TMDB_API_KEY);
const channels = process.argv.slice(2).map((c) => c.replace(/^@/, ''));
if (!channels.length) { console.error('какой канал? npx tsx tools/channel-seed.mts episodesfilm'); process.exit(2); }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[«»"“”„'’:!?.,—–-]/g, ' ').replace(/\s+/g, ' ').trim();
const index = worksIndex({ all: true });
const byTitle = new Map<string, WorkCard[]>();
for (const { work } of index) {
  for (const t of new Set([work.title, work.originalTitle].filter((x): x is string => Boolean(x)).map(norm))) {
    byTitle.set(t, [...(byTitle.get(t) ?? []), work]);
  }
}
const byKey = new Map(index.map((w) => [w.key, w.work]));

/** «Ф. Лорд», «Ф. и Н. Кравчуки», «Эндрю Стэнтон и Маккена Харрис» → фамилии для сверки */
const surnames = (director: string): string[] => director.split(/\s+и\s+|,/).map((p) => p.trim().split(/\s+/).pop() ?? '')
  .map((s) => norm(s).replace(/и$/, '')).filter((s) => s.length >= 3);
const directedBy = (w: { creators?: string[] }, names: string[]) =>
  !names.length || (w.creators ?? []).some((c) => names.some((n) => norm(c).includes(n)));

interface Line { title: string; country: string; director: string; rank: number }
/** строки рейтинга: внешние кавычки — до последней перед « (» (вложенные: "Проект "Конец света"") */
function parseList(text: string): Line[] {
  const out: Line[] = [];
  for (const raw of text.split('\n')) {
    const m = /^\s*\**\s*["«“](.+)["»”]\s*\**\s*\(([^()]*?)(?:,\s*реж\.\s*([^()]*))?\)/.exec(raw);
    if (m) out.push({ title: m[1].replace(/["«»“”]/g, '').trim(), country: m[2].trim(), director: (m[3] ?? '').trim(), rank: out.length });
  }
  return out;
}

/** место в списке → оценка: верхняя пятая — 5, следующая четверть — 4, середина — 3, дальше — 2, нижняя десятая — 1 */
const ratingFor = (rank: number, n: number): 1 | 2 | 3 | 4 | 5 => {
  const q = n > 1 ? rank / (n - 1) : 0;
  return q < 0.2 ? 5 : q < 0.45 ? 4 : q < 0.7 ? 3 : q < 0.9 ? 2 : 1;
};

const blank = { primaryOperations: [], complexityLevel: 0, warnings: [], barriers: [], isNicheMasterpiece: false };

async function resolveLine(l: Line, year?: number): Promise<{ workId: string; work: WorkCard; tmdb?: number; imdb?: string; via: string } | undefined> {
  const names = surnames(l.director);
  const local = (byTitle.get(norm(l.title)) ?? [])
    .filter((w) => directedBy(w, names) && (!year || !w.year || Math.abs(w.year - year) <= 1))
    .sort((a, b) => Math.abs((a.year ?? 0) - (year ?? 0)) - Math.abs((b.year ?? 0) - (year ?? 0)));
  if (local[0]) return { workId: local[0].id, work: local[0], tmdb: local[0].externalIds?.tmdb, imdb: local[0].externalIds?.imdb, via: 'справочник' };
  if (!tmdb) return undefined;
  for (const y of [year, year ? year - 1 : undefined, undefined]) {
    const hit = await tmdb.search(l.title, y).catch(() => undefined);
    if (!hit) continue;
    const t = await tmdb.movie(hit.id).catch(() => undefined);
    if (!t?.title || !directedBy(t, names)) continue;
    const work: WorkCard = {
      id: `l-tmdb${hit.id}`, type: 'film', title: t.title, originalTitle: t.originalTitle, year: t.year ?? y ?? 0,
      creators: t.creators ?? [], countries: t.countries, coverUrl: t.coverUrl, stillUrl: t.stillUrl, imageSource: t.imageSource,
      blurb: t.blurb, durationMinutes: t.durationMinutes, ...blank, externalIds: { tmdb: hit.id, ...(hit.imdb ? { imdb: hit.imdb } : {}) },
    };
    return { workId: work.id, work, tmdb: hit.id, imdb: hit.imdb, via: 'TMDb' };
  }
  return undefined;
}

for (const ch of channels) {
  const file = `.cache/telegram/${ch}.json`;
  if (!existsSync(file)) { console.error(`нет ${file} — канала нет в шлюзе`); continue; }
  const posts = (JSON.parse(readFileSync(file, 'utf8')).posts ?? []) as { id: number; date: string; text?: string }[];
  console.error(`\n@${ch}: постов ${posts.length}`);
  const watched: UserSeed['watched'] = [];
  const ratings: NonNullable<UserSeed['ratings']> = [];
  const unmatched: string[] = [];
  const seen = new Set<string>();

  // 1. последний рейтинг-список
  const ranked = posts
    .map((p) => ({ p, lines: parseList(p.text ?? '') }))
    .filter(({ p, lines }) => lines.length >= 5 && /понравил|список просмотренн|список за|оцени/i.test(p.text ?? ''))
    .sort((a, b) => b.p.date.localeCompare(a.p.date))[0];
  if (ranked) {
    const year = Number(/фильмов\s+(20\d\d)/i.exec(ranked.p.text ?? '')?.[1] ?? ranked.p.date.slice(0, 4));
    console.error(`  рейтинг: пост ${ranked.p.id} от ${ranked.p.date}, строк ${ranked.lines.length}, год ${year}`);
    for (const l of ranked.lines) {
      const r = await resolveLine(l, year);
      if (!r) { unmatched.push(`${l.title} (${l.country}, реж. ${l.director})`); console.error(`  ✗ ${l.title}`); continue; }
      if (seen.has(r.workId)) continue;
      seen.add(r.workId);
      const rating = ratingFor(l.rank, ranked.lines.length);
      watched.push({ workId: r.workId, work: r.work, ...(r.tmdb ? { tmdb: r.tmdb } : {}), ...(r.imdb ? { imdb: r.imdb } : {}) });
      ratings.push({ workId: r.workId, rating, work: r.work });
      console.error(`  ${l.rank + 1}. ${l.title} → ${r.work.title} (${r.work.year}) ${r.via} · ${rating}`);
    }
  } else console.error('  рейтинг-списка нет — только разобранное в постах');

  // 2. разобранное в постах
  const prefix = `tg-${ch.toLowerCase()}-`;
  let discussed = 0;
  for (const [key, list] of Object.entries(postsAuto)) {
    if (!list.some((a) => a.id.toLowerCase().startsWith(prefix))) continue;
    const work = byKey.get(key);
    if (!work || seen.has(work.id)) continue;
    seen.add(work.id);
    watched.push({ workId: work.id, work, ...(work.externalIds?.tmdb ? { tmdb: work.externalIds.tmdb } : {}), ...(work.externalIds?.imdb ? { imdb: work.externalIds.imdb } : {}) });
    discussed += 1;
  }
  console.error(`  разобрано в постах: ${discussed}`);

  const body = { watched, ratings };
  const version = createHash('sha1').update(JSON.stringify(body)).digest('hex').slice(0, 12);
  mkdirSync('seeds', { recursive: true });
  const out = `seeds/tg-${ch}.json`;
  writeFileSync(out, JSON.stringify({ username: `tg-${ch}`, version, ...body, unmatched, source: { channel: ch, rankedPost: ranked?.p.id }, resolvedAt: new Date().toISOString() }, null, 2));
  console.error(`→ ${out}: видел ${watched.length}, с оценкой ${ratings.length}, не нашлось ${unmatched.length}`);
}
