import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';

export const TAB_BAR_HEIGHT = 55;

/**
 * One source of truth for the floating tab bar.
 *  - bottom: gap between the bar and the screen edge (clears the home indicator)
 *  - space:  room a screen must leave at its bottom so nothing hides behind the bar (0 while the keyboard is open)
 */
export function useTabBarLayout() {
    const insets = useSafeAreaInsets();
    const keyboardOpen = useKeyboardVisible();

    const bottom = Math.max(insets.bottom, 2);
    const space = keyboardOpen ? 0 : TAB_BAR_HEIGHT + bottom + 8;

    return { height: TAB_BAR_HEIGHT, bottom, space };
}