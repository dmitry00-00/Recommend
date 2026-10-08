/**
 * Изображения героев (02.10) → src/mocks/characterImages.ts. Два источника, по порядку:
 *
 * 1. Wikidata P18 у элемента героя — файл Wikimedia Commons (свободная лицензия). Покрытие
 *    неполное: у вымышленных героев там рисунок, статуя или косплей, у многих — ничего.
 * 2. TMDB — актёр в этой роли: состав фильма (credits) или сериала (aggregate_credits), строка
 *    роли совпала с именем героя. Даёт и «по произведению»: Джокер в «Джокере» (2019) — Феникс, в
 *    «Тёмном рыцаре» — Леджер; страница произведения берёт своего. Нужен TMDB_API_KEY.
 *
 *   npx tsx tools/character-images.mts   (ключ TMDb — из .env.local) [--fresh] [--no-tmdb] [--offline]
 *
 * Кэши: .cache/character-p18.json (герой → файл или null), .cache/tmdb-credits.json (произведение →
 * состав). --offline — только из кэшей, без сети (пересобрать вывод после правки правил).
 */
import { writeFileSync } from 'node:fs';
import { characters, type CharacterRecord } from '../src/mocks/characters.ts';
import { readCache, sleep, wd, writeCache } from './wikidata-lib.mts';
import { loadEnvFile } from './env-file.mts';

loadEnvFile();
const args = process.argv.slice(2);
const FRESH = args.includes('--fresh'), OFFLINE = args.includes('--offline'), NO_TMDB = args.includes('--no-tmdb');
const KEY = process.env.TMDB_API_KEY ?? process.env.VITE_TMDB_API_KEY;

// ─── 1. Wikidata P18 ──────────────────────────────────────────────────────────
const p18: Record<string, string | null> = FRESH ? {} : readCache('character-p18.json', {});
const qs = Object.keys(characters).filter((q) => /^Q\d+$/.test(q) && !(q in p18));
if (!OFFLINE) {
  for (let i = 0; i < qs.length; i += 50) {
    const chunk = qs.slice(i, i + 50);
    try {
      const r = await wd<{ entities: Record<string, { claims?: { P18?: { mainsnak?: { datavalue?: { value?: string } } }[] } }> }>(
        { action: 'wbgetentities', ids: chunk.join('|'), props: 'claims' });
      for (const q of chunk) p18[q] = r.entities[q]?.claims?.P18?.[0]?.mainsnak?.datavalue?.value ?? null;
    } catch (e) { console.error(`  P18, пачка ${i}: ${(e as Error).message}`); }
    await sleep(300);
  }
  writeCache('character-p18.json', p18);
}
const commons = (file: string, width = 240) => `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file.replace(/ /g, '_'))}?width=${width}`;

// ─── 2. TMDB: актёр в роли ────────────────────────────────────────────────────
type Cast = { name: string; character: string; profile: string | null; order: number; episodes?: number };
const credits: Record<string, Cast[] | null> = readCache('tmdb-credits.json', {});
const API = 'https://api.themoviedb.org/3';
async function tmdb<T>(path: string, params: Record<string, string> = {}): Promise<T | undefined> {
  const bearer = KEY!.includes('.');
  const qs = new URLSearchParams({ ...params, ...(bearer ? {} : { api_key: KEY! }) });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const r = await fetch(`${API}${path}?${qs}`, bearer ? { headers: { Authorization: `Bearer ${KEY}` } } : undefined);
      if (r.status === 404) return undefined;
      if (r.ok) return await r.json() as T;
      if (r.status !== 429 && r.status < 500) return undefined;
    } catch { /* обрыв — повтор */ }
    await sleep(1500 * 2 ** attempt);
  }
  return undefined;
}
async function castOf(key: string): Promise<Cast[] | null> {
  if (key in credits) return credits[key];
  if (OFFLINE || NO_TMDB || !KEY) return null;
  let out: Cast[] | null = null;
  const m = /^tmdb:(\d+)$/.exec(key), imdb = /^imdb:(tt\d+)$/.exec(key);
  type Cr = { cast?: { name: string; character?: string; profile_path: string | null; order: number; roles?: { character: string; episode_count: number }[]; total_episode_count?: number }[] };
  const take = (c: Cr | undefined): Cast[] | null => c?.cast ? c.cast.flatMap((p) => (p.roles ?? [{ character: p.character ?? '', episode_count: p.total_episode_count ?? 0 }])
    .map((r) => ({ name: p.name, character: r.character, profile: p.profile_path, order: p.order, ...(r.episode_count ? { episodes: r.episode_count } : {}) }))) : null;
  if (m) out = take(await tmdb<Cr>(`/movie/${m[1]}/credits`));
  else if (imdb) {
    const f = await tmdb<{ movie_results: { id: number }[]; tv_results: { id: number }[] }>(`/find/${imdb[1]}`, { external_source: 'imdb_id' });
    if (f?.tv_results[0]) out = take(await tmdb<Cr>(`/tv/${f.tv_results[0].id}/aggregate_credits`));
    else if (f?.movie_results[0]) out = take(await tmdb<Cr>(`/movie/${f.movie_results[0].id}/credits`));
  }
  credits[key] = out;
  await sleep(120);
  return out;
}

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/["'«»“”‘’]/g, '').replace(/\s+/g, ' ').trim();
/** Строка роли в TMDB: «Bruce Wayne / Batman», «Tyrion 'The Imp' Lannister», «The Joker (voice)». */
function roleMatches(role: string, c: CharacterRecord): boolean {
  const names = [c.n, c.en, ...(c.aka ?? []), ...(c.w ?? [])].filter((x): x is string => Boolean(x)).map(norm).flatMap((x) => [x, x.replace(/^the /, '')]).filter((x) => x.length >= 3);
  const parts = role.split(/\s*[/;,]\s*|\s+\(|\)/).map((p) => norm(p.replace(/\b(voice|uncredited|archive footage)\b/gi, ''))).filter(Boolean);
  // без кличек в кавычках: «tyrion the imp lannister» → «tyrion lannister»
  const bare = norm(role.replace(/["'“‘][^"'”’]+["'”’]/g, ' '));
  return parts.some((p) => names.includes(p)) || names.includes(bare);
}

export interface CharImage { img: string; src: 'commons' | 'tmdb'; actor?: string; work?: string }
const out: Record<string, CharImage & { byWork?: Record<string, { img: string; actor: string }> }> = {};
let fromCommons = 0, fromTmdb = 0, perWork = 0, fetched = 0;
for (const [id, c] of Object.entries(characters)) {
  const byWork: Record<string, { img: string; actor: string }> = {};
  if (!NO_TMDB) {
    for (const key of c.works) {
      if (!/^(tmdb|imdb):/.test(key)) continue;
      const had = key in credits;
      const cast = await castOf(key);
      if (!had && key in credits) fetched++;
      // главный исполнитель роли: больше серий, раньше в титрах
      const hit = (cast ?? []).filter((p) => p.profile && roleMatches(p.character, c))
        .sort((a, b) => (b.episodes ?? 0) - (a.episodes ?? 0) || a.order - b.order)[0];
      if (hit) byWork[key] = { img: `https://image.tmdb.org/t/p/w185${hit.profile}`, actor: hit.name };
    }
  }
  const file = p18[id];
  const first = Object.entries(byWork)[0];
  if (file) { out[id] = { img: commons(file), src: 'commons' }; fromCommons++; }
  else if (first) { out[id] = { img: first[1].img, src: 'tmdb', actor: first[1].actor, work: first[0] }; fromTmdb++; }
  if (Object.keys(byWork).length) { (out[id] ??= { img: first![1].img, src: 'tmdb', actor: first![1].actor, work: first![0] }).byWork = byWork; perWork += Object.keys(byWork).length; }
  if (fetched && fetched % 50 === 0) writeCache('tmdb-credits.json', credits);
}
if (!OFFLINE && !NO_TMDB && KEY) writeCache('tmdb-credits.json', credits);
if (!KEY && !NO_TMDB && !OFFLINE) console.error('TMDB_API_KEY не задан — только Wikidata');

writeFileSync(new URL('../src/mocks/characterImages.ts', import.meta.url), `// Сгенерировано tools/character-images.mts (${new Date().toISOString().slice(0, 10)}): изображения героев.
// commons — файл Wikimedia Commons (P18 героя), tmdb — фото актёра в роли; byWork — исполнитель в
// конкретном произведении. Не править руками — перегенерировать.
export interface CharacterImage { img: string; src: 'commons' | 'tmdb'; actor?: string; work?: string; byWork?: Record<string, { img: string; actor: string }> }

export const characterImages: Record<string, CharacterImage> = ${JSON.stringify(out, null, 1)};
`);
const total = Object.keys(characters).length;
console.log(`изображения героев: ${Object.keys(out).length} из ${total} (Commons ${fromCommons}, актёр в роли ${fromTmdb}); по произведениям — ${perWork}`);
