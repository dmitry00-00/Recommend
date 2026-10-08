import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearOwnerDecision, decideOwnerCheck, decideOwnerLens, getOwnerDesk,
  type OwnerCheckAction, type OwnerCheckItem, type OwnerDesk, type OwnerLensItem,
} from '@/api';
import { Button, ErrorState, Meta, Skeleton, useToast } from '@/components';
import { onExternalClick } from '@/lib/telegram';
import { formatDuration } from '@/lib/format';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

type Tab = 'check' | 'lens';
const yt = (id: string) => `https://www.youtube.com/watch?v=${id.replace(/^yt:/, '')}`;
const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

/** Разметка владельца с телефона (/owner, 06.10): вкладки «Проверка» и «Рубрики» пульта на экране
 *  приложения. Одна карточка за раз, решение — одним нажатием, сразу на сервер; на Mac их забирает
 *  tools/owner-pull.mts. Экран только показывает очередь и пишет решения — ничего не считает. */
export function OwnerDeskScreen() {
  const toast = useToast();
  const [desk, setDesk] = useState<OwnerDesk | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [noServer, setNoServer] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>('check');
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [last, setLast] = useState<{ kind: Tab; id: string }[]>([]);
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getOwnerDesk()
      .then((d) => { if (!alive) return; if (d === undefined) setNoServer(true); else setDesk(d); })
      .catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const left = (kind: Tab) => (desk ? (kind === 'check' ? desk.check : desk.lens).filter((x) => !desk.decided.has(`${kind}:${x.id}`)) : []);
  const queue = left(tab);
  const current = queue.find((x) => !skipped.has(`${tab}:${x.id}`)) ?? queue[0];

  const record = (kind: Tab, id: string, send: () => Promise<void>) => {
    if (!desk || busy) return;
    setBusy(true);
    send()
      .then(() => {
        desk.decided.add(`${kind}:${id}`);
        setLast((l) => [...l.slice(-19), { kind, id }]);
        setDone((n) => n + 1);
        toast({ text: ui.owner.saved });
      })
      .catch(() => toast({ text: ui.owner.errorSave, action: ui.actions.retry, onAction: () => record(kind, id, send) }))
      .finally(() => setBusy(false));
  };
  const undo = () => {
    const l = last[last.length - 1];
    if (!l || !desk || busy) return;
    setBusy(true);
    clearOwnerDecision(l.kind, l.id)
      .then(() => {
        desk.decided.delete(`${l.kind}:${l.id}`);
        setSkipped((s) => { const n = new Set(s); n.delete(`${l.kind}:${l.id}`); return n; });
        setLast((x) => x.slice(0, -1));
        setDone((n) => Math.max(0, n - 1));
        setTab(l.kind);
        toast({ text: ui.owner.undone });
      })
      .catch(() => toast({ text: ui.owner.errorSave }))
      .finally(() => setBusy(false));
  };
  const skip = () => current && setSkipped((s) => new Set(s).add(`${tab}:${current.id}`));

  const O = ui.owner;
  return (
    <main className="tm-shell__main tm-settings tm-owner">
      <Link to="/settings" className="tm-archive__back">{O.back}</Link>
      <h1 className="tm-shell__title">{O.title}</h1>

      {failed ? <ErrorState title={O.error} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {noServer ? <p className="tm-body-sm tm-settings__note">{O.noServer}</p> : null}
      {desk === undefined && !failed && !noServer ? <Skeleton kind="block" style={{ height: 320 }} /> : null}
      {desk === null ? <p className="tm-body-sm tm-settings__note">{O.noQueue}</p> : null}

      {desk ? (
        <>
          <div className="tm-row tm-row--gap-2 tm-owner__tabs" role="tablist">
            {(['check', 'lens'] as const).map((t) => (
              <Button key={t} size="sm" variant={tab === t ? 'primary' : 'secondary'} onClick={() => setTab(t)}>
                {t === 'check' ? O.tabCheck : O.tabLens} · {left(t).length}
              </Button>
            ))}
          </div>
          <p className="tm-caption tm-settings__note">
            {O.left(queue.length)}{done ? ` · ${O.done(done)}` : ''}
          </p>

          {!current ? <p className="tm-body-sm tm-settings__note">{O.empty}</p> : null}
          {current && tab === 'check' ? (
            <CheckCard key={current.id} item={current as OwnerCheckItem} films={desk.films} busy={busy}
                       onDecide={(action, film, also) => record('check', current.id, () => decideOwnerCheck(current.id, action, film, also))} />
          ) : null}
          {current && tab === 'lens' ? (
            <LensCard key={current.id} item={current as OwnerLensItem} lenses={desk.lenses} busy={busy}
                      onDecide={(lens, also) => record('lens', current.id, () => decideOwnerLens(current.id, lens, also))} />
          ) : null}

          <div className="tm-row tm-row--gap-2 tm-row--wrap tm-owner__foot">
            {current ? <Button variant="quiet" size="sm" onClick={skip}>{O.skip}</Button> : null}
            {last.length ? <Button variant="quiet" size="sm" onClick={undo} disabled={busy}>{O.undo}</Button> : null}
          </div>
        </>
      ) : null}
    </main>
  );
}

function Video({ id, title, meta }: { id: string; title: string; meta: (string | undefined)[] }) {
  const url = yt(id);
  return (
    <a className="tm-extlink tm-extlink--preview" href={url} target="_blank" rel="noreferrer noopener" onClick={onExternalClick(url)}>
      <span className="tm-extlink__thumb">
        <img className="tm-extlink__img" src={`https://i.ytimg.com/vi/${id.replace(/^yt:/, '')}/mqdefault.jpg`} alt="" loading="lazy" />
      </span>
      <span className="tm-extlink__title">{title}</span>
      <Meta items={meta.filter(Boolean) as string[]} />
    </a>
  );
}

/** Поиск по списку фильмов: сначала начинающиеся с введённого, потом содержащие; своё название —
 *  последней кнопкой (на Mac его попробует узнать опознаватель, иначе — «нет у нас»). */
function FilmSearch({ films, busy, placeholder, onPick }: {
  films: string[]; busy: boolean; placeholder: string; onPick: (film: string) => void;
}) {
  const O = ui.owner;
  const [text, setText] = useState('');
  const hits = useMemo(() => {
    const q = norm(text.trim());
    if (q.length < 2) return [];
    const starts: string[] = [], has: string[] = [];
    for (const f of films) {
      const n = norm(f);
      if (n.startsWith(q)) starts.push(f); else if (n.includes(q)) has.push(f);
      if (starts.length >= 8) break;
    }
    return [...starts, ...has].slice(0, 8);
  }, [text, films]);
  const pick = (f: string) => { onPick(f); setText(''); };
  return (
    <div className="tm-owner__other">
      <input className="tm-owner__input" type="search" value={text} placeholder={placeholder} autoFocus
             onChange={(e) => setText(e.target.value)} />
      <div className="tm-owner__hits">
        {hits.map((f) => <Button key={f} size="sm" variant="secondary" disabled={busy} onClick={() => pick(f)}>{f}</Button>)}
        {text.trim() && !hits.includes(text.trim())
          ? <Button size="sm" variant="quiet" disabled={busy} onClick={() => pick(text.trim())}>{O.otherSave}: «{text.trim()}»</Button>
          : null}
      </div>
    </div>
  );
}

type Mode = 'other' | 'several' | 'franchise' | 'person';

function CheckCard({ item, films, busy, onDecide }: {
  item: OwnerCheckItem; films: string[]; busy: boolean; onDecide: (action: OwnerCheckAction, film?: string, also?: string[]) => void;
}) {
  const O = ui.owner;
  const m = item.model;
  const modelFilm = m?.film && m.film !== item.film ? m.film : undefined;
  const [mode, setMode] = useState<Mode | undefined>();
  const [more, setMore] = useState(false);
  // «несколько фильмов»: главный — привязка (или фильм модели), остальные — из подсказки модели
  const [main, setMain] = useState<string | undefined>(item.film ?? m?.film);
  const [also, setAlso] = useState<string[]>(() => (m?.also ?? []).filter((f) => f !== (item.film ?? m?.film)));
  // «о франшизе / о человеке»: название — из подсказки модели, если она того же вида
  const [about, setAbout] = useState('');
  const open = (next: Mode) => {
    setMode(mode === next ? undefined : next);
    if (next === 'franchise' || next === 'person') setAbout(m?.about?.kind === (next === 'franchise' ? 'universe' : 'person') ? m.about.title : '');
  };

  return (
    <section className="tm-settings__section tm-owner__card">
      <p className="tm-caption">{O.group[item.group]}</p>
      <Video id={item.id} title={item.title}
             meta={[item.channel, item.date, item.minutes ? formatDuration(item.minutes) : undefined]} />
      <dl className="tm-owner__facts">
        <dt>{O.binding}</dt>
        <dd className={cx(!item.film && 'tm-owner__none')}>{item.film ?? O.noBinding}</dd>
        {m ? (<>
          <dt>{O.model}</dt>
          <dd>
            {m.says}{m.film ? `: ${m.film}` : m.about ? `: ${m.about.title}` : m.typed ? `: ${m.typed}` : ''}
            {m.note ? <span className="tm-caption tm-owner__note">{m.note}</span> : null}
          </dd>
        </>) : null}
      </dl>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        {item.film ? <Button variant="primary" size="sm" disabled={busy} onClick={() => onDecide('ok')}>{O.ok}</Button> : null}
        {modelFilm ? <Button size="sm" variant={item.film ? 'secondary' : 'primary'} disabled={busy} onClick={() => onDecide('set', modelFilm)}>{O.asModel(modelFilm)}</Button> : null}
        <Button size="sm" disabled={busy} onClick={() => onDecide('notfilm')}>{O.notFilm}</Button>
        <Button size="sm" variant={mode === 'other' ? 'secondary' : 'quiet'} onClick={() => open('other')}>{O.other}</Button>
        <Button size="sm" variant={more ? 'secondary' : 'quiet'} onClick={() => { setMore(!more); if (more && mode !== 'other') setMode(undefined); }}>{O.more}</Button>
      </div>
      {more ? (
        <div className="tm-row tm-row--gap-2 tm-row--wrap">
          {(['several', 'franchise', 'person'] as const).map((k) => (
            <Button key={k} size="sm" variant={mode === k ? 'primary' : 'secondary'} onClick={() => open(k)}>{O[k]}</Button>
          ))}
        </div>
      ) : null}

      {mode === 'other' ? (
        <FilmSearch films={films} busy={busy} placeholder={O.otherPlaceholder} onPick={(f) => onDecide(item.film ? 'wrong' : 'set', f)} />
      ) : null}

      {mode === 'several' ? (
        <div className="tm-owner__other">
          <dl className="tm-owner__facts">
            <dt>{O.severalMain}</dt>
            <dd className={cx(!main && 'tm-owner__none')}>
              {main ? (
                <span className="tm-owner__tag">
                  {main} <button type="button" className="tm-owner__x" aria-label={O.remove} onClick={() => setMain(undefined)}>×</button>
                </span>
              ) : '—'}
            </dd>
            <dt>{O.severalAlso}</dt>
            <dd>
              {also.length ? also.map((f) => (
                <span key={f} className="tm-owner__tag">
                  {f} <button type="button" className="tm-owner__x" aria-label={O.remove} onClick={() => setAlso(also.filter((x) => x !== f))}>×</button>
                </span>
              )) : '—'}
            </dd>
          </dl>
          <FilmSearch films={films} busy={busy} placeholder={main ? O.severalAdd : O.severalMain}
                      onPick={(f) => (!main ? setMain(f) : f !== main && !also.includes(f) ? setAlso([...also, f]) : undefined)} />
          <Button size="sm" variant="primary" disabled={busy || !main || !also.length} onClick={() => onDecide('several', main, also)}>{O.otherSave}</Button>
        </div>
      ) : null}

      {mode === 'franchise' || mode === 'person' ? (
        <div className="tm-owner__other">
          <input className="tm-owner__input" type="search" value={about} autoFocus
                 placeholder={mode === 'franchise' ? O.franchisePlaceholder : O.personPlaceholder} onChange={(e) => setAbout(e.target.value)} />
          <Button size="sm" variant="primary" disabled={busy || !about.trim()} onClick={() => onDecide(mode, about.trim())}>{O.otherSave}</Button>
        </div>
      ) : null}
    </section>
  );
}

function LensCard({ item, lenses, busy, onDecide }: {
  item: OwnerLensItem; lenses: OwnerDesk['lenses']; busy: boolean; onDecide: (lens: string, also?: string) => void;
}) {
  const O = ui.owner;
  const [second, setSecond] = useState(false);
  const [main, setMain] = useState<string | undefined>();
  const name = (id?: string) => lenses.find((l) => l.id === id)?.name ?? id;
  const tap = (id: string) => {
    if (!second) return onDecide(id);
    if (!main) return setMain(id);
    if (id === main) return setMain(undefined);
    onDecide(main, id);
  };
  return (
    <section className="tm-settings__section tm-owner__card">
      <Video id={item.id} title={item.title} meta={[item.channel, ...item.works]} />
      <dl className="tm-owner__facts">
        <dt>{O.model}</dt>
        <dd>
          {name(item.lens)}{item.also ? ` + ${name(item.also)}` : ''}
          {item.conf != null ? <span className="tm-caption tm-owner__note">{O.confidence(item.conf)}</span> : null}
        </dd>
      </dl>
      <div className="tm-row tm-row--gap-2 tm-row--wrap">
        <Button variant="primary" size="sm" disabled={busy} onClick={() => onDecide(item.lens, item.also)}>{O.modelRight}</Button>
        <label className="tm-owner__second">
          <input type="checkbox" checked={second} onChange={(e) => { setSecond(e.target.checked); setMain(undefined); }} />
          <span className="tm-body-sm">{O.second}</span>
        </label>
      </div>
      {second && main ? <p className="tm-caption">{O.secondPick}</p> : null}
      <div className="tm-owner__lenses">
        {lenses.map((l) => (
          <Button key={l.id} size="sm" disabled={busy} variant={l.id === main ? 'primary' : 'secondary'}
                  className={cx(l.weak && 'tm-owner__weak', l.id === item.lens && 'tm-owner__model')} onClick={() => tap(l.id)}>
            {l.name}
          </Button>
        ))}
      </div>
      {second && main ? <Button size="sm" disabled={busy} onClick={() => onDecide(main)}>{O.finish}</Button> : null}
    </section>
  );
}
