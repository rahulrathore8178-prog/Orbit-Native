import { useCallback, useMemo } from 'react';
import { useNavigation } from 'expo-router';

/** Moves to the neighbouring tab. Does nothing on the first or last tab. */
export function useTabNavigation() {
    const navigation = useNavigation();

    const go = useCallback(
        (step: 1 | -1) => {
            const state = navigation.getState();
            const target = state?.routes?.[state.index + step];
            if (target) navigation.navigate(target.name as never);
        },
        [navigation]
    );

    return useMemo(() => ({ nextTab: () => go(1), previousTab: () => go(-1) }), [go]);
}