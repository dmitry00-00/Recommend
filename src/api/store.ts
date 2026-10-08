// Хранилище пользовательского состояния: два режима с одним интерфейсом.
//
//   · без `VITE_API_URL` — память вкладки, как было: моки и ничего наружу;
//   · с `VITE_API_URL` — сервер (worker/index.ts): отметки, прогнозы, чек-ины и отклики
//     переживают перезагрузку и переезд на другое устройство.
//
// Правило слоя: сервер хранит факты участника, а не собирает ленту. Подбор по-прежнему
// считается на клиенте, каталог и разборы — общие данные и приходят отдельно. Поэтому здесь
// нет ни одного запроса «дай рекомендации» — только «запиши, что человек сделал».
import type { BookProgress, ID, PerceivedDifficulty, SeriesProgress, UserSettings, WorkCard } from '@/types/tmdf';
import { webApp } from '@/lib/telegram';

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
  profile?: { username?: string; firstName?: string; telegram: boolean; owner: boolean; role?: 'admin' | 'tester' | 'user' };
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
async function openSession(): Promise<string | undefined> {
  const initData = webApp()?.initData;
  const res = await fetch(`${API}/api/session`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(initData ? { initData } : { demo: true }),
  });
  if (!res.ok) return undefined;
  const body = await res.json() as { token?: string };
  writeToken(body.token);
  return body.token;
}

/** Запрос с токеном. Протухшую сессию не показываем пользователю ошибкой: заходим заново и
 *  повторяем — для него это просто продолжение работы. */
async function call(path: string, init: RequestInit = {}, retry = true): Promise<Response | undefined> {
  if (API === undefined) return undefined;
  const token = readToken() ?? await openSession();
  if (!token) return undefined;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  if (res.status === 401 && retry) {
    writeToken(undefined);
    return call(path, init, false);
  }
  return res;
}

const send = async (path: string, method: string, body: unknown): Promise<void> => {
  if (API === undefined) return;
  const res = await call(path, { method, body: JSON.stringify(body) });
  if (!res || !res.ok) throw new Error(`${method} ${path}: ${res?.status ?? 'нет ответа'}`);
};

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
  impressions: (slateId: string, energy: string, items: { recId: string; workId: ID; slot?: string; rank: number }[]) =>
    send('/api/impressions', 'POST', { slateId, energy, items }),
  /** открыли материал (ТВ-3г): ролик или пост, рубрика, откуда */
  open: (event: Record<string, unknown>) => send('/api/open', 'POST', event),
  /** удалить аккаунт и все данные участника (ЗП-5): после — забыть токен и всё локальное */
  deleteAccount: () => send('/api/account', 'DELETE', {}),
  /** открыли карточку произведения или нажали «Смотреть» (ЗП-3): воронка и удержание */
  event: (event: { kind: 'card' | 'watch'; workId?: ID; place?: string; detail?: string }) => send('/api/event', 'POST', event),
  /** сериал (Е3): «где я сейчас» — сезон и серия */
  progress: (entryId: string, workId: ID, where: { series: SeriesProgress } | { book: BookProgress }) =>
    send(`/api/journal/${encodeURIComponent(entryId)}/progress`, 'POST', { workId, ...where }),
  checkIn: (entryId: string, workId: ID, payload: Record<string, unknown>) =>
    send(`/api/journal/${encodeURIComponent(entryId)}/checkin`, 'POST', { workId, ...payload }),
  feedback: (recId: string, workId: ID | undefined, action: string, reason?: string, eagerness?: number) =>
    send('/api/feedback', 'POST', { recId, workId, action, reason, eagerness }),
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
};
