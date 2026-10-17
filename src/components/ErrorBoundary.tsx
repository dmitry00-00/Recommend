import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { isChunkError, reloadOnce, reloadPending } from '@/lib/reload';
import ui from '@/i18n';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** смена ключа сбрасывает ошибку — в оболочке это `location.key`: ушли на другой экран, и он рисуется заново */
  resetKey?: unknown;
  /** 'screen' — вместо экрана внутри оболочки (меню остаётся); 'app' — над всем приложением, своей рамкой */
  scope?: 'screen' | 'app';
}

/** Граница ошибок (17.10, аудит отказоустойчивости, п. 1): без неё любое исключение при отрисовке или
 *  незагрузившийся ленивый экран снимали всё дерево — белый экран до переоткрытия. Две границы: вокруг экранов
 *  в оболочке (сброс по смене маршрута, меню живо) и верхняя над App — на случай сбоя самой оболочки.
 *  Чанк прошлой выкладки — сразу одна перезагрузка (lib/reload), иначе — экран с кнопкой «Обновить». */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  // флаг, а не сама ошибка: бросить можно и null
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  componentDidCatch(error: unknown, _info: ErrorInfo) {
    // в консоль ошибку пишет корень (onCaughtError в main.tsx) — здесь только перезагрузка за новыми чанками
    if (isChunkError(error)) reloadOnce();
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) this.setState({ failed: false });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // за новыми чанками уже перезагружаемся — пустой экран на миг, а не вспышка «Не удалось открыть»
    if (reloadPending()) return <main className="tm-shell__main" aria-busy="true" />;
    const screen = (
      <main className="tm-shell__main">
        <ErrorState title={ui.state.crashTitle} text={ui.state.crashText} action={ui.state.reload}
                    onRetry={() => location.reload()} />
      </main>
    );
    // над App оболочки нет — рамку и фон даём сами, чтобы экран не висел на голой странице
    return this.props.scope === 'app'
      ? <div className="tm-shell tm-shell--mobile tm-shell--app">{screen}</div>
      : screen;
  }
}
