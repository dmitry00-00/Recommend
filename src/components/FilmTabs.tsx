import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { WorkCard, ExternalAnalysis, ID, SpoilerLevel, WatchOption } from '@/types/tmdf';
import { LensShelf, Material, OpinionRow, Post, SinTiles, VoiceStrip, useLensShelf, useVoices } from './WorkVoices';
import { OpenContext } from '@/lib/openContext';
import { groupByVoice, monogram } from '@/lib/voices';
import { onExternalClick, openExternal, pick, showMainButton } from '@/lib/telegram';
import { cx } from '@/lib/cx';
import { imageSrc, useImageRetry } from '@/lib/images';
import ui, { language } from '@/i18n';
import { readPlaces, readingHours } from '@/lib/reading';
import { getFreeRead, noteCard, noteWatch, type FreeRead } from '@/api';
import { useDepthCard, useFeature } from '@/lib/flags';
import { byZone, ZONES, type Zone } from '@/lib/depth';
import { LENSES, inLens } from '@/lib/lenses';
import type { MaterialLens } from '@/types/tmdf';
import { useSettings } from '@/lib/settingsStore';
import { cinemaSlug } from '@/lib/cinemas';

export interface FilmTabsProps {
  analyses: ExternalAnalysis[];
  /** название фильма: значки площадок у автора ведут на поиск фильма у него, если разбора нет */
  workTitle?: string;
  /** допустимый уровень спойлеров: материал выше него закрыт штриховкой */
  spoilerLevel?: SpoilerLevel;
  watch?: WatchOption[];
  /** книга (З5): вместо площадок — честное «где читать»: страница Open Library и поиск по сервисам */
  book?: Pick<WorkCard, 'id' | 'type' | 'title' | 'originalTitle' | 'creators' | 'externalIds' | 'pages'>;
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
  /** человек видел произведение: карточка по глубине открывается на разборах, а не на мнениях */
  seen?: boolean;
}

type Mode = 'reviews' | 'talk' | 'watch' | Zone;
const isZone = (m: Mode): m is Zone => (ZONES as Mode[]).includes(m);
/** подполки разборов — рубрики без мнений, грехов и «другого»: у тех своя зона или своей полки нет */
const DEEP_LENSES: MaterialLens[] = LENSES.filter((l) => l !== 'opinion' && l !== 'sins' && l !== 'other');
const MODES: Mode[] = ['reviews', 'talk', 'watch'];

/** Логотип площадки: как аватар автора, чтобы две ленты в нижней панели читались одинаково. */
function CinemaLogo({ option, size }: { option: WatchOption; size: 'lg' | 'xl' }) {
  const { letter, hue } = monogram(option.platform);
  const img = useImageRetry(option.logoUrl ? imageSrc(option.logoUrl) : undefined);
  return (
    <span className={cx('tm-voice__avatar', size === 'lg' ? 'tm-voice__avatar--lg' : 'tm-voice__avatar--page', 'tm-film__logo')}
          aria-hidden="true" style={img.src ? undefined : { background: `hsl(${hue} 35% 30%)` }}>
      {img.src ? <img ref={img.ref} className="tm-voice__img" src={img.src} alt="" loading="lazy" onError={img.onError} /> : letter}
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
export function FilmTabs({ analyses, workTitle, spoilerLevel, watch: watchIn = [], book, discussions, discussionsCount = 0, actions, corner, onWatch, voiceId, loading, workId, seen }: FilmTabsProps) {
  // полки рубрик (ТВ-3г) — за флагом; выключен — `shown` это те же `analyses`, обзоров нет
  const shelf = useLensShelf(analyses);
  const voices = useVoices(shelf.shown, voiceId, { reviews: shelf.on });
  // счётчик на «Разборах» — по всем полкам: выбор полки не должен менять число на вкладке
  const reviewsCount = useMemo(() => groupByVoice(analyses, { reviews: shelf.on }).filter((g) => g.items.some((a) => a.platform !== 'telegram')).length,
    [analyses, shelf.on]);
  // карточка по глубине (15.10, src/lib/depth.ts): мнения, грехи и разборы — тремя зонами; обзоры видны (у них зона)
  const depth = useDepthCard();
  const zones = useMemo(() => byZone(analyses), [analyses]);
  const vOp = useVoices(zones.opinions, voiceId, { reviews: true });
  const vSins = useVoices(zones.sins, voiceId, { reviews: true });
  const [deepLens, setDeepLens] = useState<MaterialLens | null>(null);
  const deepLenses = useMemo(() => DEEP_LENSES.filter((l) => zones.deep.some((a) => inLens(a, l))), [zones.deep]);
  const deepShown = useMemo(() => (deepLens && deepLenses.includes(deepLens) ? zones.deep.filter((a) => inLens(a, deepLens)) : zones.deep), [zones.deep, deepLens, deepLenses]);
  const vDeep = useVoices(deepShown, voiceId, { reviews: true });
  const zoneCount: Record<Zone, number> = useMemo(() => ({
    opinions: groupByVoice(zones.opinions, { reviews: true }).length,
    sins: groupByVoice(zones.sins, { reviews: true }).length,
    deep: groupByVoice(zones.deep, { reviews: true }).length,
  }), [zones]);
  // где открыться: пришли по логотипу канала — у его материала; видел — разборы; не видел — мнения
  const startZone = (): Zone => {
    const own = voiceId ? ZONES.find((z) => [vOp, vSins, vDeep][ZONES.indexOf(z)].watch.concat(z === 'opinions' ? vOp.talk : []).some((g) => g.voice.id === voiceId)) : undefined;
    if (own) return own;
    const order: Zone[] = seen ? ['deep', 'sins', 'opinions'] : ['opinions', 'deep', 'sins'];
    return order.find((z) => zoneCount[z] > 0) ?? 'opinions';
  };
  // автор только с постами в Telegram — его материал на странице «Обсуждения», а не «Обзоры»
  const [modeRaw, setMode] = useState<Mode>(() =>
    voiceId && !voices.watch.some((g) => g.voice.id === voiceId) && voices.talk.some((g) => g.voice.id === voiceId) ? 'talk' : 'reviews');
  // флаг узнаём после загрузки настроек — режим приводим к той карточке, что видна
  const mode: Mode = depth ? (isZone(modeRaw) || modeRaw === 'watch' ? modeRaw : startZone()) : (isZone(modeRaw) ? 'reviews' : modeRaw);
  // «Смотреть» — функция эталона (10.10): в минимальной редакции карточка — только разборы и обсуждения
  // бесплатная классика (ЗП-43): вкладка «Смотреть» открыта и без функции «Смотреть», если фильм выложен правообладателем
  const freeOn = useFeature('freeClassics');
  // книга (11.10): текст в общественном достоянии — Викитека, Gutenberg; вкладку «Читать» открывает так же
  const [freeRead, setFreeRead] = useState<FreeRead[]>([]);
  useEffect(() => {
    let alive = true;
    setFreeRead([]);
    if (book && freeOn) getFreeRead(book).then((x) => alive && setFreeRead(x)).catch(() => undefined);
    return () => { alive = false; };
  }, [book?.id, freeOn]); // eslint-disable-line react-hooks/exhaustive-deps
  const watchOn = useFeature('watch') || (freeOn && (watchIn.some((o) => o.source === 'wikidata') || freeRead.length > 0));
  const baseModes: Mode[] = depth ? [...ZONES.filter((z) => zoneCount[z] > 0 || z === mode), 'watch'] : MODES;
  const modes = (watchOn ? baseModes : baseModes.filter((m) => m !== 'watch'));
  if (depth && !modes.some(isZone)) modes.unshift('opinions');
  // мои подписки (ЗП-42): площадка из подписки человека — первой, потом бесплатные, аренда и покупка — в конце
  const subsOn = useFeature('subscriptions');
  const subs = useSettings()?.subscriptions;
  const yours = (o: WatchOption) => subsOn && o.kind === 'subscription' && (subs ?? []).includes(cinemaSlug(o.platform));
  const watch = useMemo(() => {
    if (!subsOn) return watchIn;   // бесплатное от правообладателя и так первым (api, withWatch)
    const rank = (o: WatchOption) => (o.source === 'wikidata' ? -1 : yours(o) ? 0 : o.kind === 'free' || o.kind === 'ads' ? 1 : o.kind === 'subscription' ? 2 : !o.kind ? 3 : o.kind === 'rent' ? 4 : 5);
    return [...watchIn].sort((a, b) => rank(a) - rank(b));
  }, [watchIn, subsOn, subs]); // eslint-disable-line react-hooks/exhaustive-deps
  const [cinemaAt, setCinemaAt] = useState(0);
  const cinema = watch[cinemaAt] ?? watch[0];
  // карточка открыта — знаменатель воронки (ЗП-3); «Смотреть» — её числитель
  useEffect(() => { if (workId) noteCard(workId); }, [workId]);
  const goWatch = (option: WatchOption) => { noteWatch(workId, option.platform); onWatch?.(option); };
  // «Смотреть в …» — главной кнопкой Telegram, пока открыта карточка (ТВ-11): главное
  // действие внизу, под пальцем. У книги кнопки нет — там «где читать» несколько равных мест
  useEffect(() => (watchOn && cinema && !book
    ? showMainButton(cinema.source === 'wikidata' ? ui.film.watchFree(cinema.platform) : ui.film.watchOn(cinema.platform), () => { goWatch(cinema); openExternal(cinema.url); })
    : undefined), [watchOn, cinema?.url, cinema?.platform, Boolean(book)]); // eslint-disable-line react-hooks/exhaustive-deps
  const talkCount = voices.talk.length + discussionsCount;

  const switchTo = (m: Mode) => { if (m !== mode) { pick(); setMode(m); } };

  // Страницы переключаются только касанием (06.10, решение владельца): свайп вбок по открытой
  // карточке целиком возвращает в ленту (WorkSheet), и двух жестов на одной оси быть не должно.

  return (
    <OpenContext.Provider value={{ place: 'sheet', workId, shelf: shelf.lens ?? undefined, shelves: shelf.on }}>
    <div className="tm-film">
      <div className={cx('tm-film__pane', `tm-film__pane--${mode}`, mode === 'deep' && 'tm-film__pane--reviews')} role="tabpanel"
           aria-label={isZone(mode) ? ui.depth.zones[mode] : ui.film[mode]}>
        {mode === 'opinions' ? (
          <>
            {vOp.watch.length ? (
              <section className="tm-stream__group tm-depth__list">
                {corner ? <div className="tm-depth__corner">{corner}</div> : null}
                {vOp.watch.map((g) => <OpinionRow key={g.voice.id} group={g} spoilerLevel={spoilerLevel} />)}
              </section>
            ) : null}
            {vOp.talk.length ? (
              <section className="tm-stream__group">
                {vOp.talk.map((g) => <Post key={g.voice.id} group={g} workTitle={workTitle} spoilerLevel={spoilerLevel} />)}
              </section>
            ) : null}
            {!vOp.watch.length && !vOp.talk.length ? (
              <section className={cx('tm-stream__group', 'tm-voice__none', corner != null && 'tm-voice__none--corner')}>
                <div className="tm-voice__textmain">
                  <p className="tm-body-sm" aria-busy={loading ? 'true' : undefined}>{loading ? ui.film.loading : ui.depth.none}</p>
                  {loading ? null : <p className="tm-caption tm-voice__nonehint">{ui.depth.noneHint}</p>}
                </div>
                {corner ? <div className="tm-voice__corner">{corner}</div> : null}
              </section>
            ) : null}
            {discussions}
          </>
        ) : mode === 'sins' ? (
          <section className="tm-stream__group">
            {seen ? null : <p className="tm-caption tm-depth__hint">{ui.depth.sinsHint}</p>}
            <SinTiles groups={vSins.watch} spoilerLevel={spoilerLevel} />
          </section>
        ) : mode === 'deep' ? (
          vDeep.picked ? (
            <section className="tm-stream__group">
              <Material key={`${deepLens}:${vDeep.picked.voice.id}`} group={vDeep.picked} spoilerLevel={spoilerLevel} corner={corner} workTitle={workTitle} />
            </section>
          ) : (
            <section className="tm-stream__group tm-voice__none">
              <p className="tm-body-sm">{ui.depth.none}</p>
            </section>
          )
        ) : mode === 'reviews' ? (
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
            {freeRead.length ? (
              <>
                {freeRead.map((f, i) => (
                  <a key={f.u} className={cx('tm-btn', i ? 'tm-btn--secondary' : 'tm-btn--primary', 'tm-film__readfree')} href={f.u} target="_blank" rel="noreferrer noopener"
                     onClick={(e) => { goWatch({ platform: f.n, url: f.u, source: 'wikidata', kind: 'free' }); onExternalClick(f.u)(e); }}>
                    {ui.film.readFree(f.n)}
                  </a>
                ))}
                <p className="tm-caption tm-film__hint">{ui.film.readFreeHint}</p>
              </>
            ) : null}
            <p className="tm-body-sm">{freeRead.length ? ui.film.readMore : ui.film.readHonest}</p>
            <p className="tm-voice__outlets tm-work__statslink">
              {readPlaces(book, language === 'ru' ? 'ru' : 'en').map((p) => (
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
            {cinema.kind ? <p className="tm-caption tm-film__kind">{yours(cinema) ? ui.film.watchYours : ui.film.watchKind[cinema.kind]}</p> : null}
            <a className="tm-btn tm-btn--primary" href={cinema.url} target="_blank" rel="noreferrer noopener"
               onClick={(e) => { goWatch(cinema); onExternalClick(cinema.url)(e); }}>
              {cinema.source === 'wikidata' ? ui.film.watchFree(cinema.platform) : ui.film.watchOn(cinema.platform)}
            </a>
            {watch.length > 1 ? <p className="tm-caption tm-film__hint">{ui.film.watchHint(watch.length)}</p> : null}
            {/* данные TMDb о кинотеатрах — это JustWatch: указывать у каждого произведения (условия TMDb, ЗП-24) */}
            {cinema.source === 'tmdb' ? <p className="tm-caption tm-film__hint">{ui.film.watchByJustWatch}</p> : null}
            {cinema.source === 'wikidata' ? <p className="tm-caption tm-film__hint">{ui.film.watchFreeHint}</p> : null}
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
        {mode === 'deep' && deepLenses.length > 1 ? <LensShelf lenses={deepLenses} value={deepLens} onPick={setDeepLens} /> : null}
        {mode === 'deep' && vDeep.watch.length ? (
          <VoiceStrip groups={vDeep.watch} pickedId={vDeep.picked?.voice.id} onPick={vDeep.setPicked} />
        ) : null}
        {mode === 'reviews' && voices.watch.length ? (
          <VoiceStrip groups={voices.watch} pickedId={voices.picked?.voice.id} onPick={voices.setPicked} />
        ) : null}
        {mode === 'watch' && watch.length ? (
          <div className="tm-voice__strip" role="tablist" aria-label={ui.film.watch}>
            {watch.map((w, i) => {
              const on = w === cinema;
              return (
                <button key={`${w.platform}:${i}`} type="button" role="tab" aria-selected={on}
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
          {modes.map((m) => {
            const count = isZone(m) ? zoneCount[m] : m === 'reviews' ? reviewsCount : m === 'talk' ? talkCount : watch.length;
            return (
              <button key={m} type="button" role="tab" aria-selected={mode === m}
                      className={cx('tm-film__switch', mode === m && 'tm-film__switch--on')} onClick={() => switchTo(m)}>
                {m === 'watch' && book ? ui.film.read : isZone(m) ? ui.depth.zones[m] : ui.film[m]}
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
