import { useSyncExternalStore } from 'react';

/**
 * One mute switch for every video in the app (feed, profile, orbitals, saved, archived).
 * Not persisted on purpose: every app start begins muted. Turning sound on in any post
 * turns it on everywhere, turning it off does the same.
 */
let muted = true;
const listeners = new Set<() => void>();

export const setGlobalMuted = (next: boolean) => {
    if (next === muted) return;
    muted = next;
    listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export function useGlobalMuted() {
    const value = useSyncExternalStore(subscribe, () => muted, () => true);
    return [value, setGlobalMuted] as const;
}