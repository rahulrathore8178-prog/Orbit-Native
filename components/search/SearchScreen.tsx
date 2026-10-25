import { Reveal } from "./Reaveal";
import { useOpenProfile } from "@/hooks/useOpenProfile";
import {
    Sora_300Light,
    Sora_400Regular,
    Sora_500Medium,
    Sora_600SemiBold,
    useFonts,
} from "@expo-google-fonts/sora";
import { useCallback, useState } from "react";
import { Keyboard, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { EdgeFade } from "./EdgeFade";
import { ErrorBanner } from "./ErrorBanner";
import { HistoryList } from "./HistoryList";
import { OrbitBackdrop } from "./OrbitbackDrop";
import { ResultsList } from "./ResultsList";
import { SearchBar } from "./SearchBar";
import { SearchHeader } from "./SearchHeader";
import { CONTENT, SEARCH_BAR_HEIGHT } from "./constants";
import { useFriendActions } from "@/hooks/search/useFriendsActions";
import { useIntroDelay } from "@/hooks/search/useIntroDelay";
import { useSearchBarOffset } from "@/hooks/search/useSearchBarOffset";
import { useSearchHistory } from "@/hooks/search/USERSearchHistory";
import { useUserSearch } from "@/hooks/search/useUserSearch";
import type { User } from "../services/search/types";
import { SafeAreaView } from "react-native-safe-area-context";
import { SearchDock } from "./SearchDock";
import { router } from "expo-router";

export default function SearchScreen() {
    const [fontsLoaded] = useFonts({ Sora_300Light, Sora_400Regular, Sora_500Medium, Sora_600SemiBold });
    const openProfile = useOpenProfile();

    const [query, setQuery] = useState("");
    const { users, loading, error, patchUser } = useUserSearch(query);
    const { history, add: addToHistory, remove: removeFromHistory, clear: clearHistory } = useSearchHistory();
    const { actions, error: actionError } = useFriendActions(patchUser);
    const introDelay = useIntroDelay(800);

    const searching = query.trim().length > 0;
    const dimResults = searching && loading && users.length > 0;

    const handleSubmit = () => {
        addToHistory(query);
        Keyboard.dismiss();
    };

    const handleSelectUser = useCallback(
        (user: User) => {
            addToHistory(query);
            openProfile(user._id);
        },
        [addToHistory, query, openProfile],
    );

    const handleMessage = useCallback((user: User) => {
        // TODO: navigate to your chat screen, e.g. router.push(`/chat/${user._id}`)
         router.push({ pathname: '/chats/[id]', params: { id: user._id } } as any)
    }, []);

    if (!fontsLoaded) return null;

    return (
        <View className="flex-1 overflow-hidden bg-black">
            <OrbitBackdrop />
            <SearchHeader />

            {/* results / history: takes all the space above the search bar */}
            <View className={`${CONTENT} min-h-0 flex-1 pt-6`}>
                <Reveal delay={700} duration={600}>
                    <View className="mb-3 flex-row items-center justify-between">
                        <Text accessibilityRole="header" className="font-sora-light text-[26px] tracking-tight text-neutral-100">
                            {searching ? "Results" : "Recent searches"}
                        </Text>
                        {!searching && history.length > 0 && (
                            <Pressable onPress={clearHistory} className="rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5">
                                <Text className="font-sora text-xs text-neutral-400">Clear all</Text>
                            </Pressable>
                        )}
                    </View>
                </Reveal>

                <View className="min-h-0 flex-1">
                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        keyboardDismissMode="on-drag"
                        contentContainerClassName="gap-3.5 py-3"
                        className={dimResults ? "opacity-60" : ""}
                    >
                        {searching ? (
                            <ResultsList
                                query={query}
                                users={users}
                                loading={loading}
                                error={error}
                                actions={actions}
                                onSelect={handleSelectUser}
                                onMessage={handleMessage}
                            />
                        ) : (
                            <HistoryList
                                history={history}
                                introDelay={introDelay}
                                onPick={setQuery}
                                onRemove={removeFromHistory}
                            />
                        )}
                    </ScrollView>
                    <EdgeFade edge="top" />
                    <EdgeFade edge="bottom" />
                </View>
            </View>

            {/* search bar: above the floating tab bar, and above the keyboard when it's open */}
            <SearchDock value={query} onChangeText={setQuery} onSubmit={handleSubmit} error={actionError} />
        </View>
    );
}