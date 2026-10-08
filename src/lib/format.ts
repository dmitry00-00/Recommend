import type { WorkCard } from '@/types/tmdf';
import { isSeries } from '@/lib/media';
import { leadCredits, leadName } from '@/lib/credits';
import ui, { language, plural } from '@/i18n';

type Titled = { title: string; originalTitle?: string; id?: string; type?: string; externalIds?: { tmdb?: number; imdb?: string } };

/** Ключ английского названия (src/mocks/titlesEn.ts, tools/titles-en.mts): `m<tmdb>` / `t<tmdb>`, без TMDb — `imdb:tt…`. */
export function enTitleKey(w: Titled): string | undefined {
  const t = w.externalIds?.tmdb;
  if (t != null) return `${w.type === 'series' ? 't' : 'm'}${t}`;
  return w.externalIds?.imdb ? `imdb:${w.externalIds.imdb}` : undefined;
}

// английские названия грузятся только в английском интерфейсе (main.tsx) — русскому они ни к чему
let titlesEn: Readonly<Record<string, string>> = {};
export function setTitlesEn(map: Readonly<Record<string, string>>) { titlesEn = map; }
const LATIN = /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u;

/** Название на языке интерфейса (ЗП-20). По-английски — английское из TMDb, если оригинала нет или он не
 *  латиницей («기생충» → «Parasite», «Сталкер» → «Stalker»); иначе оригинальное; не нашлось — как есть. */
export function titleOf(w: Titled): string {
  if (language !== 'en') return w.title;
  const key = enTitleKey(w);
  const en = key ? titlesEn[key] : undefined;
  if (en) return en;
  return w.originalTitle && LATIN.test(w.originalTitle) ? w.originalTitle : w.title;
}

export function formatDuration(minutes?: number): string | undefined {
  if (!minutes) return undefined;
  return `${minutes} ${plural(minutes, ...ui.units.minute)}`;
}

/** Сериал: «3 сезона», «8 серий по 50 мин» — что известно (Е1). */
function seriesLength(work: WorkCard): string | undefined {
  const s = work.series;
  // у старых карточек сериала вместо сведений — длина серии в durationMinutes
  if (!s) return work.durationMinutes ? ui.units.episodeLength(formatDuration(work.durationMinutes)!) : undefined;
  if (s.seasons && s.seasons > 1) return `${s.seasons} ${plural(s.seasons, ...ui.units.season)}`;
  if (s.episodes) return `${s.episodes} ${plural(s.episodes, ...ui.units.episode)}${s.episodeMinutes ? ui.units.episodeOf(s.episodeMinutes) : ''}`;
  return undefined;
}

/** Порядок метаданных кадра: что это · кто · сколько длится. Год живёт на обложке. */
export function workMeta(work: WorkCard): (string | undefined)[] {
  return [
    isSeries(work) ? ui.units.series : work.type === 'book' ? ui.units.book : ui.units.film,
    // по-русски из справочника; нет — leadName решит, показывать ли пришедшее с карточкой (02.10).
    // По-английски — имена латиницей, как пришли (ЗП-20)
    leadCredits(work).map((c) => c.name).filter((n) => (language === 'ru') === /[А-Яа-яЁё]/.test(n)).join(', ') || leadName(work),
    isSeries(work) ? seriesLength(work)
      : work.type !== 'book' ? formatDuration(work.durationMinutes) : work.pages ? ui.units.pages(work.pages) : undefined,
  ];
}

export function seedOf(value: string): number {
  let n = 0;
  for (let i = 0; i < value.length; i++) n = (n * 31 + value.charCodeAt(i)) % 100000;
  return n;
}

/** Русское согласование числа: 1 произведение, 2 произведения, 5 произведений. */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const tail = n % 10;
  const teen = n % 100 >= 10 && n % 100 <= 20;
  return !teen && tail === 1 ? one : !teen && tail > 1 && tail < 5 ? few : many;
}


/** ISO-дата → «2 ноября 2025»; год опускается, если он текущий. Не дата — как есть. */
export function formatDate(iso?: string, today = new Date()): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const year = Number(y) === today.getFullYear() ? '' : ` ${y}`;
  return ui.units.date(Number(d), ui.units.months[Number(mo) - 1], year.trim());
}
