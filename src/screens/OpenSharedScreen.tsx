import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { openShared } from '@/api';
import { useToast } from '@/components';
import ui from '@/i18n';

/** Вход по ссылке «Поделиться» (05.10): `/open/<параметр>` — из `startapp` Telegram (см. App) или
 *  из адреса страницы. Находит карточку по внешнему ключу произведения и уходит на неё; если такого
 *  у нас нет — в поиск, с тостом. В истории браузера этот экран не остаётся (`replace`). */
export function OpenSharedScreen() {
  const { param = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  useEffect(() => {
    let alive = true;
    // герой (инлайн-режим бота, 06.10): `h-<элемент Wikidata>` — сразу на его страницу; герой Вестероса без
    // элемента — `h-aoiaf-<n>` (номер An API of Ice and Fire)
    const hero = /^h-(Q\d+|aoiaf-\d+)$/.exec(param)?.[1];
    if (hero) { navigate(`/character/${hero}`, { replace: true }); return; }
    openShared(param)
      .then((id) => {
        if (!alive) return;
        if (id) navigate(`/works/${encodeURIComponent(id)}`, { replace: true });
        else { toast({ text: ui.share.notFound }); navigate('/search', { replace: true }); }
      })
      .catch(() => { if (alive) navigate('/today', { replace: true }); });
    return () => { alive = false; };
  }, [param]);
  return <main className="tm-shell__main"><p className="tm-caption">{ui.share.opening}</p></main>;
}
