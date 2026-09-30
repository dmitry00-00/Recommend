import type { ResolvedWork } from './types';

/** Open Library: книги по ISBN — название, авторы, год первой публикации, страницы, обложка.
 *  Без ключа, CORS открыт; обложки — covers.openlibrary.org, тоже без ключа. */
const SEARCH = 'https://openlibrary.org/search.json';
const COVERS = 'https://covers.openlibrary.org/b';

interface Doc {
  title?: string; author_name?: string[]; first_publish_year?: number;
  number_of_pages_median?: number; cover_i?: number; isbn?: string[];
  /** «/works/OL…W» — произведение (З1) */
  key?: string;
}

export async function lookupBook(isbn: string, fetcher: typeof fetch = fetch): Promise<Partial<ResolvedWork> | undefined> {
  const qs = new URLSearchParams({ isbn, fields: 'key,title,author_name,first_publish_year,number_of_pages_median,cover_i,isbn', limit: '1' });
  const res = await fetcher(`${SEARCH}?${qs}`);
  if (!res.ok) throw new Error(`open library ${res.status}`);
  const json = (await res.json()) as { docs: Doc[] };
  const d = json.docs[0];
  if (!d) return undefined;
  return {
    title: d.title,
    creators: d.author_name,
    year: d.first_publish_year,
    pages: d.number_of_pages_median,
    coverUrl: d.cover_i ? `${COVERS}/id/${d.cover_i}-L.jpg` : `${COVERS}/isbn/${isbn}-L.jpg`,
    imageSource: 'open_library',
    externalIds: {
      isbn: d.isbn?.length ? d.isbn.slice(0, 4) : [isbn],
      // работа Open Library — ключ книги как произведения, а не издания (З1)
      ...(d.key && /^\/works\/OL\d+W$/.test(d.key) ? { openLibrary: d.key.split('/').pop() } : {}),
    },
  };
}
