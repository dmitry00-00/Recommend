import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/Toast';
import ui from '@/i18n';

/** Уведомление о рекомендательных технологиях (24.10, ст. 13.56 КоАП, ч. 2 — штраф за неинформирование с 07.2026):
 *  при первом запуске — один тост на всё: подбор, данные, согласие, со ссылкой на правила. Не окно и не запрет: человек
 *  видит ленту, текст уходит сам. Дальше — строка на первом экране новичка (TodayScreen) и раздел «Документы и данные»
 *  в профиле. Хранилище закрыто (приватное окно) — показываем раз за запуск: лучше лишний раз, чем ни разу. */
const SEEN = 'tm.legalNotice';
const DELAY_MS = 2500;

export function useLegalNotice() {
  const toast = useToast();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    let seen: string | null = null;
    try { seen = localStorage.getItem(SEEN); } catch { /* приватное окно */ }
    if (seen) return undefined;
    const mark = () => { try { localStorage.setItem(SEEN, new Date().toISOString()); } catch { /* приватное окно */ } };
    // открыл сами документы (ссылка из бота или BotFather) — уже читает, тост не нужен
    if (pathname.startsWith('/legal/')) { mark(); return undefined; }
    const timer = setTimeout(() => {
      mark();
      toast({ text: `${ui.legal.recTech} ${ui.legal.notice}`, action: ui.legal.noticeAction,
              onAction: () => navigate('/legal/rules'), duration: 15_000 });
    }, DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
}
