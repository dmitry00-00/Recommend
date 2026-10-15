import * as RD from '@radix-ui/react-dialog';
import type { Trailer } from '@/api';
import { openExternal } from '@/lib/telegram';
import ui from '@/i18n';

/** Трейлер поверх ленты (15.10): встроенный плеер YouTube (youtube-nocookie — без cookies до запуска), запуск сразу —
 *  касание, которое его открыло, и есть жест пользователя. В России YouTube замедлен: если плеер не грузится, под ним
 *  «Открыть на YouTube» — приложение YouTube или браузер справятся лучше встроенного окна. */
export function TrailerSheet({ trailer, title, onClose }: { trailer?: Trailer; title: string; onClose: () => void }) {
  return (
    <RD.Root open={trailer != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <RD.Portal>
        <RD.Overlay className="tm-overlay" />
        <RD.Content className="tm-trailer" aria-describedby={undefined}>
          <RD.Title className="tm-sr">{ui.trailer.title(title)}</RD.Title>
          {trailer ? (
            <>
              <div className="tm-trailer__frame">
                <iframe src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&playsinline=1&rel=0`}
                        title={trailer.name} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen />
              </div>
              <div className="tm-trailer__bar">
                <span className="tm-caption tm-trailer__name">{trailer.name}</span>
                <button type="button" className="tm-voice__chip" onClick={() => openExternal(`https://www.youtube.com/watch?v=${trailer.key}`)}>{ui.trailer.youtube}</button>
                <RD.Close className="tm-voice__chip">{ui.actions.close}</RD.Close>
              </div>
            </>
          ) : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}
