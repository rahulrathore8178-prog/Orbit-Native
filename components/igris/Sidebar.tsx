import { MessageSquare, Search, X } from "lucide-react-native";
import React, { memo, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, FlatList, Keyboard, Pressable, Text, TextInput, View } from "react-native";
import Animated, { SharedValue, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Glass, NeoButton, NeoWide, Reveal } from "./primitives";
import { Chat } from "./utils";

type Props = {
    progress: SharedValue<number>; // 0 = closed, 1 = open (driven by the pan gesture in the screen)
    width: number;
    open: boolean;
    chats: Chat[];
    activeId: string | null;
    topInset: number;
    bottomInset: number;
    onSelect: (c: Chat) => void;
    onNew: () => void;
    onClose: () => void;
};

const ChatItem = memo(function ChatItem({ chat, active, onPress }: { chat: Chat; active: boolean; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({
        backgroundColor: `rgba(255,255,255,${0.07 * p.value})`,
        transform: [{ scale: 1 - 0.015 * p.value }],
    }));
    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { p.value = withTiming(1, { duration: 100 }); }}
            onPressOut={() => { p.value = withTiming(0, { duration: 250 }); }}>
            <Animated.View
                className={`flex-row items-center gap-2.5 px-3 py-3 rounded-xl border ${active ? "bg-white/[0.08] border-white/[0.12]" : "border-transparent"}`}
                style={a}>
                <MessageSquare size={16} color={active ? "#e4e4e7" : "#71717a"} />
                <Text numberOfLines={1} className={`flex-1 text-sm ${active ? "text-zinc-100 font-medium" : "text-zinc-300"}`}>
                    {chat.title || "Untitled chat"}
                </Text>
            </Animated.View>
        </Pressable>
    );
});

export default function Sidebar({ progress, width, open, chats, activeId, topInset, bottomInset, onSelect, onNew, onClose }: Props) {
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const [listKey, setListKey] = useState(0); // bump on open so rows re-play their staggered reveal
    const wasOpen = useRef(false);

    useEffect(() => {
        if (open && !wasOpen.current) setListKey((k) => k + 1);
        if (!open) { setQuery(""); Keyboard.dismiss(); }
        wasOpen.current = open;
    }, [open]);

    // Android hardware back closes the drawer first
    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (open) { onClose(); return true; }
            return false;
        });
        return () => sub.remove();
    }, [open, onClose]);

    const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (progress.value - 1) * width }] }));

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? chats.filter((c) => (c.title ?? "").toLowerCase().includes(q)) : chats;
    }, [chats, query]);

    return (
        <Animated.View
            pointerEvents={open ? "auto" : "none"}
            className="absolute left-0 top-0 bottom-0 z-50"
            style={[{ width, shadowColor: "#000", shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 12, height: 0 }, elevation: 24 }, panel]}>
            {/* paddings come from safe-area insets (runtime values) so they stay in style */}
            <Glass intensity={55}
                style={{ flex: 1, borderLeftWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, backgroundColor: "rgba(10,10,12,0.94)", paddingTop: topInset, paddingBottom: Math.max(bottomInset, 12) }}>
                {/* header */}
                <View className="flex-row items-center justify-between px-4 h-14 border-b border-white/[0.08]">
                    <Text className="text-zinc-200 text-sm font-medium">Chats</Text>
                    <NeoButton label="Close sidebar" size={32} onPress={onClose}><X size={16} color="#a1a1aa" /></NeoButton>
                </View>

                {/* new chat */}
                <View className="px-3 pt-3">
                    <NeoWide label="Start New Conversation" onPress={onNew} />
                </View>

                <View className="flex-row items-center justify-between mt-4 mb-1 px-4">
                    <Text className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Recent</Text>
                    <Text className="text-[11px] text-zinc-600">{filtered.length}</Text>
                </View>

                {/* history */}
                <FlatList
                    key={listKey}
                    data={filtered}
                    keyExtractor={(c) => c._id}
                    renderItem={({ item, index }) => (
                        <Reveal delay={150 + Math.min(index, 10) * 40} duration={400} y={10}>
                            <ChatItem chat={item} active={item._id === activeId} onPress={() => onSelect(item)} />
                        </Reveal>
                    )}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                    className="flex-1"
                    contentContainerClassName="px-2 py-2 gap-0.5"
                    ListEmptyComponent={
                        <Text className="px-3 py-4 text-sm text-zinc-500 text-center">
                            {query ? "No matching chats." : "Start a chat by asking a question!"}
                        </Text>
                    }
                />

                {/* search bar — bottom */}
                <View className="px-3 pt-2">
                    <View className={`flex-row items-center gap-2.5 rounded-full px-4 h-12 border bg-[#08080a] ${focused ? "border-white/20" : "border-white/[0.09]"}`}>
                        <Search size={16} color="#71717a" />
                        <TextInput
                            value={query} onChangeText={setQuery}
                            onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                            placeholder="Search history..." placeholderTextColor="#71717a"
                            className="flex-1 text-[15px] text-zinc-200 p-0" returnKeyType="search" autoCorrect={false} />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery("")} hitSlop={10}><X size={15} color="#a1a1aa" /></Pressable>
                        )}
                    </View>
                </View>
            </Glass>
        </Animated.View>
    );
}