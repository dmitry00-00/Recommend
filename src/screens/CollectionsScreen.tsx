import { Fragment, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { ID } from '@/types/tmdf';
import { getCollection, getCollections, setWatched, type CollectionPage } from '@/api';
import { Button, EmptyState, ErrorState, Skeleton, useToast } from '@/components';
import { WorkThumb } from '@/components/WorkThumb';
import { formatDuration, titleOf } from '@/lib/format';
import { leadName } from '@/lib/credits';
import { tap } from '@/lib/telegram';
import { useFeature } from '@/lib/flags';
import ui from '@/i18n';
import { WorkCardSheet } from './WorkCardSheet';

type ShelfId = keyof typeof ui.collections.shelf;
const shelfText = (id: string) => ui.collections.shelf[id as ShelfId];
/** полка, где фильмов меньше, — не витрина, а случайность данных */
const MIN_FILMS = 5;

/** Культурные подборки (ЗП-45, шаги 2–3, за флагом `collections`): /collections — полки стран и школ и подборки
 *  голосов (плейлисты эссеистов, id `pl-<плейлист>`), /collections/:id — полка.
 *  Порядок внутри — от уровня человека вглубь; то, что заметно проще, — в конце под своей строкой. У фильма —
 *  первый автор разбора; тап открывает ту же карточку, что в поиске. Без «почему вам». */
export function CollectionsScreen() {
  const { id } = useParams();
  return id ? <Shelf id={id} /> : <Shelves />;
}

function Shelves() {
  const navigate = useNavigate();
  const [list, setList] = useState<Awaited<ReturnType<typeof getCollections>> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    getCollections().then((x) => alive && setList(x)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);
  const themes = (list?.themes ?? []).filter((c) => shelfText(c.id) && c.films >= MIN_FILMS);
  const voices = list?.voices ?? [];
  const row = (id: string, title: string, lead: string, films: number) => (
    <li key={id} className="tm-search__item">
      <button type="button" className="tm-search__open" onClick={() => { tap(); navigate(`/collections/${id}`); }}>
        <span className="tm-search__text">
          <span className="tm-search__name">{title}</span>
          <span className="tm-search__meta">{lead}</span>
          <span className="tm-search__orig">{ui.collections.films(films)}</span>
        </span>
      </button>
    </li>
  );
  return (
    <main className="tm-shell__main tm-collections">
      <h1 className="tm-shell__title">{ui.collections.title}</h1>
      <p className="tm-caption tm-collections__lead">{ui.collections.lead}</p>
      {failed ? <ErrorState onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {!list && !failed ? (
        <div aria-busy="true">{[0, 1, 2, 3].map((i) => <Skeleton key={i} kind="block" style={{ height: 76, marginTop: i ? 8 : 0 }} />)}</div>
      ) : null}
      {themes.length ? <h2 className="tm-title-3 tm-collections__section">{ui.collections.themesTitle}</h2> : null}
      <ul className="tm-search__list">
        {themes.map((c) => row(c.id, shelfText(c.id).title, shelfText(c.id).lead, c.films))}
      </ul>
      {/* подборки голосов (шаг 3): плейлисты эссеистов, у каждого фильма — разбор автора */}
      {voices.length ? (
        <>
          <h2 className="tm-title-3 tm-collections__section">{ui.collections.voicesTitle}</h2>
          <p className="tm-caption tm-collections__lead">{ui.collections.voicesLead}</p>
          <ul className="tm-search__list">
            {voices.map((c) => row(c.id, c.title ?? '', ui.collections.byVoice(c.voice ?? ''), c.films))}
          </ul>
        </>
      ) : null}
    </main>
  );
}

function Shelf({ id }: { id: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const pages = useFeature('pages');
  const [data, setData] = useState<CollectionPage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [openId, setOpenId] = useState<ID | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    setFailed(false);
    setData(null);
    getCollection(id).then((x) => alive && setData(x)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [id, attempt]);

  const text = shelfText(id);
  const items = data?.items ?? [];
  const open = openId ? items.find((x) => x.work.id === openId) : undefined;
  // «Смотрел» с полки: фильм уходит из неё и из ленты, вкус пересчитывается
  const seen = (workId: ID) => {
    setBusy(true);
    setWatched(workId, true)
      .then(() => {
        setOpenId(null);
        setData((d) => {
          if (!d) return d;
          const i = d.items.findIndex((x) => x.work.id === workId);
          return { ...d, items: d.items.filter((x) => x.work.id !== workId), easier: i >= 0 && i < d.easier ? d.easier - 1 : d.easier };
        });
      })
      .catch(() => toast({ text: ui.settings.errorSave }))
      .finally(() => setBusy(false));
  };

  return (
    <main className="tm-shell__main tm-collections">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate('/collections')}>{ui.collections.title}</button>
      {data === undefined ? <EmptyState title={ui.collections.missing} /> : null}
      {/* у полки страны — свои строки; у подборки голоса — название плейлиста и автор */}
      {text || data?.title ? (
        <>
          <h1 className="tm-shell__title">{text?.title ?? data?.title}</h1>
          <p className="tm-caption tm-collections__lead">
            {text ? text.lead : (
              <>
                {ui.collections.voiceLeadBefore}
                {pages && data?.voiceId ? <Link className="tm-search__link" to={`/voice/${data.voiceId}`}>{data.voice}</Link> : data?.voice}
                {ui.collections.voiceLeadAfter}
              </>
            )}
          </p>
        </>
      ) : null}
      {failed ? <ErrorState onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">{[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 98, marginTop: i ? 8 : 0 }} />)}</div>
      ) : null}
      {data && !items.length ? <EmptyState title={ui.collections.empty} /> : null}
      <ul className="tm-search__list">
        {items.map((x, i) => (
          <Fragment key={x.work.id}>
            {i === data!.easier && i > 0 ? <li className="tm-collections__easier tm-caption">{ui.collections.easier}</li> : null}
            <li className="tm-search__item">
              <button type="button" className="tm-search__open" onClick={() => { tap(); setOpenId(x.work.id); }}>
                <WorkThumb work={x.work} />
                <span className="tm-search__text">
                  <span className="tm-search__name">{titleOf(x.work)}</span>
                  <span className="tm-search__meta">{[x.work.year, leadName(x.work), formatDuration(x.work.durationMinutes)].filter(Boolean).join(' · ')}</span>
                  {x.what ? <span className="tm-collections__what">{x.what}</span> : null}
                  {x.essay ? <span className="tm-collections__voice">{ui.collections.essay(x.essay.minutes ? formatDuration(x.essay.minutes) : undefined)}</span>
                    : x.voice ? <span className="tm-collections__voice">{ui.collections.voice(x.voice)}</span> : null}
                </span>
              </button>
            </li>
          </Fragment>
        ))}
      </ul>
      <WorkCardSheet work={open?.work ?? null} onClose={() => setOpenId(null)} context={`подборка: ${id}`} voiceId={data?.voiceId}
                     corner={open ? <Button size="sm" variant="primary" disabled={busy} onClick={() => seen(open.work.id)}>{ui.search.mark}</Button> : null} />
    </main>
  );
}
