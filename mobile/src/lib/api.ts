import * as SecureStore from 'expo-secure-store';
import type { AuthResponse, LoginRequest, RegisterRequest, ProfilesResponse, ProfileFilters, Profile, Category } from '@najme/shared';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

async function getToken(): Promise<string | null> {
    return SecureStore.getItemAsync('access_token');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const token = await getToken();
    const res = await fetch(`${API_BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...init?.headers,
        },
        ...init,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        throw new Error(err.message ?? 'Request failed');
    }
    return res.json() as Promise<T>;
}

export const authApi = {
    login: (data: LoginRequest) =>
        request<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }),

    register: (data: RegisterRequest) =>
        request<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    googleAuth: (idToken: string) =>
        request<AuthResponse>('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),

    me: () => request<{ id: string; login: string; email?: string; name?: string; role: string; avatarUrl?: string }>('/auth/me'),
};

export const categoriesApi = {
    list: () => request<Category[]>('/categories'),
};

export const profilesApi = {
    list: (filters: ProfileFilters = {}) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([k, v]) => v != null && params.set(k, String(v)));
        return request<ProfilesResponse>(`/profiles?${params}`);
    },

    getById: (id: string) => request<Profile>(`/profiles/${id}`),

    getMyProfile: () => request<Profile | null>('/profiles/me'),
};
