// Общий каркас пульта (06.10): верхняя полоса вкладок по группам — одна на всех страницах, а не своя
// копия в каждой. Подключается первым элементом <body>: полоса встаёт до отрисовки страницы, без
// мигания. Счётчики у вкладок и строку состояния справа заполняет сама страница через window.desk.
(() => {
  const GROUPS = [
    { tabs: [['dash', 'Сводка']] },
    { label: 'Работа', tabs: [['check', 'Проверка'], ['lens', 'Рубрики']] },
    { label: 'Данные', tabs: [['channels', 'Каналы'], ['behavior', 'Поведение']] },
    { label: 'Импорт', tabs: [['links', 'Ссылки'], ['kinopoisk', 'Кинопоиск']] },
  ];
  const here = location.pathname.split('/')[1];
  const nav = document.createElement('nav');
  nav.className = 'desk-nav';
  nav.setAttribute('aria-label', 'Вкладки пульта');
  for (const g of GROUPS) {
    const box = document.createElement('div');
    box.className = 'grp';
    if (g.label) { const l = document.createElement('span'); l.className = 'lbl'; l.textContent = g.label; box.append(l); }
    for (const [id, name] of g.tabs) {
      const a = document.createElement('a');
      a.href = `/${id}/`;
      a.dataset.tab = id;
      a.textContent = name;
      const b = document.createElement('span'); b.className = 'badge'; a.append(b);
      if (id === here) { a.className = 'on'; a.setAttribute('aria-current', 'page'); }
      box.append(a);
    }
    nav.append(box);
  }
  const status = document.createElement('span');
  status.className = 'status';
  nav.append(status);
  document.body.prepend(nav);
  window.desk = {
    /** число у вкладки: сколько ждёт работы (пусто — спрятать) */
    badge(tab, n) { const b = nav.querySelector(`a[data-tab="${tab}"] .badge`); if (b) b.textContent = n ? String(n) : ''; },
    status(text) { status.textContent = text || ''; },
  };
  // сколько ждёт работы (спорные привязки, непроверенные слабые рубрики) и что идёт в конвейере —
  // раз в минуту, пока идёт прогон — чаще
  let timer;
  const poll = async () => {
    let running = false;
    try {
      const t = await (await fetch('/dash/api/todo')).json();
      for (const [tab, n] of Object.entries(t.badges ?? {})) window.desk.badge(tab, n);
      running = Boolean(t.running);
      window.desk.status(running ? `конвейер: идёт «${t.running}»` : '');
    } catch { /* пульт перезапускается */ }
    clearTimeout(timer);
    timer = setTimeout(poll, running ? 5000 : 60000);
  };
  poll();
})();
