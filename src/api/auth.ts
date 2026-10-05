import { apiClient } from '@/api/client';
import type { SessionUser } from '@/auth/session-store';

export interface AuthResponse {
  userId: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export function toSessionUser(res: AuthResponse): SessionUser {
  return { id: res.userId, email: res.email };
}

export function register(input: { email: string; password: string; fullName: string }) {
  return apiClient.post<AuthResponse>('/auth/register', input, { skipAuthHandling: true });
}

export function login(input: { email: string; password: string }) {
  return apiClient.post<AuthResponse>('/auth/login', input, { skipAuthHandling: true });
}
