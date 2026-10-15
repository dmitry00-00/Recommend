/// <reference types="vite/client" />

interface ImportMetaEnv {
  // VITE_TMDB_API_KEY здесь нарочно нет: его читают только инструменты (tools/), браузер ходит
  // в TMDb через /tmdb-api сервера. Объявить его — значит вернуть ключ в сборку (13.10).
  /** '1' — dev-сервер проксирует /kp-api (ключ у него, не у клиента); в standalone прокси нет */
  readonly VITE_KP_PROXY?: string;
  /** язык интерфейса по умолчанию: ru (как было), en или auto — по Telegram и браузеру (src/i18n) */
  readonly VITE_DEFAULT_LANG?: string;
  /** контур Global (ЗП-26): имя своего бота и регион «где смотреть» по умолчанию */
  readonly VITE_BOT_USERNAME?: string;
  readonly VITE_WATCH_REGION?: string;
}
