import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authRoles, type AuthRole } from '../../types/auth';
import { useAuth } from '../../hooks/useAuth';

type RequireRoleProps = {
  allowedRoles: AuthRole[];
};

export function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return <RouteLoadingState message="Checking session..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/scheduling-manager" replace />;
  }

  return <Outlet />;
}

export function RequireAuthRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <RouteLoadingState message="Loading workspace..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireRoleRoute({ allowedRoles }: RequireRoleProps) {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return <RouteLoadingState message="Checking permissions..." />;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    const fallbackPath = user.role === authRoles.ADMIN ? '/scheduling-manager' : '/';
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}

function RouteLoadingState({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F9FAFB] px-4">
      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">{message}</div>
    </div>
  );
}
