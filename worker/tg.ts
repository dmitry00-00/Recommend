// Bot API Telegram — один помощник на все вызовы (17.10, аудит отказов, п. 6). Раньше каждый модуль звал fetch сам, без
// предела по времени: зависший api.telegram.org держал вебхук и рассылку до 300 с (таймаут сокета Node), а ответ не-JSON
// (502 от прокси, страница ошибки) ронял разбор. Теперь — 8 с на вызов, и ответ всегда объект: { ok, error_code, … }.
// error_code 0 — до Telegram не достучались (сеть, предел времени): дошло ли сообщение — неизвестно.
import type { Env } from './env';

export const TG_TIMEOUT = 8000;

export interface TgReply<T = unknown> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  /** при 429 Telegram говорит, сколько секунд ждать */
  parameters?: { retry_after?: number; migrate_to_chat_id?: number };
}

export async function tg<T = unknown>(env: Pick<Env, 'BOT_TOKEN'>, method: string, body?: unknown, timeout = TG_TIMEOUT): Promise<TgReply<T>> {
  if (!env.BOT_TOKEN) return { ok: false, error_code: 0, description: 'no_bot_token' };
  let text: string;
  let status: number;
  try {
    // сигнал действует и на чтение тела: оборвётся и ответ, который начал приходить и встал
    const r = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(timeout),
    });
    status = r.status;
    text = await r.text();
  } catch (err) {
    const timedOut = (err as Error)?.name === 'TimeoutError' || (err as Error)?.name === 'AbortError';
    console.error(`tg ${method}:`, timedOut ? `нет ответа за ${timeout / 1000} с` : (err as Error)?.message ?? err);
    return { ok: false, error_code: 0, description: timedOut ? 'timeout' : 'network' };
  }
  try {
    const j = JSON.parse(text) as TgReply<T>;
    if (j && typeof j === 'object' && typeof j.ok === 'boolean') return j;
  } catch { /* не JSON — ниже */ }
  console.error(`tg ${method}: ответ не JSON (${status}): ${text.slice(0, 120)}`);
  return { ok: false, error_code: status, description: 'not_json' };
}
