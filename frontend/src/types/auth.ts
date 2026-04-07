export const authRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
} as const;

export type AuthRole = (typeof authRoles)[keyof typeof authRoles];

export type AdminUserStatus = 'ACTIVE';

export type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  role: AuthRole;
  status: AdminUserStatus;
};

export type SignInPayload = {
  email: string;
  password: string;
};

export type CreateAdminUserPayload = {
  displayName: string;
  email: string;
  role: AuthRole;
  initialPassword: string;
};

export type UpdateProfilePayload = {
  displayName: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};
