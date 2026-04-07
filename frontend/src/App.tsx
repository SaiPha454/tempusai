import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { PublicOnlyRoute, RequireAuthRoute, RequireRoleRoute } from './components/auth/RouteGuards';
import { useAuth } from './hooks/useAuth';
import { authRoles } from './types/auth';
import { SignInPage } from './pages/SignInPage';
import { ProfilePage } from './pages/ProfilePage';
import { UserManagementPage } from './pages/UserManagementPage';
import { DraftSchedulingsPage } from './pages/DraftSchedulingsPage';
import { ExamScheduleDraftPage } from './pages/ExamScheduleDraftPage';
import { ChatPage } from './pages/ChatPage';
import { GeneratedClassSchedulesPage } from './pages/GeneratedClassSchedulesPage';
import { GeneratedExamSchedulesPage } from './pages/GeneratedExamSchedulesPage';
import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ScheduleDraftPage } from './pages/ScheduleDraftPage';
import { SchedulingManagerPage } from './pages/SchedulingManagerPage';

const routes = {
  signIn: '/sign-in',
  profile: '/profile',
  userManagement: '/user-management',
  chat: '/chat',
  draftSchedulings: '/draft-schedulings',
  examScheduleDraft: '/exam-scheduling-draft',
  generatedClassSchedules: '/generated-class-schedules',
  generatedExamSchedules: '/generated-exam-schedules',
  programDetail: '/programs/:programId',
  scheduleDraft: '/scheduling-draft',
  schedulingManager: '/scheduling-manager',
  resources: '/resources',
} as const;

export default function App() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return null;
  }

  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path={routes.signIn} element={<SignInPage />} />
      </Route>

      <Route element={<RequireAuthRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<Navigate to={routes.schedulingManager} replace />} />
          <Route path={routes.chat} element={<ChatPage />} />
          <Route path={routes.draftSchedulings} element={<DraftSchedulingsPage />} />
          <Route path={routes.examScheduleDraft} element={<ExamScheduleDraftPage />} />
          <Route path={routes.generatedClassSchedules} element={<GeneratedClassSchedulesPage />} />
          <Route path={routes.generatedExamSchedules} element={<GeneratedExamSchedulesPage />} />
          <Route path={routes.profile} element={<ProfilePage />} />
          <Route path={routes.programDetail} element={<ProgramDetailPage />} />
          <Route path={routes.scheduleDraft} element={<ScheduleDraftPage />} />
          <Route path={routes.schedulingManager} element={<SchedulingManagerPage />} />
          <Route path={routes.resources} element={<ResourcesPage />} />

          <Route element={<RequireRoleRoute allowedRoles={[authRoles.SUPER_ADMIN]} />}>
            <Route path={routes.userManagement} element={<UserManagementPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={isAuthenticated ? routes.schedulingManager : routes.signIn} replace />} />
    </Routes>
  );
}
