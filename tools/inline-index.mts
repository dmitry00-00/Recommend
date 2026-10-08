// Индекс инлайн-поиска бота (06.10): «@recomend_media_bot тирион» в любом чате — карточки героев,
// фильмов, сериалов и книг. Сервер (worker/inline.ts) ищет по этому справочнику сам, без клиента и
// без базы: публикуется вместе с остальными (tools/publish-reference.mts, имя `inlineIndex`).
// Запись: p — параметр ссылки `?startapp=` (тот же, что у «Поделиться»: `w-tmdb_123`, герой —
// `h-<элемент Wikidata>`), k — вид, t/o — название и оригинальное, y — год, s — подпись, a — другие
// имена для поиска, i — картинка, r — вес в выдаче (сколько о нём говорят).
import { worksIndex } from './works-index.mts';
import { characters } from '../src/mocks/characters.ts';
import { characterImages } from '../src/mocks/characterImages.ts';

export interface InlineEntry { p: string; k: 'film' | 'series' | 'book' | 'character'; t: string; o?: string; y?: number; s?: string; a?: string[]; i?: string; r?: number }

const PARAM = /^[A-Za-z0-9_-]{1,64}$/;

export function buildInlineIndex(): InlineEntry[] {
  const works = worksIndex({ all: true });
  const label = new Map(works.map((w) => [w.key, w.work.title]));
  const out: InlineEntry[] = [];
  for (const [q, c] of Object.entries(characters)) {
    const p = `h-${q}`;
    if (!PARAM.test(p)) continue;
    const where = [...new Set(c.works.map((k) => label.get(k)).filter(Boolean))].slice(0, 3).join(', ');
    const aka = [...new Set([...(c.aka ?? []), ...(c.w ?? [])])].filter((x) => x !== c.n && x !== c.en).slice(0, 8);
    out.push({ p, k: 'character', t: c.n, ...(c.en && c.en !== c.n ? { o: c.en } : {}), ...(where ? { s: where } : {}),
      ...(aka.length ? { a: aka } : {}), ...(characterImages[q]?.img ? { i: characterImages[q].img } : {}), r: c.said });
  }
  const seen = new Set<string>();
  for (const { key, work } of works) {
    const p = `w-${key.replace(':', '_')}`;
    if (!PARAM.test(p) || seen.has(p)) continue;
    seen.add(p);
    const k = work.type === 'series' || work.type === 'book' ? work.type : 'film';
    const by = work.creators?.[0];
    out.push({ p, k, t: work.title, ...(work.originalTitle && work.originalTitle !== work.title ? { o: work.originalTitle } : {}),
      ...(work.year ? { y: work.year } : {}), ...(by ? { s: by } : {}), ...(work.coverUrl ? { i: work.coverUrl } : {}) });
  }
  return out;
}
