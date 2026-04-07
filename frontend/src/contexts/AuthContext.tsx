import {
  useCallback,
  createContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthRole,
  AuthUser,
  ChangePasswordPayload,
  SignInPayload,
  UpdateProfilePayload,
} from '../types/auth';
import {
  changePasswordMock,
  getActiveAuthUser,
  initializeMockAuthStorage,
  signInWithMock,
  signOutMock,
  updateProfileMock,
} from '../services/auth/mockAuthService';

type AuthContextValue = {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  signIn: (payload: SignInPayload) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  refreshActiveUser: () => void;
  updateDisplayName: (payload: UpdateProfilePayload) => Promise<AuthUser>;
  changePassword: (payload: ChangePasswordPayload) => Promise<void>;
  hasRole: (role: AuthRole) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    initializeMockAuthStorage();
    setUser(getActiveAuthUser());
    setIsInitializing(false);
  }, []);

  const signIn = useCallback(async (payload: SignInPayload): Promise<AuthUser> => {
    const signedInUser = await signInWithMock(payload);
    setUser(signedInUser);
    return signedInUser;
  }, []);

  const signOut = useCallback(async () => {
    await signOutMock();
    setUser(null);
  }, []);

  const refreshActiveUser = useCallback(() => {
    setUser(getActiveAuthUser());
  }, []);

  const updateDisplayName = useCallback(
    async (payload: UpdateProfilePayload): Promise<AuthUser> => {
      if (!user) {
        throw new Error('You are not signed in.');
      }

      const updatedUser = await updateProfileMock(user.id, payload);
      setUser(updatedUser);
      return updatedUser;
    },
    [user],
  );

  const changePassword = useCallback(
    async (payload: ChangePasswordPayload): Promise<void> => {
      if (!user) {
        throw new Error('You are not signed in.');
      }

      await changePasswordMock(user.id, payload);
    },
    [user],
  );

  const hasRole = useCallback((role: AuthRole) => user?.role === role, [user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      signIn,
      signOut,
      refreshActiveUser,
      updateDisplayName,
      changePassword,
      hasRole,
    }),
    [changePassword, hasRole, isInitializing, refreshActiveUser, signIn, signOut, updateDisplayName, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
