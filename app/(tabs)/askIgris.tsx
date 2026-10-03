import React, { useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import {
    View, Text, TextInput, Pressable, ScrollView, Image, StyleSheet, BackHandler, Platform,
    KeyboardAvoidingView, useWindowDimensions, StatusBar, StyleProp, ViewStyle, NativeSyntheticEvent, TextInputContentSizeChangeEventData,
} from "react-native";
import Animated, {
    useSharedValue, useAnimatedStyle, useAnimatedProps, withTiming, withDelay, withRepeat, withSequence,
    interpolate, interpolateColor, Easing, useReducedMotion, LinearTransition, FadeOut,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, G, Line, Path, Defs, RadialGradient, Stop } from "react-native-svg";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Paperclip, Image as ImageIcon, FileText, X, ArrowUp, Copy, Check, Menu, Search, MessageSquare } from "lucide-react-native";

/* =====================================================================
   SETUP (NativeWind v4): tailwind.config.js presets: [require("nativewind/preset")],
   babel preset "nativewind/babel", metro withNativeWind, `import "./global.css"` in your root.
   Set EXPO_PUBLIC_API_URL in .env.
   ===================================================================== */
const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5000";
const IGRIS_API_URL = `${apiUrl}/api/askigris`;
const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await AsyncStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ---------- types ---------- */
interface Attachment { name: string; size: number; kind: "image" | "pdf"; type: string; preview: string | null; uri: string }
interface Message { id: string; role: "user" | "assistant"; text: string; attachment?: Attachment | null; isError?: boolean }
interface Chat { _id: string; title: string }

const GREETINGS = [
    "What's on your mind?", "What can I help with?", "Where should we start?", "What are we figuring out today?",
    "Lawde na bhojyam", "Ready when you are.", "What's the plan?", "What are we working on?", "How can I help today?",
    "What's up?", "Let's get into it.", "What do you need?", "Something on your mind?", "What are we building today?",
    "How can I be useful?", "What's the task?", "Where do we begin?",
];
const getRandomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
const MAX_TEXTAREA_HEIGHT = 200;
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
const W = (a: number) => `rgba(255,255,255,${a})`;
const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);
const formatSize = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

/* =====================================================================
   Glass + Neo primitives
   ===================================================================== */
function Glass({ children, style, className, intensity = 40 }: { children?: ReactNode; style?: StyleProp<ViewStyle>; className?: string; intensity?: number }) {
    return (
        <View className={className} style={[{ overflow: "hidden", borderWidth: 1, borderColor: W(0.1), backgroundColor: W(0.045) }, style]}>
            <BlurView intensity={intensity} tint="dark" style={StyleSheet.absoluteFill} />
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderTopWidth: 1, borderColor: W(0.06), borderRadius: 999 }]} />
            {children}
        </View>
    );
}

/** Neumorphic button: raised at rest, sinks in (scale + dimmer shadow + darker face) while pressed. */
function NeoButton({ onPress, disabled, label, size = 36, round = true, active = false, children, style }:
    { onPress?: () => void; disabled?: boolean; label: string; size?: number; round?: boolean; active?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.92]) }],
        backgroundColor: interpolateColor(p.value, [0, 1], [active ? "#f4f4f5" : "#18181c", active ? "#d4d4d8" : "#0b0b0d"]),
        shadowOpacity: interpolate(p.value, [0, 1], [0.85, 0.15]),
        shadowRadius: interpolate(p.value, [0, 1], [9, 2]),
        borderTopColor: interpolateColor(p.value, [0, 1], [W(0.14), "rgba(0,0,0,0.5)"]),
        borderLeftColor: interpolateColor(p.value, [0, 1], [W(0.1), "rgba(0,0,0,0.5)"]),
        borderBottomColor: interpolateColor(p.value, [0, 1], ["rgba(0,0,0,0.7)", W(0.06)]),
        borderRightColor: interpolateColor(p.value, [0, 1], ["rgba(0,0,0,0.6)", W(0.04)]),
    }));
    return (
        <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
            onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
            onPressOut={() => { p.value = withTiming(0, { duration: 260, easing: EASE_OUT }); }}
            style={{ opacity: disabled ? 0.4 : 1 }} hitSlop={6}>
            <Animated.View
                style={[{ width: size, height: size, borderRadius: round ? size / 2 : 14, borderWidth: 1, alignItems: "center", justifyContent: "center",
                    shadowColor: "#000", shadowOffset: { width: 4, height: 5 }, elevation: 6 }, a, style]}>
                {children}
            </Animated.View>
        </Pressable>
    );
}

/** One-shot mount animation (UI thread). */
function Reveal({ children, delay = 0, duration = 600, y = 0, scale = 1, easing = Easing.out(Easing.cubic), style }:
    { children: ReactNode; delay?: number; duration?: number; y?: number; scale?: number; easing?: (t: number) => number; style?: StyleProp<ViewStyle> }) {
    const reduce = useReducedMotion();
    const p = useSharedValue(reduce ? 1 : 0);
    useEffect(() => { if (!reduce) p.value = withDelay(delay, withTiming(1, { duration, easing })); }, []); // eslint-disable-line
    const a = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ translateY: (1 - p.value) * y }, { scale: scale + (1 - scale) * p.value }] }));
    return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/* =====================================================================
   IgrisMark (SVG; blur filters swapped for radial gradients, which RN supports)
   ===================================================================== */
const AG = Animated.createAnimatedComponent(G);
const AEllipse = Animated.createAnimatedComponent(Ellipse);
const HELMET_PATH = "M100,10 L108,34 L128,46 L152,78 L140,100 L146,118 L122,148 L110,172 L100,192 L90,172 L78,148 L54,118 L60,100 L48,78 L72,46 L92,34 Z";
const EYE_LEFT = "M58,100 L80,93 L94,97 L80,104 Z";
const EYE_RIGHT = "M142,100 L120,93 L106,97 L120,104 Z";
const CRACK_LINES = [[152, 78, 178, 68], [48, 78, 22, 68], [140, 100, 172, 106], [60, 100, 28, 106], [122, 148, 144, 168], [78, 148, 56, 168]];

function generateParticles(count = 50) {
    let seed = 42;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed % 10000) / 10000; };
    return Array.from({ length: count }, (_, i) => {
        const hb = Math.pow(rand(), 2.2);
        const spread = 28 + hb * 58;
        return { id: i, x: 100 + (rand() - 0.5) * spread * 2, y: 4 + hb * 172, r: 0.35 + rand() * 1.05, o: 0.12 + (1 - hb) * 0.55 };
    });
}

function IgrisMark({ size, powerOnDelay = 900 }: { size: number; powerOnDelay?: number }) {
    const reduce = useReducedMotion();
    const particles = useMemo(() => generateParticles(), []);
    const sphere = useSharedValue(reduce ? 1 : 0), frame = useSharedValue(reduce ? 1 : 0), parts = useSharedValue(reduce ? 1 : 0);
    const eyes = useSharedValue(reduce ? 1 : 0), glow = useSharedValue(reduce ? 1 : 0), glowS = useSharedValue(reduce ? 1 : 0.5);
    const pulse = useSharedValue(1);
    const tw = [useSharedValue(1), useSharedValue(1), useSharedValue(1)];

    useEffect(() => {
        tw.forEach((v, i) => { v.value = withDelay(i * 900, withRepeat(withSequence(withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.sin) }), withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.sin) })), -1)); });
        if (reduce) return;
        const d = powerOnDelay, sine = Easing.out(Easing.sin), io = Easing.inOut(Easing.sin);
        const t = (v: number, ms: number) => withTiming(v, { duration: ms });
        sphere.value = withDelay(d, withTiming(1, { duration: 1300, easing: sine }));
        parts.value = withDelay(d + 150, withTiming(1, { duration: 1600, easing: sine }));
        frame.value = withDelay(d + 350, withTiming(1, { duration: 1000, easing: sine }));
        const idle = withRepeat(withSequence(withTiming(0.55, { duration: 2200, easing: io }), withTiming(1, { duration: 2200, easing: io })), -1);
        eyes.value = withDelay(d + 1100, withSequence(t(1, 50), t(1, 50), t(0.1, 60), t(0.1, 60), t(1, 70), t(1, 60), t(0.25, 50), t(0.25, 50), withTiming(1, { duration: 400, easing: sine }), withDelay(350, idle)));
        glow.value = withDelay(d + 1550, withSequence(withTiming(1, { duration: 700, easing: sine }), withDelay(350 + 0, withRepeat(withSequence(withTiming(0.55, { duration: 2200, easing: io }), withTiming(1, { duration: 2200, easing: io })), -1))));
        glowS.value = withDelay(d + 1550, withTiming(1, { duration: 700, easing: sine }));
        pulse.value = withDelay(d + 1900, withRepeat(withSequence(withTiming(1.015, { duration: 3600, easing: io }), withTiming(1, { duration: 3600, easing: io })), -1));
    }, []); // eslint-disable-line

    const pSphere = useAnimatedProps(() => ({ opacity: sphere.value }));
    const pFrame = useAnimatedProps(() => ({ opacity: frame.value }));
    const pEyes = useAnimatedProps(() => ({ opacity: eyes.value }));
    const pGlow = useAnimatedProps(() => ({ opacity: glow.value, rx: 66 * glowS.value, ry: 26 * glowS.value }));
    const pParts = tw.map((v) => useAnimatedProps(() => ({ opacity: parts.value * v.value }))); // eslint-disable-line react-hooks/rules-of-hooks
    const root = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

    return (
        <Animated.View style={[{ width: size, height: size }, root]}>
            <Svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow: "visible" }}>
                <Defs>
                    <RadialGradient id="ambient" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff" stopOpacity={0.1} /><Stop offset="0.65" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                    <RadialGradient id="core" cx="50%" cy="48%" r="55%"><Stop offset="0" stopColor="#fff" stopOpacity={0.05} /><Stop offset="0.7" stopColor="#fff" stopOpacity={0.015} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                    <RadialGradient id="eyeGlow" cx="50%" cy="50%" r="50%"><Stop offset="0" stopColor="#fff" stopOpacity={0.45} /><Stop offset="1" stopColor="#fff" stopOpacity={0} /></RadialGradient>
                </Defs>
                <Circle cx="100" cy="100" r="108" fill="url(#ambient)" />
                <AG animatedProps={pSphere}>
                    <Circle cx="100" cy="100" r="92" fill="url(#core)" />
                    <Circle cx="100" cy="100" r="92" fill="none" stroke={W(0.16)} strokeWidth={1} />
                    <Circle cx="100" cy="100" r="93" fill="none" stroke={W(0.12)} strokeWidth={5} />
                    <Path d="M42,52 A98,98 0 0 1 42,148" fill="none" stroke={W(0.1)} strokeWidth={0.75} />
                    <Path d="M158,52 A98,98 0 0 0 158,148" fill="none" stroke={W(0.1)} strokeWidth={0.75} />
                    {CRACK_LINES.map((l, i) => (
                        <G key={i}><Line x1={l[0]} y1={l[1]} x2={l[2]} y2={l[3]} stroke={W(0.14)} strokeWidth={0.6} /><Circle cx={l[2]} cy={l[3]} r={1.1} fill={W(0.4)} /></G>
                    ))}
                </AG>
                {pParts.map((ap, g) => (
                    <AG key={g} animatedProps={ap}>
                        {particles.filter((p) => p.id % 3 === g).map((p) => <Circle key={p.id} cx={p.x} cy={p.y} r={p.r} fill="#fff" opacity={p.o} />)}
                    </AG>
                ))}
                <AG animatedProps={pFrame}>
                    <Path d={HELMET_PATH} fill="rgba(10,10,12,0.55)" stroke={W(0.34)} strokeWidth={1.4} strokeLinejoin="round" />
                    <Path d="M100,10 L100,86" stroke={W(0.22)} strokeWidth={1} />
                    <Path d="M100,110 L100,192" stroke={W(0.22)} strokeWidth={1} />
                    <Path d="M100,88 L104,94 L100,100 L96,94 Z" fill={W(0.12)} stroke={W(0.3)} strokeWidth={0.6} />
                    <Path d="M108,34 L140,100" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M92,34 L60,100" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M152,78 L122,148" stroke={W(0.09)} strokeWidth={0.75} />
                    <Path d="M48,78 L78,148" stroke={W(0.09)} strokeWidth={0.75} />
                </AG>
                <AEllipse animatedProps={pGlow} cx="100" cy="98" rx="66" ry="26" fill="url(#eyeGlow)" />
                <AG animatedProps={pEyes}>
                    <Path d={EYE_LEFT} fill="#fff" opacity={0.25} transform="translate(0 0) scale(1)" stroke="#fff" strokeWidth={4} strokeOpacity={0.25} />
                    <Path d={EYE_RIGHT} fill="#fff" opacity={0.25} stroke="#fff" strokeWidth={4} strokeOpacity={0.25} />
                    <Path d={EYE_LEFT} fill="#fff" /><Path d={EYE_RIGHT} fill="#fff" />
                </AG>
            </Svg>
        </Animated.View>
    );
}

/* =====================================================================
   Sidebar (right side) — glass drawer, staggered items, neo buttons
   ===================================================================== */
function Sidebar({ open, onClose, chats, onSelectChat, newConversation }: { open: boolean; onClose: () => void; chats: Chat[]; onSelectChat: (c: Chat) => void; newConversation: () => void }) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const panelW = Math.min(280, width * 0.82);
    const p = useSharedValue(0);
    const [query, setQuery] = useState("");
    const [focused, setFocused] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        if (open) setMounted(true);
        p.value = withTiming(open ? 1 : 0, { duration: open ? 450 : 400, easing: open ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic) }, (done) => {
            if (done && !open) { /* unmount handled below */ }
        });
        if (!open) { const t = setTimeout(() => setMounted(false), 420); return () => clearTimeout(t); }
    }, [open]); // eslint-disable-line

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => { if (open) { onClose(); return true; } return false; });
        return () => sub.remove();
    }, [open, onClose]);

    const panel = useAnimatedStyle(() => ({ transform: [{ translateX: (1 - p.value) * panelW }] }));
    const backdrop = useAnimatedStyle(() => ({ opacity: p.value }));
    const filtered = chats.filter((c) => c.title?.toLowerCase().includes(query.trim().toLowerCase()));

    if (!mounted && !open) return null;
    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 50 }]} pointerEvents={open ? "auto" : "none"}>
            <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.7)" }, backdrop]}>
                <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="Close sidebar" />
            </Animated.View>
            <Animated.View style={[{ position: "absolute", top: 0, right: 0, bottom: 0, width: panelW }, panel]}>
                <Glass intensity={55} style={{ flex: 1, borderRightWidth: 0, borderTopWidth: 0, borderBottomWidth: 0, backgroundColor: "rgba(16,16,18,0.72)", paddingTop: insets.top, paddingBottom: insets.bottom }}>
                    <View className="flex-row items-center justify-between px-4 h-14 border-b border-white/[0.08]">
                        <Text className="text-zinc-200 text-sm font-medium">Chats</Text>
                        <NeoButton label="Close sidebar" size={32} onPress={onClose}><X size={16} color="#a1a1aa" /></NeoButton>
                    </View>

                    <View className="px-3 pt-3">
                        <View className="flex-row items-center gap-2 rounded-xl px-3 py-2 border" style={{ backgroundColor: "#08080a", borderColor: focused ? W(0.2) : W(0.08) }}>
                            <Search size={16} color="#71717a" />
                            <TextInput value={query} onChangeText={setQuery} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                                placeholder="Search history..." placeholderTextColor="#71717a" className="flex-1 text-sm text-zinc-200 p-0" />
                        </View>
                        <View className="mt-3"><NeoWide label="Start New Conversation" onPress={newConversation} /></View>
                    </View>

                    <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 8, paddingVertical: 12, gap: 2 }} showsVerticalScrollIndicator={false}>
                        {open && filtered.length > 0 ? filtered.map((chat, i) => (
                            <Reveal key={chat._id} delay={150 + Math.min(i, 10) * 40} duration={400} y={10}>
                                <ChatItem chat={chat} onPress={() => onSelectChat(chat)} />
                            </Reveal>
                        )) : (
                            <Text className="px-3 py-4 text-sm text-zinc-500 text-center">{chats.length ? "No matching chats." : "Start a chat by asking a question!"}</Text>
                        )}
                    </ScrollView>
                </Glass>
            </Animated.View>
        </View>
    );
}

function NeoWide({ label, onPress }: { label: string; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.97]) }],
        backgroundColor: interpolateColor(p.value, [0, 1], ["#18181c", "#0b0b0d"]),
        shadowOpacity: interpolate(p.value, [0, 1], [0.8, 0.15]),
    }));
    return (
        <Pressable onPress={onPress} accessibilityRole="button" onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }} onPressOut={() => { p.value = withTiming(0, { duration: 260, easing: EASE_OUT }); }}>
            <Animated.View style={[{ borderRadius: 16, borderWidth: 1, borderColor: W(0.08), borderTopColor: W(0.14), paddingVertical: 10, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 3, height: 4 }, shadowRadius: 8, elevation: 5 }, a]}>
                <Text className="text-sm text-zinc-200">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

function ChatItem({ chat, onPress }: { chat: Chat; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,255,255,${0.07 * p.value})`, transform: [{ scale: 1 - 0.015 * p.value }] }));
    return (
        <Pressable onPress={onPress} onPressIn={() => { p.value = withTiming(1, { duration: 100 }); }} onPressOut={() => { p.value = withTiming(0, { duration: 250 }); }}>
            <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 }, a]}>
                <MessageSquare size={16} color="#71717a" />
                <Text numberOfLines={1} className="flex-1 text-sm text-zinc-300">{chat.title}</Text>
            </Animated.View>
        </Pressable>
    );
}

/* =====================================================================
   Composer
   ===================================================================== */
function Composer(props: {
    text: string; setText: (t: string) => void; attachment: Attachment | null; onRemoveAttachment: () => void; onSend: () => void;
    canSend: boolean; isLoading: boolean; menuOpen: boolean; setMenuOpen: (f: (o: boolean) => boolean | boolean) => void;
    onPickImage: () => void; onPickPdf: () => void;
}) {
    const { text, setText, attachment, onRemoveAttachment, onSend, canSend, isLoading, menuOpen, setMenuOpen, onPickImage, onPickPdf } = props;
    const [height, setHeight] = useState(24);
    const [focused, setFocused] = useState(false);
    const f = useSharedValue(0);
    useEffect(() => { f.value = withTiming(focused ? 1 : 0, { duration: 200 }); }, [focused]); // eslint-disable-line
    const border = useAnimatedStyle(() => ({ borderColor: interpolateColor(f.value, [0, 1], [W(0.1), W(0.24)]), shadowOpacity: 0.35 + f.value * 0.25 }));
    const onSize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) => setHeight(Math.min(e.nativeEvent.contentSize.height, MAX_TEXTAREA_HEIGHT));
    const send = useAnimatedStyle(() => ({ opacity: 1 }));

    return (
        <Animated.View style={[{ borderRadius: 26, shadowColor: "#000", shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12 }, border]}>
            <Glass intensity={45} style={{ borderRadius: 26, borderColor: "transparent", paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 }}>
                {attachment && (
                    <Reveal duration={250} y={6} style={{ alignSelf: "flex-start", marginBottom: 12, maxWidth: "100%" }}>
                        <View className="flex-row items-center gap-2 rounded-2xl pl-2 pr-3 py-2 border border-white/[0.08] bg-white/[0.04]">
                            <View className="w-9 h-9 rounded-xl overflow-hidden bg-white/10 items-center justify-center">
                                {attachment.kind === "image" && attachment.preview ? <Image source={{ uri: attachment.preview }} style={{ width: "100%", height: "100%" }} /> : <FileText size={16} color="#d4d4d8" />}
                            </View>
                            <View style={{ flexShrink: 1 }}>
                                <Text numberOfLines={1} className="text-sm text-zinc-200" style={{ maxWidth: 200 }}>{attachment.name}</Text>
                                <Text className="text-xs text-zinc-500">{formatSize(attachment.size)}</Text>
                            </View>
                            <NeoButton label="Remove attachment" size={24} onPress={onRemoveAttachment}><X size={14} color="#a1a1aa" /></NeoButton>
                        </View>
                    </Reveal>
                )}

                <TextInput value={text} onChangeText={setText} multiline editable={!isLoading} placeholder="Ask something..." placeholderTextColor="#71717a"
                    onContentSizeChange={onSize} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} textAlignVertical="top" scrollEnabled={height >= MAX_TEXTAREA_HEIGHT}
                    className="text-zinc-100 text-base p-0" style={{ height: Math.max(24, height), lineHeight: 24, opacity: isLoading ? 0.6 : 1 }} />

                <View className="flex-row items-center justify-between mt-2" style={{ zIndex: 10 }}>
                    <View>
                        <NeoButton label="Attach a file" onPress={() => setMenuOpen((o) => !o)} disabled={isLoading}><Paperclip size={18} color="#a1a1aa" /></NeoButton>
                        {menuOpen && (
                            <Reveal duration={160} y={6} style={{ position: "absolute", bottom: 46, left: 0, width: 176, zIndex: 20 }}>
                                <Glass intensity={60} style={{ borderRadius: 16, paddingVertical: 4, backgroundColor: "rgba(26,26,30,0.85)" }}>
                                    <MenuRow icon={<ImageIcon size={16} color="#a1a1aa" />} label="Image" onPress={onPickImage} />
                                    <MenuRow icon={<FileText size={16} color="#a1a1aa" />} label="PDF" onPress={onPickPdf} />
                                </Glass>
                            </Reveal>
                        )}
                    </View>
                    <NeoButton label="Send message" active={canSend && !isLoading} disabled={!canSend || isLoading} onPress={onSend}>
                        <ArrowUp size={18} strokeWidth={2.5} color={canSend && !isLoading ? "#18181b" : "#52525b"} />
                    </NeoButton>
                </View>
            </Glass>
        </Animated.View>
    );
}

function MenuRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,255,255,${0.07 * p.value})` }));
    return (
        <Pressable onPress={onPress} onPressIn={() => { p.value = withTiming(1, { duration: 80 }); }} onPressOut={() => { p.value = withTiming(0, { duration: 200 }); }}>
            <Animated.View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10 }, a]}>
                {icon}<Text className="text-sm text-zinc-200">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

/* =====================================================================
   Messages
   ===================================================================== */
function MessageText({ text }: { text: string }) {
    return <>{text.split(/(\*\*[^*\n]+?\*\*)/g).map((part, i) => (part.startsWith("**") && part.endsWith("**") && part.length > 4
        ? <Text key={i} style={{ fontWeight: "700" }}>{part.slice(2, -2)}</Text> : <Text key={i}>{part}</Text>))}</>;
}

function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);
    const [showCopy, setShowCopy] = useState(false);
    const handleCopy = async () => {
        if (!message.text) return;
        await Clipboard.setStringAsync(message.text);
        setCopied(true); setTimeout(() => setCopied(false), 1200);
    };
    const bubble = isUser ? "bg-zinc-100 rounded-br-md" : message.isError ? "bg-red-950/40 border border-red-900/40 rounded-bl-md" : "bg-white/[0.05] border border-white/[0.08] rounded-bl-md";
    return (
        <Reveal duration={isUser ? 350 : 450} y={isUser ? 10 : 16} scale={isUser ? 0.98 : 0.96} style={{ flexDirection: "row", justifyContent: isUser ? "flex-end" : "flex-start" }}>
            <Pressable onPress={() => setShowCopy((s) => !s)} style={{ maxWidth: "88%" }}>
                <View className={`rounded-2xl px-4 py-2.5 ${bubble}`}>
                    {message.attachment && (
                        <View className={`mb-2 flex-row self-start items-center gap-2 rounded-xl pl-1.5 pr-3 py-1.5 ${isUser ? "bg-black/10" : "bg-white/5"}`}>
                            <View className="w-7 h-7 rounded-lg overflow-hidden bg-black/10 items-center justify-center">
                                {message.attachment.kind === "image" && message.attachment.preview ? <Image source={{ uri: message.attachment.preview }} style={{ width: "100%", height: "100%" }} /> : <FileText size={14} color={isUser ? "#18181b" : "#f4f4f5"} />}
                            </View>
                            <View style={{ flexShrink: 1 }}>
                                <Text numberOfLines={1} className={`text-xs ${isUser ? "text-zinc-900" : "text-zinc-100"}`} style={{ maxWidth: 180 }}>{message.attachment.name}</Text>
                                <Text className={`text-[11px] ${isUser ? "text-zinc-600" : "text-zinc-500"}`}>{formatSize(message.attachment.size)}</Text>
                            </View>
                        </View>
                    )}
                    {!!message.text && (
                        <Text selectable className={`text-[15px] leading-6 ${isUser ? "text-zinc-900" : message.isError ? "text-red-300" : "text-zinc-100"}`}><MessageText text={message.text} /></Text>
                    )}
                </View>
                {showCopy && !!message.text && (
                    <Reveal duration={180} y={4} style={{ position: "absolute", top: 6, [isUser ? "left" : "right"]: -8 }}>
                        <NeoButton label="Copy message" size={28} onPress={handleCopy}>
                            {copied ? <Check size={14} color="#fff" /> : <Copy size={14} color="#d4d4d8" />}
                        </NeoButton>
                    </Reveal>
                )}
            </Pressable>
        </Reveal>
    );
}

function LoadingOverlay() {
    const wave = useSharedValue(0), dots = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];
    useEffect(() => {
        wave.value = withRepeat(withSequence(withTiming(1, { duration: 275 }), withTiming(-1, { duration: 550 }), withTiming(0, { duration: 275 })), -1);
        dots.forEach((d, i) => { d.value = withDelay(i * 150, withRepeat(withSequence(withTiming(1, { duration: 440, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 660, easing: Easing.inOut(Easing.quad) })), -1)); });
    }, []); // eslint-disable-line
    const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value * 14}deg` }] }));
    const dotStyles = dots.map((d) => useAnimatedStyle(() => ({ opacity: 0.35 + d.value * 0.65, transform: [{ translateY: -4 * d.value }] }))); // eslint-disable-line react-hooks/rules-of-hooks
    return (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, zIndex: 30 }]}>
            <Reveal duration={220} y={4} scale={0.98}>
                <Glass intensity={60} style={{ borderRadius: 16, paddingHorizontal: 20, paddingVertical: 14, flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <Animated.Text style={[{ fontSize: 18 }, hand]}>🤚</Animated.Text>
                    <Text className="text-zinc-100 text-[15px] font-medium">Ruko zara sabar karo</Text>
                    <View className="flex-row items-center gap-1 ml-0.5">
                        {dotStyles.map((s, i) => <Animated.View key={i} style={[{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#a1a1aa" }, s]} />)}
                    </View>
                </Glass>
            </Reveal>
        </View>
    );
}

/* =====================================================================
   Screen
   ===================================================================== */
export default function AskIgris({ onSend }: { onSend?: (p: { text: string; attachment: Attachment | null }) => void } = {}) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [greeting] = useState(getRandomGreeting);
    const [IgrisHistory, setIgrisHistory] = useState<Chat[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const scrollRef = useRef<ScrollView>(null);
    const hasStarted = messages.length > 0;
    const heroSize = Math.min(128, Math.max(80, width * 0.2));

    const getIgrisHistory = useCallback(async (userId: string) => {
        const token = await AsyncStorage.getItem("token");
        if (!token || !userId) return;
        try {
            const res = await fetch(`${IGRIS_API_URL}/history/${userId}`, { headers: await authHeaders() });
            if (res.status === 401) { await AsyncStorage.multiRemove(["token", "user"]); /* TODO: navigate to login */ return; }
            setIgrisHistory(await res.json());
        } catch (e) { console.error("Error fetching Igris history:", e); }
    }, []);

    useEffect(() => {
        (async () => {
            const raw = await AsyncStorage.getItem("user");
            const u = raw ? JSON.parse(raw) : null;
            const id = u?.id || u?._id || "";
            setCurrentUserId(id);
            getIgrisHistory(id);
        })();
    }, [getIgrisHistory]);

    const openIgrisChat = async (chat: Chat) => {
        if (!chat?._id) return;
        try {
            const res = await fetch(`${IGRIS_API_URL}/history/${currentUserId}/${chat._id}`, { headers: await authHeaders() });
            const data = await res.json();
            const history: any[] = data?.chatHistory || [];
            const loaded: Message[] = history.flatMap((e) => (e.role && e.content
                ? [{ id: uid(), role: e.role, text: e.content } as Message]
                : ([e.question && { id: uid(), role: "user", text: e.question }, e.answer && { id: uid(), role: "assistant", text: e.answer }].filter(Boolean) as Message[])));
            setActiveConversationId(chat._id);
            setMessages(loaded);
            setSidebarOpen(false);
        } catch (e) { console.error("Error opening Igris chat:", e); }
    };

    useEffect(() => { if (hasStarted) setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50); }, [messages, isLoading, hasStarted]);

    const pickImage = async () => {
        setMenuOpen(false);
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
        const a = r.assets?.[0];
        if (!r.canceled && a) setAttachment({ name: a.fileName ?? `image-${Date.now()}.jpg`, size: a.fileSize ?? 0, kind: "image", type: a.mimeType ?? "image/jpeg", preview: a.uri, uri: a.uri });
    };
    const pickPdf = async () => {
        setMenuOpen(false);
        const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
        const a = r.assets?.[0];
        if (!r.canceled && a) setAttachment({ name: a.name, size: a.size ?? 0, kind: "pdf", type: a.mimeType ?? "application/pdf", preview: null, uri: a.uri });
    };
    const removeAttachment = useCallback(() => setAttachment(null), []);
    const canSend = text.trim().length > 0 || !!attachment;

    const handleSend = useCallback(async () => {
        const question = text.trim();
        if ((!question && !attachment) || isLoading) return;
        const outgoing = attachment;
        const isImage = attachment?.kind === "image";
        setMessages((prev) => [...prev, { id: uid(), role: "user", text: question, attachment: outgoing }]);
        setText(""); setAttachment(null); setMenuOpen(false); setIsLoading(true);
        onSend?.({ text: question, attachment: outgoing });
        try {
            let data: any;
            if (isImage && outgoing) {
                const body = new FormData();
                body.append("question", question);
                body.append("title", question.slice(0, 60) || "New Conversation");
                body.append("file", { uri: outgoing.uri, name: outgoing.name, type: outgoing.type } as any);
                body.append("systemprompt", question || "Describe the image.");
                if (activeConversationId) body.append("conversationId", activeConversationId);
                const res = await fetch(`${IGRIS_API_URL}/describe_image`, { method: "POST", headers: await authHeaders(), body });
                if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                data = await res.json();
            } else {
                const res = await fetch(`${IGRIS_API_URL}/askPrompt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
                    body: JSON.stringify({ question, title: question.slice(0, 60) || "New Conversation", conversationId: activeConversationId, source: null }),
                });
                if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
                data = await res.json();
            }
            if (data?.conversation?._id) setActiveConversationId(data.conversation._id);
            const replyText = data?.answer ?? data?.prompt ?? data?.text ?? "Hmm, no reply came back.";
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
        } catch (err) {
            console.error("send failed:", err);
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: "Couldn't reach the server. Please try again.", isError: true }]);
        } finally { setIsLoading(false); }
    }, [text, attachment, onSend, isLoading, activeConversationId]);

    const composer = (
        <Composer text={text} setText={setText} attachment={attachment} onRemoveAttachment={removeAttachment} onSend={handleSend}
            canSend={canSend} isLoading={isLoading} menuOpen={menuOpen} setMenuOpen={setMenuOpen as any} onPickImage={pickImage} onPickPdf={pickPdf} />
    );

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: "#000" }}>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <View className="flex-1 bg-black overflow-hidden" style={{ paddingTop: insets.top }}>
                {/* ambient glass glow */}
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center" }]}>
                    <View style={{ position: "absolute", top: -120, width: 420, height: 420, borderRadius: 210, backgroundColor: W(0.035) }} />
                </View>

                {/* sidebar toggle — top-right */}
                <View style={{ position: "absolute", top: insets.top + 12, right: 12, zIndex: 40 }}>
                    <NeoButton label="Toggle sidebar" size={36} onPress={() => setSidebarOpen((o) => !o)}><Menu size={18} color="#a1a1aa" /></NeoButton>
                </View>

                {/* top bar */}
                <Reveal delay={0} duration={600} y={14} style={{ zIndex: 10 }}>
                    <View className="flex-row items-center h-14 px-4 pr-14 border-b border-white/[0.06]">
                        <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-zinc-300/70" />
                            <Text className="text-sm font-semibold tracking-tight text-zinc-200">Ask Igris</Text>
                        </View>
                        <Text numberOfLines={1} className="flex-1 text-center text-sm font-medium text-zinc-500 px-3">Title</Text>
                    </View>
                </Reveal>

                {/* message list */}
                {hasStarted && (
                    <ScrollView ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ width: "100%", maxWidth: 672, alignSelf: "center", paddingHorizontal: 16, paddingTop: 24, paddingBottom: 16, gap: 16 }}>
                        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                    </ScrollView>
                )}

                {/* composer area — slides from centre to bottom (FLIP equivalent via layout animation) */}
                {menuOpen && <Pressable onPress={() => setMenuOpen(false)} style={[StyleSheet.absoluteFill, { zIndex: 5 }]} />}
                <Animated.View layout={LinearTransition.duration(480).easing(EASE_OUT)}
                    style={[{ width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, zIndex: 10 }, hasStarted ? null : { flex: 1 }]}>
                    <Animated.View layout={LinearTransition.duration(480).easing(EASE_OUT)}
                        style={{ width: "94%", maxWidth: 544, gap: 16, paddingTop: 8, paddingBottom: hasStarted ? Math.max(16, insets.bottom) : 8 }}>
                        {!hasStarted && (
                            <Reveal delay={120} duration={600} y={14} style={{ alignItems: "center", gap: 20, marginBottom: 4 }}>
                                <Animated.View exiting={FadeOut.duration(200)} style={{ alignItems: "center", gap: 20 }}>
                                    <IgrisMark size={heroSize} />
                                    <Text className="text-center text-zinc-100 font-medium tracking-tight px-2" style={{ fontSize: Math.min(30, Math.max(20, width * 0.034 + 8)) }}>{greeting}</Text>
                                </Animated.View>
                            </Reveal>
                        )}
                        <Reveal delay={240} duration={600} y={14}>{composer}</Reveal>
                    </Animated.View>
                </Animated.View>

                {isLoading && <LoadingOverlay />}

                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} chats={IgrisHistory} onSelectChat={openIgrisChat}
                    newConversation={() => { setActiveConversationId(null); setMessages([]); setSidebarOpen(false); }} />
            </View>
        </KeyboardAvoidingView>
    );
}