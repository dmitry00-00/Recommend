import type { WorkCard } from '@/types/tmdf';

/** «Где читать» (З5) — честно. Открытых данных о наличии книги у книжных сервисов нет (у ЛитРес и
 *  Яндекс Книг нет открытого API), поэтому не делаем вид, что знаем: одна ссылка — туда, где книга
 *  точно описана (Open Library — страница произведения), остальные — поиск, и так и подписаны.
 *  Поиск идёт через Яндекс с ограничением по сайту: адреса поиска у сервисов меняются, а этот нет. */
export interface ReadPlace { title: string; url: string; kind: 'page' | 'search' }

const yandexSite = (site: string, q: string) => `https://yandex.ru/search/?text=${encodeURIComponent(`${q} site:${site}`)}`;

export function readPlaces(work: Pick<WorkCard, 'title' | 'originalTitle' | 'creators' | 'externalIds'>, lang: 'ru' | 'en' = 'ru'): ReadPlace[] {
  const q = [work.title, work.creators[0]].filter(Boolean).join(' ');
  const ol = work.externalIds?.openLibrary;
  const page = ol ? [{ title: 'Open Library', url: `https://openlibrary.org/works/${ol}`, kind: 'page' as const }] : [];
  // англоязычным (11.10) — не российские магазины, а Google Книги и WorldCat (библиотеки рядом); поиск — по названию
  // оригинала, если оно есть: английский интерфейс показывает его же
  if (lang === 'en') {
    const en = [work.originalTitle ?? work.title, work.creators[0]].filter(Boolean).join(' ');
    return [
      ...page,
      { title: 'Google Books', url: `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(en)}`, kind: 'search' },
      { title: 'WorldCat', url: `https://search.worldcat.org/search?q=${encodeURIComponent(en)}`, kind: 'search' },
    ];
  }
  return [
    ...page,
    { title: 'ЛитРес', url: yandexSite('litres.ru', q), kind: 'search' },
    { title: 'Яндекс Книги', url: yandexSite('books.yandex.ru', q), kind: 'search' },
    { title: 'НЭБ', url: yandexSite('rusneb.ru', q), kind: 'search' },
  ];
}

/** Сколько читать: около 1,2 минуты на страницу — средний темп художественной прозы. */
export const readingHours = (pages?: number): number | undefined => (pages ? Math.max(1, Math.round((pages * 1.2) / 60)) : undefined);
