import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { useNavigationType } from 'react-router-dom';

/** Длинный список порциями (18.10, аудит скорости, волна 3В, п. 33): у тяжёлого участника «Отмеченное» и колода оценок —
 *  тысячи строк, ~35–80 тыс. узлов, и каждая отметка перерисовывала их все. Рисуем первые `page` строк, следующую порцию —
 *  когда метка в конце списка подъезжает к экрану (запас `ahead` px). Метка выше экрана (прыгнули к ряду книг ниже
 *  списка) порцию не добавляет: иначе список рос бы над глазами и уводил то, на что человек смотрит.
 *
 *  Возврат на экран «назад» (POP) — прежнее число строк и прежняя прокрутка (`memory` — имя экрана, помним до конца
 *  сеанса); новый заход — с начала, как и было. `reset` — что-то, при смене чего список начинается заново (запрос, фильтр).
 *  `ready` — данные на месте: прокрутку возвращаем только тогда, раньше нечего прокручивать. */
const remembered = new Map<string, { limit: number; top: number; reset: string }>();

export function usePortion({ total, root, memory, reset, ready, page = 60, ahead = 1200 }: {
  total: number;
  root: RefObject<HTMLElement | null>;
  memory?: string;
  reset?: unknown;
  ready: boolean;
  page?: number;
  ahead?: number;
}): { limit: number; sentinel: RefObject<HTMLLIElement | null> } {
  const back = useNavigationType() === 'POP';
  const saved = useRef(back && memory ? remembered.get(memory) : undefined);
  const [limit, setLimit] = useState(() => Math.max(page, saved.current?.limit ?? 0));
  const sentinel = useRef<HTMLLIElement>(null);

  // новый запрос или фильтр — с первой порции (первый проход пропускаем: там уже стоит нужное, в том числе возвращённое)
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setLimit(page);
  }, [reset, page]);

  // метка у конца списка: подъехала — ещё порция. Наблюдатель — заново после каждой порции: если метка и после неё
  // в зоне запаса (короткие строки, большой экран), первый же отклик наблюдателя добавит следующую
  useEffect(() => {
    const el = sentinel.current;
    if (!el || limit >= total || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((seen) => {
      const e = seen[seen.length - 1];
      if (!e?.isIntersecting) return;
      const top = e.rootBounds?.top ?? 0;
      if (e.boundingClientRect.bottom < top) return;
      setLimit((l) => Math.min(total, l + page));
    }, { root: root.current, rootMargin: `0px 0px ${ahead}px 0px` });
    io.observe(el);
    return () => io.disconnect();
  }, [limit, total, page, ahead, root]);

  // вернулись назад — прокрутка туда, где была, как только строки на месте
  useLayoutEffect(() => {
    const s = saved.current;
    const el = root.current;
    if (!s || !ready || !el) return;
    saved.current = undefined;
    // тот же список, что был (в поиске — тот же запрос и фильтр): чужой прокрутке в другом списке не место
    if (s.reset === String(reset)) el.scrollTop = s.top;
  }, [ready, root, reset]);

  // уходя — запомнить, сколько строк и где прокрутка. Прокрутку — по ходу: у снятого со страницы блока scrollTop уже 0
  const state = useRef({ limit, top: 0, reset: String(reset) });
  state.current.limit = limit;
  state.current.reset = String(reset);
  useEffect(() => {
    const el = root.current;
    if (!memory || !el) return;
    const s = state.current;
    const onScroll = () => { s.top = el.scrollTop; };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); remembered.set(memory, { limit: s.limit, top: s.top, reset: s.reset }); };
  }, [memory, root]);

  return { limit, sentinel };
}
