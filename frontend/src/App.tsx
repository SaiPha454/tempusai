import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
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
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to={routes.schedulingManager} replace />} />
        <Route path={routes.chat} element={<ChatPage />} />
        <Route path={routes.draftSchedulings} element={<DraftSchedulingsPage />} />
        <Route path={routes.examScheduleDraft} element={<ExamScheduleDraftPage />} />
        <Route path={routes.generatedClassSchedules} element={<GeneratedClassSchedulesPage />} />
        <Route path={routes.generatedExamSchedules} element={<GeneratedExamSchedulesPage />} />
        <Route path={routes.programDetail} element={<ProgramDetailPage />} />
        <Route path={routes.scheduleDraft} element={<ScheduleDraftPage />} />
        <Route path={routes.schedulingManager} element={<SchedulingManagerPage />} />
        <Route path={routes.resources} element={<ResourcesPage />} />
      </Route>
    </Routes>
  );
}
