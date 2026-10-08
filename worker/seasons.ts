// «Вышел новый сезон» (ЗП-17, 07.10). Справочник `seriesSeasons` (tools/series-seasons.mts, TMDb) — по ключу
// `imdb:tt…` последний вышедший сезон и дата его выхода. Новость — сезон вышел за последние две недели, и
// человек его ждал: досмотрел прежние (дневник: сериал «досмотрен» или в «смотрю» закрыты все сезоны до
// нового) или следит за сериалом (кнопка «Следить»). Брошенное и отложенное — не новость. Одна весть
// о сезоне — один раз (`season_notice`). Сообщение — в той же утренней сводке, что и разборы (worker/follow.ts).
import type { Env } from './env';

/** n — последний вышедший сезон, at — дата его выхода (YYYY-MM-DD), next — анонс, end — сериал закончен. */
export interface SeasonInfo { n: number; at: string; total?: number; next?: { n: number; at: string }; end?: true }
export interface SeasonNews { key: string; title: string; season: number; at: string; why: 'watched' | 'follow' }

const FRESH_DAYS = 14;
const IMDB_KEY = /^imdb:tt\d{5,10}$/;

/** Ключ сериала в справочнике сезонов по карточке из дневника. */
export function seriesKey(workId: string, work: { type?: string; externalIds?: { imdb?: string } } | null): string | undefined {
  if (IMDB_KEY.test(workId)) return workId;
  const imdb = work?.externalIds?.imdb;
  return work?.type === 'series' && imdb && /^tt\d{5,10}$/.test(imdb) ? `imdb:${imdb}` : undefined;
}

/** Сезоны, вышедшие за две недели до `now` (и не позже него). */
export function freshSeasons(seasons: Record<string, SeasonInfo>, now: Date): Map<string, SeasonInfo> {
  const today = now.toISOString().slice(0, 10);
  const since = new Date(now.getTime() - FRESH_DAYS * 86400e3).toISOString().slice(0, 10);
  return new Map(Object.entries(seasons).filter(([k, s]) => IMDB_KEY.test(k) && s.n >= 2 && s.at > since && s.at <= today));
}

interface Progress { season?: number; done?: { season: number }[] }
/** Ждал ли человек сезон n: досмотрел сериал или закрыл все сезоны до n и ещё не начал n. */
export function waitedFor(status: string, progress: Progress | null, n: number): boolean {
  if (status === 'finished') return true;
  if (status !== 'in_progress') return false;
  const done = Math.max(0, ...(progress?.done ?? []).map((d) => d.season));
  return done >= n - 1 && (progress?.season ?? 0) < n;
}

/** Вести о сезонах для участников: дневник и подписки, без уже отправленных. Ключ — id участника. */
export async function seasonNews(env: Env, seasons: Record<string, SeasonInfo>, now = new Date()): Promise<Map<string, SeasonNews[]>> {
  const out = new Map<string, SeasonNews[]>();
  const fresh = freshSeasons(seasons, now);
  if (!fresh.size) return out;
  const add = (user: string, n: SeasonNews) => {
    const list = out.get(user) ?? [];
    if (!list.some((x) => x.key === n.key)) list.push(n);
    out.set(user, list);
  };
  const journal = await env.DB.prepare(`SELECT user_id, work_id, work, status, series FROM journal WHERE status IN ('in_progress', 'finished') AND work IS NOT NULL`)
    .all<{ user_id: string; work_id: string; work: string; status: string; series: string | null }>();
  for (const r of journal.results) {
    let work: { type?: string; title?: string; externalIds?: { imdb?: string } } | null = null;
    try { work = JSON.parse(r.work); } catch { continue; }
    const key = seriesKey(r.work_id, work);
    const s = key ? fresh.get(key) : undefined;
    if (!key || !s) continue;
    let progress: Progress | null = null;
    try { progress = r.series ? JSON.parse(r.series) : null; } catch { /* битый прогресс — как без него */ }
    if (waitedFor(r.status, progress, s.n)) add(r.user_id, { key, title: work?.title ?? key, season: s.n, at: s.at, why: 'watched' });
  }
  const follows = await env.DB.prepare(`SELECT user_id, ref, keys, title FROM follow WHERE kind = 'work'`).all<{ user_id: string; ref: string; keys: string; title: string }>();
  for (const f of follows.results) {
    for (const key of new Set([f.ref, ...f.keys.split(',')])) {
      const s = fresh.get(key);
      if (s) add(f.user_id, { key, title: f.title, season: s.n, at: s.at, why: 'follow' });
    }
  }
  if (!out.size) return out;
  const sent = await env.DB.prepare('SELECT user_id, key, season FROM season_notice WHERE at > ?')
    .bind(new Date(now.getTime() - 60 * 86400e3).toISOString()).all<{ user_id: string; key: string; season: number }>();
  const seen = new Set(sent.results.map((x) => `${x.user_id} ${x.key} ${x.season}`));
  for (const [user, list] of out) {
    const left = list.filter((x) => !seen.has(`${user} ${x.key} ${x.season}`));
    if (left.length) out.set(user, left); else out.delete(user);
  }
  return out;
}

/** Отметить отправленное: одна весть о сезоне — один раз. */
export function noteSeasons(env: Env, userId: string, news: SeasonNews[], now = new Date()) {
  return news.map((x) => env.DB.prepare('INSERT OR IGNORE INTO season_notice (user_id, key, season, at) VALUES (?, ?, ?, ?)')
    .bind(userId, x.key, x.season, now.toISOString()));
}
