// Поиск по году (17.10): из запроса «дюна 2021» достаём название и год — src/api/index.ts searchWorks.

/** Год в запросе (17.10): «дюна 2021», «дюна (2021)», «дюна, 2021 г.», «2021 дюна» → название и год. Года нет или
 *  кроме него ничего нет («1917») — `undefined`: тогда число ищется как часть названия, как раньше. */
export function splitYear(q: string): { title: string; year: number } | undefined {
  if (q.length > 200) return undefined; // строка поиска короткая; длинную не разбираем — ленивый хвост регэкспа
  const tail = /^(.*?)[\s,]*\(?((?:18|19|20)\d{2})\)?\s*(?:г\.?|год[а]?)?$/u.exec(q);
  const head = tail ? undefined : /^\(?((?:18|19|20)\d{2})\)?[\s,]+(.+)$/u.exec(q);
  const title = (tail ? tail[1] : head?.[2])?.replace(/[\s,:–—-]+$/u, '').trim();
  const year = Number(tail ? tail[2] : head?.[1]);
  if (!title || !year || year > new Date().getFullYear() + 5) return undefined;
  return { title, year };
}
