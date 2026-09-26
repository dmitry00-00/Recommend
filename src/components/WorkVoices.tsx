import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ExternalAnalysis, SpoilerLevel, Voice, WorkVoice } from '@/types/tmdf';
import { creditOf, groupByVoice, knownVoice, monogram } from '@/lib/voices';
import { onExternalClick, pick } from '@/lib/telegram';
import { formatDuration } from '@/lib/format';
import { cx } from '@/lib/cx';
import { SuggestSheet } from './SuggestSheet';
import ru from '@/i18n/ru';

export interface WorkVoicesProps {
  analyses: ExternalAnalysis[];
  /** допустимый уровень спойлеров: материал выше него закрыт штриховкой */
  spoilerLevel?: SpoilerLevel;
  /** название фильма — уходит с заявкой «кто ещё разбирал»: без него заявка бесполезна */
  workTitle?: string;
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

const OUTLET = { youtube: ru.voices.outletYoutube, telegram: ru.voices.outletTelegram, chat: ru.voices.outletChat } as const;

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
function Outlets({ voice, extra }: { voice: Voice; extra?: React.ReactNode }) {
  return (
    <p className="tm-voice__outlets">
      {knownVoice(voice.id) ? (
        <Link className="tm-voice__chip tm-voice__chip--own" to={`/voice/${voice.id}`}>{ru.voices.allWorks}</Link>
      ) : null}
      {voice.outlets.map((o) => (
        <a key={o.kind + o.url} className="tm-voice__chip tm-voice__chip--icon" href={o.url} target="_blank" rel="noreferrer noopener"
           aria-label={OUTLET[o.kind]} title={OUTLET[o.kind]} onClick={onExternalClick(o.url)}>
          <OutletIcon kind={o.kind} />
        </a>
      ))}
      {extra}
    </p>
  );
}

/** Материал автора об этом фильме: кадр в боксе постоянного размера, название ровно в две
 *  строки, мета — в одну. Переключение автора меняет только то, что внутри коробок. */
export function Material({ group, spoilerLevel, corner }: { group: WorkVoice; spoilerLevel?: SpoilerLevel; corner?: React.ReactNode }) {
  const items = group.items.filter((a) => a.platform !== 'telegram');
  const [at, setAt] = useState(0);
  const a = items[at % items.length] ?? items[0];
  const blocked = spoilerLevel != null && a.spoilerLevel > spoilerLevel;
  const credit = creditOf(a, group.voice);
  const rest = items.length - 1;
  return (
    <div className="tm-voice__material">
      <a className={cx('tm-voice__frame', blocked && 'tm-voice__frame--blocked')}
         href={blocked ? undefined : a.url} target="_blank" rel="noreferrer noopener"
         aria-disabled={blocked ? 'true' : undefined}
         onClick={blocked ? (e) => e.preventDefault() : onExternalClick(a.url)}>
        {a.previewUrl ? <img className="tm-voice__shot" src={a.previewUrl} alt="" loading="lazy" /> : null}
        {blocked ? <span className="tm-voice__hatch" aria-hidden="true" /> : <span className="tm-voice__play" aria-hidden="true" />}
        {a.durationMinutes ? <span className="tm-voice__time">{formatDuration(a.durationMinutes)}</span> : null}
      </a>
      {/* текст под кадром; справа в углу — действия с фильмом (24.09, по замечанию владельца) */}
      <div className="tm-voice__text">
      <div className="tm-voice__textmain">
      <p className="tm-voice__name">{blocked ? ru.spoiler.lockedAnalysis : a.title}</p>
      <p className="tm-voice__meta">
        {[
          credit,
          a.tags?.length ? `#${a.tags[0]}` : undefined,
          a.language === 'ru' ? ru.lang.ru : ru.lang.en,
          a.spoilerLevel > 0 ? ru.spoilers.with : ru.spoilers.without,
          a.unverified ? ru.voices.unverified : undefined,
        ].filter(Boolean).join(' · ')}
      </p>
      <Outlets voice={group.voice} extra={rest > 0 ? (
        <button type="button" className="tm-voice__chip tm-voice__chip--quiet" onClick={() => setAt((n) => n + 1)}>
          {ru.voices.nextItem(rest)}
        </button>
      ) : null} />
      </div>
      {corner ? <div className="tm-voice__corner">{corner}</div> : null}
      </div>
    </div>
  );
}

/** Строка постов: канал, дата и начало поста. Текст обрезан до двух строк, чтобы длинный
 *  пост не растягивал список. */
export function Post({ group }: { group: WorkVoice }) {
  const posts = group.items.filter((a) => a.platform === 'telegram');
  const a = posts[0];
  const rest = posts.length - 1;
  const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined;
  return (
    <div className="tm-voice__post">
      <a className="tm-voice__postlink" href={a.url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(a.url)}>
        <Avatar voice={group.voice} size="sm" />
        <span className="tm-voice__postbody">
          <span className="tm-voice__postwho">
            {group.voice.title}
            {date ? <span className="tm-voice__postdate"> · {date}</span> : null}
          </span>
          <span className="tm-voice__posttext">{a.title}</span>
        </span>
      </a>
      <Outlets voice={group.voice} extra={rest > 0 ? <span className="tm-voice__chip tm-voice__chip--flat">{ru.voices.morePosts(rest)}</span> : null} />
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
export function useVoices(analyses: ExternalAnalysis[]) {
  const groups = useMemo(() => groupByVoice(analyses), [analyses]);
  const watch = groups.filter((g) => g.items.some((a) => a.platform !== 'telegram'));
  const talk = groups.filter((g) => g.items.some((a) => a.platform === 'telegram'));
  const [pickedId, setPicked] = useState<string | null>(null);
  const picked = watch.find((g) => g.voice.id === pickedId) ?? watch[0];
  return { watch, talk, picked, setPicked };
}

/** Строка аватаров авторов: выбор того, чей материал показан. */
export function VoiceStrip({ groups, pickedId, onPick }: { groups: WorkVoice[]; pickedId?: string; onPick: (id: string) => void }) {
  return (
    <div className="tm-voice__strip" role="tablist" aria-label={ru.voices.title}>
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

export function WorkVoices({ analyses, spoilerLevel, workTitle }: WorkVoicesProps) {
  const { watch, talk, picked, setPicked } = useVoices(analyses);
  const [asking, setAsking] = useState(false);
  // Заявка «кто ещё разбирал» нужна в обоих случаях: и когда пусто, и когда есть один автор,
  // а человек знает второго. Ссылка одна, шторка одна — меняется только соседний текст
  const ask = (
    <p className="tm-caption tm-voice__nonehint">
      <button type="button" className="tm-search__link" onClick={() => { pick(); setAsking(true); }}>
        {ru.voices.suggestLink}
      </button>
      <SuggestSheet open={asking} onOpenChange={setAsking} kind="voice"
                    context={workTitle ? `фильм: ${workTitle}` : undefined} />
    </p>
  );
  // После решения 23.09 площадки в разборы не идут, и у части фильмов не осталось ничего.
  // Пустое место молчит, а строка объясняет, почему пусто, и куда идти дальше.
  if (!watch.length && !talk.length) {
    return (
      <section className="tm-stream__group tm-voice__none">
        <p className="tm-body-sm">{ru.voices.nobody}</p>
        <p className="tm-caption tm-voice__nonehint">{ru.voices.nobodyHint}</p>
        {ask}
      </section>
    );
  }
  return (
    <>
      {picked ? (
        <section className="tm-stream__group">
          <h3 className="tm-label tm-stream__grouplabel">{ru.voices.title}</h3>
          {watch.length > 1 ? <VoiceStrip groups={watch} pickedId={picked.voice.id} onPick={setPicked} /> : null}
          <Material key={picked.voice.id} group={picked} spoilerLevel={spoilerLevel} />
        </section>
      ) : null}
      {talk.length ? (
        <section className="tm-stream__group">
          <h3 className="tm-label tm-stream__grouplabel">{ru.voices.talk}</h3>
          {talk.map((g) => <Post key={g.voice.id} group={g} />)}
        </section>
      ) : null}
      <section className="tm-stream__group tm-voice__none">{ask}</section>
    </>
  );
}
