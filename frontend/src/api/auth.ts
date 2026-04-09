import { apiClient } from './client';

export type AuthUserDto = {
  id: string;
  email: string;
  display_name: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  status: 'ACTIVE';
  created_at: string;
  updated_at: string;
};

export type SignInRequestDto = {
  email: string;
  password: string;
};

export type SignInResponseDto = {
  access_token: string;
  token_type: 'bearer';
  expires_in: number;
  user: AuthUserDto;
};

export async function signIn(payload: SignInRequestDto): Promise<SignInResponseDto> {
  const response = await apiClient.post<SignInResponseDto>('/auth/sign-in', payload);
  return response.data;
}

export async function getMe(): Promise<AuthUserDto> {
  const response = await apiClient.get<AuthUserDto>('/auth/me');
  return response.data;
}

export async function updateMyProfile(payload: { display_name: string }): Promise<AuthUserDto> {
  const response = await apiClient.patch<AuthUserDto>('/auth/me', payload);
  return response.data;
}

export async function changeMyPassword(payload: { current_password: string; new_password: string }): Promise<void> {
  await apiClient.post('/auth/me/change-password', payload);
}

export async function listAdminUsers(): Promise<AuthUserDto[]> {
  const response = await apiClient.get<AuthUserDto[]>('/auth/admin-users');
  return response.data;
}

export async function createAdminUser(payload: {
  display_name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN';
  initial_password: string;
}): Promise<AuthUserDto> {
  const response = await apiClient.post<AuthUserDto>('/auth/admin-users', payload);
  return response.data;
}

export async function removeAdminUser(userId: string): Promise<void> {
  await apiClient.delete(`/auth/admin-users/${userId}`);
}
