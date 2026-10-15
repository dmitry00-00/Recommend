// МА-3 (14.10): голоса, «поделился», источники новых, поиск по настроению, ответы на вопросы, задержка оценки — сводка
// для вкладки «Поведение» (tools/behavior-desk.html). Считается здесь из строк базы, которые собирает worker/funnel.ts;
// чистая функция — проверяется синтетикой (tools/engagement-test.mts) без сервера.
//
// События (таблица `event`, таксономия «объект_действие», snake_case; прежние `card` и `watch` оставлены как есть —
// по ним считаются пороги беты):
//   · `share_sent` — поделился: detail «что:как» — что: film / series / book / character / together / friend;
//     как: message (карточкой-сообщением Telegram, человек выбрал чат), telegram (окно «переслать»), shared (системное
//     «Поделиться» браузера), copied (ссылка скопирована);
//   · `mood_query` — запрос «подобрать словами» (detail — сам запрос, до 120 знаков; place — лента: screen / book);
//     открытие карточки из его результата — прежнее `card` с place = mood;
//   · `survey_answered` — ответ на вопрос приложения: detail «вопрос:ответ» (scale:7 — «какая оценка у вас обычная»).
// Открытия материалов (`material_open`): голос (`voice_id`), длина ролика (`minutes`), секунды до возврата (`dwell`).
// «Дочитал» — вернулся не раньше, чем через половину ролика, а без длины (пост, статья) — через минуту: снаружи досмотр
// не виден, время отсутствия — лучшее приближение.

export interface EngagementRows {
  opens: { user_id: string; voice_id: string | null; minutes: number | null; dwell: number | null; at: string }[];
  /** share_sent, mood_query, survey_answered и card с place = mood */
  events: { user_id: string; kind: string; work_id: string | null; place: string | null; detail: string | null; at: string }[];
  /** заходы за 30 дней — знаменатель «на 100 активных» */
  visits: { user_id: string; day: string }[];
  /** новые за 30 дней: метка посева и кто позвал */
  joined: { source: string | null; invited_by: string | null }[];
  /** оценки за 30 дней, у которых был показ того же произведения раньше оценки */
  rated: { rated: string; shown: string }[];
  /** день по Москве, «сегодня» — от него неделя */
  today: string;
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const share = (n: number, of: number): number | null => (of ? n / of : null);
const dayOf = (iso: string) => new Date(Date.parse(iso) + 3 * 3600e3).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Вернулся не раньше, чем через половину ролика (не меньше минуты); без длины — через минуту. */
export const readThrough = (o: { minutes: number | null; dwell: number | null }): boolean =>
  o.dwell != null && o.dwell >= Math.max(60, (o.minutes ?? 0) * 30);

export function computeEngagement(r: EngagementRows) {
  const week = addDays(r.today, -7);
  // ── голоса: открытия, люди, сколько вернулись с замером, дочитывание, медиана времени снаружи
  const byVoice = new Map<string, EngagementRows['opens']>();
  for (const o of r.opens) if (o.voice_id) byVoice.set(o.voice_id, [...(byVoice.get(o.voice_id) ?? []), o]);
  const voiceLine = (id: string, xs: EngagementRows['opens']) => {
    const timed = xs.filter((o) => o.dwell != null);
    const through = timed.filter(readThrough).length;
    return { voiceId: id, opens: xs.length, users: new Set(xs.map((o) => o.user_id)).size, timed: timed.length,
      through, throughShare: share(through, timed.length), medianDwell: median(timed.map((o) => o.dwell!)) };
  };
  const voices = [...byVoice].map(([id, xs]) => voiceLine(id, xs)).sort((a, b) => b.opens - a.opens || b.users - a.users).slice(0, 40);
  const allTimed = r.opens.filter((o) => o.dwell != null);
  const opens = { n: r.opens.length, withVoice: r.opens.filter((o) => o.voice_id).length, timed: allTimed.length,
    through: allTimed.filter(readThrough).length, throughShare: share(allTimed.filter(readThrough).length, allTimed.length),
    medianDwell: median(allTimed.map((o) => o.dwell!)) };

  // ── «поделился»: на 100 активных за 7 и 30 дней, что и как
  const shares = r.events.filter((e) => e.kind === 'share_sent');
  const active = (from: string) => new Set(r.visits.filter((v) => v.day >= from).map((v) => v.user_id)).size;
  const split = (xs: typeof shares, part: 0 | 1) => {
    const m = new Map<string, number>();
    for (const e of xs) { const k = (e.detail ?? '').split(':')[part] || '—'; m.set(k, (m.get(k) ?? 0) + 1); }
    return [...m].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  };
  const shareSpan = (from: string | undefined) => {
    const xs = from ? shares.filter((e) => dayOf(e.at) >= from) : shares;
    const act = from ? active(from) : new Set(r.visits.map((v) => v.user_id)).size;
    return { n: xs.length, users: new Set(xs.map((e) => e.user_id)).size, active: act, per100: act ? (xs.length / act) * 100 : null };
  };
  const sharing = { week: shareSpan(week), month: shareSpan(undefined), what: split(shares, 0), how: split(shares, 1) };

  // ── источники новых: метка посева, позвал друг, «сами» — ни метки, ни приглашения (без нашего участия)
  const bySource = new Map<string, { joined: number; invited: number }>();
  for (const u of r.joined) {
    const k = u.source ?? '—';
    const s = bySource.get(k) ?? { joined: 0, invited: 0 };
    s.joined++; if (u.invited_by) s.invited++;
    bySource.set(k, s);
  }
  const organic = r.joined.filter((u) => !u.source && !u.invited_by).length;
  const newcomers = { joined: r.joined.length, invited: r.joined.filter((u) => u.invited_by).length,
    seeded: r.joined.filter((u) => u.source).length, organic, organicShare: share(organic, r.joined.length),
    sources: [...bySource].map(([source, s]) => ({ source, ...s })).sort((a, b) => b.joined - a.joined) };

  // ── «подобрать словами»: запросы, люди, открытия из результата на запрос, частые запросы
  const queries = r.events.filter((e) => e.kind === 'mood_query');
  const moodOpens = r.events.filter((e) => e.kind === 'card' && e.place === 'mood');
  const qCount = new Map<string, number>();
  for (const e of queries) { const t = (e.detail ?? '').toLowerCase().replace(/\s+/g, ' ').trim(); if (t) qCount.set(t, (qCount.get(t) ?? 0) + 1); }
  const mood = { queries: queries.length, users: new Set(queries.map((e) => e.user_id)).size, opens: moodOpens.length,
    opensPerQuery: queries.length ? moodOpens.length / queries.length : null,
    top: [...qCount].map(([text, n]) => ({ text, n })).sort((a, b) => b.n - a.n).slice(0, 15) };

  // ── ответы на вопросы приложения
  const answers = r.events.filter((e) => e.kind === 'survey_answered');
  const bySurvey = new Map<string, { n: number; users: Set<string> }>();
  for (const e of answers) {
    const k = (e.detail ?? '').split(':')[0] || '—';
    const s = bySurvey.get(k) ?? { n: 0, users: new Set<string>() };
    s.n++; s.users.add(e.user_id); bySurvey.set(k, s);
  }
  const surveys = [...bySurvey].map(([survey, s]) => ({ survey, n: s.n, users: s.users.size }));

  // ── задержка оценки: дней от первого показа в ленте до оценки того же произведения
  const delays = r.rated.map((x) => Math.max(0, (Date.parse(x.rated) - Date.parse(x.shown)) / 864e5));
  const ratingDelay = { n: delays.length, medianDays: median(delays), within1: share(delays.filter((d) => d < 1).length, delays.length),
    after3: share(delays.filter((d) => d >= 3).length, delays.length) };

  return { opens, voices, sharing, newcomers, mood, surveys, ratingDelay };
}
export type Engagement = ReturnType<typeof computeEngagement>;
