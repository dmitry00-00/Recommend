import { voices, voiceKeys } from '@/mocks/voices';
import type { ExternalAnalysis, Voice, VoiceOutlet, WorkVoice } from '@/types/tmdf';

const byId = new Map(voices.map((v) => [v.id, v]));

/** Общий поиск YouTube «фильм + канал». Не поиск внутри канала (`/@канал/search?query=`):
 *  приложение YouTube на телефоне такой адрес не понимает и открывает главную канала, а
 *  из мини-приложения ссылки на телефоне уходят именно в него (замечание владельца 29.09). */
export const youtubeSearchUrl = (film: string, channel: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(`${film} ${channel}`)}`;

/** Куда ведёт значок площадки у автора в карточке фильма: на его материал об этом фильме на
 *  этой площадке; нет такого — на поиск фильма у автора; не знаем фильма — на сам канал.
 *  Раньше значок всегда вёл на главную канала, даже когда разбор лежал рядом. */
export function outletUrl(o: VoiceOutlet, items: ExternalAnalysis[], workTitle?: string): string {
  if (o.kind !== 'chat') {
    const here = items.filter((a) => a.platform === o.kind);
    const own = here.find((a) => !a.unverified) ?? here[0];
    if (own) return own.url;
  }
  if (!workTitle) return o.url;
  if (o.kind === 'youtube') return youtubeSearchUrl(workTitle, o.title);
  const handle = o.kind === 'telegram' ? /t\.me\/(?:s\/)?([A-Za-z0-9_]{4,})\/?$/i.exec(o.url)?.[1] : undefined;
  return handle ? `https://t.me/s/${handle}?q=${encodeURIComponent(workTitle)}` : o.url;
}

/** Есть ли такой автор в справочнике: у самодельного (канал, которого мы не знаем) нет ни
 *  выходов, ни страницы, и вести на неё некуда. */
export function knownVoice(id: string): Voice | undefined {
  return byId.get(id);
}

/** Где материал лежит: пост — в телеграм-канале (handle зашит в id, `tg-episodesfilm-95`),
 *  ролик — на ютуб-канале (поле `author` пришло из YouTube API и врать не может).
 *  По каналу, а не по `author`: в поле автора у поста может стоять тот, у кого он переслан. */
export function voiceKeyOf(a: ExternalAnalysis): string {
  const handle = /^tg-([^-]+)-/.exec(a.id)?.[1];
  return handle ? `tg:${handle}` : `yt:${a.author}`;
}

/** Автор материала. Незнакомый канал становится автором без выходов и без аватара:
 *  потерять материал хуже, чем показать монограмму. */
export function voiceOf(a: ExternalAnalysis): Voice {
  const key = voiceKeyOf(a);
  const known = byId.get(voiceKeys[key] ?? '');
  if (known) return known;
  return { id: key, title: a.author, short: a.author, role: 'author', outlets: [] };
}

/** Автор, под чьим именем вышел материал, если это не сам канал: пересланный пост или
 *  выложенный в канале чужой ролик. Имя канала на другой площадке за чужое не считаем:
 *  «4то за Персонаж?» на YouTube — тот же автор, что «Что за персонаж?» в Telegram. */
export function creditOf(a: ExternalAnalysis, voice: Voice): string | undefined {
  if (!a.author || a.author === voice.title) return undefined;
  if (voice.outlets.some((o) => o.title === a.author)) return undefined;
  return a.author;
}

const stamp = (a: ExternalAnalysis) => (a.publishedAt ? Date.parse(a.publishedAt) : 0);

/** Материалы по авторам. Порядок: сначала подтверждённые руками, потом у кого материала
 *  больше, потом свежие. Площадки и студии сюда не попадают — их посты про свои премьеры
 *  разбором не являются (решение владельца 23.09). */
export function groupByVoice(items: ExternalAnalysis[]): WorkVoice[] {
  const groups = new Map<string, WorkVoice>();
  for (const a of items) {
    // обзоры человеку не показываем (владелец, 29.09): они для подбора, не для чтения
    if (a.tier === 'review') continue;
    const voice = voiceOf(a);
    if (voice.role !== 'author') continue;
    const group = groups.get(voice.id) ?? { voice, items: [] };
    group.items.push(a);
    groups.set(voice.id, group);
  }
  for (const g of groups.values()) {
    g.items.sort((x, y) => Number(!!x.unverified) - Number(!!y.unverified) || stamp(y) - stamp(x));
  }
  const verified = (g: WorkVoice) => (g.items.some((a) => !a.unverified) ? 0 : 1);
  return [...groups.values()].sort(
    (a, b) => verified(a) - verified(b) || b.items.length - a.items.length || stamp(b.items[0]) - stamp(a.items[0]),
  );
}

/** Монограмма вместо аватара: первая буква имени и цвет из самого имени — так автор без
 *  картинки всё равно узнаётся на своём месте в строке. */
export function monogram(title: string): { letter: string; hue: number } {
  const letter = [...title.replace(/[^\p{L}\p{N}]/gu, '')][0]?.toUpperCase() ?? '?';
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.codePointAt(0)!) % 360;
  return { letter, hue: hash };
}
