// Помощник-закладка для LiveLib (23.10, просьба владельца): «Прочитанное» читателя LiveLib → книжная история приложения.
// Соглашение LiveLib (п. 3.2.11) запрещает автоматизированный доступ — поэтому не как у Кинопоиска (kinopoisk-helper.js):
// закладка НИЧЕГО не запрашивает и не листает. Она только читает страницу, которую владелец сам открыл в своём браузере,
// копит книги в localStorage этого браузера по нику читателя и по кнопке отдаёт файл livelib-<ник>.json в «Загрузки».
// Следующую страницу владелец открывает сам и жмёт закладку снова; «Показать ещё» на той же странице подхватывается само
// (смотрим за изменениями страницы, без запросов). Дальше: npx tsx tools/import-livelib.mts → seeds/books/livelib-<ник>.json.
// Разметку LiveLib мы не видели, поэтому разбор держится за ссылки /book/<id>-…: карточка — самый большой предок ссылки,
// в котором нет других книг; список — карточки одного вида (тег+класс), набравшие больше всех (боковые «похожие» отпадают).
// Оценка — сначала явные (schema.org reviewRating, «моя оценка», класс user/my-rating), потом догадка (единственное
// число с шагом 0,5 в «рейтинговом» элементе; среднее LiveLib пишет с сотыми — мимо); сколько оценок по догадке — видно.
// Не нашёл список или оценки — кнопка «Сохранить HTML страницы» (без скриптов, стилей и полей форм): образец для починки.
// Ссылку-закладку собирает `npx tsx tools/import-livelib.mts --install` (.cache/livelib-install.html).
(() => {
  /* разбор: начало — чистая функция, её же гоняет tools/livelib-helper-test.mts на своём HTML (без браузера) */
  function llParse(root, path) {
    const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/i;
    const els = [], parent = new Map(), order = new Map();
    (function walk(el) {
      order.set(el, els.length); els.push(el);
      for (const n of el.childNodes) if (n.nodeType === 1 && !SKIP.test(n.tagName)) { parent.set(n, el); walk(n); }
    })(root);
    const attr = (el, name) => el.getAttribute(name) || '';
    const cls = (el) => attr(el, 'class').trim().split(/\s+/).filter(Boolean);
    const texts = new Map();
    /** текст с пробелами между элементами: у textContent «НазваниеАвтор4.5» слипаются */
    const text = (el) => {
      if (texts.has(el)) return texts.get(el);
      const out = [];
      (function walk(n) {
        for (const c of n.childNodes) {
          if (c.nodeType === 3) out.push(c.nodeValue);
          else if (c.nodeType === 1 && !SKIP.test(c.tagName)) walk(c);
        }
      })(el);
      const t = out.join(' ').replace(/\s+/g, ' ').trim();
      texts.set(el, t);
      return t;
    };
    const BOOK = /^(?:https?:\/\/(?:www\.|m\.)?livelib\.ru)?\/book\/(\d+)(?=[-/?#]|$)/i;
    const AUTHOR = /^(?:https?:\/\/(?:www\.|m\.)?livelib\.ru)?\/author\/(\d+)(?=[-/?#]|$)/i;
    const isA = (el) => /^a$/i.test(el.tagName);
    const bookId = (el) => (isA(el) ? BOOK.exec(attr(el, 'href'))?.[1] : undefined);

    // под каждым элементом: номер книги, '*' — книг больше одной (снизу вверх: в обходе дети идут после родителя)
    const under = new Map();
    for (let i = els.length - 1; i >= 0; i--) {
      const el = els[i], own = bookId(el);
      let cur = under.get(el);
      if (own) cur = cur === undefined || cur === own ? own : '*';
      if (cur === undefined) continue;
      under.set(el, cur);
      const p = parent.get(el);
      if (p) { const pv = under.get(p); under.set(p, pv === undefined || pv === cur ? cur : '*'); }
    }
    const cards = new Map(); // корень карточки → номер книги
    for (const el of els) {
      const id = bookId(el);
      if (!id) continue;
      let c = el, p;
      while ((p = parent.get(c)) && p !== root && under.get(p) === id) c = p;
      cards.set(c, id);
    }

    // ── оценка читателя ──
    const AVG = /avg|average|aggregate|middle|overall|средн|общ(ая|ий)|book[-_]?rating|rating[-_]?book/i;
    const MINE = /(?:my|user|reader|own|mine|personal|self)[-_]?(?:rating|rate|mark|vote|score|stars?)|(?:rating|rate|mark|vote|score)[-_]?(?:my|user|reader|own|mine)|мо[яю]\s*оценк|оценк[аи]\s*читател|оценил/i;
    const RATEISH = /rating|rate|mark|stars?\b|score|vote|оценк/i;
    const stars = (s) => {
      const m = /(?<![\d.,])([0-5](?:[.,]\d{1,3})?)(?![\d.,]*\d)/.exec(String(s ?? ''));
      if (!m) return undefined;
      const v = Number(m[1].replace(',', '.'));
      return v > 0 && v <= 5 && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9 ? Math.round(v * 2) / 2 : undefined;
    };
    const attrsOf = (el) => [attr(el, 'class'), attr(el, 'id'), attr(el, 'title'), attr(el, 'aria-label'), attr(el, 'itemprop'), attr(el, 'data-type')].join(' ');
    const valueOf = (el) => {
      for (const a of ['data-rating', 'data-value', 'data-mark', 'data-rate', 'data-score', 'content', 'value']) { const v = stars(attr(el, a)); if (v) return v; }
      return stars(text(el)) ?? starCount(el);
    };
    /** звёзды значками: «закрашенные» дети + половинка */
    const starCount = (el) => {
      let full = 0, half = 0;
      for (const c of el.childNodes) {
        if (c.nodeType !== 1) continue;
        const k = attr(c, 'class');
        if (/half/i.test(k)) half++;
        else if (/(?:^|[-_\s])(full|active|filled|fill|on|checked|selected|lit)(?:$|[-_\s])/i.test(k)) full++;
      }
      return full || half ? stars(String(full + half / 2)) : undefined;
    };
    const inside = (card) => els.slice(order.get(card), order.get(card) + 1 + countBelow(card));
    const below = new Map();
    const countBelow = (el) => {
      if (below.has(el)) return below.get(el);
      let n = 0;
      for (const c of el.childNodes) if (c.nodeType === 1 && !SKIP.test(c.tagName)) n += 1 + countBelow(c);
      below.set(el, n);
      return n;
    };
    const avgAround = (el, card) => { for (let e = el; e && e !== card; e = parent.get(e)) if (AVG.test(attrsOf(e)) || /aggregateRating/i.test(attr(e, 'itemprop'))) return true; return false; };
    function rating(card, all) {
      // 1) schema.org: reviewRating (не aggregateRating — это среднее)
      for (const el of all) {
        if (!/reviewRating/i.test(attr(el, 'itemprop'))) continue;
        const v = [el, ...inside(el)].map((e) => /ratingValue/i.test(attr(e, 'itemprop')) ? valueOf(e) : undefined).find(Boolean);
        if (v) return { v, from: 'schema' };
      }
      // 2) элемент с пометкой «моя / читателя»
      for (const el of all) if (MINE.test(attrsOf(el)) && !avgAround(el, card)) { const v = valueOf(el); if (v) return { v, from: 'label' }; }
      // 3) текст «Моя оценка: 4,5», «оценил на 4»
      const t = /(?:мо[яю]\s+оценк[аиу]|оценк[аи]\s+читател[яь]|оценил[аи]?(?:\s+на)?|поставил[аи]?(?:\s+оценку)?)\s*[:\-–—]?\s*([0-5](?:[.,][05])?)(?![\d.,]*\d)/i.exec(text(card));
      if (t) { const v = stars(t[1]); if (v) return { v, from: 'text' }; }
      // 4) подсказки title / aria-label: «Оценка 4 из 5»
      for (const el of all) {
        const h = `${attr(el, 'title')} ${attr(el, 'aria-label')}`;
        const m = /(?:оценк|оценил|rated?\b)\D{0,20}([0-5](?:[.,]\d)?)/i.exec(h);
        if (m && !AVG.test(h) && !avgAround(el, card)) { const v = stars(m[1]); if (v) return { v, from: 'title' }; }
      }
      // 5) догадка: единственное «круглое» число в рейтинговом листе; 6) звёзды значками
      const guess = new Set();
      for (const el of all) {
        if (!RATEISH.test(attrsOf(el)) || avgAround(el, card)) continue;
        const own = [...el.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join(' ').trim();
        const v = own && /^[0-5](?:[.,]\d{1,3})?$/.test(own) ? stars(own) : undefined;
        if (v) guess.add(v);
      }
      if (guess.size === 1) return { v: [...guess][0], from: 'guess' };
      for (const el of all) if (RATEISH.test(attrsOf(el)) && !avgAround(el, card)) { const v = starCount(el); if (v) return { v, from: 'guess' }; }
      return undefined;
    }

    // ── дата прочтения ──
    const MON = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
    const M = '(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])(?!\\p{L})';
    const mon = (s) => { const l = s.toLowerCase(); return MON.findIndex((x) => (x === 'ма' ? /^ма[йя]$/.test(l) : l.startsWith(x))) + 1; };
    const pad = (n) => String(n).padStart(2, '0');
    const day = (y, m, d) => (y >= 1990 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : undefined);
    const DMY = new RegExp(`(?<!\\d)(\\d{1,2})\\s+${M}\\s+(\\d{4})`, 'iu');
    const MY = new RegExp(`${M}\\s+(\\d{4})`, 'iu');
    const dateIn = (s) => {
      let m;
      if ((m = /(\d{4})-(\d{2})-(\d{2})/.exec(s))) return { at: day(+m[1], +m[2], +m[3]), month: false };
      if ((m = DMY.exec(s))) return { at: day(+m[3], mon(m[2]), +m[1]), month: false };
      if ((m = /(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)/.exec(s))) return { at: day(+m[3], +m[2], +m[1]), month: false };
      if ((m = MY.exec(s))) return { at: day(+m[2], mon(m[1]), 1), month: true };
      return undefined;
    };
    function dateOf(card, all) {
      for (const el of all) if (/^time$/i.test(el.tagName)) { const d = dateIn(attr(el, 'datetime') || text(el)); if (d?.at) return d; }
      const t = text(card);
      // рядом со словом «прочитано» — главнее (в карточке бывают и даты рецензий, и годы изданий)
      const near = /(?:прочитан|прочтен|прочтён|дата\s+прочтения)\p{L}*\s*[:\-–—]?\s*(.{0,40})/iu.exec(t);
      return (near && dateIn(near[1])) || dateIn(t);
    }

    // ── какие карточки — список ──
    const sig = (el) => `${el.tagName.toLowerCase()}.${cls(el)[0] ?? ''}`;
    const info = [...cards].map(([card, id]) => {
      const all = inside(card);
      const links = all.filter((e) => bookId(e) === id);
      const authors = all.filter((e) => isA(e) && AUTHOR.test(attr(e, 'href')));
      return { card, id, all, links, authors };
    });
    const score = new Map();
    for (const c of info) score.set(sig(c.card), (score.get(sig(c.card)) ?? 0) + 1 + (c.authors.length ? 1 : 0));
    const best = [...score].sort((a, b) => b[1] - a[1])[0]?.[0];
    const list = info.filter((c) => sig(c.card) === best);
    const inList = new Set(list.map((c) => c.card));

    // заголовки месяцев вне карточек: «Октябрь 2024» над группой книг
    const heads = [];
    for (const el of els) {
      if (inList.has(el) || countBelow(el) > 6) continue;
      const t = text(el);
      if (t.length > 40 || !new RegExp(`^${M}\\s+(\\d{4})(?:\\s*г(?:\\.|од)?)?$`, 'iu').test(t)) continue;
      let inCard = false;
      for (let e = parent.get(el); e; e = parent.get(e)) if (inList.has(e)) { inCard = true; break; }
      if (!inCard) heads.push({ i: order.get(el), d: dateIn(t) });
    }

    const books = list.map(({ card, id, all, links, authors }) => {
      // название — у ссылки на саму книгу (не «…/reviews», не «Читать отзывы»), самый длинный текст
      const main = links.filter((a) => /\/book\/\d+(?:-[^/?#]*)?\/?(?:[?#]|$)/.test(attr(a, 'href')) && !/отзыв|рецензи|цитат|читать|подробнее/i.test(text(a)));
      const title = (main.length ? main : links).map((a) => text(a)).sort((a, b) => b.length - a.length)[0]
        || links.map((a) => attr(a, 'title')).find(Boolean)
        || all.filter((e) => /^img$/i.test(e.tagName)).map((e) => attr(e, 'alt')).find(Boolean) || '';
      const names = [...new Set(authors.map((a) => text(a)).filter(Boolean))];
      const r = rating(card, all);
      let d = dateOf(card, all), atFrom = 'card';
      if (!d?.at) { const h = heads.filter((x) => x.i < order.get(card)).pop(); d = h?.d; atFrom = 'header'; }
      const isbn = /ISBN[:\s]*([\dXx][\dXx-]{8,16}[\dXx])/.exec(text(card))?.[1].replace(/-/g, '');
      return {
        id, title: title.replace(/^[«"]+|[»"]+$/g, '').trim(),
        ...(names.length ? { author: names.join(', '), authorIds: [...new Set(authors.map((a) => AUTHOR.exec(attr(a, 'href'))[1]))] } : {}),
        ...(r ? { stars: r.v, rateFrom: r.from } : {}),
        ...(d?.at ? { at: d.at, ...(d.month ? { atMonth: true } : {}), atFrom } : {}),
        ...(isbn ? { isbn } : {}),
        url: attr(links[0], 'href').replace(/^https?:\/\/[^/]+/, ''),
      };
    }).filter((b) => b.title);

    // номер страницы и последняя: …/read/~3 или ?page=3
    const pageOf = (s) => Number(/\/~(\d+)(?:[/?#]|$)/.exec(s)?.[1] ?? /[?&]page=(\d+)/.exec(s)?.[1] ?? 1);
    // адрес с кириллицей в нике: location — в %-кодах, ссылки — как попало; сравниваем раскодированные
    const dec = (s) => { try { return decodeURI(s); } catch (e) { return s; } };
    const base = dec(String(path || '')).replace(/\/~\d+.*$/, '').replace(/[?#].*$/, '');
    let last = pageOf(path || '');
    for (const el of els) {
      if (!isA(el)) continue;
      const h = dec(attr(el, 'href').replace(/^https?:\/\/[^/]+/, ''));
      if (base && h.startsWith(base)) last = Math.max(last, pageOf(h));
    }
    return { books, page: pageOf(path || ''), last, cards: cards.size, kind: best,
      rated: books.filter((b) => b.stars).length, guessed: books.filter((b) => b.rateFrom === 'guess').length, dated: books.filter((b) => b.at).length };
  }
  /* разбор: конец */

  if (typeof window === 'undefined') return;
  const m = /^\/reader\/([^/?#]+)(\/[^?#]*)?/.exec(location.pathname);
  if (!/(^|\.)livelib\.ru$/.test(location.hostname) || !m) {
    alert('Откройте на LiveLib страницу читателя — вкладку «Прочитанное» (адрес вида livelib.ru/reader/<ник>/read) — и нажмите закладку там.');
    return;
  }
  const nick = decodeURIComponent(m[1]);
  const tail = (m[2] || '').toLowerCase();
  if (/\/(wish|reading|unread|recommended|toread)(\/|$)/.test(tail)) {
    alert('Это не «Прочитанное» — откройте у читателя вкладку «Прочитанное» и нажмите закладку там.');
    return;
  }
  if (!/\/read(\/|$)/.test(tail) && !confirm('Адрес не похож на «Прочитанное» (…/reader/<ник>/read). Это точно список прочитанного?')) return;
  if (window.__llHelper) { window.__llHelper.scan(); return; }

  const KEY = `llHelper:${nick}`;
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '') || undefined; } catch (e) { return undefined; } };
  let store = load() || { nick, pages: {}, books: {} };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); return true; } catch (e) { return false; } };

  const box = document.createElement('div');
  box.id = '__llHelperBox';
  box.style.cssText = 'position:fixed;z-index:2147483647;right:16px;bottom:16px;width:340px;padding:14px 16px;border-radius:12px;'
    + 'background:#1c1a17;color:#fff;font:14px/1.4 -apple-system,system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.35)';
  const text = document.createElement('div');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-top:10px';
  const button = (label, main) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `padding:6px 10px;border:0;border-radius:8px;font:inherit;cursor:pointer;${main ? 'background:#e6a23c;color:#1c1a17' : 'background:#3a3833;color:#fff'}`;
    row.append(b);
    return b;
  };
  const getJson = button('Скачать JSON', true);
  const getHtml = button('Сохранить HTML страницы');
  const reset = button('Начать заново');
  const close = button('Закрыть');
  box.append(text, row);
  document.body.append(box);
  const say = (html) => { text.innerHTML = html; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const download = (name, body, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60e3);
  };

  let lastScan;
  const scan = () => {
    const r = llParse(document.body, location.pathname + location.search);
    lastScan = r;
    const key = location.pathname + location.search;
    const total = () => Object.keys(store.books).length;
    if (!r.books.length) {
      say(`<b>LiveLib · ${esc(nick)}</b><br>Не нашёл список книг на этой странице${r.cards ? ` (ссылок на книги ${r.cards}, но списка из них не сложилось)` : ''}.`
        + '<br>Нажмите «Сохранить HTML страницы» и пришлите файл — поправлю разбор.'
        + (total() ? `<br><br>Уже собрано: книг ${total()}, страниц ${Object.keys(store.pages).length}.` : ''));
      return;
    }
    // свежая запись по книге главнее, но то, чего в ней нет (оценка, дата), берём из прошлой
    for (const b of r.books) store.books[b.id] = { ...(store.books[b.id] || {}), ...b, seenAt: new Date().toISOString() };
    store.pages[key] = { at: new Date().toISOString(), page: r.page, books: r.books.length };
    const saved = persist();
    const pages = Object.values(store.pages).map((p) => p.page).sort((a, b) => a - b);
    const missing = [];
    for (let n = 1; n <= Math.max(r.last, ...pages); n++) if (!pages.includes(n)) missing.push(n);
    say(`<b>LiveLib · ${esc(nick)}</b>${r.last > 1 ? ` · страница ${r.page} из ${r.last}` : ''}<br>`
      + `На этой странице: книг ${r.books.length}, с оценкой ${r.rated}${r.guessed ? ` (по догадке ${r.guessed} — сверьте пару книг)` : ''}, с датой ${r.dated}.<br>`
      + `<b>Собрано: книг ${total()}, страниц ${pages.length}</b>${missing.length && missing.length <= 12 ? ` · нет страниц: ${missing.join(', ')}` : missing.length ? ` · нет ещё ${missing.length} страниц` : ''}.<br>`
      + (!r.rated ? '<span style="color:#e6a23c">Оценок не нашёл — если у читателя они есть, сохраните HTML страницы и пришлите.</span><br>' : '')
      + (saved ? '' : '<span style="color:#ff8a80">Браузер не дал сохранить — скачайте JSON сейчас.</span><br>')
      + '<span style="color:#bbb">Дальше откройте следующую страницу сами и нажмите закладку снова. В конце — «Скачать JSON».</span>');
  };

  // «Показать ещё» дописывает книги в ту же страницу — перечитываем её сами (только DOM, без запросов)
  let timer;
  const watch = new MutationObserver((list) => {
    if (list.every((x) => box.contains(x.target))) return;
    clearTimeout(timer); timer = setTimeout(scan, 1500);
  });
  watch.observe(document.body, { childList: true, subtree: true });

  getJson.onclick = () => {
    const books = Object.values(store.books);
    if (!books.length) return alert('Пока ничего не собрано.');
    download(`livelib-${nick}.json`, JSON.stringify({ format: 'livelib-helper', version: 1, nick, savedAt: new Date().toISOString(), pages: store.pages, books }, null, 1), 'application/json');
  };
  getHtml.onclick = () => {
    // образец разметки для починки разбора: без скриптов, стилей, полей форм и токенов
    const doc = document.documentElement.cloneNode(true);
    doc.querySelectorAll('script,style,link,meta,input,textarea,select,iframe,noscript,template').forEach((e) => e.remove());
    doc.querySelector('#__llHelperBox')?.remove();
    for (const e of doc.querySelectorAll('*')) for (const a of [...e.attributes]) if (/^on|csrf|token|nonce|integrity/i.test(a.name)) e.removeAttribute(a.name);
    const page = lastScan?.page ?? 1;
    download(`livelib-${nick}-page${page}.html`, `<!-- ${location.pathname}${location.search} · ${new Date().toISOString()} -->\n${doc.outerHTML}`, 'text/html');
  };
  reset.onclick = () => {
    if (!confirm(`Забыть всё собранное по ${nick} (книг ${Object.keys(store.books).length})? Скачанные файлы не тронутся.`)) return;
    try { localStorage.removeItem(KEY); } catch (e) { /* нет доступа — просто начинаем в памяти */ }
    store = { nick, pages: {}, books: {} };
    scan();
  };
  close.onclick = () => { watch.disconnect(); clearTimeout(timer); box.remove(); window.__llHelper = undefined; };
  window.__llHelper = { scan };
  scan();
})();
