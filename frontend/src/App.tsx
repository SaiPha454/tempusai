import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ChatPage } from './pages/ChatPage';
import { GeneratedClassSchedulesPage } from './pages/GeneratedClassSchedulesPage';
import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { ScheduleDraftPage } from './pages/ScheduleDraftPage';
import { SchedulingManagerPage } from './pages/SchedulingManagerPage';

const routes = {
  chat: '/chat',
  generatedClassSchedules: '/generated-class-schedules',
  programDetail: '/programs/:programId',
  scheduleDraft: '/scheduling-draft',
  schedulingManager: '/scheduling-manager',
  resources: '/resources',
} as const;

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to={routes.schedulingManager} replace />} />
        <Route path={routes.chat} element={<ChatPage />} />
        <Route path={routes.generatedClassSchedules} element={<GeneratedClassSchedulesPage />} />
        <Route path={routes.programDetail} element={<ProgramDetailPage />} />
        <Route path={routes.scheduleDraft} element={<ScheduleDraftPage />} />
        <Route path={routes.schedulingManager} element={<SchedulingManagerPage />} />
        <Route path={routes.resources} element={<ResourcesPage />} />
      </Route>
    </Routes>
  );
}
