// Вход через Telegram: разбор и проверка `initData` мини-приложения.
//
// Как это устроено у Telegram: WebApp отдаёт строку вида `query_id=…&user=%7B…%7D&auth_date=…&hash=…`.
// Подлинность доказывает `hash`: HMAC-SHA256 от отсортированных пар «ключ=значение» (без самого
// hash, через перевод строки) на ключе `HMAC-SHA256("WebAppData", <токен бота>)`.
//
// ВАЖНО: проверять обязан сервер. Токен бота — это полный доступ к боту, в клиент он не попадает
// никогда, поэтому `verifyInitData` здесь написана для серверной стороны (и для тестов), а
// приложение просто передаёт строку дальше. Клиентский разбор (`parseInitData`) нужен только
// чтобы показать имя и аватар до ответа сервера; доверять ему нельзя.
export interface TelegramAuthUser {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
  isPremium?: boolean;
}

export interface ParsedInitData {
  user?: TelegramAuthUser;
  authDate?: Date;
  hash?: string;
  /** сырые пары — их же проверяет сервер */
  params: URLSearchParams;
}

interface RawUser {
  id: number; first_name?: string; last_name?: string; username?: string;
  language_code?: string; photo_url?: string; is_premium?: boolean;
}

export function parseInitData(raw: string): ParsedInitData {
  const params = new URLSearchParams(raw);
  const out: ParsedInitData = { params, hash: params.get('hash') ?? undefined };
  const authDate = Number(params.get('auth_date'));
  if (authDate) out.authDate = new Date(authDate * 1000);
  const userJson = params.get('user');
  if (userJson) {
    try {
      const u = JSON.parse(userJson) as RawUser;
      if (typeof u.id === 'number') {
        out.user = {
          id: u.id,
          firstName: u.first_name ?? '',
          lastName: u.last_name,
          username: u.username,
          languageCode: u.language_code,
          photoUrl: u.photo_url,
          isPremium: u.is_premium,
        };
      }
    } catch {
      // сломанный JSON — просто нет пользователя; подпись всё равно проверяет сервер
    }
  }
  return out;
}

const hmac = async (key: ArrayBuffer | Uint8Array, data: string): Promise<ArrayBuffer> => {
  const cryptoKey = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
};
const hex = (buf: ArrayBuffer): string => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

/** Проверка подписи `initData`. Только для сервера: `botToken` в клиенте быть не должно.
 *  `maxAgeSeconds` — на сколько «свежей» должна быть подпись (у Telegram рекомендуется сутки). */
export async function verifyInitData(raw: string, botToken: string, maxAgeSeconds = 86400): Promise<boolean> {
  const { params, hash, authDate } = parseInitData(raw);
  if (!hash || !authDate) return false;
  if (maxAgeSeconds > 0 && Date.now() - authDate.getTime() > maxAgeSeconds * 1000) return false;
  const checkString = [...params.entries()]
    .filter(([k]) => k !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = await hmac(new TextEncoder().encode('WebAppData'), botToken);
  const signature = hex(await hmac(secret, checkString));
  // сравнение без раннего выхода: подпись — секрет, время сравнения не должно её выдавать
  if (signature.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < signature.length; i += 1) diff |= signature.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

/** Имя для интерфейса: как человек подписан в Telegram, без выдумок. */
export const displayName = (u: TelegramAuthUser): string =>
  [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : `id${u.id}`);
