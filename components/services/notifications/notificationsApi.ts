import axios, { AxiosRequestConfig } from 'axios';
import { API_URL } from '@/lib/utils';
import { authStorage } from '@/lib/auth/authStorage';

const BASE = '/api/auth/user/notifications';

export type AppNotification = {
    _id: string;
    title: string;
    detail?: string;
    isRead: boolean;
    createdAt: string;
    type?: string; // optional: used only to pick the icon
};

async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const token = await authStorage.getToken();
    const res = await axios({
        baseURL: API_URL,
        withCredentials: true,
        ...config,
        headers: { Authorization: `Bearer ${token}`, ...config.headers },
    });
    return res.data;
}

export const notificationsApi = {
    async list(): Promise<AppNotification[]> {
        const data = await request({ url: BASE });
        const list: AppNotification[] = data?.notifications ?? [];
        return [...list].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    },
    markRead: (id: string) => request({ url: `${BASE}/${id}/read`, method: 'PATCH' }),
    markAllRead: () => request({ url: `${BASE}/read-all`, method: 'PATCH' }),
};
