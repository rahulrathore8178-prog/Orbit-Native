import React, { useEffect, useRef, useState, ReactNode } from "react";
import {
    View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet, Platform,
    KeyboardAvoidingView, useWindowDimensions, StyleProp, ViewStyle,
} from "react-native";
import Animated, {
    useSharedValue, useAnimatedStyle, withTiming, withDelay, withRepeat, withSequence,
    Easing, useReducedMotion,
} from "react-native-reanimated";
import Svg, { Circle, Path, Ellipse } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";
import { createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";
import {
    useFonts, Sora_300Light, Sora_400Regular, Sora_500Medium, Sora_600SemiBold,
} from "@expo-google-fonts/sora";
import { API_URL, getAuthHeaders } from "../utils";
import { AppDispatch, RootState } from "@/redux/store";

/* ---- adjust these imports to your project ---- */
// import { apiUrl, getAuthHeaders } from "../config/api";
// import { setSearchResults, setSearchQuery, setError } from "../store/friendsSlice";
// import type { RootState, AppDispatch } from "../store";

interface User { _id: string; username: string; profilePic?: string; isFriend?: boolean; hasPendingRequest?: boolean }

/* ---------- tokens ---------- */
const W = (a: number) => `rgba(255,255,255,${a})`;
const C = { n100: "#f5f5f5", n200: "#e5e5e5", n300: "#d4d4d4", n400: "#a3a3a3", n500: "#737373", n600: "#525252" };
const F = { light: "Sora_300Light", reg: "Sora_400Regular", med: "Sora_500Medium", semi: "Sora_600SemiBold" };

/* ---------- reveal: UI-thread mount animation (replaces gsap .from) ---------- */
function Reveal({ children, delay = 0, duration = 600, y = 0, scale = 1, easing = Easing.out(Easing.cubic), style }:
    { children: ReactNode; delay?: number; duration?: number; y?: number; scale?: number; easing?: (t: number) => number; style?: StyleProp<ViewStyle> }) {
    const reduce = useReducedMotion();
    const p = useSharedValue(reduce ? 1 : 0);
    useEffect(() => { if (!reduce) p.value = withDelay(delay, withTiming(1, { duration, easing })); }, []); // eslint-disable-line
    const a = useAnimatedStyle(() => ({
        opacity: Math.min(1, p.value * 1.4),
        transform: [{ translateY: (1 - p.value) * y }, { scale: scale + (1 - scale) * p.value }],
    }));
    return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* ---------- icons ---------- */
const Icon = ({ children, size = 20, color = "currentColor" }: { children: ReactNode; size?: number; color?: string }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">{children}</Svg>
);
type IP = { size?: number; color?: string };
const ClockIcon = (p: IP) => <Icon {...p}><Circle cx="12" cy="12" r="9" /><Path d="M12 7v5l3 2" /></Icon>;
const SearchIcon = (p: IP) => <Icon {...p}><Circle cx="11" cy="11" r="7" /><Path d="m20 20-3.5-3.5" /></Icon>;
const CloseIcon = (p: IP) => <Icon {...p}><Path d="M6 6l12 12M18 6 6 18" /></Icon>;
const CheckIcon = (p: IP) => <Icon {...p}><Path d="m5 12.5 4.5 4.5L19 7.5" /></Icon>;
const FillIcon = (p: IP) => <Icon {...p}><Path d="M17 17 7 7M7 15V7h8" /></Icon>;
const MessageIcon = (p: IP) => <Icon {...p}><Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" /></Icon>;
const UserPlusIcon = (p: IP) => <Icon {...p}><Circle cx="10" cy="8" r="3.6" /><Path d="M3.5 20c.6-3.4 3.2-5.4 6.5-5.4M18 9v6M15 12h6" /></Icon>;
const OrbitMark = (p: IP) => <Icon {...p}><Circle cx="12" cy="12" r="3" /><Ellipse cx="12" cy="12" rx="10" ry="4.5" rotation={-25} origin="12, 12" /></Icon>;

/* ---------- thunk ---------- */
const searchUsers = createAsyncThunk<User[], string, { rejectValue: string }>("friends/searchUsers", async (query, { rejectWithValue }) => {
    try {
        const response = await axios.get(`${API_URL}/api/social/search`, {
            params: { q: query }, withCredentials: true, headers: getAuthHeaders(),
        });
        return response.data.users ?? [];
    } catch (err: any) {
        return rejectWithValue(err.response?.data?.message || "Search failed");
    }
});

/* ---------- shared surfaces ---------- */
const raised: ViewStyle = {
    backgroundColor: "#0c0c0c", borderWidth: 1, borderColor: W(0.08),
    shadowColor: "#000", shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 4, height: 4 }, elevation: 6,
};
function GlassRow({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
    return (
        <LinearGradient colors={[W(0.1), W(0.03)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={[{ borderWidth: 1, borderColor: W(0.08) }, style]}>{children}</LinearGradient>
    );
}
function ActionBtn({ onPress, label, children, plain }: { onPress: () => void; label: string; children: ReactNode; plain?: boolean }) {
    return (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
            style={({ pressed }) => [s.actionBtn, plain ? s.plainBtn : raised, pressed && { transform: [{ scale: 0.9 }] }]}>
            {children}
        </Pressable>
    );
}

/* ---------- avatar ---------- */
function Avatar({ user }: { user: User }) {
    const [failed, setFailed] = useState(false);
    return (
        <View style={[s.avatar, raised]}>
            {user.profilePic && !failed ? (
                <Image source={{ uri: user.profilePic }} onError={() => setFailed(true)} style={s.avatarImg} />
            ) : (
                <View style={[s.avatarImg, { backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" }]}>
                    <Text style={{ fontFamily: F.med, fontSize: 14, color: C.n300, textTransform: "uppercase" }}>{user.username?.[0] ?? "?"}</Text>
                </View>
            )}
        </View>
    );
}

/* ---------- one searched profile ---------- */
function ProfileRow({ user, onSelect, onMessage, onAddFriend, onAccept, onReject }:
    { user: User; onSelect: () => void; onMessage: (u: User) => void; onAddFriend: (u: User) => void; onAccept: (u: User) => void; onReject: (u: User) => void }) {
    return (
        <GlassRow style={s.row}>
            <Avatar user={user} />
            <Pressable onPress={onSelect} style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={s.rowText}>{user.username}</Text>
            </Pressable>
            {user.isFriend ? (
                <ActionBtn label={`Message ${user.username}`} onPress={() => onMessage(user)}><MessageIcon size={18} color={C.n100} /></ActionBtn>
            ) : user.hasPendingRequest ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActionBtn label={`Accept request from ${user.username}`} onPress={() => onAccept(user)}><CheckIcon size={18} color="#fff" /></ActionBtn>
                    <ActionBtn plain label={`Decline request from ${user.username}`} onPress={() => onReject(user)}><CloseIcon size={18} color={C.n400} /></ActionBtn>
                </View>
            ) : (
                <ActionBtn label={`Add ${user.username} as a friend`} onPress={() => onAddFriend(user)}><UserPlusIcon size={18} color={C.n100} /></ActionBtn>
            )}
        </GlassRow>
    );
}

function SkeletonRow() {
    const o = useSharedValue(1);
    useEffect(() => { o.value = withRepeat(withSequence(withTiming(0.5, { duration: 1000 }), withTiming(1, { duration: 1000 })), -1); }, []); // eslint-disable-line
    const a = useAnimatedStyle(() => ({ opacity: o.value }));
    return (
        <Animated.View style={a}>
            <GlassRow style={s.row}>
                <View style={[s.avatar, { backgroundColor: W(0.07), borderWidth: 0 }]} />
                <View style={{ height: 14, width: 128, borderRadius: 7, backgroundColor: W(0.08) }} />
                <View style={{ marginLeft: "auto", height: 40, width: 40, borderRadius: 20, backgroundColor: W(0.07) }} />
            </GlassRow>
        </Animated.View>
    );
}

/* ---------- orbit backdrop ---------- */
function Ring({ size, index, d }: { size: number; index: number; d: number }) {
    const rot = useSharedValue(0);
    const reduce = useReducedMotion();
    useEffect(() => {
        if (!reduce) rot.value = withRepeat(withTiming(360, { duration: (28 + index * 14) * 1000, easing: Easing.linear }), -1);
    }, []); // eslint-disable-line
    const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
    const dot = index === 1 ? 8 : 6;
    return (
        <Reveal delay={index * 180} duration={1600} scale={0.55} easing={Easing.out(Easing.exp)} style={[StyleSheet.absoluteFill, s.center]}>
            <View style={{ width: d, height: d, borderRadius: d / 2, borderWidth: 1, borderColor: W(0.11) }}>
                <Animated.View style={[StyleSheet.absoluteFill, a]}>
                    <View style={{
                        position: "absolute", left: d / 2 - dot / 2, top: -dot / 2, width: dot, height: dot, borderRadius: dot / 2,
                        backgroundColor: C.n300, shadowColor: "#fff", shadowOpacity: 0.35, shadowRadius: 7, shadowOffset: { width: 0, height: 0 },
                    }} />
                </Animated.View>
            </View>
        </Reveal>
    );
}

const SEED = ["neon photography walks", "@mira.vale", "#lowlightcity", "late night synth sets", "Lisbon rooftops", "@kairo", "#analogfilm"]; // eslint-disable-line @typescript-eslint/no-unused-vars

export default function SearchPage() {
    const dispatch = useDispatch<AppDispatch>();
    const navigation = useNavigation<any>();
    const insets = useSafeAreaInsets();
    const { width, height } = useWindowDimensions();
    const [fontsLoaded] = useFonts({ Sora_300Light, Sora_400Regular, Sora_500Medium, Sora_600SemiBold });
    // const searchResults: User[] = useSelector((state: RootState) => (state as any).friends.searchResults) ?? [];

    // const searchQuery: string = useSelector((state: RootState) => (state as any).friends.searchQuery) ?? "";
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [history, setHistory] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const introDone = useRef(false);

    const searching = searchQuery.trim().length > 0;
    const vmin = Math.min(width, height) / 100;

    useEffect(() => { const t = setTimeout(() => { introDone.current = true; }, 1800); return () => clearTimeout(t); }, []);

    /* ---- connect these to your own friend / chat actions ---- */
    const handleSelectUser = (user: User) => { /* e.g. navigation.navigate("SocialProfile", { id: user._id }) */ };
    const handleMessage = (user: User) => { /* e.g. navigation.navigate("Chat", { id: user._id }) */ };
    const handleAddFriend = async (user: User) => {
        try {
            await axios.post(`${API_URL}/api/social/friend-request/${user._id}`, {}, { withCredentials: true, headers: getAuthHeaders() });
            // Update search results to show Pending state instead of removing
            setSearchResults(searchResults.map((u) => (u._id === user._id ? { ...u, hasPendingRequest: true } : u)));
        } catch (err: any) {
            setError(err.response?.data?.message || "Failed to send friend request");
            setTimeout(() => setError(null), 3000);
        }
    };
    const handleAccept = (user: User) => { /* e.g. dispatch(acceptFriendRequest(user._id)) */ };
    const handleReject = (user: User) => { /* e.g. dispatch(rejectFriendRequest(user._id)) */ };

    /* debounced user search: cancels stale requests, tracks loading locally */
    useEffect(() => {
        const term = searchQuery.trim();
        if (!term) { setSearchResults([]); setLoading(false); return; }
        setLoading(true);
        let active = true;
        let request: any;
        const timer = setTimeout(() => {
            request = dispatch(searchUsers(term));
            request.then((action: any) => {
                if (!active) return;
                setSearchResults(searchUsers.fulfilled.match(action) ? action.payload : []);
                setLoading(false);
            });
        }, 250);
        return () => { active = false; clearTimeout(timer); request?.abort(); };
    }, [searchQuery, dispatch]);

    const submit = () => {
        const term = searchQuery.trim();
        if (!term) return;
        setHistory((h) => [term, ...h.filter((x) => x.toLowerCase() !== term.toLowerCase())]);
    };
    const remove = (term: string) => setHistory((h) => h.filter((x) => x !== term));
    const rowDelay = (i: number, intro: number) => (introDone.current ? i * 50 : intro + i * 70);

    if (!fontsLoaded) return null;

    const empty = (title: string, sub: string) => (
        <GlassRow style={s.empty}>
            <Text style={{ fontFamily: F.reg, fontSize: 16, color: C.n200, textAlign: "center" }}>{title}</Text>
            <Text style={{ fontFamily: F.light, fontSize: 14, color: C.n500, marginTop: 6, textAlign: "center" }}>{sub}</Text>
        </GlassRow>
    );

    return (
        <View style={s.root}>
            {/* orbit backdrop */}
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.center, { opacity: 0.3 }]}>
                <Reveal delay={0} duration={1400} style={StyleSheet.absoluteFill}>
                    <LinearGradient colors={[W(0.07), "transparent"]} start={{ x: 0.5, y: 0 }} end={{ x: 0.5, y: 0.6 }} style={StyleSheet.absoluteFill} />
                </Reveal>
                {[52, 84, 122].map((size, i) => <Ring key={size} size={size} index={i} d={size * vmin} />)}
            </View>

            {/* header */}
            <Reveal delay={350} duration={900} y={-24} style={[s.wrap, { paddingTop: Math.max(20, insets.top) + (width >= 640 ? 12 : 0) }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                    <View style={[s.mark, raised]}><OrbitMark color={C.n100} /></View>
                    <View>
                        <Text style={{ fontFamily: F.semi, fontSize: 18, color: C.n100, letterSpacing: -0.4 }}>Orb8</Text>
                        <Text style={{ fontFamily: F.light, fontSize: 12, color: C.n500 }}>Search</Text>
                    </View>
                </View>
            </Reveal>

            {/* history / results */}
            <View style={[s.wrap, { flex: 1, minHeight: 0, paddingTop: 24 }]} accessibilityLabel={searching ? "Search results" : "Search history"}>
                <Reveal delay={700} duration={600} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <Text accessibilityRole="header" style={{ fontFamily: F.light, fontSize: 26, color: C.n100, letterSpacing: -0.5 }}>{searching ? "Results" : "Recent searches"}</Text>
                    {!searching && history.length > 0 && (
                        <Pressable onPress={() => setHistory([])} style={s.clear}>
                            <Text style={{ fontFamily: F.reg, fontSize: 12, color: C.n400 }}>Clear all</Text>
                        </Pressable>
                    )}
                </Reveal>

                <View style={{ flex: 1, minHeight: 0 }}>
                    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 12, gap: 14 }}>
                        {searching ? (
                            loading && searchResults.length === 0 ? (
                                [0, 1, 2, 3].map((i) => <SkeletonRow key={i} />)
                            ) : searchResults.length === 0 ? (
                                empty(`No users found for “${searchQuery.trim()}”`, "Check the spelling or try another username.")
                            ) : (
                                searchResults.map((u, i) => (
                                    <Reveal key={u._id} delay={i * 50} duration={500} y={18} style={{ opacity: loading ? 0.6 : 1 }}>
                                        <ProfileRow user={u}
                                            onSelect={() => u._id && navigation.navigate("SocialProfile", { id: u._id })}
                                            onMessage={handleMessage} onAddFriend={handleAddFriend} onAccept={handleAccept} onReject={handleReject} />
                                    </Reveal>
                                ))
                            )
                        ) : history.length === 0 ? (
                            empty("No searches yet", "Search for people on Orbit.")
                        ) : (
                            history.map((term, i) => (
                                <Reveal key={term} delay={rowDelay(i, 800)} duration={700} y={introDone.current ? -18 : 28} scale={introDone.current ? 0.96 : 0.97}>
                                    <GlassRow style={s.row}>
                                        <View style={[s.histIcon, raised]}><ClockIcon size={18} color={C.n400} /></View>
                                        <Pressable onPress={() => setSearchQuery(term)} style={{ flex: 1, minWidth: 0 }} accessibilityLabel={`Search “${term}”`}>
                                            <Text numberOfLines={1} style={[s.rowText, { color: C.n200 }]}>{term}</Text>
                                        </Pressable>
                                        {width >= 640 && (
                                            <Pressable onPress={() => setSearchQuery(term)} accessibilityLabel={`Use ${term} in search`} style={s.small}>
                                                <FillIcon size={16} color={C.n500} />
                                            </Pressable>
                                        )}
                                        <Pressable onPress={() => remove(term)} accessibilityLabel={`Remove ${term} from history`} style={s.small}>
                                            <CloseIcon size={16} color={C.n500} />
                                        </Pressable>
                                    </GlassRow>
                                </Reveal>
                            ))
                        )}
                    </ScrollView>
                    <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0.8)", "transparent"]} style={[s.fade, { top: 0 }]} />
                    <LinearGradient pointerEvents="none" colors={["transparent", "rgba(0,0,0,0.8)"]} style={[s.fade, { bottom: 0 }]} />
                </View>
            </View>

            {/* search bar */}
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
                <Reveal delay={900} duration={1000} y={110} easing={Easing.out(Easing.back(1.5))} style={[s.wrap, { paddingBottom: Math.max(16, insets.bottom), paddingTop: 8 }]}>
                    <View style={[s.barOuter, { borderColor: focused ? W(0.25) : W(0.1), shadowOpacity: focused ? 1 : 0.95 }]}>
                        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                        <View style={s.barInner}>
                            <SearchIcon size={20} color={C.n500} />
                            <TextInput
                                value={searchQuery}
                                onChangeText={(t) => setSearchQuery(t)}
                                onFocus={() => setFocused(true)}
                                onBlur={() => setFocused(false)}
                                onSubmitEditing={submit}
                                placeholder="Search anything on orbit"
                                placeholderTextColor={C.n600}
                                accessibilityLabel="Search anything on orbit"
                                returnKeyType="search"
                                autoCapitalize="none"
                                autoCorrect={false}
                                autoComplete="off"
                                style={s.input}
                            />
                            <Pressable onPress={submit} accessibilityRole="button" accessibilityLabel="Search"
                                style={({ pressed }) => [s.submit, raised, pressed && { transform: [{ scale: 0.95 }] }]}>
                                <SearchIcon size={20} color={C.n100} />
                            </Pressable>
                        </View>
                    </View>
                </Reveal>
            </KeyboardAvoidingView>
        </View>
    );
}

const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#000", overflow: "hidden" },
    center: { alignItems: "center", justifyContent: "center" },
    wrap: { width: "100%", maxWidth: 672, alignSelf: "center", paddingHorizontal: 20 },
    mark: { height: 44, width: 44, borderRadius: 16, alignItems: "center", justifyContent: "center" },
    clear: { borderRadius: 999, borderWidth: 1, borderColor: W(0.1), backgroundColor: W(0.04), paddingHorizontal: 14, paddingVertical: 6 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 10, paddingRight: 12 },
    rowText: { fontFamily: F.reg, fontSize: 15, color: C.n100 },
    avatar: { height: 44, width: 44, borderRadius: 12, padding: 3, overflow: "hidden" },
    avatarImg: { height: "100%", width: "100%", borderRadius: 9 },
    actionBtn: { height: 40, width: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    plainBtn: { borderWidth: 1, borderColor: W(0.1), backgroundColor: W(0.04) },
    histIcon: { height: 40, width: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    small: { height: 36, width: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
    empty: { marginTop: 24, borderRadius: 24, paddingHorizontal: 24, paddingVertical: 40 },
    fade: { position: "absolute", left: 0, right: 0, height: 16 },
    barOuter: {
        borderRadius: 30, borderWidth: 1, backgroundColor: W(0.045), padding: 8, overflow: "hidden",
        shadowColor: "#000", shadowRadius: 35, shadowOffset: { width: 0, height: 24 }, elevation: 16,
    },
    barInner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 24, backgroundColor: "#050505", paddingVertical: 6, paddingLeft: 16, paddingRight: 6, borderWidth: 1, borderColor: W(0.04) },
    input: { flex: 1, minWidth: 0, paddingVertical: 10, fontFamily: F.reg, fontSize: 15, color: C.n100 },
    submit: { height: 44, width: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});