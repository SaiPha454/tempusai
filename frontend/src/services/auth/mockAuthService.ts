import axios from 'axios';
import {
  changeMyPassword,
  createAdminUser,
  listAdminUsers,
  removeAdminUser,
  signIn,
  updateMyProfile,
  type AuthUserDto,
} from '../../api/auth';
import { setApiAuthToken } from '../../api/client';
import type {
  AuthUser,
  ChangePasswordPayload,
  CreateAdminUserPayload,
  SignInPayload,
  UpdateProfilePayload,
} from '../../types/auth';

const ACCESS_TOKEN_STORAGE_KEY = 'tempusai:auth-access-token';
const AUTH_USER_STORAGE_KEY = 'tempusai:auth-user';

const getStorage = () => window.localStorage;

const toAuthUser = (user: AuthUserDto): AuthUser => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  role: user.role,
  status: user.status,
});

const saveAuthSession = (token: string, user: AuthUserDto) => {
  getStorage().setItem(ACCESS_TOKEN_STORAGE_KEY, token);
  getStorage().setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(toAuthUser(user)));
  setApiAuthToken(token);
};

const clearAuthSession = () => {
  getStorage().removeItem(ACCESS_TOKEN_STORAGE_KEY);
  getStorage().removeItem(AUTH_USER_STORAGE_KEY);
  setApiAuthToken(null);
};

const mapApiError = (error: unknown, fallback: string): Error => {
  if (axios.isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    return new Error(detail || fallback);
  }

  return error instanceof Error ? error : new Error(fallback);
};

export const initializeMockAuthStorage = () => {
  const token = getStorage().getItem(ACCESS_TOKEN_STORAGE_KEY);
  setApiAuthToken(token || null);
};

export const getActiveAuthUser = (): AuthUser | null => {
  const rawUser = getStorage().getItem(AUTH_USER_STORAGE_KEY);
  if (!rawUser) {
    return null;
  }

  try {
    return JSON.parse(rawUser) as AuthUser;
  } catch {
    clearAuthSession();
    return null;
  }
};

export const signInWithMock = async (payload: SignInPayload): Promise<AuthUser> => {
  try {
    const response = await signIn(payload);
    saveAuthSession(response.access_token, response.user);
    return toAuthUser(response.user);
  } catch (error) {
    throw mapApiError(error, 'Invalid email or password.');
  }
};

export const signOutMock = async (): Promise<void> => {
  clearAuthSession();
};

export const listAdminUsersMock = async (): Promise<AuthUser[]> => {
  try {
    const users = await listAdminUsers();
    return users.map(toAuthUser);
  } catch (error) {
    throw mapApiError(error, 'Unable to load admin users.');
  }
};

export const createAdminUserMock = async (payload: CreateAdminUserPayload): Promise<AuthUser> => {
  try {
    const created = await createAdminUser({
      display_name: payload.displayName,
      email: payload.email,
      role: payload.role,
      initial_password: payload.initialPassword,
    });
    return toAuthUser(created);
  } catch (error) {
    throw mapApiError(error, 'Unable to create admin user.');
  }
};

export const removeAdminUserMock = async (targetUserId: string, _actorUserId: string): Promise<void> => {
  try {
    await removeAdminUser(targetUserId);
  } catch (error) {
    throw mapApiError(error, 'Unable to remove admin user.');
  }
};

export const updateProfileMock = async (_userId: string, payload: UpdateProfilePayload): Promise<AuthUser> => {
  try {
    const updatedUser = await updateMyProfile({ display_name: payload.displayName });
    const token = getStorage().getItem(ACCESS_TOKEN_STORAGE_KEY);
    if (token) {
      saveAuthSession(token, updatedUser);
    }
    return toAuthUser(updatedUser);
  } catch (error) {
    throw mapApiError(error, 'Unable to update profile.');
  }
};

export const changePasswordMock = async (_userId: string, payload: ChangePasswordPayload): Promise<void> => {
  try {
    await changeMyPassword({
      current_password: payload.currentPassword,
      new_password: payload.newPassword,
    });
  } catch (error) {
    throw mapApiError(error, 'Unable to change password.');
  }
};
