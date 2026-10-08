import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExternalAnalysis, ID, MaterialLens, SpoilerLevel, Voice, WorkVoice } from '@/types/tmdf';
import { creditOf, groupByVoice, knownVoice, monogram, outletUrl } from '@/lib/voices';
import { LENSES, inLens, youtubeId } from '@/lib/lenses';
import { useLensShelves } from '@/lib/flags';
import { OpenContext, useNoteOpen } from '@/lib/openContext';
import { onExternalClick, pick } from '@/lib/telegram';
import { formatDuration } from '@/lib/format';
import { cx } from '@/lib/cx';
import { SuggestSheet } from './SuggestSheet';
import { telegramComments } from '@/mocks/telegramComments';
import ui, { locale } from '@/i18n';

export interface WorkVoicesProps {
  analyses: ExternalAnalysis[];
  /** допустимый уровень спойлеров: материал выше него закрыт штриховкой */
  spoilerLevel?: SpoilerLevel;
  /** название фильма — уходит с заявкой «кто ещё разбирал»: без него заявка бесполезна */
  workTitle?: string;
  /** вид произведения — для строки «пока никто не говорил»: о книге, сериале, фильме */
  kind?: 'film' | 'series' | 'book';
  /** произведение — в событие открытия материала (ТВ-3г) */
  workId?: ID;
}

/** Аватар автора: картинка канала, а без неё — монограмма. Размер задаёт вёрстка, чтобы
 *  строка не меняла высоту от того, загрузилась картинка или нет. */
export function Avatar({ voice, size }: { voice: Voice; size: 'lg' | 'sm' }) {
  const { letter, hue } = monogram(voice.title);
  return (
    <span className={cx('tm-voice__avatar', `tm-voice__avatar--${size}`)} aria-hidden="true"
          style={voice.avatarUrl ? undefined : { background: `hsl(${hue} 35% 30%)` }}>
      {voice.avatarUrl ? <img className="tm-voice__img" src={voice.avatarUrl} alt="" loading="lazy" /> : letter}
    </span>
  );
}

const OUTLET = { youtube: ui.voices.outletYoutube, telegram: ui.voices.outletTelegram, chat: ui.voices.outletChat } as const;

/** Значки площадок вместо подписей (решение владельца 24.09): одноцветные, в цвет текста —
 *  узнаются по форме, а чужая палитра в нашу типографику не лезет. */
function OutletIcon({ kind }: { kind: 'youtube' | 'telegram' | 'chat' }) {
  if (kind === 'youtube') {
    return (
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
        <rect x="2" y="5" width="20" height="14" rx="4" fill="currentColor" />
        <path d="M10 9l5 3-5 3z" fill="var(--tm-color-surface-200)" />
      </svg>
    );
  }
  if (kind === 'telegram') {
    return (
      <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
        <path d="M21.5 4.2 2.9 11.4c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.6 3.4c.7.5 1.7.1 1.9-.7l3.1-14.9c.2-1-.8-1.8-2-1.3zM9.6 14.3l8.2-6.4-6.6 7.4-.3 3.1-1.3-4.1z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width={18} height={18} aria-hidden="true">
      <path d="M4 5h16v10H9l-5 4z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

/** Строка выходов автора: где его ещё читать и смотреть. Всегда на одном месте и в одну
 *  строку — даже когда выход один, иначе блок ниже прыгает при переключении автора. */
function Outlets({ voice, extra, items = [], workTitle }: { voice: Voice; extra?: React.ReactNode; items?: ExternalAnalysis[]; workTitle?: string }) {
  return (
    <p className="tm-voice__outlets">
      {knownVoice(voice.id) ? (
        <Link className="tm-voice__chip tm-voice__chip--own" to={`/voice/${voice.id}`}>{ui.voices.allWorks}</Link>
      ) : null}
      {voice.outlets.map((o) => {
        const url = outletUrl(o, items, workTitle);
        return (
          <a key={o.kind + o.url} className="tm-voice__chip tm-voice__chip--icon" href={url} target="_blank" rel="noreferrer noopener"
             aria-label={OUTLET[o.kind]} title={OUTLET[o.kind]} onClick={onExternalClick(url)}>
            <OutletIcon kind={o.kind} />
          </a>
        );
      })}
      {extra}
    </p>
  );
}

/** Материал автора об этом фильме: кадр в боксе постоянного размера, название ровно в две
 *  строки, мета — в одну. Переключение автора меняет только то, что внутри коробок. */
export function Material({ group, spoilerLevel, corner, workTitle }: { group: WorkVoice; spoilerLevel?: SpoilerLevel; corner?: React.ReactNode; workTitle?: string }) {
  const items = group.items.filter((a) => a.platform !== 'telegram');
  const a = items[0];
  const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
  const credit = creditOf(a, group.voice);
  const noteOpen = useNoteOpen();
  return (
    <div className="tm-voice__material">
      <a className={cx('tm-voice__frame', blocked && 'tm-voice__frame--blocked')}
         href={blocked ? undefined : a.url} target="_blank" rel="noreferrer noopener"
         aria-disabled={blocked ? 'true' : undefined}
         onClick={blocked ? (e) => e.preventDefault() : (e) => { noteOpen(a); onExternalClick(a.url)(e); }}>
        {a.previewUrl ? <img className="tm-voice__shot" src={a.previewUrl} alt="" loading="lazy" /> : null}
        {blocked ? <span className="tm-voice__hatch" aria-hidden="true" /> : <span className="tm-voice__play" aria-hidden="true" />}
        {/* замок — на самом кадре (28.09): в заголовке он читался как главное сообщение карточки */}
        {blocked ? <span className="tm-voice__lock">{ui.spoiler.lockedAnalysis}</span> : null}
        {a.durationMinutes ? <span className="tm-voice__time">{formatDuration(a.durationMinutes)}</span> : null}
      </a>
      {/* текст под кадром; справа в углу — действия с фильмом (24.09, по замечанию владельца) */}
      <div className="tm-voice__text">
      <div className="tm-voice__textmain">
      {/* название ролика само может выдать финал — вместо него автор */}
      <p className="tm-voice__name">{blocked ? group.voice.title : a.title}</p>
      <p className="tm-voice__meta">
        {[
          credit,
          ui.seriesPart(a.season, a.episode),
          a.tags?.length ? `#${a.tags[0]}` : undefined,
          a.language === 'ru' ? ui.lang.ru : ui.lang.en,
          a.spoilerLevel > 0 ? ui.spoilers.with : ui.spoilers.without,
          a.unverified ? ui.voices.unverified : a.evidence === 'model' ? ui.voices.byModel : undefined,
        ].filter(Boolean).join(' · ')}
      </p>
      <Outlets voice={group.voice} items={group.items} workTitle={workTitle} />
      </div>
      {corner ? <div className="tm-voice__corner">{corner}</div> : null}
      </div>
      {items.length > 1 ? <MoreByVoice items={items.slice(1)} spoilerLevel={spoilerLevel} /> : null}
    </div>
  );
}

/** Остальные ролики того же автора об этом произведении — лентой вбок (07.10, замечание владельца): раньше
 *  «ещё N у автора» листало их по одному, и у автора с 29 роликами о сериале это 28 нажатий вслепую. Теперь
 *  видны все сразу: кадр, длина, сезон и серия, заголовок в две строки; касание открывает ролик. Сериал — по
 *  сезонам и сериям, остальное — свежее первым. `data-noswipe`: жест закрытия карточки вбок ленту не трогает. */
function MoreByVoice({ items, spoilerLevel }: { items: ExternalAnalysis[]; spoilerLevel?: SpoilerLevel }) {
  const noteOpen = useNoteOpen();
  const ordered = useMemo(() => [...items].sort((x, y) =>
    (x.season ?? 99) - (y.season ?? 99) || (x.episode ?? 999) - (y.episode ?? 999) || (y.publishedAt ?? '').localeCompare(x.publishedAt ?? '')), [items]);
  return (
    <div className="tm-voice__more">
      <p className="tm-voice__morehead">{ui.voices.nextItem(items.length)}</p>
      <ul className="tm-voice__morelist" data-noswipe="">
        {ordered.map((m) => {
          const blocked = spoilerLevel != null && m.spoilerLevel > spoilerLevel;
          const part = ui.seriesPart(m.season, m.episode);
          return (
            <li key={m.id} className="tm-voice__moreitem">
              <a className={cx('tm-voice__morelink', blocked && 'tm-voice__morelink--blocked')} href={blocked ? undefined : m.url}
                 target="_blank" rel="noreferrer noopener" aria-disabled={blocked ? 'true' : undefined}
                 onClick={blocked ? (e) => e.preventDefault() : (e) => { noteOpen(m); onExternalClick(m.url)(e); }}>
                <span className="tm-voice__morethumb">
                  {m.previewUrl ? <img src={m.previewUrl} alt="" loading="lazy" /> : null}
                  {blocked ? <span className="tm-voice__hatch" aria-hidden="true" /> : null}
                  {m.durationMinutes ? <span className="tm-voice__time">{formatDuration(m.durationMinutes)}</span> : null}
                </span>
                <span className="tm-voice__moretitle">{part ? <b>{part} · </b> : null}{blocked ? ui.spoilers.with : m.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Канал поста и есть ли под постом ветка комментариев (tools/telegram-comments.mts): нет
 *  сведений о канале — кнопки нет, лучше промолчать, чем вести в пустоту. */
const commentsOn = (url: string): boolean => {
  const ch = /t\.me\/([\w]+)\/\d+/i.exec(url)?.[1]?.toLowerCase();
  return ch ? telegramComments[ch] === true : false;
};
const postDate = (a: ExternalAnalysis) => (a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }) : undefined);

/** Строка постов: канал, дата и начало поста. Текст обрезан до двух строк, чтобы длинный
 *  пост не растягивал список. «Ещё N постов» раскрывает остальные посты автора (ТВ-5а);
 *  «Комментарии» ведёт в Telegram к посту, под которым идёт разговор, — только у каналов с
 *  обсуждением (ТВ-5б). Спойлеры — как у роликов (ТВ-5в): пост может пересказать финал, поэтому
 *  до конца просмотра вместо текста — замок, и ни пост, ни комментарии не открываются. */
export function Post({ group, workTitle, spoilerLevel }: { group: WorkVoice; workTitle?: string; spoilerLevel?: SpoilerLevel }) {
  const posts = group.items.filter((a) => a.platform === 'telegram');
  const [open, setOpen] = useState(false);
  const noteOpen = useNoteOpen();
  const rest = posts.length - 1;
  const row = (a: ExternalAnalysis, first: boolean) => {
    const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
    const date = postDate(a);
    return (
      <div key={a.id} className={cx('tm-voice__postrow', !first && 'tm-voice__postrow--more')}>
        <a className={cx('tm-voice__postlink', blocked && 'tm-voice__postlink--blocked')} href={blocked ? undefined : a.url}
           target="_blank" rel="noreferrer noopener" aria-disabled={blocked ? 'true' : undefined}
           onClick={blocked ? (e) => e.preventDefault() : (e) => { noteOpen(a); onExternalClick(a.url)(e); }}>
          {first ? <Avatar voice={group.voice} size="sm" /> : <span className="tm-voice__postpad" aria-hidden="true" />}
          <span className="tm-voice__postbody">
            <span className="tm-voice__postwho">
              {first ? group.voice.title : null}
              {date ? <span className="tm-voice__postdate">{first ? ' · ' : ''}{date}</span> : null}
            </span>
            <span className="tm-voice__posttext">{blocked ? ui.spoiler.lockedPost : a.title}</span>
          </span>
        </a>
        {!blocked && commentsOn(a.url) ? (
          <a className="tm-voice__chip tm-voice__comments" href={a.url} target="_blank" rel="noreferrer noopener"
             onClick={onExternalClick(a.url)}>{ui.voices.comments}</a>
        ) : null}
      </div>
    );
  };
  return (
    <div className="tm-voice__post">
      {row(posts[0], true)}
      {open ? posts.slice(1).map((a) => row(a, false)) : null}
      <Outlets voice={group.voice} items={group.items} workTitle={workTitle} extra={rest > 0 ? (
        <button type="button" className="tm-voice__chip" aria-expanded={open ? 'true' : 'false'}
                onClick={() => { pick(); setOpen(!open); }}>
          {open ? ui.voices.lessPosts : ui.voices.morePosts(rest)}
        </button>
      ) : null} />
    </div>
  );
}

/** Разборы в карточке: сначала строка авторов (кто вообще разбирал этот фильм), под ней —
 *  один материал выбранного автора, ниже — посты в Telegram. Единица — автор, а не площадка:
 *  один и тот же человек ведёт канал на YouTube, канал в Telegram и чат при нём, и в
 *  карточке это одно лицо с выходами (решение владельца 23.09). Площадки (Кинопоиск, Okko,
 *  Wink, KION, viju) сюда не попадают: их посты — анонсы своих премьер. */
/** Авторы фильма: у кого есть материал (ролик, статья) и кто писал в Telegram, плюс выбранный
 *  автор. Вынесено, чтобы карточка в ленте могла поставить строку авторов в нижнюю панель,
 *  а материал — над ней (FilmTabs), не дублируя логику. */
export function useVoices(analyses: ExternalAnalysis[], initial?: string, opts: { reviews?: boolean } = {}) {
  const groups = useMemo(() => groupByVoice(analyses, opts), [analyses, opts.reviews]); // eslint-disable-line react-hooks/exhaustive-deps
  const watch = groups.filter((g) => g.items.some((a) => a.platform !== 'telegram'));
  const talk = groups.filter((g) => g.items.some((a) => a.platform === 'telegram'));
  const [pickedId, setPicked] = useState<string | null>(initial ?? null);
  const picked = watch.find((g) => g.voice.id === pickedId) ?? watch[0];
  return { watch, talk, picked, setPicked };
}

/** Полки рубрик (ТВ-3г, за флагом `lensShelves`): разборы делятся по тому, с какой стороны
 *  автор смотрит на фильм, — смысл, факты, грехи, книга и фильм… Обзоры с полками видны: у них
 *  теперь своё место, рубрика, и они не теснят эссе в общей куче (решение 06.10). Рубрики
 *  равноправны (ТВ-3в): порядок постоянный, без счётчиков и без «главной»; «Все» — сначала.
 *  Полка — фильтр роликов; посты Telegram живут на «Обсуждениях» и полками не делятся.
 *  Флаг выключен — ничего не меняется: ни полок, ни обзоров. */
export function useLensShelf(analyses: ExternalAnalysis[]) {
  const on = useLensShelves();
  const [lens, setLens] = useState<MaterialLens | null>(null);
  const present = useMemo(() => {
    if (!on) return [];
    const videos = analyses.filter((a) => a.platform !== 'telegram');
    return LENSES.filter((l) => videos.some((a) => inLens(a, l)));
  }, [on, analyses]);
  const current = lens && present.includes(lens) ? lens : null;
  const shown = useMemo(
    () => (current ? analyses.filter((a) => a.platform === 'telegram' || inLens(a, current)) : analyses),
    [analyses, current],
  );
  // полка одна — делить нечего: строку не показываем, но обзоры всё равно видны
  return { on, lenses: present.length > 1 ? present : [], lens: current, setLens, shown };
}

export function LensShelf({ lenses, value, onPick }: { lenses: MaterialLens[]; value: MaterialLens | null; onPick: (l: MaterialLens | null) => void }) {
  if (!lenses.length) return null;
  const chip = (l: MaterialLens | null) => (
    <button key={l ?? 'all'} type="button" role="tab" aria-selected={value === l}
            className={cx('tm-voice__chip', 'tm-lens__chip', value === l && 'tm-voice__chip--on')}
            onClick={() => { if (value !== l) { pick(); onPick(l); } }}>
      {l ? ui.lens.name[l] : ui.lens.all}
    </button>
  );
  return (
    <div className="tm-lens" role="tablist" aria-label={ui.lens.label}>
      {chip(null)}
      {lenses.map(chip)}
    </div>
  );
}

/** Строка аватаров авторов: выбор того, чей материал показан. */
export function VoiceStrip({ groups, pickedId, onPick }: { groups: WorkVoice[]; pickedId?: string; onPick: (id: string) => void }) {
  return (
    <div className="tm-voice__strip" role="tablist" aria-label={ui.voices.title}>
      {groups.map((g) => {
        const on = g.voice.id === pickedId;
        return (
          <button key={g.voice.id} type="button" role="tab" aria-selected={on}
                  className={cx('tm-voice__tab', on && 'tm-voice__tab--on')}
                  onClick={() => { pick(); onPick(g.voice.id); }}>
            <Avatar voice={g.voice} size="lg" />
            <span className="tm-voice__short">{g.voice.short}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Площадка ленты разборов. Смотрят — ролики (YouTube и VK: кадр, длительность); читают — всё
 *  остальное: посты Telegram, статьи, подкасты. Статьи у нас приходят из телеграм-каналов (id
 *  `tg-канал-…`), кадра и длительности у них нет, и в карточке они читаются как пост — отдельная
 *  вкладка ради одной-двух статей была бы пустой полкой (решение 06.10). */
type Feed = 'youtube' | 'telegram';
const feedOf = (a: ExternalAnalysis): Feed => (a.platform === 'youtube' || a.platform === 'vk' ? 'youtube' : 'telegram');
const FEEDS: Feed[] = ['youtube', 'telegram'];
/** сколько карточек в ленте сразу и сколько добавляет «Ещё» */
const PAGE = 10;

/** Материал ленты вместе с автором: карточке нужны имя и аватар канала. */
interface FeedItem { a: ExternalAnalysis; voice: Voice }

/** Лента из групп по авторам — по кругу: первый материал каждого автора, потом второй… Порядок
 *  авторов и материалов внутри — из groupByVoice (сначала подтверждённое, потом свежее). Подряд
 *  все ролики одного плодовитого канала заняли бы первые десять мест, а лента — про то, кто что
 *  сказал о фильме. */
function roundRobin(groups: WorkVoice[]): FeedItem[] {
  const out: FeedItem[] = [];
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  for (let k = 0; out.length < total; k += 1) {
    for (const g of groups) if (g.items[k]) out.push({ a: g.items[k], voice: g.voice });
  }
  return out;
}

/** Кадр ролика: своё превью, а без него — кадр YouTube по id ролика. */
const shotOf = (a: ExternalAnalysis): string | undefined => {
  if (a.previewUrl) return a.previewUrl;
  const id = a.platform === 'youtube' ? youtubeId(a.url) : undefined;
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : undefined;
};

/** Рубрика чипом — только с полками (ТВ-3г): без них рубрика живёт в данных и в замере. */
function LensMark({ a, on }: { a: ExternalAnalysis; on: boolean }) {
  return on && a.lens ? <span className="tm-vcard__lens">{ui.lens.name[a.lens]}</span> : null;
}

/** Ролик в ленте — как фильм в рекомендательной: кадр во всю ширину, снизу затемнение, на нём
 *  название и строка «канал · дата». Спойлерный до конца просмотра — штриховка и замок, вместо
 *  названия (оно само может выдать финал) — автор, и ролик не открывается. */
function FeedVideo({ item, spoilerLevel, shelves }: { item: FeedItem; spoilerLevel?: SpoilerLevel; shelves: boolean }) {
  const { a, voice } = item;
  const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
  const noteOpen = useNoteOpen();
  // картинка не загрузилась — тёмный кадр, а не значок битой ссылки (как у WorkBanner)
  const [broken, setBroken] = useState(false);
  const src = broken ? undefined : shotOf(a);
  // закрытый ролик вместо названия показывает автора — во второй строке его уже не повторяем
  const meta = [
    blocked ? undefined : creditOf(a, voice) ? `${voice.title} · ${creditOf(a, voice)}` : voice.title,
    postDate(a),
    ui.seriesPart(a.season, a.episode),
    a.language === 'en' ? ui.lang.en : undefined,
    a.spoilerLevel > 0 ? ui.spoilers.with : undefined,
    a.unverified ? ui.voices.unverified : a.evidence === 'model' ? ui.voices.byModel : undefined,
  ].filter(Boolean).join(' · ');
  return (
    <a className={cx('tm-vcard', 'tm-vcard--video', src && 'tm-vcard--image', blocked && 'tm-vcard--blocked')}
       href={blocked ? undefined : a.url} target="_blank" rel="noreferrer noopener" aria-disabled={blocked ? 'true' : undefined}
       onClick={blocked ? (e) => e.preventDefault() : (e) => { noteOpen(a); onExternalClick(a.url)(e); }}>
      {src ? <img className="tm-vcard__img" src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : null}
      {blocked ? <span className="tm-voice__hatch" aria-hidden="true" /> : null}
      <span className="tm-vcard__scrim" aria-hidden="true" />
      <span className="tm-vcard__top">
        <LensMark a={a} on={shelves} />
        {a.durationMinutes ? <span className="tm-vcard__time">{formatDuration(a.durationMinutes)}</span> : null}
      </span>
      {blocked ? <span className="tm-voice__lock">{ui.spoiler.lockedAnalysis}</span> : null}
      <span className="tm-vcard__text">
        <span className="tm-vcard__title">{blocked ? voice.title : a.title}</span>
        <span className="tm-vcard__meta">{meta}</span>
      </span>
    </a>
  );
}

/** Пост в ленте: канал и дата, ниже начало поста (или заголовок статьи) — до четырёх строк.
 *  Картинка — только если она у поста есть: пустой серый кадр под текстом только врал бы.
 *  «Комментарии» — у каналов с обсуждением (ТВ-5б); спойлерный пост закрыт целиком (ТВ-5в). */
function FeedPost({ item, spoilerLevel, shelves }: { item: FeedItem; spoilerLevel?: SpoilerLevel; shelves: boolean }) {
  const { a, voice } = item;
  const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
  const noteOpen = useNoteOpen();
  const [broken, setBroken] = useState(false);
  const src = !broken && !blocked ? a.previewUrl : undefined;
  const who = [
    postDate(a),
    a.platform !== 'telegram' ? ui.platform[a.platform] : undefined,
    a.language === 'en' ? ui.lang.en : undefined,
    a.unverified ? ui.voices.unverified : a.evidence === 'model' ? ui.voices.byModel : undefined,
  ].filter(Boolean).join(' · ');
  const comments = !blocked && a.platform === 'telegram' && commentsOn(a.url);
  return (
    <div className={cx('tm-vcard', 'tm-vcard--post', blocked && 'tm-vcard--blocked')}>
      <a className="tm-vcard__postlink" href={blocked ? undefined : a.url} target="_blank" rel="noreferrer noopener"
         aria-disabled={blocked ? 'true' : undefined}
         onClick={blocked ? (e) => e.preventDefault() : (e) => { noteOpen(a); onExternalClick(a.url)(e); }}>
        <span className="tm-vcard__head">
          <Avatar voice={voice} size="sm" />
          <span className="tm-vcard__who">
            <span className="tm-vcard__channel">{voice.title}</span>
            {who ? <span className="tm-vcard__date">{who}</span> : null}
          </span>
        </span>
        {src ? <img className="tm-vcard__postimg" src={src} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} /> : null}
        <span className="tm-vcard__posttext">{blocked ? ui.spoiler.lockedPost : a.title}</span>
      </a>
      {comments || (shelves && a.lens) ? (
        <p className="tm-vcard__chips">
          <LensMark a={a} on={shelves} />
          {comments ? (
            <a className="tm-voice__chip" href={a.url} target="_blank" rel="noreferrer noopener"
               onClick={onExternalClick(a.url)}>{ui.voices.comments}</a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

/** Переключатель площадок в нижней панели ленты: «YouTube · 12 | Telegram · 5». Число — по всем полкам и
 *  авторам, как счётчик на вкладке «Разборы» в FilmTabs: выбор полки не меняет цифру. */
function FeedTabs({ counts, value, onPick }: { counts: Record<Feed, number>; value: Feed; onPick: (f: Feed) => void }) {
  return (
    <div className="tm-voicefeed__tabs" role="tablist" aria-label={ui.voices.feeds}>
      {FEEDS.map((f) => (
        <button key={f} type="button" role="tab" aria-selected={value === f}
                className={cx('tm-voicefeed__tab', value === f && 'tm-voicefeed__tab--on')}
                onClick={() => { if (value !== f) { pick(); onPick(f); } }}>
          {f === 'youtube' ? ui.voices.outletYoutube : ui.voices.outletTelegram}
          <span className="tm-voicefeed__count">{` · ${counts[f]}`}</span>
        </button>
      ))}
    </div>
  );
}

/** Разборы в карточке фильма лентой (06.10, по замечанию владельца): материал — крупной
 *  карточкой, как фильм в рекомендательной ленте, ролики и посты — на разных вкладках. Отбор
 *  прежний: язык (materialLanguages) срезан ещё в api, ярусы и площадки-не-авторы — в
 *  groupByVoice, спойлеры — в карточке. Строка авторов («Кто разбирал») теперь фильтр ленты: раньше она
 *  выбирала, чей единственный материал показан, а в ленте видны все — и выбор автора сужает её
 *  до него, с его выходами (решение 06.10). Единица по-прежнему автор (23.09): лента собирается
 *  по кругу авторов, а не по свежести. Площадки (Кинопоиск, Okko, Wink, KION, viju) сюда не
 *  попадают: их посты — анонсы своих премьер. */
export function WorkVoices({ analyses, spoilerLevel, workTitle, kind = 'film', workId }: WorkVoicesProps) {
  const shelf = useLensShelf(analyses);
  const groups = useMemo(() => groupByVoice(analyses, { reviews: shelf.on }), [analyses, shelf.on]);
  // группы по площадкам: у автора с роликами и постами — две группы, по одной в каждой ленте
  const byFeed = useMemo(() => {
    const split = (f: Feed) => groups
      .map((g) => ({ voice: g.voice, items: g.items.filter((a) => feedOf(a) === f) }))
      .filter((g) => g.items.length);
    return { youtube: split('youtube'), telegram: split('telegram') };
  }, [groups]);
  const counts = useMemo(() => ({
    youtube: byFeed.youtube.reduce((n, g) => n + g.items.length, 0),
    telegram: byFeed.telegram.reduce((n, g) => n + g.items.length, 0),
  }), [byFeed]);
  // по умолчанию — где материалов больше; поровну — ролики, как было в карточке
  const [feedPicked, setFeed] = useState<Feed | null>(null);
  const feed: Feed = feedPicked ?? (counts.telegram > counts.youtube ? 'telegram' : 'youtube');
  const [voiceId, setVoice] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const [asking, setAsking] = useState(false);
  // полка — фильтр роликов (ТВ-3г): посты рубрик не имеют, и в ленте Telegram полок нет
  const lensOn = feed === 'youtube' ? shelf.lens : null;
  const inFeed = useMemo(() => byFeed[feed]
    .map((g) => ({ voice: g.voice, items: lensOn ? g.items.filter((a) => inLens(a, lensOn)) : g.items }))
    .filter((g) => g.items.length), [byFeed, feed, lensOn]);
  const picked = inFeed.find((g) => g.voice.id === voiceId);
  const items = useMemo(() => roundRobin(picked ? [picked] : inFeed), [inFeed, picked]);
  // смена площадки, полки или автора — лента с начала, снова первые десять
  const reset = () => setLimit(PAGE);

  // Заявка «кто ещё разбирал» нужна в обоих случаях: и когда пусто, и когда есть один автор,
  // а человек знает второго. Ссылка одна, шторка одна — меняется только соседний текст
  const ask = (
    <p className="tm-caption tm-voice__nonehint">
      <button type="button" className="tm-search__link" onClick={() => { pick(); setAsking(true); }}>
        {ui.voices.suggestLink}
      </button>
      <SuggestSheet open={asking} onOpenChange={setAsking} kind="voice"
                    context={workTitle ? `фильм: ${workTitle}` : undefined} />
    </p>
  );
  // После решения 23.09 площадки в разборы не идут, и у части фильмов не осталось ничего.
  // Пустое место молчит, а строка объясняет, почему пусто, и куда идти дальше.
  if (!counts.youtube && !counts.telegram) {
    return (
      <section className="tm-stream__group tm-voice__none">
        <p className="tm-body-sm">{kind === 'book' ? ui.voices.nobodyBook : kind === 'series' ? ui.voices.nobodySeries : ui.voices.nobody}</p>
        <p className="tm-caption tm-voice__nonehint">{kind === 'book' ? ui.voices.nobodyBookHint : ui.voices.nobodyHint}</p>
        {ask}
      </section>
    );
  }
  // автор, чьи выходы показать: выбранный или единственный в ленте
  const sole = picked ?? (inFeed.length === 1 ? inFeed[0] : undefined);
  const Card = feed === 'youtube' ? FeedVideo : FeedPost;
  const both = counts.youtube > 0 && counts.telegram > 0;
  // панель — если в ней есть что-то: выходы автора, полки, авторы или площадки
  const bar = both || Boolean(sole) || inFeed.length > 1 || (feed === 'youtube' && shelf.lenses.length > 0);
  const rest = items.length - limit;
  return (
    <OpenContext.Provider value={{ place: 'work', workId, shelf: lensOn ?? undefined, shelves: shelf.on }}>
      <section className="tm-stream__group tm-voicefeed">
        <div className={cx('tm-voicefeed__list', `tm-voicefeed__list--${feed}`)} role="tabpanel"
             aria-label={feed === 'youtube' ? ui.voices.outletYoutube : ui.voices.outletTelegram}>
          {items.slice(0, limit).map((it) => <Card key={it.a.id} item={it} spoilerLevel={spoilerLevel} shelves={shelf.on} />)}
        </div>
        {rest > 0 ? (
          <button type="button" className="tm-btn tm-btn--secondary tm-btn--sm tm-voicefeed__more"
                  onClick={() => { pick(); setLimit((n) => n + PAGE); }}>
            {ui.voices.feedMore(Math.min(PAGE, rest), rest)}
          </button>
        ) : null}
        {/* Всё управление лентой — нижней панелью, под большим пальцем (владелец, 06.10), как
            нижняя панель карточки в FilmTabs: выходы выбранного автора, полки рубрик (только у
            роликов), строка авторов-фильтр и переключатель площадок. Сверху остаются одни карточки.
            Панель липнет к низу экрана, пока лента на виду, и уезжает вместе с ней; стоит в потоке
            после ленты, поэтому последнюю карточку не закрывает. Кнопки Telegram (MainButton,
            BackButton) — вне окна WebView, нижнее меню приложения — под прокруткой: не пересекаются. */}
        {bar ? (
          <div className="tm-voicefeed__bar">
            {sole ? (
              <Outlets voice={sole.voice} items={sole.items} workTitle={workTitle} extra={picked && inFeed.length > 1 ? (
                <button type="button" className="tm-voice__chip tm-voice__chip--quiet" onClick={() => { pick(); setVoice(null); reset(); }}>
                  {ui.voices.allVoices}
                </button>
              ) : null} />
            ) : null}
            {feed === 'youtube' ? <LensShelf lenses={shelf.lenses} value={shelf.lens} onPick={(l) => { shelf.setLens(l); reset(); }} /> : null}
            {inFeed.length > 1 ? (
              <VoiceStrip groups={inFeed} pickedId={picked?.voice.id}
                          onPick={(id) => { setVoice(id === picked?.voice.id ? null : id); reset(); }} />
            ) : null}
            {both ? <FeedTabs counts={counts} value={feed} onPick={(f) => { setFeed(f); setVoice(null); reset(); }} /> : null}
          </div>
        ) : null}
      </section>
      <section className="tm-stream__group tm-voice__none">{ask}</section>
    </OpenContext.Provider>
  );
}
