import { KeyboardAvoidingView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KEYBOARD_GAP, TAB_BAR_GAP, TAB_BAR_HEIGHT } from "./constants";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { ErrorBanner } from "./ErrorBanner";
import { SearchBar } from "./SearchBar";

type Props = {
    value: string;
    onChangeText: (text: string) => void;
    onSubmit: () => void;
    error: string | null;
};

/**
 * Bottom area of the screen: the search bar, lifted above the floating tab bar,
 * and pushed above the keyboard when it opens. Keyboard state lives here, so opening the
 * keyboard re-renders only this component, not the whole screen.
 */
export function SearchDock({ value, onChangeText, onSubmit, error }: Props) {
    const insets = useSafeAreaInsets();
    const keyboardOpen = useKeyboardVisible();

    // resting: clear the floating tab bar. keyboard open: the tab bar is hidden behind it.
    const paddingBottom = keyboardOpen ? KEYBOARD_GAP : insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP;

    return (
        <KeyboardAvoidingView behavior="padding">
            <View style={{ paddingBottom }}>
                <ErrorBanner message={error} />
                <SearchBar value={value} onChangeText={onChangeText} onSubmit={onSubmit} />
            </View>
        </KeyboardAvoidingView>
    );
}