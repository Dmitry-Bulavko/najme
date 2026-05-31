export type UserRole = 'CLIENT' | 'ADMIN';

export interface User {
  id: string;
  login: string;
  email?: string;
  avatarUrl?: string;
  role: UserRole;
  createdAt: string;
}

export interface LoginRequest {
  login: string;
  password: string;
}

export interface RegisterRequest {
  login: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
}
