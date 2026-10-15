import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  // Ключ неофициального API Кинопоиска живёт только здесь: браузеру тот API закрыт (CORS),
  // а ключ в сборке — утечка. Dev-сервер и preview проксируют /kp-api → сервис и сами
  // подставляют заголовок — ровно так же это сделает бэкенд мини-приложения.
  const env = loadEnv(mode, '.', '');
  const kpProxy = env.KP_API_KEY
    ? { '/kp-api': { target: 'https://kinopoiskapiunofficial.tech', changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/kp-api/, '/api'), headers: { 'X-API-KEY': env.KP_API_KEY } } }
    : undefined;
  // TMDb — так же, как на сервере (server/index.js): браузер ходит в /tmdb-api, ключ подставляет
  // dev-сервер. Имя VITE_ осталось от прежних времён — его читают инструменты; в сборку ключ не идёт
  const tmdbKey = env.TMDB_API_KEY || env.VITE_TMDB_API_KEY;
  const tmdbBearer = tmdbKey?.includes('.');
  const tmdbProxy = tmdbKey
    ? { '/tmdb-api': { target: 'https://api.themoviedb.org', changeOrigin: true,
        rewrite: (p: string) => p.replace(/^\/tmdb-api/, '/3') + (tmdbBearer ? '' : `${p.includes('?') ? '&' : '?'}api_key=${tmdbKey}`),
        ...(tmdbBearer ? { headers: { Authorization: `Bearer ${tmdbKey}` } } : {}) } }
    : undefined;
  const proxy = kpProxy || tmdbProxy ? { ...kpProxy, ...tmdbProxy } : undefined;
  return {
    // './' — чтобы собранный dist открывался и двойным щелчком, без сервера
    base: './',
    plugins: [react(), tailwindcss()],
    // '@' указывает на /src от корня проекта: так не нужен @types/node в typecheck
    resolve: { alias: { '@': '/src' } },
    // 5173 часто занят другим dev-сервером. strictPort: false — если и 5180 занят,
    // Vite молча возьмёт следующий свободный и напишет адрес в консоли.
    server: { port: 5180, strictPort: false, open: true, proxy },
    preview: { port: 5181, strictPort: false, proxy },
    // Справочники грузятся кусками по требованию (src/api/index.ts, трек А). Страница из
    // одного файла (build:standalone) куски из file:// не подтянет — там всё в один скрипт.
    // Манифест — для бюджета первой загрузки (tools/load-budget.mjs, РР-0): по нему видно, какие куски тянет старт.
    build: mode === 'standalone' ? { rollupOptions: { output: { inlineDynamicImports: true } } } : { manifest: true },
  };
});
