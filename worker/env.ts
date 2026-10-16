// Минимальные типы платформы: берём ровно то, чем пользуемся. Пакет типов Cloudflare тянет
// за собой полный рантайм воркеров и в проекте, где основной tsconfig — про браузер, только
// мешает. Понадобится больше — допишем здесь.

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  /** у run(): сколько строк изменено (D1 и оба переходника server/) */
  meta?: { changes?: number };
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<unknown>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  size: number;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ArrayBuffer | ReadableStream | string): Promise<unknown>;
  delete?(key: string): Promise<unknown>;
}

export interface Env {
  DB: D1Database;
  /** справочники (каталог, разборы, замеры) — общие данные, не пользовательские */
  REFERENCE?: R2Bucket;
  /** токен бота: только в секретах, только здесь */
  BOT_TOKEN?: string;
  /** имя бота без @ для ссылок `t.me/<бот>?startapp=…`; пусто — recomend_media_bot. У контура Global свой бот (ЗП-26) */
  BOT_USERNAME?: string;
  /** «1» разрешает вход без Telegram — для разработки и проверок */
  ALLOW_DEMO?: string;
  /** через запятую: кому отвечать на кросс-доменные запросы; пусто — только своему домену */
  ALLOWED_ORIGINS?: string;
  /** адрес сайта для публичных страниц и карты сайта (ЗП-15), `https://…` без слеша; пусто — по запросу */
  PUBLIC_ORIGIN?: string;
  /** `1` — включить публичные страницы для поисковиков (ЗП-15); иначе выключены (решение владельца 07.10) */
  PUBLIC_PAGES?: string;
  /** токен сборщика индексов (tools/publish-reference.mts): им, и только им, пишутся
   *  справочники. Не сессия участника — у сборщика нет Telegram */
  ADMIN_TOKEN?: string;
  /** ник владельца в Telegram (без @, регистр не важен): его профиль при первом входе
   *  получает историю из `OWNER_SEED` */
  OWNER_USERNAME?: string;
  /** номер аккаунта Telegram владельца (ХБ, 16.10): задан — роль админа только по нему, ник не в счёт */
  OWNER_TG_ID?: string;
  /** история владельца, которую до сервера знал только фронтенд: дневник, оценки, просмотренное */
  OWNER_SEED?: OwnerSeed;
}

export interface OwnerSeed {
  journal: { entryId: string; workId: string; work: unknown; status: string; startedAt?: string; finishedAt?: string }[];
  ratings: { workId: string; rating: number; raw?: number }[];
  watched: { workId: string; work: unknown; tmdb?: number; imdb?: string }[];
}

/** Список просмотренного, присланный участником владельцу (с согласия участника) и
 *  выложенный на сервер tools/publish-seed.mts. Лежит в том же хранилище, что справочники,
 *  но наружу не раздаётся: читает его только воркер, при входе этого участника. */
export interface UserSeed {
  /** меняется с каждой новой версией списка: по ней понятно, что уже разложено */
  version: string;
  /** from — откуда запись: 'kinopoisk' — tools/import-kinopoisk.mts; без него — присланный
   *  список (tools/resolve-seed.mts). Воркеру не нужен, нужен сборщикам, чтобы не затирать друг друга */
  watched: { workId: string; work: unknown; tmdb?: number; imdb?: string; from?: 'kinopoisk' }[];
  ratings?: { workId: string; rating: number; raw?: number; work?: unknown }[];
}

/** Имя бота для ссылок и команд: задаётся из окружения на входе в воркер (`useBot`). Объект, а не строка: модули читают
 *  его в момент запроса, а сборка для Node (CommonJS) не ломает живую привязку. */
export const bot = { name: 'recomend_media_bot' };
export function useBot(env: Pick<Env, 'BOT_USERNAME'>): void {
  bot.name = env.BOT_USERNAME?.replace(/^@/, '') || 'recomend_media_bot';
}
