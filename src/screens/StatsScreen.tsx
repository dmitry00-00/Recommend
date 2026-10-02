import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getStats, type StatsKind, type StatsPage } from '@/api';
import { EmptyState, ErrorState, Skeleton } from '@/components';
import ru from '@/i18n/ru';

const KINDS: StatsKind[] = ['work', 'universe', 'person'];
const TOP = 12;

/** Статистика обсуждений (/stats/:kind/:id, 02.10): сколько роликов и постов, когда выходили, кто
 *  говорит, о каких произведениях вселенной или автора, насколько привязкам можно верить и с чем
 *  называют вместе. Числа — из тех же материалов, что на карточке; подборки — из разметки модели. */
export function StatsScreen() {
  const { kind = 'work', id = '' } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<StatsPage | null | undefined>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const k = (KINDS as string[]).includes(kind) ? (kind as StatsKind) : undefined;

  useEffect(() => {
    let alive = true;
    setData(null);
    setFailed(false);
    if (!k) { setData(undefined); return; }
    getStats(k, id).then((s) => alive && setData(s)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [k, id, attempt]);

  return (
    <main className="tm-shell__main tm-voicepage tm-stats">
      <button type="button" className="tm-voicepage__back" onClick={() => navigate(-1)}>{ru.person.back}</button>
      {failed ? <ErrorState title={ru.state.errorSlate} onRetry={() => setAttempt((n) => n + 1)} /> : null}
      {data === null && !failed ? (
        <div aria-busy="true">
          <span className="tm-sr">{ru.today.loading}</span>
          <Skeleton kind="block" style={{ height: 72 }} />
          {[0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ height: 96, marginTop: 8 }} />)}
        </div>
      ) : null}
      {data === undefined ? <EmptyState title={ru.stats.unknown} text={ru.universe.unknownText} /> : null}

      {data ? <StatsView data={data} /> : null}
    </main>
  );
}

/** Сама страница по готовым данным — отдельно от загрузки, чтобы её можно было отрисовать и проверить без сети. */
export function StatsView({ data }: { data: StatsPage }) {
  const [allChannels, setAllChannels] = useState(false);
  const [allWorks, setAllWorks] = useState(false);
  const t = data.totals;
  const total = t.videos + t.posts;
  return (
    <>
      <header className="tm-person__head">
        <p className="tm-label">{ru.stats.title(data.kind)}</p>
        <h1 className="tm-title-2"><Link to={data.back} className="tm-stats__home">{data.title}</Link></h1>
        {data.rank ? <p className="tm-caption">{ru.stats.rank(data.kind, data.rank.place, data.rank.of)}</p> : null}
      </header>

      {total === 0 ? <EmptyState title={ru.stats.empty} text={ru.stats.emptyText} /> : (
        <>
          <dl className="tm-stats__tiles">
            <Tile n={t.videos} label={ru.stats.videos} />
            <Tile n={t.posts} label={ru.stats.posts} />
            <Tile n={t.channels} label={ru.stats.channels} />
            {t.minutes ? <Tile n={Math.round(t.minutes / 60)} label={ru.stats.hours} /> : null}
          </dl>
          <p className="tm-caption">
            {[ru.stats.essays(t.essays, t.reviews), t.first && t.last ? ru.stats.span(t.first, t.last) : undefined,
              t.about ? ru.stats.about(t.about) : undefined].filter(Boolean).join(' · ')}
          </p>

          {data.timeline.length > 1 ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.stats.timeline}</h2>
              <Timeline rows={data.timeline} />
              <p className="tm-caption tm-work__note">{ru.stats.timelineNote}</p>
            </section>
          ) : null}

          {data.works?.length ? (
            <section className="tm-person__section">
              <h2 className="tm-title-3">{ru.stats.worksTitle}</h2>
              <Bars rows={(allWorks ? data.works : data.works.slice(0, TOP)).map((w) => ({
                key: w.workId ?? w.title, label: w.year ? `${w.title} (${w.year})` : w.title,
                to: w.workId ? `/works/${w.workId}` : undefined, videos: w.videos, posts: w.posts,
              }))} />
              {!allWorks && data.works.length > TOP ? (
                <button type="button" className="tm-voice__chip tm-stats__more" onClick={() => setAllWorks(true)}>{ru.stats.more(data.works.length - TOP)}</button>
              ) : null}
            </section>
          ) : null}

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ru.stats.channelsTitle}</h2>
            <Bars rows={(allChannels ? data.channels : data.channels.slice(0, TOP)).map((c) => ({
              key: c.voiceId, label: c.title, to: c.known ? `/voice/${c.voiceId}` : undefined, videos: c.videos, posts: c.posts,
            }))} />
            {!allChannels && data.channels.length > TOP ? (
              <button type="button" className="tm-voice__chip tm-stats__more" onClick={() => setAllChannels(true)}>{ru.stats.more(data.channels.length - TOP)}</button>
            ) : null}
          </section>

          <section className="tm-person__section">
            <h2 className="tm-title-3">{ru.stats.evidenceTitle}</h2>
            <Evidence rows={data.evidence} />
            <p className="tm-caption tm-work__note">{ru.stats.evidenceNote}</p>
          </section>
        </>
      )}

      {data.mentions ? (
        <section className="tm-person__section">
          <h2 className="tm-title-3">{ru.stats.mentionsTitle}</h2>
          <p className="tm-body-sm">{ru.stats.mentions(data.mentions.list, data.mentions.several, data.mentions.news)}</p>
          <p className="tm-caption tm-work__note">{ru.stats.mentionsNote(data.mentions.labels)}</p>
        </section>
      ) : null}

      {data.nearby.length ? (
        <section className="tm-person__section">
          <h2 className="tm-title-3">{ru.stats.nearbyTitle}</h2>
          <p className="tm-voice__outlets tm-work__people">
            {data.nearby.map((c) => (
              <Link key={c.key} className="tm-voice__chip" to={`/works/${c.workId}`}>{c.year ? `${c.title} (${c.year})` : c.title} · {c.n}</Link>
            ))}
          </p>
          <p className="tm-caption tm-work__note">{ru.stats.nearbyNote}</p>
        </section>
      ) : null}
    </>
  );
}

function Tile({ n, label }: { n: number; label: string }) {
  return (
    <div className="tm-stats__tile">
      <dt className="tm-caption">{label}</dt>
      <dd className="tm-title-2">{n.toLocaleString('ru')}</dd>
    </div>
  );
}

function Legend() {
  return (
    <p className="tm-caption tm-stats__legend">
      <span className="tm-stats__key tm-stats__key--video" aria-hidden="true" />{ru.stats.legendVideos}
      <span className="tm-stats__key tm-stats__key--post" aria-hidden="true" />{ru.stats.legendPosts}
    </p>
  );
}

/** Столбики по периодам: ролики снизу, посты сверху. */
function Timeline({ rows }: { rows: StatsPage['timeline'] }) {
  const max = Math.max(1, ...rows.map((r) => r.videos + r.posts));
  const every = Math.ceil(rows.length / 8);
  return (
    <>
      <div className="tm-stats__cols" role="img"
           aria-label={rows.map((r) => `${r.period}: ${r.videos} ${ru.stats.videos}, ${r.posts} ${ru.stats.posts}`).join('; ')}>
        {rows.map((r, i) => (
          <div key={r.period} className="tm-stats__col" title={`${r.period}: ${r.videos} / ${r.posts}`}>
            <span className="tm-stats__stack" style={{ '--h': `${((r.videos + r.posts) / max) * 100}%` } as CSSProperties}>
              {r.posts ? <span className="tm-stats__seg tm-stats__seg--post" style={{ flexGrow: r.posts }} /> : null}
              {r.videos ? <span className="tm-stats__seg tm-stats__seg--video" style={{ flexGrow: r.videos }} /> : null}
            </span>
            <span className="tm-stats__tick">{i % every === 0 ? r.period : ''}</span>
          </div>
        ))}
      </div>
      <Legend />
    </>
  );
}

/** Горизонтальные полосы: имя, полоса (ролики + посты), число. */
function Bars({ rows }: { rows: { key: string; label: string; to?: string; videos: number; posts: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.videos + r.posts));
  return (
    <>
      <ul className="tm-stats__bars">
        {rows.map((r) => (
          <li key={r.key} className="tm-stats__bar">
            <span className="tm-stats__name">{r.to ? <Link to={r.to}>{r.label}</Link> : r.label}</span>
            <span className="tm-stats__track">
              <span className="tm-stats__seg tm-stats__seg--video" style={{ width: `${(r.videos / max) * 100}%` }} />
              <span className="tm-stats__seg tm-stats__seg--post" style={{ width: `${(r.posts / max) * 100}%` }} />
            </span>
            <span className="tm-stats__num">{r.videos + r.posts}</span>
          </li>
        ))}
      </ul>
      {rows.some((r) => r.posts) && rows.some((r) => r.videos) ? <Legend /> : null}
    </>
  );
}

/** Одна полоса долей: подтверждённое — плотным, найденное без подтверждения — бледным. */
function Evidence({ rows }: { rows: StatsPage['evidence'] }) {
  const sum = rows.reduce((s, r) => s + r.n, 0) || 1;
  return (
    <>
      <div className="tm-stats__share" role="img" aria-label={rows.map((r) => `${ru.stats.evidence[r.kind] ?? r.kind}: ${r.n}`).join('; ')}>
        {rows.map((r) => (
          <span key={r.kind} className={r.kind === 'none' ? 'tm-stats__seg tm-stats__seg--none' : 'tm-stats__seg tm-stats__seg--sure'}
                style={{ width: `${(r.n / sum) * 100}%` }} title={`${ru.stats.evidence[r.kind] ?? r.kind}: ${r.n}`} />
        ))}
      </div>
      <ul className="tm-stats__evlist">
        {rows.map((r) => (
          <li key={r.kind} className="tm-caption">
            <span className={`tm-stats__key ${r.kind === 'none' ? 'tm-stats__key--none' : 'tm-stats__key--sure'}`} aria-hidden="true" />
            {ru.stats.evidence[r.kind] ?? r.kind}: {r.n} ({Math.round((r.n / sum) * 100)}%)
          </li>
        ))}
      </ul>
    </>
  );
}
