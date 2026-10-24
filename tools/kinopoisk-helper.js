// Помощник-закладка для Кинопоиска (22.10): то же «Сохранить как» на каждой странице «Оценки и просмотры», только
// без ручной работы. Запускает владелец в своём браузере на странице профиля; помощник по очереди открывает
// страницы оценок этого человека (`?page=1, 2, …`) с паузой 3–6 с, вырезает из них лишнее (скрипты, стили,
// иконки — оставляет карточки и номер страницы) и отдаёт один файл `kp-<профиль>.html` в «Загрузки».
// Его перетаскивают в пульт (вкладка «Оценки Кинопоиска»): там он раскладывается обратно на страницы
// (splitBundle в tools/kinopoisk-seed.mts). Ничего никуда не отправляет: только свои запросы к Кинопоиску и файл.
// Капча — стоп: файл с уже собранным сохраняется, после капчи закладку нажимают снова — продолжит с той же страницы.
// Ссылку-закладку собирает пульт из этого файла (GET /kinopoisk/helper.js).
// Контакты (23.10, просьба владельца): перед оценками помощник открывает главную страницу профиля и выписывает из неё
// ник Telegram (ссылки t.me/…, @ник в тексте) и ссылки на другие площадки; итог — первой строкой файла
// (`<!-- kp-contacts … -->`, его читает tools/kp-profiles.mts). У профиля со скрытыми оценками файл — из одних контактов.
// Ссылки и @ники самой площадки (подвал, меню) тоже попадают — их отсеивает чтение: что есть почти у всех, то не контакт.
// window.__kpContactsOnly — только контакты, без оценок (для уже собранных профилей).
(async () => {
  const m = /^\/user\/([^/]+)\//.exec(location.pathname);
  if (location.hostname !== 'www.kinopoisk.ru' || !m) {
    alert('Откройте на Кинопоиске профиль человека — страницу «Оценки и просмотры» — и нажмите закладку там.');
    return;
  }
  if (window.__kpHelper) return;
  window.__kpHelper = true;
  const id = m[1];
  const base = `/user/${id}/movies/voted-watched/`;
  const RESUME = `kpHelperNext:${id}`;
  // больше — не листаем: свежих оценок хватает на вкус; пакетный прогон может задать меньше (window.__kpLimit)
  const LIMIT = Number(window.__kpLimit) || 300;

  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:320px;padding:14px 16px;border-radius:12px;'
    + 'background:#1c1a17;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)';
  const text = document.createElement('div');
  const stop = document.createElement('button');
  stop.textContent = 'Остановить и сохранить';
  stop.style.cssText = 'margin-top:10px;padding:6px 10px;border:0;border-radius:8px;background:#e6a23c;color:#1c1a17;font:inherit;cursor:pointer';
  box.append(text, stop);
  document.body.append(box);
  const say = (s) => { text.textContent = s; };
  let stopped = false;
  stop.onclick = () => { stopped = true; say('Останавливаю…'); };

  const cards = (html) => (html.match(/<a href="\/(?:film|series)\/\d+\/"[^>]*>\s*<img\b/g) || []).length;
  const lastPage = (html) => Math.max(1, ...Array.from(html.matchAll(/voted-watched\/\?page=(\d+)/g), (x) => Number(x[1])));
  const isCaptcha = (res, html) => /showcaptcha|checkcaptcha/.test(res.url) || /SmartCaptcha|captcha-form/i.test(html.slice(0, 20000));
  /** только карточки и номер страницы: без скриптов, стилей и иконок файл меньше в пять раз, а токены сессии не попадают */
  const strip = (html) => {
    let query = {};
    try { query = JSON.parse(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)[1]).query || {}; } catch (e) { query = {}; }
    const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '')
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, '').replace(/<(?:link|meta|input)\b[^>]*>/gi, '');
    return `${body}\n<script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ query })}</script>`;
  };
  /** главная страница профиля → ник Telegram и ссылки; ошибка — { error }, оценки собираются всё равно */
  const contactsOf = async () => {
    try {
      const res = await fetch(`/user/${id}/`, { credentials: 'include', redirect: 'manual' });
      if (res.type === 'opaqueredirect' || !res.ok) return { error: `профиль: ${res.status || 'переадресация'}` };
      const html = await res.text();
      if (isCaptcha(res, html)) return { error: 'капча' };
      const page = html.replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/\\u002[fF]/g, '/').replace(/\\\//g, '/');
      const tg = new Set(), at = new Set(), links = new Set();
      for (const m of page.matchAll(/(?:t\.me|telegram\.me|telegram\.dog)\/(?:s\/)?@?([A-Za-z][A-Za-z0-9_]{3,31})\b/gi)) tg.add(m[1].toLowerCase());
      for (const m of page.matchAll(/tg:\/\/resolve\?domain=([A-Za-z][A-Za-z0-9_]{3,31})/gi)) tg.add(m[1].toLowerCase());
      // @ник — не почта (x@y.ru) и не @media/@import стилей (стили вырезаны)
      for (const m of page.matchAll(/(?<![\w.@\/])@([A-Za-z][A-Za-z0-9_]{3,31})\b(?![\w.-]*\.[a-z]{2,6}\b)/g)) at.add(m[1].toLowerCase());
      for (const m of page.matchAll(/https?:\/\/(?:www\.|m\.)?((?:vk\.com|instagram\.com|youtube\.com|youtu\.be|letterboxd\.com|twitter\.com|x\.com|boosty\.to|dzen\.ru|twitch\.tv)\/[^\s"'<>\\)]{2,80})/gi)) links.add(m[1]);
      const title = (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] || '').trim();
      return { at: new Date().toISOString(), title, tg: [...tg], mentions: [...at], links: [...links] };
    } catch (e) { return { error: 'профиль: сеть' }; }
  };
  let contacts;
  const save = (pages) => {
    if (!pages.length && !contacts) return;
    // encodeURIComponent: в комментарии не встретится «-->»
    const head = contacts ? `<!-- kp-contacts ${encodeURIComponent(JSON.stringify(contacts))} -->\n` : '';
    const blob = new Blob([head, ...pages.map((p) => `<!-- kp-page ${p.n} -->\n${p.html}\n`)], { type: 'text/html' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `kp-${id}${!pages.length ? '-контакты' : pages[0].n > 1 ? `-с-${pages[0].n}` : ''}.html`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  let start = Number(localStorage.getItem(RESUME)) || 1;
  // только контакты — страницы оценок не нужны, и диалог остановил бы пакетный прогон (24.10, ревью п. 10)
  if (start > 1 && !window.__kpContactsOnly && !confirm(`В прошлый раз помощник остановился на странице ${start}. Продолжить с неё? («Отмена» — начать сначала)`)) start = 1;
  // контакты — один раз, в начале сбора (после капчи с середины их уже записал первый файл)
  if (start === 1 || window.__kpContactsOnly) {
    say('Профиль: ищу контакты…');
    contacts = await contactsOf();
    if (window.__kpContactsOnly) {
      save([]);
      say(contacts.error ? `Контакты: ${contacts.error}` : `Готово: контакты — Telegram ${contacts.tg.length}, упоминаний ${contacts.mentions.length}, ссылок ${contacts.links.length}`);
      stop.textContent = 'Закрыть';
      stop.onclick = () => { box.remove(); window.__kpHelper = false; };
      return;
    }
    await sleep(2000 + Math.random() * 2000);
  }
  const pages = [];
  let last = start;
  let note = '';
  for (let n = start; n <= Math.min(last, LIMIT) && !stopped; n++) {
    say(`Страница ${n}${last > n ? ` из ${last}` : ''}…`);
    let res, html;
    try {
      // капчу Кинопоиск отдаёт переадресацией на другой адрес: без `manual` браузер обрывает её как ошибку сети
      res = await fetch(`${base}?page=${n}`, { credentials: 'include', redirect: 'manual' });
      html = res.type === 'opaqueredirect' ? '' : await res.text();
    } catch (e) { res = undefined; }
    if (!res || res.type === 'opaqueredirect' || (res.status >= 300 && res.status < 400)) {
      // куда ведёт: на профиль без оценок — человек их скрыл (так у части профилей); иначе — капча или сеть
      const to = await fetch(`${base}?page=${n}`, { credentials: 'include' }).then((r) => r.url).catch(() => '');
      if (to && !/voted-watched|captcha/.test(to) && new URL(to).hostname === location.hostname) { note = n === 1 ? 'нет фильмов — оценки скрыты' : `дальше страниц нет (${n - 1})`; break; }
      note = to ? `Кинопоиск попросил капчу на странице ${n}` : `не открылась страница ${n} (сеть)`;
      localStorage.setItem(RESUME, String(n)); break;
    }
    if (isCaptcha(res, html)) { note = `Кинопоиск попросил капчу на странице ${n}`; localStorage.setItem(RESUME, String(n)); break; }
    if (!res.ok) { note = `страница ${n}: ответ ${res.status}`; break; }
    if (n === 1 && !cards(html)) { note = 'на первой странице нет фильмов — профиль закрыт или пуст'; break; }
    if (!cards(html)) break;
    last = Math.max(last, lastPage(html));
    pages.push({ n, html: strip(html) });
    if (n < last) await sleep(3000 + Math.random() * 3000);
  }
  const done = (!note || /^дальше страниц нет/.test(note)) && !stopped;
  if (done) localStorage.removeItem(RESUME);
  else if (pages.length && !localStorage.getItem(RESUME)) localStorage.setItem(RESUME, String(pages[pages.length - 1].n + 1));
  save(pages);
  const films = pages.reduce((s, p) => s + cards(p.html), 0);
  say(done
    ? `Готово: страниц ${pages.length}, фильмов ${films}${last > LIMIT ? ` (свежие ${LIMIT} страниц из ${last})` : ''}. Файл kp-${id}.html — в «Загрузках»: перетащите его в пульт.`
    : `${note || 'Остановлено'}. Сохранено страниц ${pages.length} (фильмов ${films}).${/капчу|сеть/.test(note) ? ' Пройдите капчу (обновите страницу) и нажмите закладку снова — продолжу с этого места.' : ''}`);
  stop.textContent = 'Закрыть';
  stop.onclick = () => { box.remove(); window.__kpHelper = false; };
})();
