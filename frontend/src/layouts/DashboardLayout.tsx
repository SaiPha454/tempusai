import { BookOpen, CalendarClock, MessageSquare } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ResourcesCatalogProvider } from '../contexts/ResourcesCatalogContext';
import { Sidebar } from '../components/Sidebar';

const chatRoute = '/chat';
const newConversationEvent = 'tempusai:new-conversation';

const sidebarRoutes = [
  { label: 'Chat', path: chatRoute, icon: MessageSquare },
  { label: 'Scheduling Manager', path: '/scheduling-manager', icon: CalendarClock },
  { label: 'Resources', path: '/resources', icon: BookOpen },
] as const;

const isResourcesRoute = (pathname: string) => pathname === '/resources' || pathname.startsWith('/programs/');

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleNewConversation = () => {
    window.dispatchEvent(new Event(newConversationEvent));
    navigate(chatRoute);
  };

  return (
    <div className="h-screen overflow-hidden bg-[#F9FAFB] text-slate-900">
      <ResourcesCatalogProvider>
        <div className="flex h-full w-full overflow-hidden">
          <Sidebar
            brand="TempusAI"
            onNewConversation={handleNewConversation}
            items={sidebarRoutes.map((route) => ({
              label: route.label,
              icon: route.icon,
              active:
                route.path === '/resources'
                  ? isResourcesRoute(location.pathname)
                  : location.pathname === route.path,
              onClick: () => navigate(route.path),
            }))}
          />

          <main
            className={`min-w-0 flex-1 overflow-y-auto overflow-x-hidden ${
              location.pathname === chatRoute ? 'px-2 pt-0 pb-4' : 'px-7 py-8'
            }`}
          >
            <Outlet />
          </main>
        </div>
      </ResourcesCatalogProvider>
    </div>
  );
}
