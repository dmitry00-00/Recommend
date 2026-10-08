import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { WorkCard, ExternalAnalysis, ID, SpoilerLevel, WatchOption } from '@/types/tmdf';
import { LensShelf, Material, Post, VoiceStrip, useLensShelf, useVoices } from './WorkVoices';
import { OpenContext } from '@/lib/openContext';
import { groupByVoice, monogram } from '@/lib/voices';
import { onExternalClick, openExternal, pick, showMainButton } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import ui from '@/i18n';
import { readPlaces, readingHours } from '@/lib/reading';
import { noteCard, noteWatch } from '@/api';

export interface FilmTabsProps {
  analyses: ExternalAnalysis[];
  /** название фильма: значки площадок у автора ведут на поиск фильма у него, если разбора нет */
  workTitle?: string;
  /** допустимый уровень спойлеров: материал выше него закрыт штриховкой */
  spoilerLevel?: SpoilerLevel;
  watch?: WatchOption[];
  /** книга (З5): вместо площадок — честное «где читать»: страница Open Library и поиск по сервисам */
  book?: Pick<WorkCard, 'title' | 'creators' | 'externalIds' | 'pages'>;
  /** что ещё показать в обсуждениях: каналы и чаты, строка поиска по авторам */
  discussions?: ReactNode;
  /** сколько мест разговора в `discussions` — для счётчика на переключателе */
  discussionsCount?: number;
  /** под материалом (например, выбор причины «не сейчас») */
  actions?: ReactNode;
  /** действия с фильмом («в планы», «не сейчас») — в правом углу текста под кадром материала
   *  на странице «Обзоры»; нет материала — справа в строке «никто не говорил» */
  corner?: ReactNode;
  /** переход в онлайн-кинотеатр — признак, что человек, вероятно, сейчас будет смотреть;
   *  экран отмечает это за него (вместо кнопки «Начать смотреть») и потом переспросит */
  onWatch?: (option: WatchOption) => void;
  /** разборы и места разговора ещё грузятся (шторка поиска спрашивает их при открытии): вместо
   *  «никто не говорил» — «загружаем», иначе пустота врёт первые полсекунды (ТВ-9) */
  loading?: boolean;
  /** открыть сразу на материале этого автора — так приходят из ленты по логотипу канала.
   *  Штриховка спойлеров при этом работает как обычно: ради неё и идём в карточку, а не в ролик */
  voiceId?: string;
  /** произведение — в событие открытия материала (ТВ-3г) */
  workId?: ID;
}

type Mode = 'reviews' | 'talk' | 'watch';
const MODES: Mode[] = ['reviews', 'talk', 'watch'];

/** Логотип площадки: как аватар автора, чтобы две ленты в нижней панели читались одинаково. */
function CinemaLogo({ option, size }: { option: WatchOption; size: 'lg' | 'xl' }) {
  const { letter, hue } = monogram(option.platform);
  return (
    <span className={cx('tm-voice__avatar', size === 'lg' ? 'tm-voice__avatar--lg' : 'tm-voice__avatar--page', 'tm-film__logo')}
          aria-hidden="true" style={option.logoUrl ? undefined : { background: `hsl(${hue} 35% 30%)` }}>
      {option.logoUrl ? <img className="tm-voice__img" src={option.logoUrl} alt="" loading="lazy" /> : letter}
    </span>
  );
}

/** Карточка фильма в ленте и в архиве: три вложенные страницы — «Обзоры», «Обсуждения» и
 *  «Смотреть» (Обсуждения вынесены отдельно 24.09: блок Telegram не зависит от выбранного
 *  автора, съедал место и тянул прокрутку; «Обзоры» теперь статичны, без прокрутки) — и
 *  нижняя панель. В панели лента выбора (авторы или онлайн-кинотеатры, одной вёрсткой) и
 *  переключатель страниц. Над панелью — то, что выбрано: материал автора или площадка с
 *  кнопкой перехода. Решение владельца 23.09: преамбула из карточки убрана, авторы — вниз,
 *  «где посмотреть» — отдельной страницей. */
export function FilmTabs({ analyses, workTitle, spoilerLevel, watch = [], book, discussions, discussionsCount = 0, actions, corner, onWatch, voiceId, loading, workId }: FilmTabsProps) {
  // полки рубрик (ТВ-3г) — за флагом; выключен — `shown` это те же `analyses`, обзоров нет
  const shelf = useLensShelf(analyses);
  const voices = useVoices(shelf.shown, voiceId, { reviews: shelf.on });
  // счётчик на «Разборах» — по всем полкам: выбор полки не должен менять число на вкладке
  const reviewsCount = useMemo(() => groupByVoice(analyses, { reviews: shelf.on }).filter((g) => g.items.some((a) => a.platform !== 'telegram')).length,
    [analyses, shelf.on]);
  // автор только с постами в Telegram — его материал на странице «Обсуждения», а не «Обзоры»
  const [mode, setMode] = useState<Mode>(() =>
    voiceId && !voices.watch.some((g) => g.voice.id === voiceId) && voices.talk.some((g) => g.voice.id === voiceId) ? 'talk' : 'reviews');
  const [cinemaAt, setCinemaAt] = useState(0);
  const cinema = watch[cinemaAt] ?? watch[0];
  // карточка открыта — знаменатель воронки (ЗП-3); «Смотреть» — её числитель
  useEffect(() => { if (workId) noteCard(workId); }, [workId]);
  const goWatch = (option: WatchOption) => { noteWatch(workId, option.platform); onWatch?.(option); };
  // «Смотреть в …» — главной кнопкой Telegram, пока открыта карточка (ТВ-11): главное
  // действие внизу, под пальцем. У книги кнопки нет — там «где читать» несколько равных мест
  useEffect(() => (cinema && !book
    ? showMainButton(ui.film.watchOn(cinema.platform), () => { goWatch(cinema); openExternal(cinema.url); })
    : undefined), [cinema?.url, cinema?.platform, Boolean(book)]); // eslint-disable-line react-hooks/exhaustive-deps
  const talkCount = voices.talk.length + discussionsCount;

  const switchTo = (m: Mode) => { if (m !== mode) { pick(); setMode(m); } };

  // Страницы переключаются только касанием (06.10, решение владельца): свайп вбок по открытой
  // карточке целиком возвращает в ленту (WorkSheet), и двух жестов на одной оси быть не должно.

  return (
    <OpenContext.Provider value={{ place: 'sheet', workId, shelf: shelf.lens ?? undefined, shelves: shelf.on }}>
    <div className="tm-film">
      <div className={cx('tm-film__pane', `tm-film__pane--${mode}`)} role="tabpanel" aria-label={ui.film[mode]}>
        {mode === 'reviews' ? (
          voices.picked ? (
            <section className="tm-stream__group">
              <Material key={`${shelf.lens}:${voices.picked.voice.id}`} group={voices.picked} spoilerLevel={spoilerLevel} corner={corner} workTitle={workTitle} />
            </section>
          ) : (
            <section className={cx('tm-stream__group', 'tm-voice__none', corner != null && 'tm-voice__none--corner')}>
              <div className="tm-voice__textmain">
                {loading ? <p className="tm-body-sm" aria-busy="true">{ui.film.loading}</p> : (
                  <>
                    <p className="tm-body-sm">{ui.voices.nobody}</p>
                    <p className="tm-caption tm-voice__nonehint">{ui.film.reviewsNoneHint}</p>
                  </>
                )}
              </div>
              {corner ? <div className="tm-voice__corner">{corner}</div> : null}
            </section>
          )
        ) : mode === 'talk' ? (
          <>
            {voices.talk.length ? (
              <section className="tm-stream__group">
                {voices.talk.map((g) => <Post key={g.voice.id} group={g} workTitle={workTitle} spoilerLevel={spoilerLevel} />)}
              </section>
            ) : null}
            {!talkCount ? (
              <section className="tm-stream__group tm-voice__none">
                <p className="tm-body-sm" aria-busy={loading ? 'true' : undefined}>{loading ? ui.film.loading : ui.film.talkNone}</p>
              </section>
            ) : null}
            {discussions}
          </>
        ) : book ? (
          <section className="tm-stream__group tm-voice__none">
            {readingHours(book.pages) ? <p className="tm-caption">{ui.film.readHours(readingHours(book.pages)!, book.pages!)}</p> : null}
            <p className="tm-body-sm">{ui.film.readHonest}</p>
            <p className="tm-voice__outlets tm-work__statslink">
              {readPlaces(book).map((p) => (
                <a key={p.url} className="tm-voice__chip" href={p.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(p.url)}>
                  {p.kind === 'search' ? ui.film.readSearch(p.title) : p.title}
                </a>
              ))}
            </p>
          </section>
        ) : cinema ? (
          <section className="tm-stream__group tm-film__cinema">
            <CinemaLogo option={cinema} size="xl" />
            <p className="tm-title-3 tm-film__cinemaname">{cinema.platform}</p>
            <a className="tm-btn tm-btn--primary" href={cinema.url} target="_blank" rel="noreferrer noopener"
               onClick={(e) => { goWatch(cinema); onExternalClick(cinema.url)(e); }}>
              {ui.film.watchOn(cinema.platform)}
            </a>
            {watch.length > 1 ? <p className="tm-caption tm-film__hint">{ui.film.watchHint(watch.length)}</p> : null}
            {/* данные TMDb о кинотеатрах — это JustWatch: указывать у каждого произведения (условия TMDb, ЗП-24) */}
            {cinema.source === 'tmdb' ? <p className="tm-caption tm-film__hint">{ui.film.watchByJustWatch}</p> : null}
          </section>
        ) : (
          <section className="tm-stream__group tm-voice__none">
            <p className="tm-body-sm">{ui.film.watchNone}</p>
            <p className="tm-caption tm-voice__nonehint">{ui.film.watchNoneHint}</p>
          </section>
        )}
        {actions}
      </div>

      {/* Нижняя панель: лента выбора и переключатель страниц. Липнет к низу карточки — до неё
          не нужно докручивать, как до строки авторов раньше. */}
      <div className="tm-film__dock">
        {mode === 'reviews' ? <LensShelf lenses={shelf.lenses} value={shelf.lens} onPick={shelf.setLens} /> : null}
        {mode === 'reviews' && voices.watch.length ? (
          <VoiceStrip groups={voices.watch} pickedId={voices.picked?.voice.id} onPick={voices.setPicked} />
        ) : null}
        {mode === 'watch' && watch.length ? (
          <div className="tm-voice__strip" role="tablist" aria-label={ui.film.watch}>
            {watch.map((w, i) => {
              const on = w === cinema;
              return (
                <button key={w.url} type="button" role="tab" aria-selected={on}
                        className={cx('tm-voice__tab', on && 'tm-voice__tab--on')}
                        onClick={() => { pick(); setCinemaAt(i); }}>
                  <CinemaLogo option={w} size="lg" />
                  <span className="tm-voice__short">{w.platform}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="tm-film__toggle" role="tablist" aria-label={ui.film.pages}>
          {MODES.map((m) => {
            const count = m === 'reviews' ? reviewsCount : m === 'talk' ? talkCount : watch.length;
            return (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                      className={cx('tm-film__switch', mode === m && 'tm-film__switch--on')} onClick={() => switchTo(m)}>
                {m === 'watch' && book ? ui.film.read : ui.film[m]}
                {count && !(m === 'watch' && book) ? <span className="tm-film__count">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
    </OpenContext.Provider>
  );
}
