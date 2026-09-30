import { useRef, useState, type ReactNode } from 'react';
import type { WorkCard, ExternalAnalysis, SpoilerLevel, WatchOption } from '@/types/tmdf';
import { Material, Post, VoiceStrip, useVoices } from './WorkVoices';
import { monogram } from '@/lib/voices';
import { onExternalClick, pick } from '@/lib/telegram';
import { useSwipe } from '@/lib/swipe';
import { cx } from '@/lib/cx';
import ru from '@/i18n/ru';
import { readPlaces, readingHours } from '@/lib/reading';

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
  /** открыть сразу на материале этого автора — так приходят из ленты по логотипу канала.
   *  Штриховка спойлеров при этом работает как обычно: ради неё и идём в карточку, а не в ролик */
  voiceId?: string;
}

type Mode = 'reviews' | 'talk' | 'watch';
const MODES: Mode[] = ['reviews', 'talk', 'watch'];
/** на сколько пикселей протащить страницу, чтобы она сменилась */
const SWIPE = 64;

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
export function FilmTabs({ analyses, workTitle, spoilerLevel, watch = [], book, discussions, discussionsCount = 0, actions, corner, onWatch, voiceId }: FilmTabsProps) {
  const voices = useVoices(analyses, voiceId);
  // автор только с постами в Telegram — его материал на странице «Обсуждения», а не «Обзоры»
  const [mode, setMode] = useState<Mode>(() =>
    voiceId && !voices.watch.some((g) => g.voice.id === voiceId) && voices.talk.some((g) => g.voice.id === voiceId) ? 'talk' : 'reviews');
  const [cinemaAt, setCinemaAt] = useState(0);
  const cinema = watch[cinemaAt] ?? watch[0];
  const talkCount = voices.talk.length + discussionsCount;

  const switchTo = (m: Mode) => { if (m !== mode) { pick(); setMode(m); } };

  // Свайп по странице листает страницы, как переключатель внизу: влево — следующая, вправо —
  // предыдущая. Страница идёт за пальцем; у крайних — туго, давая понять, что дальше некуда.
  // Ленты авторов и кинотеатров в панели жест не трогает: они прокручиваются вбок сами.
  const pane = useRef<HTMLDivElement>(null);
  const at = MODES.indexOf(mode);
  const swipe = useSwipe({
    onMove(dx) {
      const el = pane.current;
      if (!el) return;
      const stuck = (dx > 0 && at === 0) || (dx < 0 && at === MODES.length - 1);
      el.style.transition = dx ? 'none' : '';
      el.style.transform = dx ? `translateX(${Math.round(dx * (stuck ? 0.2 : 0.5))}px)` : '';
    },
    onEnd(dx) {
      const el = pane.current;
      if (el) { el.style.transition = ''; el.style.transform = ''; }
      const next = at + (dx <= -SWIPE ? 1 : dx >= SWIPE ? -1 : 0);
      if (next !== at && MODES[next]) switchTo(MODES[next]);
    },
  });

  return (
    <div className="tm-film">
      <div ref={pane} className={cx('tm-film__pane', `tm-film__pane--${mode}`)} role="tabpanel" aria-label={ru.film[mode]}
           {...swipe}>
        {mode === 'reviews' ? (
          voices.picked ? (
            <section className="tm-stream__group">
              <Material key={voices.picked.voice.id} group={voices.picked} spoilerLevel={spoilerLevel} corner={corner} workTitle={workTitle} />
            </section>
          ) : (
            <section className={cx('tm-stream__group', 'tm-voice__none', corner != null && 'tm-voice__none--corner')}>
              <div className="tm-voice__textmain">
                <p className="tm-body-sm">{ru.voices.nobody}</p>
                <p className="tm-caption tm-voice__nonehint">{ru.film.reviewsNoneHint}</p>
              </div>
              {corner ? <div className="tm-voice__corner">{corner}</div> : null}
            </section>
          )
        ) : mode === 'talk' ? (
          <>
            {voices.talk.length ? (
              <section className="tm-stream__group">
                {voices.talk.map((g) => <Post key={g.voice.id} group={g} workTitle={workTitle} />)}
              </section>
            ) : null}
            {!talkCount ? (
              <section className="tm-stream__group tm-voice__none">
                <p className="tm-body-sm">{ru.film.talkNone}</p>
              </section>
            ) : null}
            {discussions}
          </>
        ) : book ? (
          <section className="tm-stream__group tm-voice__none">
            {readingHours(book.pages) ? <p className="tm-caption">{ru.film.readHours(readingHours(book.pages)!, book.pages!)}</p> : null}
            <p className="tm-body-sm">{ru.film.readHonest}</p>
            <p className="tm-voice__outlets tm-work__people">
              {readPlaces(book).map((p) => (
                <a key={p.url} className="tm-voice__chip" href={p.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(p.url)}>
                  {p.kind === 'search' ? ru.film.readSearch(p.title) : p.title}
                </a>
              ))}
            </p>
          </section>
        ) : cinema ? (
          <section className="tm-stream__group tm-film__cinema">
            <CinemaLogo option={cinema} size="xl" />
            <p className="tm-title-3 tm-film__cinemaname">{cinema.platform}</p>
            <a className="tm-btn tm-btn--primary" href={cinema.url} target="_blank" rel="noreferrer noopener"
               onClick={(e) => { onWatch?.(cinema); onExternalClick(cinema.url)(e); }}>
              {ru.film.watchOn(cinema.platform)}
            </a>
            {watch.length > 1 ? <p className="tm-caption tm-film__hint">{ru.film.watchHint(watch.length)}</p> : null}
          </section>
        ) : (
          <section className="tm-stream__group tm-voice__none">
            <p className="tm-body-sm">{ru.film.watchNone}</p>
            <p className="tm-caption tm-voice__nonehint">{ru.film.watchNoneHint}</p>
          </section>
        )}
        {actions}
      </div>

      {/* Нижняя панель: лента выбора и переключатель страниц. Липнет к низу карточки — до неё
          не нужно докручивать, как до строки авторов раньше. */}
      <div className="tm-film__dock">
        {mode === 'reviews' && voices.watch.length ? (
          <VoiceStrip groups={voices.watch} pickedId={voices.picked?.voice.id} onPick={voices.setPicked} />
        ) : null}
        {mode === 'watch' && watch.length ? (
          <div className="tm-voice__strip" role="tablist" aria-label={ru.film.watch}>
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
        <div className="tm-film__toggle" role="tablist" aria-label={ru.film.pages}>
          {MODES.map((m) => {
            const count = m === 'reviews' ? voices.watch.length : m === 'talk' ? talkCount : watch.length;
            return (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                      className={cx('tm-film__switch', mode === m && 'tm-film__switch--on')} onClick={() => switchTo(m)}>
                {m === 'watch' && book ? ru.film.read : ru.film[m]}
                {count && !(m === 'watch' && book) ? <span className="tm-film__count">{count}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
