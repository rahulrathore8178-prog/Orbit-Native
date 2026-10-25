import { useAnimatedKeyboard, useDerivedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KEYBOARD_GAP, TAB_BAR_GAP, TAB_BAR_HEIGHT } from "../../components/search/constants";

/**
 * Distance (px) from the screen bottom to the search bar.
 * Resting: sits above the floating tab bar. Keyboard open: sits just above the keyboard.
 * Runs on the UI thread, so the keyboard follow is smooth and causes no React re-renders.
 */
export function useSearchBarOffset() {
    const insets = useSafeAreaInsets();
    const keyboard = useAnimatedKeyboard();
    const resting = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP;

    return useDerivedValue(() => Math.max(resting, keyboard.height.value + KEYBOARD_GAP));
}