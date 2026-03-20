import { Navigate, Route, Routes } from 'react-router-dom';
import { DashboardLayout } from './layouts/DashboardLayout';
import { ChatPage } from './pages/ChatPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SchedulingManagerPage } from './pages/SchedulingManagerPage';

export default function App() {
  return (
    <Routes>
      <Route element={<DashboardLayout />}>
        <Route path="/" element={<Navigate to="/scheduling-manager" replace />} />
        <Route path="/chat" element={<ChatPage />} />
        <Route path="/scheduling-manager" element={<SchedulingManagerPage />} />
        <Route path="/resources" element={<ResourcesPage />} />
      </Route>
    </Routes>
  );
}
