// Минимальные типы платформы: берём ровно то, чем пользуемся. Пакет типов Cloudflare тянет
// за собой полный рантайм воркеров и в проекте, где основной tsconfig — про браузер, только
// мешает. Понадобится больше — допишем здесь.

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
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
}

export interface Env {
  DB: D1Database;
  /** справочники (каталог, разборы, замеры) — общие данные, не пользовательские */
  REFERENCE?: R2Bucket;
  /** токен бота: только в секретах, только здесь */
  BOT_TOKEN?: string;
  /** «1» разрешает вход без Telegram — для разработки и проверок */
  ALLOW_DEMO?: string;
  /** через запятую: кому отвечать на кросс-доменные запросы; пусто — только своему домену */
  ALLOWED_ORIGINS?: string;
  /** токен сборщика индексов (tools/publish-reference.mts): им, и только им, пишутся
   *  справочники. Не сессия участника — у сборщика нет Telegram */
  ADMIN_TOKEN?: string;
  /** ник владельца в Telegram (без @, регистр не важен): его профиль при первом входе
   *  получает историю из `OWNER_SEED` */
  OWNER_USERNAME?: string;
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
  watched: { workId: string; work: unknown; tmdb?: number; imdb?: string }[];
  ratings?: { workId: string; rating: number; raw?: number; work?: unknown }[];
}
