import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components';
import ui from '@/i18n';

/** Экран механики (карта) при выключенной механике: по прямой ссылке — не пустота, а
 *  объяснение и путь в настройки. */
export function MechanicsOff() {
  const navigate = useNavigate();
  return (
    <main className="tm-shell__main">
      <EmptyState title={ui.mechanics.offTitle} text={ui.mechanics.offText}
                  action={ui.mechanics.openSettings} onAction={() => navigate('/settings')} />
    </main>
  );
}
