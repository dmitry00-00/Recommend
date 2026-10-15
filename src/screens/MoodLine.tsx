import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Energy, FeedKind, ID } from '@/types/tmdf';
import { getMoodSlate, noteCard, type MoodSlate } from '@/api';
import { Button, ErrorState, FilmEdge, QuickMark, Skeleton, WorkBanner } from '@/components';
import { leadName } from '@/lib/credits';
import { formatDuration } from '@/lib/format';
import { readingHours } from '@/lib/reading';
import { cx } from '@/lib/cx';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';
import { WorkCardSheet } from './WorkCardSheet';

/** сколько кадров ответа видно сразу — как три слота ленты; «Ещё три» открывает остальные */
const SHOWN = 3;

/** Запрос словами из ленты (?m=), уточнения (?mr=тише,короче) — в адресе, чтобы «Назад» из полной страницы
 *  возвращал к тому же ответу. Экран ленты прячет свои кадры, пока запрос есть. */
export function useMoodQuery(): string { return useSearchParams()[0].get('m') ?? ''; }

/** Поиск словами внутри ленты (ДФ-12, 14.10) — вместо отдельного экрана /mood: строка и 4–5 чипов-примеров под
 *  переключателями ленты; ответ — те же кадры ленты, три и «ещё три». Вторым шагом — уточнения «тише / страннее /
 *  короче» чипами: они дописываются к запросу. Не понято ничего — честный отказ («это не похоже на просьбу о
 *  фильме») и поиск по названию: чаще всего так пишут название. Отбор и события (`mood_query`, открытие — `card` с
 *  place = mood) — те же, что у /mood: `getMoodSlate`. */
export function MoodLine({ kind, energy }: { kind: FeedKind; energy: Energy }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const base = params.get('m') ?? '';
  const refine = (params.get('mr') ?? '').split(',').filter(Boolean);
  const query = [base, ...refine].join(', ');
  const book = kind === 'book';
  const [draft, setDraft] = useState(base);
  const [slate, setSlate] = useState<MoodSlate | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [all, setAll] = useState(false);
  const [openId, setOpenId] = useState<ID | null>(null);
  // «Видел» в карточке ответа: кадр уходит, когда карточку закроют, — как в ленте
  const [gone, setGone] = useState<Set<ID>>(new Set());
  const [seenNow, setSeenNow] = useState<ID | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(base); }, [base]);

  useEffect(() => {
    if (!base) { setSlate(null); return; }
    let live = true;
    setSlate(null);
    setFailed(false);
    setAll(false);
    getMoodSlate(query, energy, { kind }).then((s) => { if (live) setSlate(s); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [query, attempt, kind, energy]);

  const go = (next: Record<string, string>, replace = false) => {
    const p = new URLSearchParams(params);
    for (const k of ['m', 'mr']) p.delete(k);
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    setParams(p, { replace });
  };
  const ask = (text: string) => { tap(); setDraft(text); go({ m: text.trim() }); input.current?.blur(); };
  const clear = () => { tap(); setDraft(''); go({}, true); };
  const toggle = (add: string) => {
    tap();
    const next = refine.includes(add) ? refine.filter((x) => x !== add) : [...refine, add];
    go({ m: base, mr: next.join(',') }, true);
  };
  const open = (id: ID) => { tap(); noteCard(id, 'mood'); setOpenId(id); };
  const items = (slate?.items ?? []).filter((x) => !gone.has(x.work.id));
  const shown = all ? items : items.slice(0, SHOWN);
  const openItem = openId ? items.find((x) => x.work.id === openId) : undefined;
  const refusal = Boolean(base && slate && !slate.understood.length);
  // книге «короче» не о чем: длина у неё в страницах, а словарь понимает минуты
  const refiners = ui.mood.refine.filter(([, add]) => !(book && add === 'короче'));
  const meta = (x: (typeof items)[number]) => {
    const w = x.work;
    const len = w.type === 'book' ? (readingHours(w.pages) ? ui.feed.readTime(readingHours(w.pages)!) : undefined) : formatDuration(w.durationMinutes);
    return [w.year, leadName(w), len].filter(Boolean).join(' · ');
  };

  return (
    <>
      <section className="tm-stream__pad tm-moodline">
        <form className="tm-moodline__bar" role="search" onSubmit={(e) => { e.preventDefault(); if (draft.trim()) ask(draft); }}>
          <input ref={input} className="tm-search__input tm-moodline__input" type="search" value={draft} enterKeyHint="search"
                 placeholder={book ? ui.mood.placeholderBook : ui.mood.short} aria-label={book ? ui.mood.placeholderBook : ui.mood.placeholder}
                 onChange={(e) => setDraft(e.target.value)} />
          {base ? <Button size="sm" variant="quiet" onClick={clear}>{ui.mood.clear}</Button>
            : draft.trim() ? <Button size="sm" variant="primary" onClick={() => ask(draft)}>{ui.mood.go}</Button> : null}
        </form>
        {!base ? (
          <div className="tm-moodline__chips">
            {(book ? ui.mood.chipsBook : ui.mood.chips).map((x) => (
              <button key={x} type="button" className="tm-voice__chip" onClick={() => ask(x)}>{x}</button>
            ))}
          </div>
        ) : null}
        {base && slate?.understood.length ? (
          <>
            <p className="tm-caption tm-moodline__got">
              {ui.mood.understood} {slate.understood.join(' · ')}
              {slate.like ? ` ${ui.mood.likeFound(slate.like.title)}` : ''}
            </p>
            <div className="tm-moodline__chips">
              {refiners.map(([label, add]) => (
                <button key={add} type="button" className={cx('tm-voice__chip', refine.includes(add) && 'tm-voice__chip--on')}
                        aria-pressed={refine.includes(add)} onClick={() => toggle(add)}>{label}</button>
              ))}
            </div>
          </>
        ) : null}
        {refusal ? (
          <div className="tm-moodline__refuse" role="status">
            <p className="tm-body-sm">{book ? ui.mood.refuseBook : ui.mood.refuse}</p>
            <p className="tm-caption">{ui.mood.refuseText}</p>
            <Button size="sm" variant="secondary" onClick={() => { tap(); navigate(`/search?q=${encodeURIComponent(base)}`); }}>{ui.mood.byTitle(base)}</Button>
          </div>
        ) : null}
        {base && slate?.understood.length && !items.length ? (
          <div className="tm-moodline__refuse" role="status">
            <p className="tm-body-sm">{ui.mood.empty}</p>
            <p className="tm-caption">{ui.mood.emptyText}</p>
          </div>
        ) : null}
        {failed ? <ErrorState title={ui.mood.error} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      </section>
      {base && !slate && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          {[0, 1].map((i) => <Skeleton key={i} kind="block" style={{ height: 200, marginTop: i ? 2 : 0 }} />)}
        </div>
      ) : null}
      {shown.length ? (
        <div className="tm-filmstrip tm-moodline__strip">
          {shown.map((x, i) => (
            <article key={x.work.id} className="tm-stream__item">
              <FilmEdge work={x.work} no={i + 1} />
              <WorkBanner work={x.work} meta={meta(x)} onClick={() => open(x.work.id)} priority={i === 0} />
            </article>
          ))}
        </div>
      ) : null}
      {items.length > SHOWN && !all ? (
        <div className="tm-stream__pad tm-stream__more">
          <Button variant="secondary" onClick={() => { tap(); setAll(true); }}>{ui.mood.more}</Button>
        </div>
      ) : null}
      <WorkCardSheet work={openItem?.work ?? null} context={`лента, запрос: ${query}`} hurdles={seenNow !== openId} seen={seenNow === openId}
                     onClose={() => { if (seenNow) setGone((g) => new Set(g).add(seenNow)); setSeenNow(null); setOpenId(null); }}
                     corner={openItem && seenNow !== openId ? (
                       <QuickMark work={openItem.work} abandon={false} label={openItem.work.type === 'book' ? ui.quick.read : ui.quick.seen}
                                  onDone={() => setSeenNow(openItem.work.id)} />
                     ) : undefined} />
    </>
  );
}
