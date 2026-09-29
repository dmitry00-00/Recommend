import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ErrorState, Skeleton } from '@/components';
import { loginAsDemo, loginWithTelegram } from '@/api';
import { BOT_USERNAME, initData, isTelegram } from '@/lib/telegram';
import ru from '@/i18n/ru';

/** Вход (/login). Внутри Telegram экран сам обменивает `initData` на сессию и уходит на
 *  «Сегодня»: в мини-приложении другого входа не бывает. Снаружи — ссылка на бота и демо.
 *  Подпись `initData` проверяет сервер (`verifyInitData` в `src/lib/telegramAuth.ts`);
 *  пока сервера нет, сессия честно помечена непроверенной — это видно в настройках. */
export function LoginScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inTelegram = isTelegram();
  const [failed, setFailed] = useState(params.get('error') === '1');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inTelegram || failed) return;
    let alive = true;
    setBusy(true);
    loginWithTelegram(initData())
      .then(() => alive && navigate('/today', { replace: true }))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setBusy(false));
    return () => { alive = false; };
  }, [inTelegram, failed, navigate]);

  const demo = () => {
    setBusy(true);
    loginAsDemo().then(() => navigate('/welcome')).finally(() => setBusy(false));
  };

  return (
    <main className="tm-shell__main">
      <h1 className="tm-shell__title">{ru.login.title}</h1>
      {failed ? (
        <ErrorState title={ru.login.errorTitle} text={ru.login.errorText}
                    onRetry={() => { setFailed(false); }} className="tm-login__error" />
      ) : null}
      {inTelegram && !failed ? (
        <>
          <p className="tm-body tm-login__lead">{ru.login.inTelegram}</p>
          <Skeleton kind="line" style={{ width: 180 }} />
        </>
      ) : null}
      {!inTelegram ? (
        <>
          <p className="tm-body tm-login__lead">{ru.login.lead}</p>
          <div className="tm-row tm-row--gap-2 tm-row--wrap">
            <Button variant="primary" href={`https://t.me/${BOT_USERNAME}`}>{ru.login.open}</Button>
            <Button variant="quiet" loading={busy} onClick={demo}>{ru.login.demo}</Button>
          </div>
        </>
      ) : null}
    </main>
  );
}
