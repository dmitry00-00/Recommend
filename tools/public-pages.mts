// Публичные страницы для поисковиков (ЗП-15, 07.10): справочник `publicPages` — какие фильмы и авторы получают
// страницу и что о них сказать. Сервер (worker/pages.ts) рисует по нему HTML: /film/<ключ>, /author/<канал>,
// карту сайта; разборы — из справочника `essaysAuto`, который уже на сервере.
// Страница — только там, где есть что показать и за что не стыдно: фильм с подтверждённым русским разбором
// (неподтверждённая привязка на публичной странице хуже, чем её отсутствие), автор из реестра с такими разборами.
//   npx tsx tools/public-pages.mts      — посчитать (публикует tools/publish-reference.mts)
import { worksIndex } from './works-index.mts';
import { essaysAuto } from '../src/mocks/essaysAuto.ts';
import { draftAnnotations } from '../src/mocks/draftAnnotations.ts';
import { seriesAnnotations } from '../src/mocks/seriesAnnotations.ts';
import { draftReview } from '../src/mocks/draftReview.ts';
import { baseMedia } from '../src/mocks/baseMedia.ts';
import { sources } from '../src/mocks/sources.ts';

/** Фильм: t — название, o — оригинальное, y — год, c — режиссёр или создатель, w — что вещь делает со
 *  зрителем (черновик разметки, не low), p — обложка, s — сериал. */
export interface PageWork { t: string; o?: string; y?: number; c?: string[]; w?: string; p?: string; s?: 1 }
/** Автор: n — имя канала, u — ссылка на канал, e — эссеист (иначе обзорщик), b — о книгах. */
export interface PageAuthor { n: string; u: string; e?: 1; b?: 1 }
export interface PublicPages { works: Record<string, PageWork>; authors: Record<string, PageAuthor>; at: string }

const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
/** Адрес автора: id реестра без `src-` — `yt-mishadarko`, `episodesfilm`. */
export const authorSlug = (id: string) => id.replace(/^src-/, '');

export function buildPublicPages(): PublicPages {
  const cards = new Map(worksIndex({ all: true }).map((w) => [w.key, w.work]));
  const voices = new Map(sources.filter((s) => s.role === 'voice' && !s.via).map((s) => [norm(s.title), s]));
  const works: Record<string, PageWork> = {};
  const authors: Record<string, PageAuthor> = {};
  for (const [key, list] of Object.entries(essaysAuto)) {
    const shown = list.filter((e) => !e.unverified && (e.language ?? 'ru') === 'ru');
    const w = cards.get(key);
    if (!shown.length || !w) continue;
    const ann = draftAnnotations[key] ?? seriesAnnotations[key];
    const what = ann && ann.confidence !== 'low' && draftReview[key]?.status !== 'rejected' ? ann.what : undefined;
    const cover = w.coverUrl ?? baseMedia[w.id]?.coverUrl;
    works[key] = {
      t: w.title, ...(w.originalTitle && w.originalTitle !== w.title ? { o: w.originalTitle } : {}), ...(w.year ? { y: w.year } : {}),
      ...(w.creators?.length ? { c: w.creators.slice(0, 2) } : {}), ...(what ? { w: what } : {}), ...(cover ? { p: cover } : {}),
      ...(w.type === 'series' ? { s: 1 as const } : {}),
    };
    for (const e of shown) {
      const v = voices.get(norm(e.author));
      if (!v || authors[authorSlug(v.id)]) continue;
      authors[authorSlug(v.id)] = { n: v.title.trim(), u: v.url, ...(v.tier === 'essay' ? { e: 1 as const } : {}), ...(v.medium === 'book' ? { b: 1 as const } : {}) };
    }
  }
  return { works, authors, at: new Date().toISOString() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const p = buildPublicPages();
  const withWhat = Object.values(p.works).filter((w) => w.w).length;
  console.log(`страниц фильмов ${Object.keys(p.works).length} (с описанием ${withWhat}), авторов ${Object.keys(p.authors).length}; ${(JSON.stringify(p).length / 1024).toFixed(0)} КБ`);
}
