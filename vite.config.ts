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
  return {
    // './' — чтобы собранный dist открывался и двойным щелчком, без сервера
    base: './',
    plugins: [react(), tailwindcss()],
    // '@' указывает на /src от корня проекта: так не нужен @types/node в typecheck
    resolve: { alias: { '@': '/src' } },
    // 5173 часто занят другим dev-сервером. strictPort: false — если и 5180 занят,
    // Vite молча возьмёт следующий свободный и напишет адрес в консоли.
    server: { port: 5180, strictPort: false, open: true, proxy: kpProxy },
    preview: { port: 5181, strictPort: false, proxy: kpProxy },
    // Справочники грузятся кусками по требованию (src/api/index.ts, трек А). Страница из
    // одного файла (build:standalone) куски из file:// не подтянет — там всё в один скрипт.
    build: mode === 'standalone' ? { rollupOptions: { output: { inlineDynamicImports: true } } } : {},
  };
});
