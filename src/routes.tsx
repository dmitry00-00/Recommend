import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Skeleton } from '@/components/Skeleton';
import { loadSettings, useMechanics, useRole, useSettings } from '@/lib/settingsStore';
import { useFeature, type Feature } from '@/lib/flags';
// Редкие экраны (механика, кураторская, задания участника) — отдельными кусками: в основной
// бандл идёт только то, что нужно ленте, поиску, карточке и архиву (трек А, цель — меньше
// 200 КБ gzip).
import { TodayScreen } from '@/screens/TodayScreen';
import { WorkScreen } from '@/screens/WorkScreen';
import { OpenSharedScreen } from '@/screens/OpenSharedScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { RateScreen } from '@/screens/RateScreen';
// «Под настроение» и страница автора (ДФ-4, 14.10) — тоже кусками: с ленты в них уходят не сразу и не все
const MoodScreen = lazy(() => import('@/screens/MoodScreen').then((m) => ({ default: m.MoodScreen })));
const VoiceScreen = lazy(() => import('@/screens/VoiceScreen').then((m) => ({ default: m.VoiceScreen })));
const LoopScreen = lazy(() => import('@/screens/LoopScreen').then((m) => ({ default: m.LoopScreen })));
const OwnerDeskScreen = lazy(() => import('@/screens/OwnerDeskScreen').then((m) => ({ default: m.OwnerDeskScreen })));
const MapScreen = lazy(() => import('@/screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const TrajectoriesScreen = lazy(() => import('@/screens/TrajectoriesScreen').then((m) => ({ default: m.TrajectoriesScreen })));
const UniverseScreen = lazy(() => import('@/screens/UniverseScreen').then((m) => ({ default: m.UniverseScreen })));
const CharacterScreen = lazy(() => import('@/screens/CharacterScreen').then((m) => ({ default: m.CharacterScreen })));
const PersonScreen = lazy(() => import('@/screens/PersonScreen').then((m) => ({ default: m.PersonScreen })));
const SubscriptionPlanScreen = lazy(() => import('@/screens/SubscriptionPlanScreen').then((m) => ({ default: m.SubscriptionPlanScreen })));
const StatsScreen = lazy(() => import('@/screens/StatsScreen').then((m) => ({ default: m.StatsScreen })));
const TrajectoryScreen = lazy(() => import('@/screens/TrajectoryScreen').then((m) => ({ default: m.TrajectoryScreen })));
import { JournalScreen } from '@/screens/JournalScreen';
import { JournalEntryScreen } from '@/screens/JournalEntryScreen';
import { CheckInScreen } from '@/screens/CheckInScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })));
const AssessmentScreen = lazy(() => import('@/screens/AssessmentScreen').then((m) => ({ default: m.AssessmentScreen })));
const StartScreen = lazy(() => import('@/screens/StartScreen').then((m) => ({ default: m.StartScreen })));
const FirstMapScreen = lazy(() => import('@/screens/FirstMapScreen').then((m) => ({ default: m.FirstMapScreen })));
import { SettingsScreen } from '@/screens/SettingsScreen';
import { LegalScreen } from '@/screens/LegalScreen';
import { TogetherScreen } from '@/screens/TogetherScreen';
import { CollectionsScreen } from '@/screens/CollectionsScreen';
import { LoginScreen } from '@/screens/LoginScreen';
const ContributorScreen = lazy(() => import('@/screens/ContributorScreen').then((m) => ({ default: m.ContributorScreen })));
const ContributorTaskScreen = lazy(() => import('@/screens/ContributorTaskScreen').then((m) => ({ default: m.ContributorTaskScreen })));
const ContributorProfileScreen = lazy(() => import('@/screens/ContributorProfileScreen').then((m) => ({ default: m.ContributorProfileScreen })));
const CuratorQueueScreen = lazy(() => import('@/screens/curator/CuratorQueueScreen').then((m) => ({ default: m.CuratorQueueScreen })));
const AnnotationReviewScreen = lazy(() => import('@/screens/curator/AnnotationReviewScreen').then((m) => ({ default: m.AnnotationReviewScreen })));
const simple = () => import('@/screens/curator/CuratorSimpleScreens');
const AgreementScreen = lazy(() => simple().then((m) => ({ default: m.AgreementScreen })));
const ContributorsScreen = lazy(() => simple().then((m) => ({ default: m.ContributorsScreen })));
const EvaluationScreen = lazy(() => simple().then((m) => ({ default: m.EvaluationScreen })));
const GoldScreen = lazy(() => simple().then((m) => ({ default: m.GoldScreen })));
const MappingsScreen = lazy(() => simple().then((m) => ({ default: m.MappingsScreen })));
const PacketsScreen = lazy(() => simple().then((m) => ({ default: m.PacketsScreen })));
const RunsScreen = lazy(() => simple().then((m) => ({ default: m.RunsScreen })));
const SourcesScreen = lazy(() => simple().then((m) => ({ default: m.SourcesScreen })));
const TaxonomyScreen = lazy(() => simple().then((m) => ({ default: m.TaxonomyScreen })));

/** Пока кусок экрана грузится (на медленной сети — секунды): заголовок и строки-заготовки, как у самих экранов,
 *  а не пустое место под меню. Остальные отложенные экраны редкие — у них по-прежнему пусто (App.tsx). */
export function ScreenLoading() {
  return (
    <main className="tm-shell__main" aria-busy="true">
      <Skeleton kind="title" style={{ width: '60%' }} />
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} kind="block" style={{ height: 74, marginTop: i ? 8 : 16 }} />)}
    </main>
  );
}
const Loading = ({ children }: { children: ReactNode }) => <Suspense fallback={<ScreenLoading />}>{children}</Suspense>;

/** Только админу (ТВ-3в, 06.10): статистика, петля прогноза, кураторская, разметка владельца. Роль
 *  приходит с настройками — до них ничего не решаем; не админа уводим в ленту. */
function AdminOnly({ children }: { children: ReactNode }) {
  const role = useRole();
  useEffect(() => { void loadSettings(); }, []);
  // до настроек — заготовки, а не пустота: без экрана меню оболочки встаёт наверх, под кнопки Telegram (16.10)
  if (role === undefined) return <ScreenLoading />;
  return role === 'admin' ? <>{children}</> : <Navigate to="/today" replace />;
}

/** Функция эталона (10.10): в минимальной редакции экрана нет — по старой ссылке уводим в ленту.
 *  До загрузки настроек не решаем: админ с прямой ссылкой не должен вылететь в ленту. */
function Gate({ f, children }: { f: Feature; children: ReactNode }) {
  const loaded = useSettings() != null;
  const on = useFeature(f);
  useEffect(() => { void loadSettings(); }, []);
  if (!loaded) return <ScreenLoading />;
  return on ? <>{children}</> : <Navigate to="/today" replace />;
}

/** Старая диагностика (ТВ-14, 16.10, решение владельца): приветствие → анкета → задания → первая карта — только с
 *  «Показывать механику»; участнику в Telegram она недостижима и не нужна, по старой ссылке — в ленту. */
function MechanicsOnly({ children }: { children: ReactNode }) {
  const loaded = useSettings() != null;
  const on = useMechanics();
  useEffect(() => { void loadSettings(); }, []);
  if (!loaded) return <ScreenLoading />;
  return on ? <>{children}</> : <Navigate to="/today" replace />;
}

/** Роуты §17. Все экраны перенесены (22.09). */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/today" replace /> },
  { path: '/today', element: <TodayScreen /> },
  { path: '/welcome', element: <MechanicsOnly><WelcomeScreen /></MechanicsOnly> },
  // первый вход свайпом (ДФ-2): «Сегодня» уводит сюда нового человека из доли `swipeStart`
  { path: '/start', element: <Gate f="swipeStart"><Loading><StartScreen /></Loading></Gate> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/onboarding', element: <MechanicsOnly><OnboardingScreen /></MechanicsOnly> },
  { path: '/assessment/:id', element: <MechanicsOnly><AssessmentScreen /></MechanicsOnly> },
  { path: '/onboarding/map', element: <MechanicsOnly><FirstMapScreen /></MechanicsOnly> },
  { path: '/search', element: <Gate f="search"><SearchScreen /></Gate> },
  { path: '/mood', element: <Gate f="search"><Loading><MoodScreen /></Loading></Gate> },
  { path: '/rate', element: <RateScreen /> },
  { path: '/voice/:id', element: <Gate f="pages"><Loading><VoiceScreen /></Loading></Gate> },
  { path: '/works/:id', element: <WorkScreen /> },
  { path: '/open/:param', element: <OpenSharedScreen /> },
  { path: '/person/:id', element: <Gate f="pages"><PersonScreen /></Gate> },
  { path: '/universe/:id', element: <Gate f="pages"><UniverseScreen /></Gate> },
  { path: '/character/:id', element: <Gate f="pages"><CharacterScreen /></Gate> },
  { path: '/stats/:kind/:id', element: <AdminOnly><StatsScreen /></AdminOnly> },
  { path: '/trajectories', element: <TrajectoriesScreen /> },
  { path: '/trajectories/:id', element: <TrajectoryScreen /> },
  { path: '/map', element: <MapScreen /> },
  { path: '/journal', element: <Gate f="plans"><JournalScreen /></Gate> },
  { path: '/journal/:entryId', element: <Gate f="diary"><JournalEntryScreen /></Gate> },
  { path: '/journal/:entryId/check-in', element: <Gate f="diary"><CheckInScreen /></Gate> },
  { path: '/checkpoint/:id', element: <MechanicsOnly><AssessmentScreen checkpoint /></MechanicsOnly> },
  { path: '/settings', element: <SettingsScreen /> },
  // какая подписка подходит (15.10): по планам и ленте — по очереди, пара, каждая площадка
  { path: '/subscriptions', element: <Gate f="subscriptions"><Loading><SubscriptionPlanScreen /></Loading></Gate> },
  // документы (ЗП-5): /legal/rules — как работает подбор, /legal/privacy — политика данных
  { path: '/legal/:doc', element: <LegalScreen /> },
  // выбор компанией (ЗП-11): /together — собрать десятку, /together/:id — голосовать и итог
  { path: '/together', element: <Gate f="together"><TogetherScreen /></Gate> },
  { path: '/together/:id', element: <TogetherScreen /> },
  { path: '/collections', element: <Gate f="collections"><CollectionsScreen /></Gate> },
  { path: '/collections/:id', element: <Gate f="collections"><CollectionsScreen /></Gate> },
  { path: '/loop', element: <AdminOnly><LoopScreen /></AdminOnly> },
  { path: '/owner', element: <AdminOnly><OwnerDeskScreen /></AdminOnly> },
  { path: '/curator', element: <AdminOnly><CuratorQueueScreen /></AdminOnly> },
  { path: '/curator/annotations/:id', element: <AdminOnly><AnnotationReviewScreen /></AdminOnly> },
  { path: '/curator/taxonomy', element: <AdminOnly><TaxonomyScreen /></AdminOnly> },
  { path: '/curator/runs', element: <AdminOnly><RunsScreen /></AdminOnly> },
  { path: '/curator/packets', element: <AdminOnly><PacketsScreen /></AdminOnly> },
  { path: '/curator/gold', element: <AdminOnly><GoldScreen /></AdminOnly> },
  { path: '/curator/evaluation', element: <AdminOnly><EvaluationScreen /></AdminOnly> },
  { path: '/curator/contributors', element: <AdminOnly><ContributorsScreen /></AdminOnly> },
  { path: '/curator/agreement', element: <AdminOnly><AgreementScreen /></AdminOnly> },
  { path: '/curator/mappings', element: <AdminOnly><MappingsScreen /></AdminOnly> },
  { path: '/curator/sources', element: <AdminOnly><SourcesScreen /></AdminOnly> },
  { path: '/contribute', element: <ContributorScreen /> },
  { path: '/contribute/tasks/:id', element: <ContributorTaskScreen /> },
  { path: '/contribute/profile', element: <ContributorProfileScreen /> },
  // незнакомый путь (старая ссылка, адрес из Telegram с лишним хвостом) — в ленту, а не пустой экран с одним меню
  { path: '*', element: <Navigate to="/today" replace /> },
];
