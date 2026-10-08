/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ключ TMDb v3 — только для разработки; в мини-приложении картинки отдаёт сервер */
  readonly VITE_TMDB_API_KEY?: string;
  /** '1' — dev-сервер проксирует /kp-api (ключ у него, не у клиента); в standalone прокси нет */
  readonly VITE_KP_PROXY?: string;
  /** язык интерфейса по умолчанию: ru (как было), en или auto — по Telegram и браузеру (src/i18n) */
  readonly VITE_DEFAULT_LANG?: string;
}
