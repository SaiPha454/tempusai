import {
  authRoles,
  type AuthUser,
  type ChangePasswordPayload,
  type CreateAdminUserPayload,
  type SignInPayload,
  type UpdateProfilePayload,
} from '../../types/auth';

type StoredAdminUser = AuthUser & {
  password: string;
};

const USERS_STORAGE_KEY = 'tempusai:mock-admin-users';
const ACTIVE_USER_ID_STORAGE_KEY = 'tempusai:active-admin-user-id';

const defaultUsers: StoredAdminUser[] = [
  {
    id: 'admin-super-001',
    displayName: 'System Super Admin',
    email: 'superadmin@tempusai.local',
    role: authRoles.SUPER_ADMIN,
    status: 'ACTIVE',
    password: 'Tempus@123',
  },
  {
    id: 'admin-normal-001',
    displayName: 'System Admin',
    email: 'admin@tempusai.local',
    role: authRoles.ADMIN,
    status: 'ACTIVE',
    password: 'Admin@123',
  },
];

const singleSuperAdminSeed: StoredAdminUser[] = [
  {
    id: 'admin-super-001',
    displayName: 'System Super Admin',
    email: 'superadmin@tempusai.local',
    role: authRoles.SUPER_ADMIN,
    status: 'ACTIVE',
    password: 'Tempus@123',
  },
];

const toAuthUser = (user: StoredAdminUser): AuthUser => ({
  id: user.id,
  displayName: user.displayName,
  email: user.email,
  role: user.role,
  status: user.status,
});

const getStorage = () => window.localStorage;

const sleep = async (ms: number) =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });

const readUsers = (): StoredAdminUser[] => {
  const raw = getStorage().getItem(USERS_STORAGE_KEY);
  if (!raw) {
    return [...defaultUsers];
  }

  try {
    const parsed = JSON.parse(raw) as StoredAdminUser[];
    if (!Array.isArray(parsed)) {
      return [...defaultUsers];
    }
    return parsed;
  } catch {
    return [...defaultUsers];
  }
};

const writeUsers = (users: StoredAdminUser[]) => {
  getStorage().setItem(USERS_STORAGE_KEY, JSON.stringify(users));
};

const readActiveUserId = (): string | null => getStorage().getItem(ACTIVE_USER_ID_STORAGE_KEY);

const writeActiveUserId = (userId: string | null) => {
  if (userId) {
    getStorage().setItem(ACTIVE_USER_ID_STORAGE_KEY, userId);
    return;
  }
  getStorage().removeItem(ACTIVE_USER_ID_STORAGE_KEY);
};

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `admin-${Date.now()}`;
};

export const initializeMockAuthStorage = () => {
  const users = readUsers();

  const isSingleSuperAdminSeededSet =
    users.length === singleSuperAdminSeed.length &&
    singleSuperAdminSeed.every((legacyUser) =>
      users.some(
        (user) =>
          user.id === legacyUser.id &&
          user.displayName === legacyUser.displayName &&
          user.email === legacyUser.email &&
          user.role === legacyUser.role,
      ),
    );

  if (isSingleSuperAdminSeededSet) {
    writeUsers(defaultUsers);
    return;
  }

  writeUsers(users);
};

export const getActiveAuthUser = (): AuthUser | null => {
  const activeUserId = readActiveUserId();
  if (!activeUserId) {
    return null;
  }

  const user = readUsers().find((entry) => entry.id === activeUserId);
  return user ? toAuthUser(user) : null;
};

export const signInWithMock = async (payload: SignInPayload): Promise<AuthUser> => {
  await sleep(600);

  const email = normalizeEmail(payload.email);
  const password = payload.password;
  const user = readUsers().find((entry) => normalizeEmail(entry.email) === email);

  if (!user || user.password !== password) {
    throw new Error('Invalid email or password.');
  }

  writeActiveUserId(user.id);
  return toAuthUser(user);
};

export const signOutMock = async (): Promise<void> => {
  await sleep(200);
  writeActiveUserId(null);
};

export const listAdminUsersMock = async (): Promise<AuthUser[]> => {
  await sleep(350);
  return readUsers().map(toAuthUser).sort((left, right) => left.displayName.localeCompare(right.displayName));
};

export const createAdminUserMock = async (payload: CreateAdminUserPayload): Promise<AuthUser> => {
  await sleep(400);

  const users = readUsers();
  const email = normalizeEmail(payload.email);
  if (users.some((user) => normalizeEmail(user.email) === email)) {
    throw new Error('This email is already used by another admin.');
  }

  const newUser: StoredAdminUser = {
    id: generateId(),
    displayName: payload.displayName.trim(),
    email,
    role: payload.role,
    status: 'ACTIVE',
    password: payload.initialPassword,
  };

  const nextUsers = [...users, newUser];
  writeUsers(nextUsers);
  return toAuthUser(newUser);
};

export const removeAdminUserMock = async (targetUserId: string, actorUserId: string): Promise<void> => {
  await sleep(300);

  if (targetUserId === actorUserId) {
    throw new Error('You cannot remove your own account.');
  }

  const users = readUsers();
  const target = users.find((entry) => entry.id === targetUserId);
  if (!target) {
    throw new Error('User no longer exists.');
  }

  if (target.role === authRoles.SUPER_ADMIN) {
    const superAdminCount = users.filter((entry) => entry.role === authRoles.SUPER_ADMIN).length;
    if (superAdminCount <= 1) {
      throw new Error('At least one super admin must remain.');
    }
  }

  const nextUsers = users.filter((entry) => entry.id !== targetUserId);
  writeUsers(nextUsers);
};

export const updateProfileMock = async (userId: string, payload: UpdateProfilePayload): Promise<AuthUser> => {
  await sleep(350);

  const users = readUsers();
  const targetIndex = users.findIndex((entry) => entry.id === userId);
  if (targetIndex < 0) {
    throw new Error('User account was not found.');
  }

  const nextUsers = [...users];
  nextUsers[targetIndex] = {
    ...nextUsers[targetIndex],
    displayName: payload.displayName.trim(),
  };
  writeUsers(nextUsers);

  return toAuthUser(nextUsers[targetIndex]);
};

export const changePasswordMock = async (userId: string, payload: ChangePasswordPayload): Promise<void> => {
  await sleep(350);

  const users = readUsers();
  const targetIndex = users.findIndex((entry) => entry.id === userId);
  if (targetIndex < 0) {
    throw new Error('User account was not found.');
  }

  const target = users[targetIndex];
  if (target.password !== payload.currentPassword) {
    throw new Error('Current password is incorrect.');
  }

  const nextUsers = [...users];
  nextUsers[targetIndex] = {
    ...target,
    password: payload.newPassword,
  };
  writeUsers(nextUsers);
};
