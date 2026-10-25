import { MessageSquare, Search, X } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { BackHandler, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Glass, NeoButton, NeoWide, Reveal } from "./primitives";
import { Chat } from "./utils";

function ChatItem({ chat, onPress }: { chat: Chat; onPress: () => void }) {
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
            <Animated.View className="flex-row items-center gap-2.5 px-3 py-2.5 rounded-xl" style={a}>
                <MessageSquare size={16} color="#71717a" />
                <Text numberOfLines={1} className="flex-1 text-sm text-zinc-300">{chat.title}</Text>
            </Animated.View>
        </Pressable>
    );
}

export default function Sidebar({ open, onClose, chats, onSelectChat, newConversation }: {
    open: boolean; onClose: () => void; chats: Chat[]; onSelectChat: (c: Chat) => void; newConversation: () => void;
}) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const panelW = Math.min(280, width * 0.82);
    const p = useSharedValue(0);
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (open) setMounted(true);
        p.value = withTiming(open ? 1 : 0, {
            duration: open ? 450 : 400,
            easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
        });
        if (!open) {
            const t = setTimeout(() => setMounted(false), 420);
            return () => clearTimeout(t);
        }
    }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => {
            if (open) { onClose(); return true; }
            return false;
        });
        return () => sub.remove();
    }, [open, onClose]);

    const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - p.value) * panelW }] }));
    const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
    const list = Array.isArray(chats) ? chats : [];
    const filtered = list.filter((c) => c.title?.toLowerCase().includes(query.trim().toLowerCase()));

    if (!mounted && !open) return null;

    return (
        <View className="absolute inset-0 z-50" pointerEvents={open ? "auto" : "none"}>
            <Animated.View className="absolute inset-0 bg-black/70" style={backdrop}>
                <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close sidebar" />
            </Animated.View>

            <Animated.View className="absolute top-0 right-0 bottom-0" style={[{ width: panelW }, panel]}>
                {/* paddings come from safe-area insets (runtime values) so they stay in style */}
                <Glass intensity={55}
                    style={{ flex: 1, borderRightWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, backgroundColor: "rgba(16,16,18,0.72)", paddingTop: insets.top, paddingBottom: insets.bottom }}>
                    <View className="flex-row items-center justify-between px-4 h-14 border-b border-white/[0.08]">
                        <Text className="text-zinc-200 text-sm font-medium">Chats</Text>
                        <NeoButton label="Close sidebar" size={32} onPress={onClose}><X size={16} color="#a1a1aa" /></NeoButton>
                    </View>

                    <View className="px-3 pt-3">
                        <View className={`flex-row items-center gap-2 rounded-xl px-3 py-2 border bg-[#08080a] ${focused ? "border-white/20" : "border-white/[0.08]"}`}>
                            <Search size={16} color="#71717a" />
                            <TextInput
                                value={query} onChangeText={setQuery}
                                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                                placeholder="Search history..." placeholderTextColor="#71717a"
                                className="flex-1 text-sm text-zinc-200 p-0" />
                        </View>
                        <View className="mt-3"><NeoWide label="Start New Conversation" onPress={newConversation} /></View>
                    </View>

                    <ScrollView className="flex-1" contentContainerClassName="px-2 py-3 gap-0.5" showsVerticalScrollIndicator={false}>
                        {open && filtered.length > 0 ? filtered.map((chat, i) => (
                            <Reveal key={chat._id} delay={150 + Math.min(i, 10) * 40} duration={400} y={10}>
                                <ChatItem chat={chat} onPress={() => onSelectChat(chat)} />
                            </Reveal>
                        )) : (
                            <Text className="px-3 py-4 text-sm text-zinc-500 text-center">
                                {chats.length ? "No matching chats." : "Start a chat by asking a question!"}
                            </Text>
                        )}
                    </ScrollView>
                </Glass>
            </Animated.View>
        </View>
    );
}
