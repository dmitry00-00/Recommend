import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getLoopReport, type LoopReportData } from '@/api';
import { ErrorState, Skeleton } from '@/components';
import { cx } from '@/lib/cx';
import ui from '@/i18n';

type Diff = 'too_easy' | 'just_right' | 'too_hard';
const DIFFS: Diff[] = ['too_easy', 'just_right', 'too_hard'];
const pct = (x?: number) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const num = (x?: number) => (x == null ? '—' : String(x));

/** Петля прогноза (/loop, трек Б): насколько мы угадываем, как пойдёт фильм, и что люди делают
 *  с лентой. Владелец видит всех участников, остальные — только себя. Экран только
 *  раскладывает отчёт сервера (worker/loop.ts); ничего не считает сам. */
export function LoopScreen() {
  const [report, setReport] = useState<LoopReportData | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getLoopReport().then((r) => alive && setReport(r ?? null)).catch(() => alive && setFailed(true));
    return () => { alive = false; };
  }, [attempt]);

  const L = ui.loop;
  return (
    <main className="tm-shell__main tm-settings tm-loop">
      <Link to="/settings" className="tm-archive__back">{L.back}</Link>
      <h1 className="tm-shell__title">{L.title}</h1>
      <p className="tm-body-sm tm-settings__note">{L.lead}</p>

      {failed ? <ErrorState title={L.error} onRetry={() => setAttempt(attempt + 1)} /> : null}
      {report === undefined && !failed ? <Skeleton kind="block" style={{ height: 240 }} /> : null}
      {report === null ? <p className="tm-body-sm tm-settings__note">{L.noServer}</p> : null}

      {report ? (
        <>
          <section className={cx('tm-settings__section', 'tm-loop__note', report.honest ? 'tm-loop__note--ok' : 'tm-loop__note--wait')}>
            <p className="tm-body-sm">{report.note}</p>
            <p className="tm-caption">{L.scope(report.scope === 'all', report.users)}</p>
          </section>

          <section className="tm-settings__section">
            <h2 className="tm-title-3 tm-settings__h">{L.calibration}</h2>
            <p className="tm-caption tm-settings__note">{L.calibrationHint}</p>
            <table className="tm-loop__table">
              <thead><tr><th />{[L.n, L.brier, L.exact].map((h) => <th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {(['model', 'human', 'baseRate', 'alwaysJustRight'] as const).map((k) => {
                  const s = report.calibration[k];
                  return (
                    <tr key={k} className={k === 'model' ? 'tm-loop__row--main' : undefined}>
                      <th scope="row">{L.who[k]}</th><td>{num(s?.n)}</td><td>{num(s?.brier)}</td><td>{pct(s?.exact)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className="tm-settings__section">
            <h2 className="tm-title-3 tm-settings__h">{L.confusion}</h2>
            <p className="tm-caption tm-settings__note">{L.confusionHint}</p>
            {(['model', 'human'] as const).map((who) => (
              <table key={who} className="tm-loop__table tm-loop__table--matrix">
                <caption>{L.who[who]}</caption>
                <thead><tr><th>{L.predicted}</th>{DIFFS.map((d) => <th key={d}>{ui.difficulty[d]}</th>)}</tr></thead>
                <tbody>
                  {DIFFS.map((row) => (
                    <tr key={row}>
                      <th scope="row">{ui.difficulty[row]}</th>
                      {DIFFS.map((col) => (
                        <td key={col} className={row === col ? 'tm-loop__hit' : undefined}>{report.confusion[who][row][col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ))}
            <p className="tm-caption tm-settings__note">{L.agreement(pct(report.agreement.humanModel), report.agreement.n)}</p>
          </section>

          <section className="tm-settings__section">
            <h2 className="tm-title-3 tm-settings__h">{L.slate}</h2>
            <dl className="tm-loop__facts">
              <dt>{L.impressions}</dt><dd>{report.slate.impressions}</dd>
              <dt>{L.starts}</dt><dd>{report.slate.start} ({pct(report.slate.acceptance)})</dd>
              <dt>{L.saves}</dt><dd>{report.slate.save}</dd>
              <dt>{L.dismisses}</dt><dd>{report.slate.dismiss}</dd>
            </dl>
            {Object.keys(report.dismiss).length ? (
              <p className="tm-caption tm-settings__note">
                {L.dismissReasons}: {Object.entries(report.dismiss).map(([k, v]) => `${(ui.dismissReason as Record<string, string>)[k] ?? k} — ${v}`).join(', ')}
              </p>
            ) : null}
          </section>

          {report.plans && Object.keys(report.plans).length ? (
            <section className="tm-settings__section">
              <h2 className="tm-title-3 tm-settings__h">{L.plans}</h2>
              <p className="tm-caption tm-settings__note">{L.plansHint}</p>
              <table className="tm-loop__table">
                <thead><tr>{[L.want, L.planned, L.started, L.finished].map((h) => <th key={h}>{h}</th>)}</tr></thead>
                <tbody>
                  {Object.entries(report.plans).sort(([a], [b]) => Number(b) - Number(a)).map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">{k === '0' ? L.noWant : k}</th>
                      <td>{v.saved}</td>
                      <td>{v.started} ({pct(v.saved ? v.started / v.saved : undefined)})</td>
                      <td>{v.finished} ({pct(v.saved ? v.finished / v.saved : undefined)})</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ) : null}

          <section className="tm-settings__section">
            <h2 className="tm-title-3 tm-settings__h">{L.abandon}</h2>
            <dl className="tm-loop__facts">
              <dt>{L.abandoned}</dt><dd>{report.abandon.n}</dd>
              <dt>{L.medianDays}</dt><dd>{num(report.abandon.medianDays)}</dd>
              {report.abandon.fit != null ? <><dt>{L.abandonFit}</dt><dd>{report.abandon.fit}</dd></> : null}
              {report.abandon.circumstances != null ? <><dt>{L.abandonCircumstances}</dt><dd>{report.abandon.circumstances}</dd></> : null}
            </dl>
            {Object.keys(report.abandon.reasons).length ? (
              <p className="tm-caption tm-settings__note">
                {Object.entries(report.abandon.reasons).map(([k, v]) => `${(ui.abandonReason as Record<string, string>)[k] ?? k} — ${v}`).join(', ')}
              </p>
            ) : null}
          </section>

          {report.notWatched ? (
            <section className="tm-settings__section">
              <h2 className="tm-title-3 tm-settings__h">{L.notWatched}</h2>
              <p className="tm-caption tm-settings__note">{L.notWatchedHint}</p>
              <dl className="tm-loop__facts">
                <dt>{L.notWatchedAnswered}</dt><dd>{report.notWatched.answered}</dd>
                <dt>{L.notWatchedExpired}</dt><dd>{report.notWatched.expired}</dd>
              </dl>
            </section>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
