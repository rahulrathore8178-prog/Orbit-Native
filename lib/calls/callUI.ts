import { useSyncExternalStore } from 'react';

let minimized = false;
const listeners = new Set<() => void>();
const sub = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const setMinimized = (v: boolean) => {
    if (minimized === v) return;
    minimized = v;
    listeners.forEach((l) => l());
};
export const useMinimized = () => useSyncExternalStore(sub, () => minimized, () => minimized);