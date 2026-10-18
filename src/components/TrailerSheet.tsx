import * as RD from '@radix-ui/react-dialog';
import type { Trailer } from '@/api';
import type { WorkCard } from '@/types/tmdf';
import { useYouTubePlayer } from './InlineTrailer';
import ui from '@/i18n';

/** Трейлер шторкой поверх списка (15.10; с 17.10 — из строки поиска): встроенный плеер YouTube (youtube-nocookie — без
 *  cookies до запуска), запуск сразу — касание, которое его открыло, и есть жест пользователя. В России YouTube замедлен:
 *  «Открыть на YouTube» всегда под плеером, а не заиграл за 8 с — подсказка «Не грузится? Открыть в YouTube» поверх него.
 *  Замер (18.10) — тот же, что у трейлера на кадре (useYouTubePlayer): `trailer_play` / `trailer_stall` с местом `place`;
 *  `trailer` (открыл) шлёт тот, кто открыл шторку. */
export function TrailerSheet({ trailer, title, work, place = 'search', onClose }: {
  trailer?: Trailer; title: string; work?: WorkCard; place?: string; onClose: () => void;
}) {
  return (
    <RD.Root open={trailer != null} onOpenChange={(o) => { if (!o) onClose(); }}>
      <RD.Portal>
        <RD.Overlay className="tm-overlay" />
        <RD.Content className="tm-trailer" aria-describedby={undefined}>
          <RD.Title className="tm-sr">{ui.trailer.title(title)}</RD.Title>
          {trailer ? <SheetPlayer key={trailer.key} trailer={trailer} title={title} work={work} place={place} /> : null}
        </RD.Content>
      </RD.Portal>
    </RD.Root>
  );
}

/** Плеер шторки: на каждый ролик свой (key), чтобы замер и «не грузится» считались заново. */
function SheetPlayer({ trailer, title, work, place }: { trailer: Trailer; title: string; work?: WorkCard; place: string }) {
  const { frame, src, onLoad, stalled, dead, playing, toYouTube } = useYouTubePlayer(work?.id, trailer, place);
  return (
    <>
      <div className="tm-trailer__frame">
        {/* плеер так и не ответил (YouTube закрыт) — вместо серой страницы ошибки чёрный кадр с подсказкой */}
        <iframe ref={frame} src={src} title={trailer.name || ui.trailer.title(title)} onLoad={onLoad} style={dead ? { opacity: 0 } : undefined}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        {stalled && !playing ? (
          <button type="button" className="tm-itrailer__stall" onClick={toYouTube}>{ui.trailer.stall}</button>
        ) : null}
      </div>
      <div className="tm-trailer__bar">
        <span className="tm-caption tm-trailer__name">{trailer.name}</span>
        <button type="button" className="tm-voice__chip" onClick={toYouTube}>{ui.trailer.youtube}</button>
        <RD.Close className="tm-voice__chip">{ui.actions.close}</RD.Close>
      </div>
    </>
  );
}
