import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { draftTexts } from './tools/draft-texts-plugin.mjs';
import { leanMocks } from './tools/lean-mocks-plugin.mjs';

/** Кусок приложения (src/boot.tsx) — сразу в index.html (18.10, аудит скорости, волна 3А): вход (src/main.tsx) грузит его
 *  динамически, после словаря языка, и без `modulepreload` браузер узнавал бы о нём только после входа — лишний круг по
 *  сети (на 3G ~0,6 с). Так оба качаются параллельно, а исполняется приложение всё равно после словаря. */
const bootPreload = (): Plugin => ({
  name: 'boot-preload',
  apply: 'build',
  transformIndexHtml: {
    order: 'post',
    handler(html, ctx) {
      // facadeModuleId у динамического куска бывает пуст — ищем по модулям внутри
      const boot = Object.values(ctx.bundle ?? {}).find((c) => c.type === 'chunk' && c.moduleIds.some((id) => id.endsWith('/src/boot.tsx')));
      if (!boot || boot.type !== 'chunk') return html;
      const files = [...new Set([boot.fileName, ...boot.imports])].filter((f) => f !== ctx.chunk?.fileName);
      return { html, tags: files.map((f) => ({ tag: 'link', attrs: { rel: 'modulepreload', crossorigin: true, href: `./${f}` }, injectTo: 'head' as const })) };
    },
  },
});

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
    // тексты «что делает» черновиков — отдельным ленивым куском (18.10, бюджет первой загрузки): tools/draft-texts-plugin.mjs
    // имена людей в оригинале — ленивым куском, список запасных карточек справочника — для сверки с сервером (18.10, волна 3А):
    // tools/lean-mocks-plugin.mjs
    plugins: [draftTexts(), leanMocks(), react(), tailwindcss(), bootPreload()],
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
