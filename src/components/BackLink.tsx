import { Link, useNavigate } from 'react-router-dom';
import { isTelegram } from '@/lib/telegram';

/** Ссылка «‹ Назад» / «‹ Лента» / «Подборки» вверху вложенного экрана (17.10): только вне Telegram — там её дублирует
 *  кнопка «Назад» в шапке мессенджера (AppShell показывает её на всех неглавных экранах). `to` — ссылка на адрес,
 *  без него — шаг назад по истории. */
export function BackLink({ label, to, className = 'tm-voicepage__back' }: { label: string; to?: string; className?: string }) {
  const navigate = useNavigate();
  if (isTelegram()) return null;
  return to
    ? <Link to={to} className={className}>{label}</Link>
    : <button type="button" className={className} onClick={() => navigate(-1)}>{label}</button>;
}
