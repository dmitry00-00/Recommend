import { useNavigate } from 'react-router-dom';
import { EmptyState } from '@/components';
import ru from '@/i18n/ru';

/** Экран механики (карта) при выключенной механике: по прямой ссылке — не пустота, а
 *  объяснение и путь в настройки. */
export function MechanicsOff() {
  const navigate = useNavigate();
  return (
    <main className="tm-shell__main">
      <EmptyState title={ru.mechanics.offTitle} text={ru.mechanics.offText}
                  action={ru.mechanics.openSettings} onAction={() => navigate('/settings')} />
    </main>
  );
}
