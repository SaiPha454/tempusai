import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ChatPage } from './pages/ChatPage';
import { ProgramDetailPage } from './pages/ProgramDetailPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SchedulingManagerPage } from './pages/SchedulingManagerPage';

const routes = {
  chat: '/chat',
  programDetail: '/programs/:programId',
  schedulingManager: '/scheduling-manager',
  resources: '/resources',
} as const;

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to={routes.schedulingManager} replace />} />
        <Route path={routes.chat} element={<ChatPage />} />
        <Route path={routes.programDetail} element={<ProgramDetailPage />} />
        <Route path={routes.schedulingManager} element={<SchedulingManagerPage />} />
        <Route path={routes.resources} element={<ResourcesPage />} />
      </Route>
    </Routes>
  );
}
