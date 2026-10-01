import type { RouteObject } from 'react-router-dom';
import { Navigate } from 'react-router-dom';
import { lazy } from 'react';
// Редкие экраны (механика, кураторская, задания участника) — отдельными кусками: в основной
// бандл идёт только то, что нужно ленте, поиску, карточке и архиву (трек А, цель — меньше
// 200 КБ gzip).
import { TodayScreen } from '@/screens/TodayScreen';
import { WorkScreen } from '@/screens/WorkScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { RateScreen } from '@/screens/RateScreen';
import { VoiceScreen } from '@/screens/VoiceScreen';
const LoopScreen = lazy(() => import('@/screens/LoopScreen').then((m) => ({ default: m.LoopScreen })));
const MapScreen = lazy(() => import('@/screens/MapScreen').then((m) => ({ default: m.MapScreen })));
const TrajectoriesScreen = lazy(() => import('@/screens/TrajectoriesScreen').then((m) => ({ default: m.TrajectoriesScreen })));
const UniverseScreen = lazy(() => import('@/screens/UniverseScreen').then((m) => ({ default: m.UniverseScreen })));
const CharacterScreen = lazy(() => import('@/screens/CharacterScreen').then((m) => ({ default: m.CharacterScreen })));
const PersonScreen = lazy(() => import('@/screens/PersonScreen').then((m) => ({ default: m.PersonScreen })));
const TrajectoryScreen = lazy(() => import('@/screens/TrajectoryScreen').then((m) => ({ default: m.TrajectoryScreen })));
import { JournalScreen } from '@/screens/JournalScreen';
import { JournalEntryScreen } from '@/screens/JournalEntryScreen';
import { CheckInScreen } from '@/screens/CheckInScreen';
import { WelcomeScreen } from '@/screens/WelcomeScreen';
const OnboardingScreen = lazy(() => import('@/screens/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })));
const AssessmentScreen = lazy(() => import('@/screens/AssessmentScreen').then((m) => ({ default: m.AssessmentScreen })));
const FirstMapScreen = lazy(() => import('@/screens/FirstMapScreen').then((m) => ({ default: m.FirstMapScreen })));
import { SettingsScreen } from '@/screens/SettingsScreen';
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
  { path: '/rate', element: <RateScreen /> },
  { path: '/voice/:id', element: <VoiceScreen /> },
  { path: '/works/:id', element: <WorkScreen /> },
  { path: '/person/:id', element: <PersonScreen /> },
  { path: '/universe/:id', element: <UniverseScreen /> },
  { path: '/character/:id', element: <CharacterScreen /> },
  { path: '/trajectories', element: <TrajectoriesScreen /> },
  { path: '/trajectories/:id', element: <TrajectoryScreen /> },
  { path: '/map', element: <MapScreen /> },
  { path: '/journal', element: <JournalScreen /> },
  { path: '/journal/:entryId', element: <JournalEntryScreen /> },
  { path: '/journal/:entryId/check-in', element: <CheckInScreen /> },
  { path: '/checkpoint/:id', element: <AssessmentScreen checkpoint /> },
  { path: '/settings', element: <SettingsScreen /> },
  { path: '/loop', element: <LoopScreen /> },
  { path: '/curator', element: <CuratorQueueScreen /> },
  { path: '/curator/annotations/:id', element: <AnnotationReviewScreen /> },
  { path: '/curator/taxonomy', element: <TaxonomyScreen /> },
  { path: '/curator/runs', element: <RunsScreen /> },
  { path: '/curator/packets', element: <PacketsScreen /> },
  { path: '/curator/gold', element: <GoldScreen /> },
  { path: '/curator/evaluation', element: <EvaluationScreen /> },
  { path: '/curator/contributors', element: <ContributorsScreen /> },
  { path: '/curator/agreement', element: <AgreementScreen /> },
  { path: '/curator/mappings', element: <MappingsScreen /> },
  { path: '/curator/sources', element: <SourcesScreen /> },
  { path: '/contribute', element: <ContributorScreen /> },
  { path: '/contribute/tasks/:id', element: <ContributorTaskScreen /> },
  { path: '/contribute/profile', element: <ContributorProfileScreen /> },
];
