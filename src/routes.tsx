import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { lazy, useEffect, type ReactNode } from 'react';
import { loadSettings, useRole } from '@/lib/settingsStore';
// Редкие экраны (механика, кураторская, задания участника) — отдельными кусками: в основной
// бандл идёт только то, что нужно ленте, поиску, карточке и архиву (трек А, цель — меньше
// 200 КБ gzip).
import { TodayScreen } from '@/screens/TodayScreen';
import { WorkScreen } from '@/screens/WorkScreen';
import { OpenSharedScreen } from '@/screens/OpenSharedScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { MoodScreen } from '@/screens/MoodScreen';
import { RateScreen } from '@/screens/RateScreen';
import { VoiceScreen } from '@/screens/VoiceScreen';
const LoopScreen = lazy(() => import('@/screens/LoopScreen').then((m) => ({ default: m.LoopScreen })));
const OwnerDeskScreen = lazy(() => import('@/screens/OwnerDeskScreen').then((m) => ({ default: m.OwnerDeskScreen })));
const MapScreen = lazy(() => import('@/screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const TrajectoriesScreen = lazy(() => import('@/screens/TrajectoriesScreen').then((m) => ({ default: m.TrajectoriesScreen })));
const UniverseScreen = lazy(() => import('@/screens/UniverseScreen').then((m) => ({ default: m.UniverseScreen })));
const CharacterScreen = lazy(() => import('@/screens/CharacterScreen').then((m) => ({ default: m.CharacterScreen })));
const PersonScreen = lazy(() => import('@/screens/PersonScreen').then((m) => ({ default: m.PersonScreen })));
const StatsScreen = lazy(() => import('@/screens/StatsScreen').then((m) => ({ default: m.StatsScreen })));
const TrajectoryScreen = lazy(() => import('@/screens/TrajectoryScreen').then((m) => ({ default: m.TrajectoryScreen })));
import { JournalScreen } from '@/screens/JournalScreen';
import { JournalEntryScreen } from '@/screens/JournalEntryScreen';
import { CheckInScreen } from '@/screens/CheckInScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })));
const AssessmentScreen = lazy(() => import('@/screens/AssessmentScreen').then((m) => ({ default: m.AssessmentScreen })));
const FirstMapScreen = lazy(() => import('@/screens/FirstMapScreen').then((m) => ({ default: m.FirstMapScreen })));
import { SettingsScreen } from '@/screens/SettingsScreen';
import { LegalScreen } from '@/screens/LegalScreen';
import { TogetherScreen } from '@/screens/TogetherScreen';
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

/** Только админу (ТВ-3в, 06.10): статистика, петля прогноза, кураторская, разметка владельца. Роль
 *  приходит с настройками — до них ничего не решаем; не админа уводим в ленту. */
function AdminOnly({ children }: { children: ReactNode }) {
  const role = useRole();
  useEffect(() => { void loadSettings(); }, []);
  if (role === undefined) return null;
  return role === 'admin' ? <>{children}</> : <Navigate to="/today" replace />;
}

/** Роуты §17. Все экраны перенесены (22.09). */
export const routes: RouteObject[] = [
  { path: '/', element: <Navigate to="/today" replace /> },
  { path: '/today', element: <TodayScreen /> },
  { path: '/welcome', element: <WelcomeScreen /> },
  { path: '/login', element: <LoginScreen /> },
  { path: '/onboarding', element: <OnboardingScreen /> },
  { path: '/assessment/:id', element: <AssessmentScreen /> },
  { path: '/onboarding/map', element: <FirstMapScreen /> },
  { path: '/search', element: <SearchScreen /> },
  { path: '/mood', element: <MoodScreen /> },
  { path: '/rate', element: <RateScreen /> },
  { path: '/voice/:id', element: <VoiceScreen /> },
  { path: '/works/:id', element: <WorkScreen /> },
  { path: '/open/:param', element: <OpenSharedScreen /> },
  { path: '/person/:id', element: <PersonScreen /> },
  { path: '/universe/:id', element: <UniverseScreen /> },
  { path: '/character/:id', element: <CharacterScreen /> },
  { path: '/stats/:kind/:id', element: <AdminOnly><StatsScreen /></AdminOnly> },
  { path: '/trajectories', element: <TrajectoriesScreen /> },
  { path: '/trajectories/:id', element: <TrajectoryScreen /> },
  { path: '/map', element: <MapScreen /> },
  { path: '/journal', element: <JournalScreen /> },
  { path: '/journal/:entryId', element: <JournalEntryScreen /> },
  { path: '/journal/:entryId/check-in', element: <CheckInScreen /> },
  { path: '/checkpoint/:id', element: <AssessmentScreen checkpoint /> },
  { path: '/settings', element: <SettingsScreen /> },
  // документы (ЗП-5): /legal/rules — как работает подбор, /legal/privacy — политика данных
  { path: '/legal/:doc', element: <LegalScreen /> },
  // выбор компанией (ЗП-11): /together — собрать десятку, /together/:id — голосовать и итог
  { path: '/together', element: <TogetherScreen /> },
  { path: '/together/:id', element: <TogetherScreen /> },
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
];
