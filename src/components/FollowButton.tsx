import { useEffect, useState } from 'react';
import { followsAvailable, getFollows, onFollowsChange, setFollow, type FollowTarget } from '@/api';
import { tap, webApp } from '@/lib/telegram';
import { useToast } from './Toast';
import { Button } from './Button';
import ui from '@/i18n';

/** Разрешение боту писать первым (Bot API 6.9+). Уже разрешено — Telegram отвечает сразу, без окна.
 *  Вне Telegram и у старых клиентов спросить нечем — пусть решает сервер (403 → не шлём). */
function writeAccess(): Promise<boolean> {
  const wa = webApp();
  if (!wa?.requestWriteAccess || !wa.isVersionAtLeast('6.9')) return Promise.resolve(true);
  return new Promise((resolve) => wa.requestWriteAccess!((granted) => resolve(granted)));
}

/** «Следить» за героем или произведением (06.10): новые разборы о нём бот присылает сводкой раз в день
 *  (worker/follow.ts). Первая подписка спрашивает у Telegram разрешение писать. */
export function FollowButton({ target }: { target: FollowTarget | undefined }) {
  const toast = useToast();
  const [on, setOn] = useState<boolean | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const ref = target?.ref;
  const kind = target?.kind;
  useEffect(() => {
    if (!ref || !followsAvailable()) return undefined;
    const pick = (list: { kind: string; ref: string }[]) => setOn(list.some((f) => f.kind === kind && f.ref === ref));
    void getFollows().then(pick);
    return onFollowsChange(pick);
  }, [kind, ref]);
  if (!target || !followsAvailable() || on === undefined) return null;
  const toggle = async () => {
    tap();
    setBusy(true);
    try {
      if (!on && !(await writeAccess())) { toast({ text: ui.follow.denied }); return; }
      await setFollow(target, !on);
      toast({ text: on ? ui.follow.removed : ui.follow.added });
    } catch (err) {
      toast({ text: (err as Error).message === 'too_many' ? ui.follow.tooMany : ui.follow.error });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant={on ? 'secondary' : 'quiet'} pressed={on} disabled={busy} onClick={() => void toggle()}
            aria-label={on ? ui.follow.labelOn(target.title) : ui.follow.label(target.title)}>
      {on ? `✓ ${ui.follow.on}` : ui.follow.button}
    </Button>
  );
}
