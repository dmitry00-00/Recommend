import type { WorkCard } from '@/types/tmdf';
import { noteShare, prepareShare, shareParam, type ShareCard, type ShareWhat } from '@/api';
import { appLink, shareLink, tap, webApp } from '@/lib/telegram';
import { useToast } from './Toast';
import { Button } from './Button';
import ui from '@/i18n';

/** Герой для «Поделиться»: id — элемент Wikidata, `where` — его произведения строкой. */
/** Герой со ссылкой: элемент Wikidata или номер An API of Ice and Fire у героев Вестероса без элемента. */
export const HERO_ID = /^(Q\d+|aoiaf-\d+)$/;

export interface ShareHero { id: string; name: string; where?: string; image?: string }
/** Страница человека или вселенной (25.10): `p-<Q>` / `u-<Q>` — App.tsx открывает их по ссылке */
export interface SharePage { kind: 'person' | 'universe'; id: string; title: string; about?: string; image?: string }

/** Действие «Поделиться» без кнопки (17.10): шапка шторки зовёт его из меню «⋯». Поделиться нечем — undefined. */
export function useShare({ work, hero, page }: { work?: WorkCard; hero?: ShareHero; page?: SharePage }): (() => Promise<void>) | undefined {
  const toast = useToast();
  // герой (06.10) — `h-<элемент Wikidata>`, как в инлайн-режиме бота; человек и вселенная (25.10) — `p-` / `u-<Q>`
  const param = page ? (/^Q\d{1,12}$/.test(page.id) ? `${page.kind === 'person' ? 'p' : 'u'}-${page.id}` : undefined)
    : hero ? (HERO_ID.test(hero.id) ? `h-${hero.id}` : undefined) : work ? shareParam(work) : undefined;
  if (!param) return undefined;
  const card = (): ShareCard => page
    ? { param, title: page.title, kind: page.kind, ...(page.about ? { about: page.about } : {}), ...(page.image ? { image: page.image } : {}) }
    : hero
    ? { param, title: hero.name, kind: 'character', ...(hero.where ? { by: hero.where } : {}), ...(hero.image ? { image: hero.image } : {}) }
    : { param, title: work!.title, ...(work!.year ? { year: work!.year } : {}), kind: work!.type === 'series' || work!.type === 'book' ? work!.type : 'film',
        ...(work!.creators?.[0] ? { by: work!.creators[0] } : {}), ...((work!.coverUrl ?? work!.stillUrl) ? { image: work!.coverUrl ?? work!.stillUrl } : {}) };
  // что делится — для «поделился» (МА-3)
  const what: ShareWhat = page ? page.kind : hero ? 'character' : work!.type === 'series' || work!.type === 'book' ? work!.type : 'film';
  const text = page ? (page.kind === 'person' ? ui.share.personText(page.title) : ui.share.universeText(page.title))
    : hero ? ui.share.heroText(hero.name) : ui.share.text(work!.title, work!.year);
  const byLink = () => shareLink(appLink(param), text).then((r) => {
    if (r !== 'failed') noteShare(what, r, work?.id);
    if (r === 'copied') toast({ text: ui.share.copied });
    if (r === 'failed') toast({ text: ui.share.failed });
  }).catch(() => toast({ text: ui.share.failed }));
  const share = async () => {
    tap();
    const wa = webApp();
    if (wa?.shareMessage && wa.isVersionAtLeast('8.0')) {
      const id = await prepareShare(card());
      if (id) { wa.shareMessage(id, (sent) => { if (sent) { toast({ text: ui.share.sent }); noteShare(what, 'message', work?.id); } }); return; }
    }
    await byLink();
  };
  return share;
}

/** «Поделиться» карточкой фильма, сериала, книги или героя (05.10). В Telegram (Bot API 8.0+) — карточкой-
 *  сообщением: сервер готовит постер, название и кнопку, а Telegram открывает свой выбор чата (06.10).
 *  Иначе — ссылкой, которая открывает мини-приложение сразу на карточке (`startapp`, см. `openShared`).
 *  `round` — кружок в углу кадра (с 17.10 шторка зовёт `useShare` из меню «⋯»); без него — обычная тихая кнопка для страницы. */
export function ShareButton({ work, hero, page, round }: { work?: WorkCard; hero?: ShareHero; page?: SharePage; round?: boolean }) {
  const share = useShare({ work, hero, page });
  if (!share) return null;
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
