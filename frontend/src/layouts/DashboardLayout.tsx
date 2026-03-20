import { BookOpen, CalendarClock, MessageSquare } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from '../components/Sidebar';

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-slate-900">
      <div className="flex w-full min-h-screen">
        <Sidebar
          brand="TempusAI"
          items={[
            {
              label: 'Chat',
              icon: MessageSquare,
              active: location.pathname === '/chat',
              onClick: () => navigate('/chat'),
            },
            {
              label: 'Scheduling Manager',
              icon: CalendarClock,
              active: location.pathname === '/scheduling-manager',
              onClick: () => navigate('/scheduling-manager'),
            },
            {
              label: 'Resources',
              icon: BookOpen,
              active: location.pathname === '/resources',
              onClick: () => navigate('/resources'),
            },
          ]}
        />

        <main className="flex-1 px-7 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
