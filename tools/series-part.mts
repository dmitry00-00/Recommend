// О каком сезоне и серии материал (Е6): «Фарго 3 сезон», «второй сезон», «S05E14», «5 серия»,
// «Season 2 Episode 3». Нужен ролику или посту, уже привязанному к сериалу: у антологии единица
// разметки — сезон (Е2), и разбор третьего сезона «Фарго» относится к нему, а не к сериалу вообще.
// Диапазон («1–3 сезоны», «все сезоны») — про сериал целиком: ни сезона, ни серии.

const ORD: Record<string, number> = {
  перв: 1, втор: 2, трет: 3, четвёрт: 4, четверт: 4, пят: 5, шест: 6, седьм: 7, восьм: 8, девят: 9, десят: 10,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
};
const ordinal = (w: string): number | undefined => {
  const l = w.toLowerCase();
  for (const [stem, n] of Object.entries(ORD)) if (l.startsWith(stem)) return n;
  return undefined;
};
const num = (s: string | undefined): number | undefined => {
  if (!s) return undefined;
  const n = /^\d+$/.test(s) ? Number(s) : ordinal(s);
  return n != null && n > 0 && n <= 60 ? n : undefined;
};

const NB = '(?<![\\p{L}\\p{N}])';
const NA = '(?![\\p{L}\\p{N}])';
const ORDW = '(?:перв|втор|трет|четв[её]рт|пят|шест|седьм|восьм|девят|десят)\\p{L}*|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth';
// диапазон и перечисление: «1–3 сезоны», «1 и 2 сезон», «10, 11 сезоны», «все сезоны»
const RANGE = new RegExp(`${NB}\\d{1,2}(?:\\s*-?\\p{L}{0,3})?\\s*(?:[-–—,]|и)\\s*\\d{1,2}(?:\\s*-?\\p{L}{0,3})?\\s*сезон|все\\s+сезоны|${NB}seasons?\\s*\\d{1,2}\\s*(?:[-–—,&]|and)\\s*\\d{1,2}`, 'iu');
const SXE = new RegExp(`${NB}s(\\d{1,2})\\s*[.:]?\\s*e(\\d{1,3})${NA}`, 'iu');
const SEASON = [
  new RegExp(`${NB}(\\d{1,2})(?:\\s*-?\\s*(?:й|ий|ый|ой|го|м))?\\s+сезон\\p{L}*`, 'iu'),
  new RegExp(`${NB}сезон\\p{L}*\\s*(?:№\\s*)?(\\d{1,2})${NA}`, 'iu'),
  new RegExp(`${NB}(${ORDW})\\s+сезон`, 'iu'),
  new RegExp(`${NB}season\\s*(\\d{1,2})${NA}`, 'iu'),
  new RegExp(`${NB}(${ORDW})\\s+season`, 'iu'),
];
const EPISODE = [
  new RegExp(`${NB}(\\d{1,3})(?:\\s*-?\\s*(?:я|ая|й|ой|го|ю|ую))?\\s+(?:серия|серии|серию|эпизод)`, 'iu'),
  new RegExp(`${NB}(?:серия|эпизод)\\s*(?:№\\s*)?(\\d{1,3})${NA}`, 'iu'),
  new RegExp(`${NB}episode\\s*(\\d{1,3})${NA}`, 'iu'),
  new RegExp(`${NB}ep\\.?\\s*(\\d{1,3})${NA}`, 'iu'),
];

export interface SeriesPart { season?: number; episode?: number }

/** Сезон и серия, названные в тексте (обычно — в заголовке). Ничего не названо или назван
 *  диапазон — пусто. */
export function seriesPart(text: string): SeriesPart {
  if (RANGE.test(text)) return {};
  const sxe = SXE.exec(text);
  if (sxe) return { season: Number(sxe[1]), episode: Number(sxe[2]) };
  let season: number | undefined;
  for (const re of SEASON) { const m = re.exec(text); if (m) { season = num(m[1]); if (season) break; } }
  let episode: number | undefined;
  for (const re of EPISODE) { const m = re.exec(text); if (m) { episode = num(m[1]); if (episode) break; } }
  return { ...(season ? { season } : {}), ...(episode ? { episode } : {}) };
}
