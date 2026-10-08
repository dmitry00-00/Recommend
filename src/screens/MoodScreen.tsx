import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ID } from '@/types/tmdf';
import { getMoodSlate, type MoodSlate } from '@/api';
import { Button, EmptyState, ErrorState, Skeleton } from '@/components';
import { WorkThumb } from '@/components/WorkThumb';
import { leadName } from '@/lib/credits';
import { tap } from '@/lib/telegram';
import ui from '@/i18n';
import { WorkCardSheet } from './WorkCardSheet';
import { titleOf } from '@/lib/format';

/** Подбор по настроению (/mood, ЗП-16): человек пишет словами, чего хочется, — экран показывает, что понято, и до
 *  шести фильмов. Запрос живёт в адресе (`?q=`), чтобы «Назад» из карточки возвращал к тому же списку. */
export function MoodScreen() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const [draft, setDraft] = useState(q);
  const [slate, setSlate] = useState<MoodSlate | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<ID | null>(null);
  const input = useRef<HTMLInputElement>(null);
  // запрос из адреса — и в поле: «Назад» и переход на пустой /mood не должны оставлять прежний текст
  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    if (!q) { setSlate(null); return; }
    let live = true;
    setSlate(null);
    setFailed(false);
    getMoodSlate(q).then((s) => { if (live) setSlate(s); }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [q, attempt]);

  const ask = (text: string) => { tap(); setDraft(text); setParams(text.trim() ? { q: text.trim() } : {}); input.current?.blur(); };
  const open = openId ? slate?.items.find((x) => x.work.id === openId) : undefined;

  return (
    <main className="tm-shell__main tm-search tm-mood">
      <h1 className="tm-sr">{ui.mood.title}</h1>
      <form className="tm-search__bar" onSubmit={(e) => { e.preventDefault(); ask(draft); }}>
        <input ref={input} className="tm-search__input" type="search" value={draft} enterKeyHint="search"
               placeholder={ui.mood.placeholder} aria-label={ui.mood.placeholder} onChange={(e) => setDraft(e.target.value)} />
        <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={() => ask(draft)}>{ui.mood.go}</Button>
      </form>

      {!q ? (
        <>
          <p className="tm-caption tm-search__hint">{ui.mood.hint}</p>
          <div className="tm-search__filters tm-mood__examples">
            {ui.mood.examples.map((x) => (
              <button key={x} type="button" className="tm-voice__chip" onClick={() => ask(x)}>{x}</button>
            ))}
          </div>
        </>
      ) : null}

      {q && slate?.understood.length ? (
        <p className="tm-caption tm-search__hint">
          {ui.mood.understood} {slate.understood.join(' · ')}
          {slate.like ? ` ${ui.mood.likeFound(slate.like.title)}` : ''}
        </p>
      ) : null}

      {failed ? <ErrorState title={ui.mood.error} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {q && !slate && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ui.today.loading}</span>
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 106, marginTop: i ? 8 : 0 }} />)}
        </div>
      ) : null}
      {q && slate && !slate.understood.length ? <EmptyState title={ui.mood.notUnderstood} text={ui.mood.notUnderstoodText} /> : null}
      {q && slate?.understood.length && !slate.items.length ? <EmptyState title={ui.mood.empty} text={ui.mood.emptyText} /> : null}

      <ul className="tm-search__list">
        {slate?.items.map((x) => (
          <li key={x.work.id} className="tm-search__item">
            <button type="button" className="tm-search__open" onClick={() => { tap(); setOpenId(x.work.id); }}>
              <WorkThumb work={x.work} />
              <span className="tm-search__text">
                <span className="tm-search__name">{titleOf(x.work)}</span>
                <span className="tm-search__meta">{[x.work.year, leadName(x.work)].filter(Boolean).join(' · ')}</span>
                {x.what ? <span className="tm-mood__what">{x.what}</span> : null}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <WorkCardSheet work={open?.work ?? null} onClose={() => setOpenId(null)} context={`настроение: ${q}`} />
    </main>
  );
}
