import type { WorkCard } from '@/types/tmdf';
import { prepareShare, shareParam, type ShareCard } from '@/api';
import { appLink, shareLink, tap, webApp } from '@/lib/telegram';
import { useToast } from './Toast';
import { Button } from './Button';
import ui from '@/i18n';

/** Герой для «Поделиться»: id — элемент Wikidata, `where` — его произведения строкой. */
/** Герой со ссылкой: элемент Wikidata или номер An API of Ice and Fire у героев Вестероса без элемента. */
export const HERO_ID = /^(Q\d+|aoiaf-\d+)$/;

export interface ShareHero { id: string; name: string; where?: string; image?: string }

/** «Поделиться» карточкой фильма, сериала, книги или героя (05.10). В Telegram (Bot API 8.0+) — карточкой-
 *  сообщением: сервер готовит постер, название и кнопку, а Telegram открывает свой выбор чата (06.10).
 *  Иначе — ссылкой, которая открывает мини-приложение сразу на карточке (`startapp`, см. `openShared`).
 *  `round` — кружок в углу кадра шторки, рядом с ⚑ и ×; без него — обычная тихая кнопка для страницы. */
export function ShareButton({ work, hero, round }: { work?: WorkCard; hero?: ShareHero; round?: boolean }) {
  const toast = useToast();
  // герой (06.10) — `h-<элемент Wikidata>`, как в инлайн-режиме бота
  const param = hero ? (HERO_ID.test(hero.id) ? `h-${hero.id}` : undefined) : work ? shareParam(work) : undefined;
  if (!param) return null;
  const card = (): ShareCard => hero
    ? { param, title: hero.name, kind: 'character', ...(hero.where ? { by: hero.where } : {}), ...(hero.image ? { image: hero.image } : {}) }
    : { param, title: work!.title, ...(work!.year ? { year: work!.year } : {}), kind: work!.type === 'series' || work!.type === 'book' ? work!.type : 'film',
        ...(work!.creators?.[0] ? { by: work!.creators[0] } : {}), ...((work!.coverUrl ?? work!.stillUrl) ? { image: work!.coverUrl ?? work!.stillUrl } : {}) };
  const byLink = () => shareLink(appLink(param), hero ? ui.share.heroText(hero.name) : ui.share.text(work!.title, work!.year)).then((r) => {
    if (r === 'copied') toast({ text: ui.share.copied });
    if (r === 'failed') toast({ text: ui.share.failed });
  }).catch(() => toast({ text: ui.share.failed }));
  const share = async () => {
    tap();
    const wa = webApp();
    if (wa?.shareMessage && wa.isVersionAtLeast('8.0')) {
      const id = await prepareShare(card());
      if (id) { wa.shareMessage(id, (sent) => { if (sent) toast({ text: ui.share.sent }); }); return; }
    }
    await byLink();
  };
  return round ? (
    <button type="button" className="tm-worksheet__share" aria-label={ui.share.label} title={ui.share.label} onClick={() => void share()}>
      <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v12" /><path d="M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
      </svg>
    </button>
  ) : (
    <Button size="sm" variant="quiet" onClick={() => void share()} aria-label={ui.share.label}>{ui.share.button}</Button>
  );
}
