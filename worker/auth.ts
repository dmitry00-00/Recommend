// Вход: подпись Telegram проверяется здесь и только здесь. Токен бота — это полный доступ к
// боту, поэтому он живёт в секретах Worker и в клиент не попадает никогда.
// Проверка та же, что в `src/lib/telegramAuth.ts` (там она написана как эталон и для тестов):
// HMAC-SHA256 по отсортированным парам на ключе HMAC-SHA256("WebAppData", токен).

export interface TgUser {
  id: number;
  first_name?: string;
  username?: string;
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
}

const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Сравнение подписей за постоянное время: обычное `===` на строках выходит из цикла на
 *  первом несовпавшем символе, и по времени ответа подпись можно подбирать. */
function same(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface VerifiedInitData {
  ok: boolean;
  user?: TgUser;
  reason?: 'no_hash' | 'bad_hash' | 'stale' | 'no_user';
}

export async function verifyInitData(raw: string, botToken: string, maxAgeSeconds = 86400): Promise<VerifiedInitData> {
  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  if (!hash) return { ok: false, reason: 'no_hash' };

  const pairs: string[] = [];
  params.forEach((v, k) => { if (k !== 'hash') pairs.push(`${k}=${v}`); });
  pairs.sort();

  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const signature = hex(await hmac(secret, pairs.join('\n')));
  if (!same(signature, hash)) return { ok: false, reason: 'bad_hash' };

  const authDate = Number(params.get('auth_date'));
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) return { ok: false, reason: 'stale' };

  try {
    const user = JSON.parse(params.get('user') ?? 'null') as TgUser | null;
    if (!user || typeof user.id !== 'number') return { ok: false, reason: 'no_user' };
    return { ok: true, user };
  } catch {
    return { ok: false, reason: 'no_user' };
  }
}

/** Токен сессии: 32 случайных байта. Не JWT — состояние всё равно в базе, а подписанный
 *  токен пришлось бы отзывать отдельной таблицей, то есть тем же самым. */
export function newToken(): string {
  return hex(crypto.getRandomValues(new Uint8Array(32)).buffer);
}

export function newId(prefix: string): string {
  return `${prefix}-${hex(crypto.getRandomValues(new Uint8Array(8)).buffer)}`;
}
