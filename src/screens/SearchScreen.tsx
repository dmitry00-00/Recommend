import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID, Register } from '@/types/tmdf';
import { notWatched, searchWorks, setWatched, startWork, type SearchHit } from '@/api';
import { Button, EmptyState, ErrorState, Skeleton, SuggestSheet, useToast } from '@/components';
import { formatDuration } from '@/lib/format';
import { registers } from '@/lib/registers';
import { cx } from '@/lib/cx';
import { pick, tap } from '@/lib/telegram';
import { opVar } from '@/lib/operations';
import ru from '@/i18n/ru';
import { isSeries } from '@/lib/media';

const DEBOUNCE = 250;

/** Поиск (/search): найти фильм и сказать, что видел его, — или снять отметку.
 *  Пустой запрос показывает то, что уже отмечено: это и список, и способ его почистить.
 *  Отметка работает сразу — отмеченное перестаёт приходить в ленту, а вкус по регистру
 *  пересчитывается вместе с ним. Бэкенда нет, правка живёт в памяти вкладки. */
export function SearchScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<ID[]>([]);
  // фильтр живёт только в «моём списке» (пустой запрос): в результатах поиска фильтровать
  // нечего — там и так то, что человек назвал
  const [reg, setReg] = useState<Register | null>(null);
  const [asking, setAsking] = useState(false);
  const input = useRef<HTMLInputElement>(null);

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
  }, [query]);

  // «Смотрю» — для просмотра вне приложения: в кино, по телевизору, у друзей. Прогноз не
  // спрашиваем, потом спросим «посмотрели?» над лентой; отмена сразу — в наблюдения не идёт
  const watchingNow = (id: ID) => {
    tap();
    setBusy((b) => [...b, id]);
    setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: true } : h)));
    startWork(id)
      .then((entry) => toast({
        text: ru.toast.watchMarked,
        ...(entry ? {
          action: ru.actions.undo,
          onAction: () => {
            setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: false } : h)));
            notWatched(entry.id, 'undo').catch(() => toast({ text: ru.settings.errorSave }));
          },
        } : {}),
      }))
      .catch(() => {
        setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watching: false } : h)));
        toast({ text: ru.settings.errorSave });
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
      .then(() => toast({
        text: watched ? ru.search.added : ru.search.removed,
        ...(undo ? { action: ru.actions.undo, onAction: () => apply(id, !watched, false) } : {}),
      }))
      .catch(() => {
        setHits((prev) => (prev ?? []).map((h) => (h.work.id === id ? { ...h, watched: !watched } : h)));
        toast({ text: ru.settings.errorSave });
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
    [hit.work.year, hit.work.creators[0], formatDuration(hit.work.durationMinutes)].filter(Boolean).join(' · ');

  return (
    <main className="tm-shell__main tm-search">
      <h1 className="tm-sr">{ru.search.title}</h1>
      <div className="tm-search__bar">
        <input ref={input} className="tm-search__input" type="search" value={query} inputMode="search"
               placeholder={ru.search.placeholder} aria-label={ru.search.placeholder}
               onChange={(e) => setQuery(e.target.value)} />
        {query ? (
          <Button variant="quiet" size="sm" onClick={() => { setQuery(''); input.current?.focus(); }}>
            {ru.actions.clear}
          </Button>
        ) : null}
      </div>

      <p className="tm-caption tm-search__hint">
        {query ? ru.search.hint : ru.search.watchedHint}
        {!query && hits?.length ? ` ${ru.search.watchedCount(hits.length)}` : null}
      </p>

      {!query && chips.length > 1 ? (
        <div className="tm-search__filters">
          <button type="button" className={cx('tm-voice__chip', !reg && 'tm-voice__chip--on')}
                  onClick={() => { pick(); setReg(null); }}>{ru.search.filterAll}</button>
          {chips.map(([r, n]) => (
            <button key={r} type="button" className={cx('tm-voice__chip', reg === r && 'tm-voice__chip--on')}
                    onClick={() => { pick(); setReg(reg === r ? null : r); }}>
              {registers[r].name} <span className="tm-search__count">{n}</span>
            </button>
          ))}
        </div>
      ) : null}

      {failed ? <ErrorState title={ru.search.error} onRetry={() => setQuery(`${query}`)} /> : null}
      {!hits && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 106, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}
      {hits && !hits.length ? (
        <EmptyState title={query ? ru.search.empty : ru.search.watchedEmpty}
                    text={query ? ru.search.emptyText : ru.search.watchedEmptyText} />
      ) : null}
      {/* «не нашли» — не только у пустого списка: искали «Солярис», нашли не тот. Ссылка
          стоит под результатами, а не над ними: сначала список, потом жалоба на список */}
      {query && hits ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => { tap(); setAsking(true); }}>
            {ru.search.missing}
          </button>
        </p>
      ) : null}
      {/* список растёт не только по одному фильму: отсюда же виден вход в импорт */}
      {!query ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => navigate('/settings?import=1')}>
            {ru.search.importLink}
          </button>
        </p>
      ) : null}

      <ul className="tm-search__list">
        {shown.map((hit) => (
          <li key={hit.work.id} className="tm-search__item">
            <button type="button" className="tm-search__open" onClick={() => navigate(`/works/${hit.work.id}`)}>
              {/* кадр в строке — только картинка: название рядом, и повторять его внутри рамки
                  (как делает WorkCover) значит написать его дважды */}
              <span className="tm-search__thumb"
                    style={{ '--thumb-line': opVar(hit.work.primaryOperations?.[0]?.op ?? 'synthesis') } as CSSProperties}>
                {hit.work.stillUrl ?? hit.work.coverUrl
                  ? <img src={hit.work.stillUrl ?? hit.work.coverUrl} alt="" loading="lazy" decoding="async" />
                  : null}
              </span>
              <span className="tm-search__text">
                <span className="tm-search__name">{hit.work.title}</span>
                <span className="tm-search__meta">{meta(hit)}</span>
                {hit.work.originalTitle && hit.work.originalTitle !== hit.work.title
                  ? <span className="tm-search__orig">{hit.work.originalTitle}</span> : null}
              </span>
            </button>
            {/* «Смотрел» и «Смотрю» — одна над другой; «Смотрю» не для уже просмотренного. «Убрать» у
                просмотренного — тихая (28.09): белая рамка в каждой строке спорила с названиями */}
            <span className="tm-search__acts">
              <Button size="sm" variant={hit.watched ? 'quiet' : 'primary'} disabled={busy.includes(hit.work.id)}
                      onClick={() => apply(hit.work.id, !hit.watched)}>
                {hit.watched ? ru.search.unmark : ru.search.mark}
              </Button>
              {!hit.watched && !isSeries(hit.work) ? (
                <Button size="sm" variant="quiet" pressed={hit.watching} disabled={hit.watching || busy.includes(hit.work.id)}
                        onClick={() => watchingNow(hit.work.id)}>
                  {hit.work.type === 'book'
                    ? (hit.watching ? ru.feed.readingOn : ru.feed.readingMark)
                    : (hit.watching ? ru.feed.watchingOn : ru.feed.watchingMark)}
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      <SuggestSheet open={asking} onOpenChange={setAsking} kind="work" initial={query}
                    context={`поиск: ${query}`} />
    </main>
  );
}
