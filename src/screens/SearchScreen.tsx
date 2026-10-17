import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { FeedKind, ID, Register } from '@/types/tmdf';
import { coldStartLeft, getMoodSlate, notWatched, searchCharacters, searchWorks, setWatched, startWork, type MoodSlate, type SearchHit } from '@/api';
import { loadSettings } from '@/lib/settingsStore';
import { Button, EmptyState, ErrorState, FilterMenu, KindFilter, Skeleton, SuggestSheet, useToast } from '@/components';
import { formatDuration, titleOf } from '@/lib/format';
import { registers } from '@/lib/registers';
import { tap } from '@/lib/telegram';
import { leadName } from '@/lib/credits';
import { WorkThumb } from '@/components/WorkThumb';
import ui, { language } from '@/i18n';
import { isSeries } from '@/lib/media';
import { useDiary } from '@/lib/settingsStore';
import { useFeature } from '@/lib/flags';
import { WorkCardSheet } from './WorkCardSheet';

const DEBOUNCE = 250;
/** поиск по описанию — реже: каждый запрос словами пишется в замер (mood_query), набор по букве — не запрос */
const MOOD_DEBOUNCE = 700;
/** сколько найденного по описанию показывать */
const MOOD_SHOWN = 6;

/** Поиск (/search): найти фильм и сказать, что видел его, — или снять отметку.
 *  Пустой запрос показывает то, что уже отмечено: это и список, и способ его почистить.
 *  Отметка работает сразу — отмеченное перестаёт приходить в ленту, а вкус по регистру
 *  пересчитывается вместе с ним. Бэкенда нет, правка живёт в памяти вкладки. */
export function SearchScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const diary = useDiary();
  // «Искать по названию» из запроса словами в ленте (ДФ-12): текст приходит в адресе
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  // автофокус (17.10) — только когда пришли ввести (?focus=1): клавиатура Telegram закрывала «Отмеченное» и результаты
  const focusOnOpen = params.get('focus') === '1';
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [failed, setFailed] = useState(false);
  // «Повторить» (ТВ-9): тот же запрос строкой не перезапускал поиск — React не видит перемены
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<ID[]>([]);
  // фильтр живёт только в «моём списке» (пустой запрос): в результатах поиска фильтровать
  // нечего — там и так то, что человек назвал
  const [reg, setReg] = useState<Register | null>(null);
  // кино или книги в своём списке (11.10) — как в архиве, за флагом книг
  const booksOn = useFeature('readShelf');
  const [kind, setKind] = useState<FeedKind | null>(null);
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

  useEffect(() => { if (focusOnOpen) input.current?.focus(); }, [focusOnOpen]);

  // «Чего хочется» — в общем поиске (17.10, владелец: для человека это одно и то же): тот же запрос идёт и в подбор по
  // описанию (getMoodSlate, словарь src/lib/mood.ts — только русский). Понял запрос — раздел «По описанию»; не понял —
  // раздела нет, остаётся поиск по названию
  const [mood, setMood] = useState<MoodSlate | null>(null);
  const moodOn = useFeature('search') && language === 'ru';
  useEffect(() => {
    setMood(null);
    const q = query.trim();
    if (!moodOn || q.length < 3) return undefined;
    let alive = true;
    const timer = setTimeout(() => {
      loadSettings().then((st) => getMoodSlate(q, st.energy ?? 'normal'))
        .then((m) => alive && setMood(m.understood.length && m.items.length ? m : null))
        .catch(() => alive && setMood(null));
    }, MOOD_DEBOUNCE);
    return () => { alive = false; clearTimeout(timer); };
  }, [query, moodOn]);

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

  const isBook = (id: ID) => (hits?.find((h) => h.work.id === id)?.work ?? mood?.items.find((x) => x.work.id === id)?.work)?.type === 'book';
  const addedText = (id: ID) => (isBook(id) ? ui.search.addedBook : ui.search.added);
  // что ушло из списков по отметке — чтобы «Отменить» в тосте вернуло строку на место (17.10): «Убрать» осталось только
  // в карточке, и без возврата отменённое пропадало из «Отмеченного» до нового поиска
  const gone = useRef(new Map<ID, { hit?: { item: SearchHit; at: number }; mood?: { item: MoodSlate['items'][number]; at: number } }>());
  const apply = (id: ID, watched: boolean, undo = true) => {
    tap();
    setBusy((b) => [...b, id]);
    const back = undo ? undefined : gone.current.get(id);
    if (undo) {
      const at = !query && !watched ? (hits ?? []).findIndex((h) => h.work.id === id) : -1;
      const mat = watched ? mood?.items.findIndex((x) => x.work.id === id) ?? -1 : -1;
      gone.current.set(id, {
        ...(at >= 0 ? { hit: { item: hits![at], at } } : {}),
        ...(mat >= 0 ? { mood: { item: mood!.items[mat], at: mat } } : {}),
      });
    } else gone.current.delete(id);
    // список пустого запроса — это и есть просмотренное: снятое из него уходит
    setHits((prev) => {
      const list = [...(prev ?? [])];
      if (back?.hit && watched && !list.some((h) => h.work.id === id)) list.splice(back.hit.at, 0, back.hit.item);
      return list.map((h) => (h.work.id === id ? { ...h, watched } : h)).filter((h) => query || h.watched);
    });
    // отмеченное из найденного по описанию уходит из него — как кадр из ленты; отменили — возвращается
    if (watched) setMood((m) => (m ? { ...m, items: m.items.filter((x) => x.work.id !== id) } : m));
    else if (back?.mood) {
      const { item, at } = back.mood;
      setMood((m) => (m && !m.items.some((x) => x.work.id === id) ? { ...m, items: [...m.items.slice(0, at), item, ...m.items.slice(at)] } : m));
    }
    setWatched(id, watched)
      // пока первой ленты нет, «Смотрел» её не приближает — говорим это сразу (02.10)
      .then(() => (watched ? coldStartLeft() : 0))
      .then((left) => toast({
        text: watched ? (left ? `${addedText(id)} · ${ui.quick.notCounted(left)}` : addedText(id)) : isBook(id) ? ui.search.removedBook : ui.search.removed,
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
  const all = hits ?? [];
  const kindOf = (h: SearchHit): FeedKind => (h.work.type === 'book' ? 'book' : 'screen');
  const kindCounts = new Map<FeedKind, number>();
  if (!query) for (const h of all) kindCounts.set(kindOf(h), (kindCounts.get(kindOf(h)) ?? 0) + 1);
  const kindOn = booksOn && !query && kindCounts.size > 1;
  // регистры — внутри выбранного рода: число на кнопке — сколько она покажет
  const list = !query && kind ? all.filter((h) => kindOf(h) === kind) : all;
  const counts = new Map<Register, number>();
  if (!query) for (const h of list) for (const r of h.work.registers ?? []) counts.set(r, (counts.get(r) ?? 0) + 1);
  const chips = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const shown = !query && reg ? list.filter((h) => h.work.registers?.includes(reg)) : list;

  const moodSection = (
    <>
      {/* по описанию (17.10): то же поле — «тихое про семью»; кадры те же строки, «Смотрел» — как у найденного по названию */}
      {query && mood ? (
        <section className="tm-search__mood" aria-label={ui.search.byMood}>
          <h2 className="tm-label tm-search__moodh">{ui.search.byMood}</h2>
          <p className="tm-caption tm-search__hint">{ui.mood.understood} {mood.understood.join(' · ')}{mood.like ? ` ${ui.mood.likeFound(mood.like.title)}` : ''}</p>
          <ul className="tm-search__list">
            {mood.items.slice(0, MOOD_SHOWN).map((x) => (
              <li key={x.work.id} className="tm-search__item">
                <button type="button" className="tm-search__open" onClick={() => { tap(); setOpenId(x.work.id); }}>
                  <WorkThumb work={x.work} />
                  <span className="tm-search__text">
                    <span className="tm-search__name">{titleOf(x.work)}</span>
                    <span className="tm-search__meta">{[x.work.year, leadName(x.work), formatDuration(x.work.durationMinutes)].filter(Boolean).join(' · ')}</span>
                  </span>
                </button>
                {/* «Смотрел» справа (17.10) — как у найденного по названию */}
                <span className="tm-search__acts">
                  <Button size="sm" variant="primary" disabled={busy.includes(x.work.id)} onClick={() => apply(x.work.id, true)}>
                    {x.work.type === 'book' ? ui.search.markRead : ui.search.mark}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );

  const meta = (hit: SearchHit) =>
    [hit.work.year, leadName(hit.work), formatDuration(hit.work.durationMinutes)].filter(Boolean).join(' · ');

  return (
    <main className="tm-shell__main tm-search">
      <h1 className="tm-sr">{ui.search.title}</h1>
      <div className="tm-search__bar">
        <input ref={input} className="tm-search__input" type="search" value={query} inputMode="search"
               placeholder={ui.search.placeholder} aria-label={ui.search.placeholder}
               onChange={(e) => setQuery(e.target.value)} />
        {/* одна очистка (17.10): своя ✕, системная у type=search спрятана в app.css */}
        {query ? (
          <button type="button" className="tm-search__clear" aria-label={ui.actions.clear}
                  onClick={() => { setQuery(''); input.current?.focus(); }}>✕</button>
        ) : null}
      </div>

      {/* подсказки в 3 строки нет (17.10): плейсхолдер уже говорит «название или чего хочется». У отмеченного — счёт слева,
          фильтры справа: род тогглом, регистр — «Фильтр ▾» с листом вместо двух рядов чипов */}
      {!query && hits?.length ? (
        <div className="tm-fbar">
          <p className="tm-caption tm-fbar__what">{ui.search.watchedCount(hits.length)}</p>
          {kindOn ? <KindFilter value={kind} onChange={(k) => { setKind(k); setReg(null); }} /> : null}
          {chips.length > 1 ? (
            <FilterMenu<Register> label={reg ? registers[reg].name : ui.search.filter} title={ui.search.filterTitle}
                        value={reg} onChange={setReg}
                        options={[{ key: null, label: ui.search.filterAll, count: list.length },
                                  ...chips.map(([r, n]) => ({ key: r, label: registers[r].name, count: n }))]} />
          ) : null}
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
          <span className="tm-sr">{ui.actions.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 106, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}
      {hits && !hits.length && !(query && mood) ? (
        <EmptyState title={query ? ui.search.empty : ui.search.watchedEmpty}
                    text={query ? ui.search.emptyText : ui.search.watchedEmptyText} />
      ) : null}
      {/* список растёт не только по одному фильму: отсюда же виден вход в импорт */}
      {!query ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => navigate('/settings?import=1')}>
            {ui.search.importLink}
          </button>
        </p>
      ) : null}

      {hits && !shown.length ? moodSection : null}
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
            {/* в «Отмеченном» (пустой запрос) кнопок в строке нет (17.10): «Убрать» в каждой строке — лишнее, оно в карточке,
                с «Отменить» в тосте */}
            {query ? <span className="tm-search__acts">
              <Button size="sm" variant={hit.watched ? 'quiet' : 'primary'} disabled={busy.includes(hit.work.id)}
                      onClick={() => apply(hit.work.id, !hit.watched)}>
                {hit.watched ? ui.search.unmark : hit.work.type === 'book' ? ui.search.markRead : ui.search.mark}
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
            </span> : null}
          </li>
        ))}
      </ul>

      {shown.length ? moodSection : null}

      {/* «не нашли» — не только у пустого списка: искали «Солярис», нашли не тот. Ссылка
          стоит под результатами и «По описанию» (17.10): сначала списки, потом жалоба на них */}
      {query && hits ? (
        <p className="tm-caption tm-search__hint">
          <button type="button" className="tm-search__link" onClick={() => { tap(); setAsking(true); }}>
            {booksOn ? ui.search.missingBooks : ui.search.missing}
          </button>
        </p>
      ) : null}

      {(() => {
        // карточка — и найденного по названию, и по описанию (у второго «Смотрел» — по общему списку отметок)
        const moodHit = openId && !list.some((h) => h.work.id === openId) ? mood?.items.find((x) => x.work.id === openId) : undefined;
        const open = openId ? list.find((h) => h.work.id === openId) ?? (moodHit ? { work: moodHit.work, watched: false } : undefined) : undefined;
        return (
          <WorkCardSheet work={open?.work ?? null} onClose={() => setOpenId(null)} seen={open?.watched}
                         tag={open?.watched ? ui.card.seen : open?.watching ? (open.work.type === 'book' ? ui.feed.readingOn : ui.feed.watchingOn) : undefined}
                         context={query ? `поиск: ${query}` : 'просмотренное'}
                         corner={open ? (
                           <>
                             <Button size="sm" variant={open.watched ? 'quiet' : 'primary'} disabled={busy.includes(open.work.id)}
                                     onClick={() => apply(open.work.id, !open.watched)}>
                               {open.watched ? ui.search.unmark : open.work.type === 'book' ? ui.search.markRead : ui.search.mark}
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
