import { authStorage } from '@/lib/auth/authStorage';
import { API_URL } from '@/lib/utils';
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';

// Backend returns http://localhost:5000/... for profile pics, which a phone can't reach
export const resolveUrl = (url?: string | null) =>
    url ? url.replace(/^https?:\/\/localhost:5000/, API_URL) : undefined;

export type OrbitalVisibility = 'open' | 'private';
export type OrbitalRole = 'creator' | 'admin' | 'member';

export type OrbitalCreator = {
    _id: string;
    username: string;
    profilePic?: string;
};

type OrbitalBase = {
    _id: string;
    name: string;
    description: string;
    image?: string;
    memberCount: number;
    visibility: OrbitalVisibility;
    requests: number | null;
};

/** Item from the "all orbitals" endpoint */
export type Orbital = OrbitalBase & { author: OrbitalCreator };

/** Item from the "my orbitals" endpoint */
export type MyOrbital = OrbitalBase & { role: OrbitalRole };

const api = axios.create({
    baseURL: API_URL,
    withCredentials: true,
});

api.interceptors.request.use(async (config) => {
    const token = await authStorage.getToken();

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
});

// Accepts either a bare array or an object like { orbitals: [...] }
export const fetchAllOrbitals = async (): Promise<Orbital[]> => {
    const res = await api.get('/api/orbital/all');
    const d = res.data;
    return Array.isArray(d) ? d : d?.orbitals ?? [];
};

export const fetchMyOrbitals = async (): Promise<MyOrbital[]> => {
    const res = await api.get('/api/orbital/mine');
    return res?.data?.orbitals || [];
};

export const fetchOrbitalRequests = async (orbitalId: string): Promise<Orbital[]> => {
    const res = await api.get(`/api/orbital/${orbitalId}/requests`);
    console.log('fetchOrbitalRequests', res?.data);
    return res?.data?.orbitals || [];
} 

export function useOrbitals() {
    const [all, setAll] = useState<Orbital[]>([]);
    const [joined, setJoined] = useState<Orbital[]>([]);
    const [mine, setMine] = useState<MyOrbital[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (mode: 'initial' | 'refresh') => {
        if (mode === 'refresh') setRefreshing(true);
        else setLoading(true);
        try {
            setError(null);
            const [allOrbitals, my] = await Promise.all([fetchAllOrbitals(), fetchMyOrbitals()]);
            setAll(allOrbitals);
            // For now the Joined tab shows every orbital.
            // Later: point this at your real "joined orbitals" endpoint.
            setJoined(allOrbitals);
            setMine(my);
        } catch (err: any) {
            setError('Could not load orbitals. Check your connection and try again.');
            console.error('Error loading orbitals:', err);
            console.log('STATUS:', err.response?.status);
            console.log('DATA:', err.response?.data);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load('initial');
    }, [load]);

    return {
        all,
        joined,
        mine,
        loading,
        refreshing,
        error,
        refresh: () => load('refresh'),
        retry: () => load('initial'),
    };
}