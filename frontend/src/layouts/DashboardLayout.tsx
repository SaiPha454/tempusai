import { BookOpen, CalendarCheck2, CalendarClock, LogOut, MessageSquare, Shield, UserCircle2 } from 'lucide-react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ResourcesCatalogProvider } from '../contexts/ResourcesCatalogContext';
import { Sidebar } from '../components/Sidebar';
import { useAuth } from '../hooks/useAuth';
import { authRoles } from '../types/auth';

const chatRoute = '/chat';
const profileRoute = '/profile';
const signInRoute = '/sign-in';
const newConversationEvent = 'tempusai:new-conversation';

const sidebarRoutes = [
  { label: 'Chat', path: chatRoute, icon: MessageSquare },
  { label: 'Scheduling Manager', path: '/scheduling-manager', icon: CalendarClock },
  { label: 'Draft Schedulings', path: '/draft-schedulings', icon: CalendarClock },
  { label: 'Resources', path: '/resources', icon: BookOpen },
] as const;

const generatedSidebarRoutes = [
  { label: 'Generated Class Schedules', path: '/generated-class-schedules', icon: CalendarCheck2 },
  { label: 'Generated Exam Schedules', path: '/generated-exam-schedules', icon: CalendarCheck2 },
] as const;

const superAdminRoutes = [{ label: 'User Management', path: '/user-management', icon: Shield }] as const;

const isResourcesRoute = (pathname: string) => pathname === '/resources' || pathname.startsWith('/programs/');

export function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate(signInRoute, { replace: true });
  };

  const handleNewConversation = () => {
    window.dispatchEvent(new Event(newConversationEvent));
    navigate(chatRoute);
  };

  const isSuperAdmin = user?.role === authRoles.SUPER_ADMIN;

  const sidebarItems = [
    ...sidebarRoutes.map((route) => ({
      type: 'link' as const,
      label: route.label,
      icon: route.icon,
      active:
        route.path === '/resources'
          ? isResourcesRoute(location.pathname)
          : location.pathname === route.path,
      onClick: () => navigate(route.path),
    })),
    { type: 'divider' as const, label: 'Generated' },
    ...generatedSidebarRoutes.map((route) => ({
      type: 'link' as const,
      label: route.label,
      icon: route.icon,
      active: location.pathname === route.path,
      onClick: () => navigate(route.path),
    })),
    ...(isSuperAdmin
      ? [
          { type: 'divider' as const, label: 'Admin' },
          ...superAdminRoutes.map((route) => ({
            type: 'link' as const,
            label: route.label,
            icon: route.icon,
            active: location.pathname === route.path,
            onClick: () => navigate(route.path),
          })),
        ]
      : []),
  ];

  const userInitial = user?.displayName?.trim().charAt(0).toUpperCase() || 'A';

  return (
    <div className="h-screen overflow-hidden bg-[#F9FAFB] text-slate-900">
      <ResourcesCatalogProvider>
        <div className="flex h-full w-full overflow-hidden">
          <Sidebar
            brand="TempusAI"
            onNewConversation={handleNewConversation}
            items={sidebarItems}
            footer={
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0A64BC]/10 text-xs font-semibold text-[#0A64BC]">
                    {userInitial}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{user?.displayName ?? 'Admin User'}</p>
                    <p className="truncate text-[11px] text-slate-500">{user?.role === authRoles.SUPER_ADMIN ? 'Super Admin' : 'Admin'}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <button
                    type="button"
                    onClick={() => navigate(profileRoute)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <UserCircle2 size={15} />
                    Profile settings
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-rose-700 transition hover:bg-rose-50"
                  >
                    <LogOut size={15} />
                    Sign out
                  </button>
                </div>
              </div>
            }
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
