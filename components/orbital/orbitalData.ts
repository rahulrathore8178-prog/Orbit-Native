import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '@/app/utils';

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
};

/** Item from the "all orbitals" endpoint */
export type Orbital = OrbitalBase & { author: OrbitalCreator };

/** Item from the "my orbitals" endpoint */
export type MyOrbital = OrbitalBase & { role: OrbitalRole };

const api = axios.create({ baseURL: API_URL, withCredentials: true });

// TODO: replace the routes (and unwrap res.data.xxx if your API wraps the array)
export const fetchAllOrbitals = async (): Promise<Orbital[]> =>
    (await api.get('/api/orbital/all')).data;
// console.log('fetchAllOrbitals called, data:', (await api.get('/api/orbital/all')).data);

export const fetchMyOrbitals = async (): Promise<MyOrbital[]> => {
    const res = await api.get('/api/orbital/mine')
    console.log('fetchMyOrbitals called, data:', res.data?.orbitals);
    return res?.data?.orbitals || [];
};

export function useOrbitals() {
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
            const [all, my] = await Promise.all([fetchAllOrbitals(), fetchMyOrbitals()]);
            // For now the Joined tab shows every orbital.
            // Later: point this at your real "joined orbitals" endpoint.
            setJoined(all);
            setMine(my);
        } catch {
            setError('Could not load orbitals. Check your connection and try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load('initial');
    }, [load]);

    return {
        joined,
        mine,
        loading,
        refreshing,
        error,
        refresh: () => load('refresh'),
        retry: () => load('initial'),
    };
}