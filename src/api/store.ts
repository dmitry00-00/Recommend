// Хранилище пользовательского состояния: два режима с одним интерфейсом.
//
//   · без `VITE_API_URL` — память вкладки, как было: моки и ничего наружу;
//   · с `VITE_API_URL` — сервер (worker/index.ts): отметки, прогнозы, чек-ины и отклики
//     переживают перезагрузку и переезд на другое устройство.
//
// Правило слоя: сервер хранит факты участника, а не собирает ленту. Подбор по-прежнему
// считается на клиенте, каталог и разборы — общие данные и приходят отдельно. Поэтому здесь
// нет ни одного запроса «дай рекомендации» — только «запиши, что человек сделал».
import type { AfterHook, AfterPace, AfterwordPatch, BookProgress, ID, PerceivedDifficulty, SeriesProgress, UserSettings, WorkCard } from '@/types/tmdf';
import { webApp } from '@/lib/telegram';
import type { ComplexitySpan } from '@/lib/model/deriveState';

/** Уровень сложности и признаки произведения для метрик сдвига и разнообразия (МА-1/МА-2, worker/metrics.ts):
 *  разметки у сервера нет, поэтому уровень едет с событием — тот, по которому человек выбирал. */
export interface WorkMeta { level?: number; traits?: { op?: Record<string, number>; rg?: string[] } }
export function workMeta(work?: WorkCard): WorkMeta {
  if (!work) return {};
  const op = Object.fromEntries((work.primaryOperations ?? []).map((o) => [o.op, o.intensity]));
  const rg = work.registers ?? [];
  return {
    ...(work.complexityLevel > 0 ? { level: work.complexityLevel } : {}),
    ...(Object.keys(op).length || rg.length ? { traits: { ...(Object.keys(op).length ? { op } : {}), ...(rg.length ? { rg } : {}) } } : {}),
  };
}

// `VITE_API_URL=/` — API на том же адресе, что и страница (сборка для bothost); пустая строка
// после обрезки слеша — это тоже «сервер есть», поэтому сравниваем с undefined, а не на истинность
const RAW_API = import.meta.env.VITE_API_URL as string | undefined;
const API = RAW_API ? RAW_API.replace(/\/+$/, '') : undefined;
const TOKEN_KEY = 'tm.token';

export const onServer = API !== undefined;
/** Адрес API для запросов без токена (справочники): '' — тот же адрес, что у страницы. */
export const apiBase = API ?? '';

export interface StoredState {
  settings: Partial<UserSettings>;
  watched: { workId: ID; watched: boolean; work?: WorkCard }[];
  predictions: { entry_id: string; work_id: ID; expected?: PerceivedDifficulty; model?: string; model_p?: string | null; at: string }[];
  verdicts: { url: string; verdict: 'about_this' | 'other_work' | 'unsure' }[];
  journal?: { entry_id: string; work_id: ID; work?: WorkCard; status: string; progress?: number | null; started_at?: string | null; finished_at?: string | null; eagerness?: number | null; inferred?: number | null; series?: (SeriesProgress & { kind?: undefined }) | (BookProgress & { kind: 'book' }) | null }[];
  ratings?: { workId: ID; rating: 1 | 2 | 3 | 4 | 5; raw?: number; work?: WorkCard; at: string }[];
  /** последний отказ на фильм ленты (10.10): по нему фильм не возвращается в ленту на срок по причине */
  dismissals?: { workId: ID; reason?: string; at: string }[];
  /** послесловие к просмотренному (17.10): «стоило ли», темп, что держало; null — не ответил */
  afterwords?: { workId: ID; worth?: 1 | 2 | 3 | 4 | 5 | null; pace?: AfterPace | null; hook?: AfterHook | null; at?: string }[];
  profile?: { username?: string; firstName?: string; telegram: boolean; owner: boolean; role?: 'admin' | 'tester' | 'user'; /** дни захода (ДФ-3) */ visitDays?: number };
}

/** Токен сессии хранится отдельно для каждого аккаунта Telegram. localStorage у WebView один
 *  на приложение Telegram, а не на аккаунт: с общим ключом второй аккаунт на том же телефоне
 *  входил под первым (23.09). Вне Telegram — ключ гостя этого браузера. */
const tokenKey = (): string => {
  const id = webApp()?.initDataUnsafe?.user?.id;
  return id != null ? `${TOKEN_KEY}.tg${id}` : `${TOKEN_KEY}.guest`;
};
const readToken = (): string | undefined => {
  try {
    // прежний общий ключ больше не читаем: по нему нельзя понять, чей это вход
    localStorage.removeItem(TOKEN_KEY);
    return localStorage.getItem(tokenKey()) ?? undefined;
  } catch { return undefined; }
};
const writeToken = (token: string | undefined) => {
  try { if (token) localStorage.setItem(tokenKey(), token); else localStorage.removeItem(tokenKey()); } catch { /* приватное окно */ }
};

/** Вход: подписью Telegram, если приложение открыто в мессенджере, иначе — демо-участником.
 *  Демо разрешает сервер, а не клиент: в боевом окружении `ALLOW_DEMO` пуст, и такой вход
 *  просто не работает. */
async function openSession(signal?: AbortSignal): Promise<string | undefined> {
  const initData = webApp()?.initData;
  const res = await fetch(`${API}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(initData ? { initData } : { demo: true }),
    signal,
  });
  if (!res.ok) return undefined;
  const body = await res.json() as { token?: string };
  writeToken(body.token);
  return body.token;
}

// Срок ответа и повтор (17.10, аудит отказоустойчивости, п. 6): без срока зависший сервер или оборванное мобильное
// соединение держали запрос минутами — экран вечно грузился вместо «нет связи». Срок — один на весь вызов (вход,
// запрос, повтор), чтобы экран ошибки появлялся через ~15 с, а не через сумму попыток. Таймер свой, а не
// AbortSignal.timeout: тот не отменить, а срок нужен только до заголовков — тело большого состояния на медленной
// сети читается дольше 15 с, и обрывать его нельзя (заодно работает и в старых WebView, где timeout нет).
const TIMEOUT_MS = 15_000;
/** пауза перед повтором чтения: сеть успевает переключиться, сервер — подняться после перезапуска */
const RETRY_PAUSE_MS = 800;
/** ответы прокси и балансировщика, после которых чтение стоит повторить */
const RETRY_STATUS = new Set([502, 503, 504]);

function deadline(ms: number): { signal: AbortSignal; done: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException(`нет ответа за ${ms / 1000} с`, 'TimeoutError')), ms);
  return { signal: ctrl.signal, done: () => clearTimeout(timer) };
}
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

/** fetch с одним повтором для чтения (GET) при сетевой ошибке и 502/503/504. Записи не повторяем: сервер мог
 *  принять первую попытку, и повтор поставил бы оценку или отметку дважды. Вышел срок — без повтора. */
async function request(url: string, init: RequestInit & { signal: AbortSignal }): Promise<Response> {
  if ((init.method ?? 'GET').toUpperCase() !== 'GET') return fetch(url, init);
  let first: Response | undefined;
  try {
    first = await fetch(url, init);
    if (!RETRY_STATUS.has(first.status)) return first;
  } catch (e) {
    if (init.signal.aborted) throw e;
  }
  await pause(RETRY_PAUSE_MS);
  if (init.signal.aborted) {
    if (first) return first;
    throw init.signal.reason ?? new DOMException('нет ответа', 'TimeoutError');
  }
  try {
    return await fetch(url, init);
  } catch (e) {
    // повтор не дошёл — отдаём первый ответ (503 и т. п.): его экраны уже умеют показать
    if (first) return first;
    throw e;
  }
}

/** Запрос с токеном. Протухшую сессию не показываем пользователю ошибкой: заходим заново и
 *  повторяем — для него это просто продолжение работы. Нет ответа за срок — исключение TimeoutError:
 *  оно идёт теми же путями, что и обрыв сети («нет связи», откат отметки). */
async function call(path: string, init: RequestInit = {}): Promise<Response | undefined> {
  if (API === undefined) return undefined;
  const limit = deadline(TIMEOUT_MS);
  try {
    return await authed(path, init, limit.signal, true);
  } finally {
    // ответ пришёл (или не придёт) — тело читает вызывающий, уже без срока
    limit.done();
  }
}
async function authed(path: string, init: RequestInit, signal: AbortSignal, retry: boolean): Promise<Response | undefined> {
  const token = readToken() ?? await openSession(signal);
  if (!token) return undefined;
  const res = await request(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
    signal,
  });
  if (res.status === 401 && retry) {
    writeToken(undefined);
    return authed(path, init, signal, false);
  }
  return res;
}

const send = async (path: string, method: string, body: unknown): Promise<void> => {
  if (API === undefined) return;
  const res = await call(path, { method, body: JSON.stringify(body) });
  if (!res || !res.ok) throw new Error(`${method} ${path}: ${res?.status ?? 'нет ответа'}`);
};

/** Импорт истории (ДФ-11): записи и оценки одной пачкой с меткой; без сервера — undefined. */
export interface ImportWrite { added: number; rated: number; kept: number; keptRatings: number }
export async function postImport(body: { importId: string; entries: unknown[]; ratings: unknown[] }): Promise<ImportWrite | undefined> {
  if (API === undefined) return undefined;
  const res = await call('/api/import', { method: 'POST', body: JSON.stringify(body) });
  if (!res || !res.ok) throw new Error(`POST /api/import: ${res?.status ?? 'нет ответа'}`);
  return await res.json() as ImportWrite;
}
export async function deleteImport(importId: string): Promise<{ removed: number; unrated: number } | undefined> {
  if (API === undefined) return undefined;
  const res = await call(`/api/import/${encodeURIComponent(importId)}`, { method: 'DELETE' });
  if (!res || !res.ok) throw new Error(`DELETE /api/import: ${res?.status ?? 'нет ответа'}`);
  return await res.json() as { removed: number; unrated: number };
}

/** Выгрузка дневника (ДФ-14): файл на час, ответ — путь для скачивания по ссылке. */
export async function postExport(name: string, text: string): Promise<string | undefined> {
  if (API === undefined) return undefined;
  const res = await call('/api/export', { method: 'POST', body: JSON.stringify({ name, text }) });
  if (!res || !res.ok) throw new Error(`POST /api/export: ${res?.status ?? 'нет ответа'}`);
  return (await res.json() as { path: string }).path;
}

/** Состояние участника при запуске. Без сервера (разработка) — undefined: работаем на моках.
 *  С сервером, который не ответил, — 'unreachable': это не «новый участник», и показывать
 *  холодный старт вместо его истории нельзя (трек А, «честный экран сети»). */
export async function loadState(): Promise<StoredState | 'unreachable' | undefined> {
  if (API === undefined) return undefined;
  try {
    const res = await call('/api/state');
    if (!res || !res.ok) return 'unreachable';
    return await res.json() as StoredState;
  } catch {
    return 'unreachable';
  }
}

/** Отчёт петли прогноза (трек Б): владельцу — по всем, остальным — по себе. */
export async function fetchLoopReport(scope: 'all' | 'me' = 'all'): Promise<unknown | undefined> {
  if (API === undefined) return undefined;
  const res = await call(`/api/report/loop?scope=${scope}`);
  if (!res || !res.ok) throw new Error(`loop report: ${res?.status ?? 'нет ответа'}`);
  return res.json();
}

/** Разметка владельца с телефона (06.10): очередь «Проверки» и «Рубрик» пульта и решения по ней.
 *  Сервер отдаёт их только владельцу; без сервера (разработка) — undefined. */
/** Тестеры (ТВ-3в): список и правка — только админу. */
export async function fetchTesters(change?: { username: string; on: boolean }): Promise<{ testers: { username: string; at: string }[] } | undefined> {
  if (API === undefined) return undefined;
  const res = await call('/api/owner/testers', change ? { method: 'PUT', body: JSON.stringify(change) } : {});
  if (!res || !res.ok) throw new Error(`testers: ${res?.status ?? 'нет ответа'}`);
  return res.json();
}

/** Подписки на разборы (06.10): список и изменение — одним ответом, как у тестеров. */
export interface FollowRow { kind: 'work' | 'character'; ref: string; title: string; at: string }
export async function fetchFollows(change?: { kind: 'work' | 'character'; ref: string; keys?: string[]; title: string; on: boolean }): Promise<{ follows: FollowRow[]; telegram: boolean } | undefined> {
  if (API === undefined) return undefined;
  const res = await call(change ? '/api/follow' : '/api/follows', change ? { method: 'PUT', body: JSON.stringify(change) } : {});
  if (res && res.status === 400 && change) {
    const err = ((await res.json().catch(() => ({}))) as { error?: string }).error;
    throw new Error(err === 'too_many' ? 'too_many' : 'bad_follow');
  }
  if (!res || !res.ok) throw new Error(`follows: ${res?.status ?? 'нет ответа'}`);
  return res.json();
}

/** «Поделиться» карточкой-сообщением (06.10): сервер готовит сообщение, id — для `WebApp.shareMessage`. */
export async function prepareShareMessage(card: Record<string, unknown>): Promise<string | undefined> {
  if (API === undefined) return undefined;
  const res = await call('/api/share', { method: 'POST', body: JSON.stringify(card) });
  if (!res || !res.ok) return undefined;
  return ((await res.json()) as { id?: string }).id;
}

/** выбор компанией (ЗП-11): запрос к /api/together* — статус и тело; без сервера — undefined */
export async function togetherCall<T>(path: string, init: RequestInit = {}): Promise<{ status: number; body?: T } | undefined> {
  if (API === undefined) return undefined;
  const res = await call(path, init);
  if (!res) return undefined;
  return { status: res.status, body: res.ok ? await res.json() as T : undefined };
}

export async function fetchOwnerDesk(): Promise<{ queue: unknown; decisions: unknown } | undefined> {
  if (API === undefined) return undefined;
  const [q, d] = await Promise.all([call('/api/owner/queue'), call('/api/owner/decisions')]);
  if (!q || !d || !q.ok || !d.ok) throw new Error(`owner desk: ${q?.status ?? '—'}/${d?.status ?? '—'}`);
  return { queue: await q.json(), decisions: await d.json() };
}

export const store = {
  onServer,
  watched: (workId: ID, watched: boolean, work?: WorkCard) =>
    send(`/api/watched/${encodeURIComponent(workId)}`, 'PUT', { watched, work }),
  settings: (patch: Partial<UserSettings>) => send('/api/settings', 'PUT', patch),
  start: (workId: ID, work?: WorkCard, expected?: string, model?: string, entryId?: string, modelOdds?: Record<string, number>, inferred?: boolean) =>
    send('/api/journal/start', 'POST', { workId, work, expected, model, modelOdds, entryId, inferred }),
  /** «ещё не смотрел» (или вопрос без ответа, или отмена) — начатое обратно в планы */
  unstart: (entryId: string, workId: ID, reason: 'not_watched' | 'expired' | 'undo') =>
    send(`/api/journal/${encodeURIComponent(entryId)}/unstart`, 'POST', { workId, reason }),
  /** «в планы» — запись дневника planned; отмена — удалить её (только planned) */
  plan: (entryId: string, workId: ID, work?: WorkCard, eagerness?: number) =>
    send('/api/journal/plan', 'POST', { entryId, workId, work, eagerness }),
  unplan: (entryId: string) => send(`/api/journal/${encodeURIComponent(entryId)}/plan`, 'DELETE', {}),
  /** показы ленты; у каждого — уровень и признаки произведения, `state` — снимок карты (МА-1/МА-2) */
  impressions: (slateId: string, energy: string, items: ({ recId: string; workId: ID; slot?: string; rank: number } & WorkMeta)[], state?: ComplexitySpan) =>
    send('/api/impressions', 'POST', { slateId, energy, items, ...(state ? { state } : {}) }),
  /** открыли материал (ТВ-3г): ролик или пост, рубрика, откуда, чей (МА-3); ответ — id записи для `dwell` */
  open: async (event: Record<string, unknown>): Promise<string | undefined> => {
    if (API === undefined) return undefined;
    const res = await call('/api/open', { method: 'POST', body: JSON.stringify(event) });
    if (!res || !res.ok) throw new Error(`POST /api/open: ${res?.status ?? 'нет ответа'}`);
    return (await res.json() as { id?: string }).id;
  },
  /** вернулись из открытого материала (МА-3): секунды снаружи */
  dwell: (openId: string, seconds: number) => send(`/api/open/${encodeURIComponent(openId)}/dwell`, 'POST', { seconds }),
  /** удалить аккаунт и все данные участника (ЗП-5): после — забыть токен и всё локальное */
  deleteAccount: () => send('/api/account', 'DELETE', {}),
  /** открыли карточку произведения или нажали «Смотреть» (ЗП-3): воронка и удержание */
  event: (event: { kind: 'card' | 'watch' | 'trailer' | 'share_sent' | 'mood_query' | 'survey_answered' | 'onboard'; workId?: ID; place?: string; detail?: string }) => send('/api/event', 'POST', event),
  /** сериал (Е3): «где я сейчас» — сезон и серия */
  progress: (entryId: string, workId: ID, where: { series: SeriesProgress } | { book: BookProgress }) =>
    send(`/api/journal/${encodeURIComponent(entryId)}/progress`, 'POST', { workId, ...where }),
  checkIn: (entryId: string, workId: ID, payload: Record<string, unknown>) =>
    send(`/api/journal/${encodeURIComponent(entryId)}/checkin`, 'POST', { workId, ...payload }),
  feedback: (recId: string, workId: ID | undefined, action: string, reason?: string, eagerness?: number, meta?: WorkMeta) =>
    send('/api/feedback', 'POST', { recId, workId, action, reason, eagerness, ...meta }),
  verdict: (url: string, workId: ID | undefined, verdict: string) =>
    send('/api/verdict', 'PUT', { url, workId, verdict }),
  /** заявка: «нет такого фильма» или «добавьте этого автора» */
  suggest: (kind: 'work' | 'voice', title: string, note?: string, context?: string) =>
    send('/api/suggestion', 'POST', { kind, title, note, context }),
  /** неточность в карточке произведения (02.10) */
  workIssue: (workId: ID, title: string, fields: string[], note?: string, context?: string) =>
    send('/api/work-issue', 'POST', { workId, title, fields, note, context }),
  /** решение владельца: привязка ролика (kind 'check') или рубрика (kind 'lens'); clear — снять */
  ownerDecision: (decision: { kind: 'check' | 'lens'; id: string } & Record<string, unknown>) =>
    send('/api/owner/decision', 'PUT', decision),
  rating: (workId: ID, rating: number | null, work?: WorkCard) =>
    send(`/api/rating/${encodeURIComponent(workId)}`, 'PUT', { rating, work }),
  /** послесловие (17.10): значение — записать, null — снять, нет поля — не трогать. Без сервера — ничего наружу,
   *  как у оценок: послесловие живёт в памяти вкладки */
  afterword: (workId: ID, patch: AfterwordPatch) =>
    send(`/api/afterword/${encodeURIComponent(workId)}`, 'PUT', patch),
};
