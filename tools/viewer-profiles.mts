// Профили зрителей из находок шлюза (.cache/tg-asks/found.json) — ссылки на Кинопоиск, Letterboxd, Trakt, Кинориум,
// которые люди оставили в постах и комментариях (ЗП-46). Общая выборка для вкладки «Запросы» пульта (tools/asks-desk.mts)
// и ночного сбора историй Letterboxd (tools/profile-seed.mts --auto, 22.10).

export interface FoundPost { channel: string; title?: string; msg_id: number; parent_id?: number; date?: string; text?: string }
export interface ViewerProfile { url: string; site: string; ru: boolean; channel: string; channelTitle?: string; date?: string; text: string; link: string }

// профиль Кинопоиска — номер или ник (23.10: ник вида kinopoisk.ru/user/mrkuhnya раньше не узнавался — 37 ссылок мимо)
// книги (23.10): Фантлаб и Goodreads собираются (tools/book-profile-seed.mts), LiveLib — только видно (скриптами не собираем)
const PROFILE = /https?:\/\/(?:www\.)?(?:kinopoisk\.ru\/user\/[\w.-]+|letterboxd\.com\/[\w.-]+|trakt\.tv\/users\/[\w.-]+|kinorium\.com\/user\/\d+|fantlab\.ru\/user\d+|goodreads\.com\/user\/show\/\d+|livelib\.ru\/reader\/[\w.-]+)\/?/gi;
const site = (url: string) => /kinopoisk/.test(url) ? 'Кинопоиск' : /letterboxd/.test(url) ? 'Letterboxd' : /trakt/.test(url) ? 'Trakt'
  : /fantlab/.test(url) ? 'Фантлаб' : /goodreads/.test(url) ? 'Goodreads' : /livelib/.test(url) ? 'LiveLib' : 'Кинориум';
// служебные разделы Letterboxd — не профиль человека: /film/…, /films/, /lists/ и т. п.; official — аккаунт самого сервиса
const LB_SERVICE = /letterboxd\.com\/(?:film|films|lists?|journal|members|search|about|pro|tag|actor|director|crew|people|showdown|year|official)$/i;

/** Ссылка на пост публичного канала; у комментария — на пост с открытым обсуждением. */
export function postLink(channel: string, msg: number, parent?: number): string {
  return parent ? `https://t.me/${channel}/${parent}?comment=${msg}` : `https://t.me/${channel}/${msg}`;
}

/** Один человек — один профиль, свежее сообщение главнее; новые сверху. */
export function viewerProfiles(found: FoundPost[]): ViewerProfile[] {
  const profiles = new Map<string, ViewerProfile>();
  for (const f of found) {
    for (const m of (f.text ?? '').matchAll(PROFILE)) {
      const url = m[0].replace(/\/$/, '');
      if (LB_SERVICE.test(url)) continue;
      const prev = profiles.get(url.toLowerCase());
      if (prev && (prev.date ?? '') >= (f.date ?? '')) continue;
      // русскоязычный адресат: Кинопоиск и Кинориум — всегда, остальные — по кириллице в сообщении или названии канала
      const ru = /kinopoisk|kinorium/i.test(url) || /[а-яё]/i.test(`${f.text ?? ''} ${f.title ?? ''}`);
      profiles.set(url.toLowerCase(), { url, site: site(url), ru, channel: f.channel, channelTitle: f.title, date: f.date,
        text: (f.text ?? '').replace(/\s+/g, ' ').trim().slice(0, 240), link: postLink(f.channel, f.msg_id, f.parent_id) });
    }
  }
  return [...profiles.values()].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
}

/** Ник Letterboxd из ссылки профиля — имя файла истории seeds/letterboxd-<ник>.json. */
export const letterboxdUser = (url: string) => /letterboxd\.com\/([\w.-]+)/i.exec(url)?.[1];
