// Своя верхушка вкуса для подбора «вместе» в боте (19.10): ~150 лучших для участника фильмов и сериалов с оценкой
// подходящести 0..1 — сервер пересекает верхушки компании (worker/togetherPick.ts). Здесь — чистая часть: отбор и когда
// пора отправлять снова (не чаще раза в TOP_HOURS часов или при заметном изменении оценок или самой верхушки).

/** k — ключ произведения (`tmdb:`, у сериала `imdb:`), f — подходящесть 0..1, s — сериал, n/y — название и год,
 *  a — строка о фильме (что он делает, не «почему вам»), x — другие ключи того же произведения. */
export interface TopEntry { k: string; f: number; s?: 1; n?: string; y?: number; a?: string; x?: string[] }
/** Что отправили в прошлый раз: когда, сколько было оценок, первые ключи, чей это профиль. */
export interface TopMark { at: number; rated: number; head: string[]; who: string }

export const TOP_SIZE = 150;
export const TOP_HOURS = 12;
/** не чаще, чем раз в столько минут, даже при изменениях: оценки на экране первых оценок идут подряд */
export const TOP_MIN_MINUTES = 3;
const HEAD = 30;
const KEY = /^(?:tmdb|imdb|kp|wd):[A-Za-z0-9]{1,24}$/;

/** Лучшие `size` по подходящести; одно произведение — один раз (с наибольшей оценкой). */
export function pickTop(items: TopEntry[], size = TOP_SIZE): TopEntry[] {
  const best = new Map<string, TopEntry>();
  for (const it of items) {
    if (!KEY.test(it.k) || !Number.isFinite(it.f)) continue;
    const f = Math.round(Math.max(0, Math.min(1, it.f)) * 1000) / 1000;
    const had = best.get(it.k);
    if (!had || f > had.f) best.set(it.k, { ...it, f });
  }
  return [...best.values()].sort((a, b) => b.f - a.f || a.k.localeCompare(b.k)).slice(0, size);
}

/** Пора ли отправлять: первый раз; другой профиль; прошло TOP_HOURS; или (не раньше TOP_MIN_MINUTES) оценок стало
 *  заметно больше или меньше, либо верх списка сменился больше чем на треть. */
export function topDue(prev: TopMark | undefined, now: number, rated: number, top: TopEntry[], who: string): boolean {
  if (!top.length) return false;
  if (!prev || prev.who !== who) return true;
  const age = now - prev.at;
  if (age >= TOP_HOURS * 3600e3) return true;
  if (age < TOP_MIN_MINUTES * 60e3) return false;
  if (Math.abs(rated - prev.rated) >= 3) return true;
  const head = new Set(prev.head);
  const same = top.slice(0, HEAD).filter((t) => head.has(t.k)).length;
  return same < Math.min(HEAD, top.length) * (2 / 3);
}

export const markOf = (now: number, rated: number, top: TopEntry[], who: string): TopMark => ({ at: now, rated, head: top.slice(0, HEAD).map((t) => t.k), who });

/** Строка о фильме: первая фраза, не длиннее `n`. */
export function shortLine(s: string | undefined, n = 140): string | undefined {
  const t = (s ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return undefined;
  const first = /^.+?[.!?…](?=\s|$)/.exec(t)?.[0] ?? t;
  return first.length <= n ? first : `${first.slice(0, n - 1).replace(/\s+\S*$/, '')}…`;
}
