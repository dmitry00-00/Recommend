// Заставка мобильной версии (16.10): плёнка с кадрами фильмов бежит вверх ~1,75 экрана за 1,8 с, тормозит и
// встаёт; кадры гаснут, а левая дорожка перфорации остаётся — она совпадает с дорожкой страницы, как в ленте
// приложения (.tm-filmstrip: дорожка 26 px, отверстия 8×6, шаг 14). Поэтому сдвиг ленты и высота кадра —
// кратны шагу: где бы лента ни встала, отверстия попадают в отверстия страницы.
(() => {
  const root = document.documentElement;
  const reel = document.querySelector('.reel');
  if (!reel || !root.classList.contains('reel-on')) return;

  const P = 14, TRACK = 26, RUN = 1.8, HOLD = 600, FADE = 450, FPS = 24;
  const IMG = 'https://image.tmdb.org/t/p/';
  // кадры, которые проносятся, и те, на которых лента встаёт (сверху вниз)
  const PASS = [
    ['2001: Космическая одиссея', '/w5IDXtifKntw0ajv2co7jFlTQDM.jpg'],
    ['Зеркало', '/9UAcMhSCDJ2OCo5QdPpSERjhMA1.jpg'],
    ['Унесённые призраками', '/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg'],
    ['Ведьма', '/zi2oYYNSSv7t44iSt5YrxHX9PYs.jpg'],
    ['Мальчик и птица', '/75nSb1fbWooipwcSU5bUttiOriI.jpg'],
    ['Чужой', '/AmR3JG1VQVxU8TfAvljUhfSFUOx.jpg'],
    ['Большой Лебовски', '/77ElMccPnTMPouRxSdbJ4nEjf69.jpg'],
    ['Интерстеллар', '/8sNiAPPYU14PUepFNeSNGUTiHW.jpg'],
    ['Дюна: Часть вторая', '/eZ239CUp1d6OryZEBPnO2n87gMG.jpg'],
  ];
  const STOP = [
    ['Одержимость', '/fRGxZuo7jJUWQsVg9PREb98Aclp.jpg'],
    ['С широко закрытыми глазами', '/cAZ87S5bONxKMMAlPxK8LZvdOcm.jpg'],
    ['Солярис', '/jZv1u7uzpOE5JOc2MmrvPUZWoyb.jpg'],
    ['Сталкер', '/6yrbWzzrPp7pwz6zHdifspJk8t3.jpg'],
    ['Любовное настроение', '/ffQFnAUm2Uu4RU0nijpjPRf9TBT.jpg'],
    ['Персона', '/amr72SENYz7AM4Hq5WBXxFBJEY6.jpg'],
  ];

  const vw = window.innerWidth, vh = window.innerHeight;
  const cell = Math.max(8, Math.round(((vw - 2 * TRACK) * 9 / 16 + 4) / P)) * P; // кадр 16:9 + межкадровая полоска
  const onStop = Math.ceil(vh / cell);                         // сколько кадров видно, когда лента стоит
  const passing = Math.max(4, Math.round((1.75 * vh) / cell)); // столько кадров уезжает за верх экрана
  const total = passing + onStop;
  const D = passing * cell;                                    // путь ленты — кратен шагу перфорации

  const strip = reel.querySelector('.reel__strip');
  strip.style.height = `${total * cell}px`;
  strip.style.setProperty('--cell', `${cell}px`);
  const film = reel.querySelector('.reel__film');
  const edge = reel.querySelector('.reel__edge');
  for (let i = 0; i < total; i++) {
    const last = i >= passing;
    const [title, path] = last ? STOP[(i - passing) % STOP.length] : PASS[i % PASS.length];
    const fr = document.createElement('div');
    fr.className = 'reel__frame';
    const img = new Image();
    img.alt = '';
    img.decoding = 'async';
    img.src = IMG + (last ? 'w780' : 'w300') + path;
    img.onerror = () => img.remove();
    fr.appendChild(img);
    film.appendChild(fr);
    const pr = document.createElement('span');
    pr.className = 'reel__print';
    pr.style.top = `${i * cell}px`;
    pr.innerHTML = `<span><b>${String(i + 1).padStart(2, '0')}</b> ${title}</span>`;
    edge.appendChild(pr);
  }

  let t0 = 0, done = false;
  // как проектор: разгон за четверть секунды, ровный ход, торможение за 0,7 с — путь по трапеции скорости
  const A = 0.25, B = 0.7, V = 1 / (RUN - (A + B) / 2);
  const travel = (t) => {
    if (t <= 0) return 0;
    if (t < A) return (V * t * t) / (2 * A);
    if (t < RUN - B) return V * (t - A / 2);
    if (t < RUN) { const r = RUN - t; return 1 - (V * r * r) / (2 * B); }
    return 1;
  };
  const finish = () => {
    if (done) return;
    done = true;
    strip.style.transform = `translate3d(0, ${-D}px, 0)`;
    reel.classList.add('is-done');
    setTimeout(() => {
      reel.remove();
      root.classList.remove('reel-on');
      try { sessionStorage.setItem('filibri-reel', '1'); } catch {}
    }, FADE);
  };
  const frame = (now) => {
    if (done) return;
    if (!t0) t0 = now;
    // положение меняется ступенями 24 раза в секунду, как кадры в проекторе
    const t = Math.floor(((now - t0) / 1000) * FPS) / FPS;
    strip.style.transform = `translate3d(0, ${-Math.round(D * travel(t))}px, 0)`;
    if (t < RUN) requestAnimationFrame(frame);
    else setTimeout(finish, HOLD);
  };
  reel.addEventListener('click', finish);
  requestAnimationFrame(frame);
})();
