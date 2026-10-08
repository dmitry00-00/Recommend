import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID, Register } from '@/types/tmdf';
import { coldStartLeft, notWatched, searchCharacters, searchWorks, setWatched, startWork, type SearchHit } from '@/api';
import { Button, EmptyState, ErrorState, Skeleton, SuggestSheet, useToast } from '@/components';
import { formatDuration, titleOf } from '@/lib/format';
import { registers } from '@/lib/registers';
import { cx } from '@/lib/cx';
import { pick, tap } from '@/lib/telegram';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import ui from '@/i18n';
import { isSeries } from '@/lib/media';
import { useDiary } from '@/lib/settingsStore';
import { WorkCardSheet } from './WorkCardSheet';

const DEBOUNCE = 250;

/** Поиск (/search): найти фильм и сказать, что видел его, — или снять отметку.
 *  Пустой запрос показывает то, что уже отмечено: это и список, и способ его почистить.
 *  Отметка работает сразу — отмеченное перестаёт приходить в ленту, а вкус по регистру
 *  пересчитывается вместе с ним. Бэкенда нет, правка живёт в памяти вкладки. */
export function SearchScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const diary = useDiary();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  // «Повторить» (ТВ-9): тот же запрос строкой не перезапускал поиск — React не видит перемены
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<ID[]>([]);
  // фильтр живёт только в «моём списке» (пустой запрос): в результатах поиска фильтровать
  // нечего — там и так то, что человек назвал
  const [reg, setReg] = useState<Register | null>(null);
  const [asking, setAsking] = useState(false);
  // карточка найденного — та же, что у рекомендации (02.10): тап по строке открывает её, а не страницу
  const [openId, setOpenId] = useState<ID | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // герои по запросу (И2): «джокер» — это и фильм, и герой десятка произведений
  const [heroes, setHeroes] = useState<{ id: string; name: string; works: number }[]>([]);
  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => { searchCharacters(query).then((h) => alive && setHeroes(h)).catch(() => alive && setHeroes([])); }, query ? DEBOUNCE : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [query]);

  useEffect(() => { input.current?.focus(); }, []);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    const timer = setTimeout(() => {
      searchWorks(query)
        .then((found) => alive && setHits(found))
        .catch(() => alive && setFailed(true));
    }, query ? DEBOUNCE : 0);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, attempt]);

  // «Смотрю» — для просмотра вне приложения: в кино, по телевизору, у друзей. Прогноз не
  // спрашиваем, потом спросим «посмотрели?» над лентой; отмена сразу — в наблюдения не идёт
  const watchingNow = (id: ID) => {
    tap();
    setBusy((b) => [...b, id]);
    setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: true } : h)));
    startWork(id)
      .then((entry) => toast({
        text: hits?.find((h) => h.work.id === id)?.work.type === 'book' ? ui.toast.readMarked : ui.toast.watchMarked,
        ...(entry ? {
          action: ui.actions.undo,
          onAction: () => {
            setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: false } : h)));
            notWatched(entry.id, 'undo').catch(() => toast({ text: ui.settings.errorSave }));
          },
        } : {}),
      }))
      .catch(() => {
        setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: false } : h)));
        toast({ text: ui.settings.errorSave });
      })
      .finally(() => setBusy((b) => b.filter((x) => x !== id)));
  };

  const apply = (id: ID, watched: boolean, undo = true) => {
    tap();
    setBusy((b) => [...b, id]);
    // список пустого запроса — это и есть просмотренное: снятое из него уходит
    setHits((prev) => (prev ?? [])
      .map((h) => (h.work.id === id ? { ...h, watched } : h))
      .filter((h) => query || h.watched));
    setWatched(id, watched)
      // пока первой ленты нет, «Смотрел» её не приближает — говорим это сразу (02.10)
      .then(() => (watched ? coldStartLeft() : 0))
      .then((left) => toast({
        text: watched ? (left ? `${ui.search.added} · ${ui.quick.notCounted(left)}` : ui.search.added) : ui.search.removed,
        ...(undo ? { action: ui.actions.undo, onAction: () => apply(id, !watched, false) } : {}),
      }))
      .catch(() => {
        setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watched: !watched } : h)));
        toast({ text: ui.settings.errorSave });
      })
      .finally(() => setBusy((b) => b.filter((x) => x !== id)));
  };

  // регистры считаем по отмеченному, а не по каталогу: это список человека, и фильтры в нём
  // должны быть его собственные
  const list = hits ?? [];
  const counts = new Map<Register, number>();
  if (!query) for (const h of list) for (const r of h.work.registers ?? []) counts.set(r, (counts.get(r) ?? 0) + 1);
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const shown = !query && reg ? list.filter((h) => h.work.registers?.includes(reg)) : list;

  const meta = (hit: SearchHit) =>
    [hit.work.year, leadName(hit.work), formatDuration(hit.work.durationMinutes)].filter(Boolean).join(' · ');

  return (
    <main className="tm-shell__main tm-search">
      <h1 className="tm-sr">{ui.search.title}</h1>
      <div className="tm-search__bar">
        <input ref={input} className="tm-search__input" type="search" value={query} inputMode="search"
               placeholder={ui.search.placeholder} aria-label={ui.search.placeholder}
               onChange={(e) => setQuery(e.target.value)} />
        {query ? (
          <Button variant="quiet" size="sm" onClick={() => { setQuery(''); input.current?.focus(); }}>
            {ui.actions.clear}
          </Button>
        ) : null}
      </div>

      <p className="tm-caption tm-search__hint">
        {query ? ui.search.hint : ui.search.watchedHint}
        {!query && hits?.length ? ` ${ui.search.watchedCount(hits.length)}` : null}
      </p>

      {!query && chips.length > 1 ? (
        <div className="tm-search__filters">
          <button type="button" className={cx('tm-voice__chip', !reg && 'tm-voice__chip--on')}
                  onClick={() => { pick(); setReg(null); }}>{ui.search.filterAll}</button>
          {chips.map(([r, n]) => (
            <button key={r} type="button" className={cx('tm-voice__chip', reg === r && 'tm-voice__chip--on')}
                    onClick={() => { pick(); setReg(reg === r ? null : r); }}>
              {registers[r].name} <span className="tm-search__count">{n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {query && heroes.length ? (
        <p className="tm-voice__outlets tm-search__heroes">
          {heroes.map((h) => (
            <button key={h.id} type="button" className="tm-voice__chip" onClick={() => navigate(`/character/${h.id}`)}>
              {ui.hero.search(h.name, h.works)}
            </button>
          ))}
        </p>
      ) : null}

      {failed ? <ErrorState title={ui.search.error} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {!hits && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 106, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}
      {hits && !hits.length ? (
        <EmptyState title={query ? ui.search.empty : ui.search.watchedEmpty}
                    text={query ? ui.search.emptyText : ui.search.watchedEmptyText} />
      ) : null}
      {/* «не нашли» — не только у пустого списка: искали «Солярис», нашли не тот. Ссылка
          стоит под результатами, а не над ними: сначала список, потом жалоба на список */}
      {query && hits ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => { tap(); setAsking(true); }}>
            {ui.search.missing}
          </button>
        </p>
      ) : null}
      {/* список растёт не только по одному фильму: отсюда же виден вход в импорт */}
      {!query ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => navigate('/settings?import=1')}>
            {ui.search.importLink}
          </button>
        </p>
      ) : null}

      <ul className="tm-search__list">
        {shown.map((hit) => (
          <li key={hit.work.id} className="tm-search__item">
            <button type="button" className="tm-search__open" onClick={() => { tap(); setOpenId(hit.work.id); }}>
              {/* кадр в строке — только картинка: название рядом, и повторять его внутри рамки
                  (как делает WorkCover) значит написать его дважды */}
              <WorkThumb work={hit.work} />
              <span className="tm-search__text">
                <span className="tm-search__name">{titleOf(hit.work)}</span>
                <span className="tm-search__meta">{meta(hit)}</span>
                {hit.work.originalTitle && hit.work.originalTitle !== titleOf(hit.work)
                  ? <span className="tm-search__orig">{hit.work.originalTitle}</span> : null}
              </span>
            </button>
            {/* «Смотрел» и «Смотрю» — одна над другой; «Смотрю» не для уже просмотренного. «Убрать» у
                просмотренного — тихая (28.09): белая рамка в каждой строке спорила с названиями */}
            <span className="tm-search__acts">
              <Button size="sm" variant={hit.watched ? 'quiet' : 'primary'} disabled={busy.includes(hit.work.id)}
                      onClick={() => apply(hit.work.id, !hit.watched)}>
                {hit.watched ? ui.search.unmark : ui.search.mark}
              </Button>
              {/* «Смотрю» — часть подробного дневника (02.10): в облегчённом учёте хватает «Смотрел» */}
              {diary && !hit.watched && !isSeries(hit.work) ? (
                <Button size="sm" variant="quiet" pressed={hit.watching} disabled={hit.watching || busy.includes(hit.work.id)}
                        onClick={() => watchingNow(hit.work.id)}>
                  {hit.work.type === 'book'
                    ? (hit.watching ? ui.feed.readingOn : ui.feed.readingMark)
                    : (hit.watching ? ui.feed.watchingOn : ui.feed.watchingMark)}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {(() => {
        const open = openId ? list.find((h) => h.work.id === openId) : undefined;
        return (
          <WorkCardSheet work={open?.work ?? null} onClose={() => setOpenId(null)} seen={open?.watched}
                         tag={open?.watched ? ui.card.seen : open?.watching ? (open.work.type === 'book' ? ui.feed.readingOn : ui.feed.watchingOn) : undefined}
                         context={query ? `поиск: ${query}` : 'просмотренное'}
                         corner={open ? (
                           <>
                             <Button size="sm" variant={open.watched ? 'quiet' : 'primary'} disabled={busy.includes(open.work.id)}
                                     onClick={() => apply(open.work.id, !open.watched)}>
                               {open.watched ? ui.search.unmark : ui.search.mark}
                             </Button>
                             {diary && !open.watched && !isSeries(open.work) ? (
                               <Button size="sm" variant="quiet" pressed={open.watching} disabled={open.watching || busy.includes(open.work.id)}
                                       onClick={() => watchingNow(open.work.id)}>
                                 {open.work.type === 'book'
                                   ? (open.watching ? ui.feed.readingOn : ui.feed.readingMark)
                                   : (open.watching ? ui.feed.watchingOn : ui.feed.watchingMark)}
                               </Button>
                             ) : null}
                           </>
                         ) : undefined} />
        );
      })()}

      <SuggestSheet open={asking} onOpenChange={setAsking} kind="work" initial={query}
                    context={`поиск: ${query}`} />
    </main>
  );
}
