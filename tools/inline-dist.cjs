// Делает из собранного dist одну самодостаточную страницу: скрипт, стили и
// шрифты внутри HTML. Нужна, чтобы прототип открывался двойным щелчком —
// ES-модули и внешние файлы браузер из file:// не грузит.
const fs = require('fs');
const path = require('path');

const DIST = path.resolve(process.argv[2] || path.join(__dirname, '../dist'));
const ASSETS = path.join(DIST, 'assets');
const MIME = { '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.svg': 'image/svg+xml' };

let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

// 1. шрифты и прочие файлы — в data: URI внутри CSS
function inlineAssets(css) {
  return css.replace(/url\(([^)]+)\)/g, (whole, raw) => {
    const ref = raw.trim().replace(/^['"]|['"]$/g, '');
    if (/^(data:|https?:)/.test(ref)) return whole;
    const file = path.join(ASSETS, path.basename(ref));
    if (!fs.existsSync(file)) return whole;
    const mime = MIME[path.extname(file)] || 'application/octet-stream';
    return `url(data:${mime};base64,${fs.readFileSync(file).toString('base64')})`;
  });
}

// 2. стили — в <style>
html = html.replace(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = fs.readFileSync(path.join(DIST, href.replace(/^\.\//, '')), 'utf8');
  return `<style>${inlineAssets(css)}</style>`;
});

// 3. скрипт — в <script type="module"> без src: инлайновый модуль работает из file://
html = html.replace(/<script[^>]*src="([^"]+)"[^>]*><\/script>/g, (whole, src) => {
  // внешние скрипты (telegram-web-app.js) остаются ссылкой: без сети их просто нет
  if (/^(https?:)?\/\//.test(src)) return whole;
  const js = fs.readFileSync(path.join(DIST, src.replace(/^\.\//, '')), 'utf8');
  return '<script type="module">' + js + '\n</scr' + 'ipt>';
});

// 4. предзагрузки модулей больше не нужны
html = html.replace(/<link[^>]+rel="modulepreload"[^>]*>/g, '');

const out = path.join(DIST, 'standalone.html');
fs.writeFileSync(out, html);
console.log('standalone.html:', (fs.statSync(out).size / 1024).toFixed(0), 'КБ',
  '| осталось внешних ссылок:', (html.match(/(src|href)="\.\/assets/g) || []).length);
