import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CognitiveMapData, RecommendationSlate } from '@/types/tmdf';
import { getMap, getSlate } from '@/api';
import { Button, CognitiveMap, Skeleton, WorkCover } from '@/components';
import ui from '@/i18n';
import { useMechanics } from '@/lib/settingsStore';

/** Приветствие (/welcome): что это за приложение и с чего начать. Карта и кадры здесь —
 *  образцы: до диагностики своей карты нет, а показать, к чему всё идёт, надо. */
export function WelcomeScreen() {
  const mechanics = useMechanics();
  const navigate = useNavigate();
  const [sample, setSample] = useState<{ map: CognitiveMapData; slate: RecommendationSlate } | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([getMap(), getSlate('normal')])
      .then(([map, slate]) => alive && setSample({ map, slate }))
      .catch(() => { /* образцы не обязательны: приветствие живёт и без них */ });
    return () => { alive = false; };
  }, []);

  return (
    <main className="tm-shell__main tm-welcome">
      <h1 className="tm-shell__title">{ui.welcome.title}</h1>
      <p className="tm-body tm-welcome__p">{ui.welcome.lead}</p>
      <p className="tm-body tm-welcome__p">{ui.welcome.how}</p>

      <div className="tm-row tm-row--gap-2 tm-row--wrap tm-welcome__actions">
        <Button variant="primary" onClick={() => navigate('/onboarding')}>{ui.welcome.start}</Button>
        <Button variant="quiet" onClick={() => navigate('/today')}>{ui.welcome.haveMap}</Button>
      </div>

      {mechanics ? (
        <section className="tm-welcome__sample" aria-label={ui.welcome.mapSample}>
          <p className="tm-caption tm-welcome__caption">{ui.welcome.mapSample}</p>
          {sample
            ? <CognitiveMap map={sample.map} compact size={240} />
            : <Skeleton kind="block" style={{ height: 240, width: 240 }} />}
        </section>
      ) : null}

      <section className="tm-welcome__sample" aria-label={ui.welcome.framesSample}>
        <p className="tm-caption tm-welcome__caption">{ui.welcome.framesSample}</p>
        <div className="tm-row tm-row--gap-3 tm-welcome__covers">
          {sample
            ? sample.slate.items.slice(0, 3).map((r) => <WorkCover key={r.id} work={r.work} size="sm" />)
            : [0, 1, 2].map((i) => <Skeleton key={i} kind="block" style={{ width: 84, height: 106 }} />)}
        </div>
      </section>
    </main>
  );
}
