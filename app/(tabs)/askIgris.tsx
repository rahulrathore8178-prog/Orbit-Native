import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import { GlassPanel } from "@/components/ui/neo";
import { authStorage } from "@/lib/auth/authStorage";
import axios from "axios";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { ArrowDown, Brain, Check, Menu, Square } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator, Keyboard, KeyboardAvoidingView, NativeScrollEvent, NativeSyntheticEvent, Pressable,
    ScrollView, StatusBar, Text, TextInput, useWindowDimensions, View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
    FadeIn, FadeOut, interpolate, LinearTransition, runOnJS, SharedValue, useAnimatedReaction, useAnimatedStyle,
    useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Composer from "../../components/igris/Composer";
import IgrisMark from "../../components/igris/IgrisMark";
import { MessageBubble } from "../../components/igris/Messages";
import { NeoButton, Reveal, Glass } from "../../components/igris/primitives";
import Sidebar from "../../components/igris/Sidebar";
import { KEYBOARD_GAP, TAB_BAR_GAP, TAB_BAR_HEIGHT } from "../../components/search/constants";
import {
    apiError, Attachment, Chat, EASE_OUT, getRandomGreeting, Message, nodeApi, pythonApi, SUGGESTIONS, uid,
} from "../../components/igris/utils";

/* ---------------------------------- constants --------------------------------- */
const HEADER_H = 56;
const DOCK_MARK = 50; // docked mark size in the header
const TIMING = { duration: 340, easing: EASE_OUT };
const PHASES = ["Thinking…", "Digging in…", "Putting it together…"];

type TabKey = "ask" | "remember";
const TABS: { key: TabKey; label: string }[] = [
    { key: "ask", label: "Ask Igris" },
    { key: "remember", label: "Remember Igris" },
];

/** Turn a saved conversation document into chat bubbles (new `chatHistory` format + the old question/response one). */
function toMessages(doc: any): Message[] {
    const history: any[] = Array.isArray(doc?.chatHistory) ? doc.chatHistory : [];
    const out = history.flatMap((e): Message[] =>
        e.role && e.content
            ? [{ id: uid(), role: e.role, text: e.content }]
            : ([
                e.question && { id: uid(), role: "user", text: e.question },
                e.answer && { id: uid(), role: "assistant", text: e.answer },
            ].filter(Boolean) as Message[]));
    if (out.length === 0 && doc?.question) {
        out.push({ id: uid(), role: "user", text: doc.question });
        if (doc.response) out.push({ id: uid(), role: "assistant", text: doc.response });
    }
    return out;
}

const dismissKeyboard = () => Keyboard.dismiss();

/* ----------------------------------- tabs ------------------------------------- */
/** Same pill as ProfileTabs. The pill follows `progress` live, so it tracks your finger while swiping. */
function IgrisTabs({ active, onChange, progress }: { active: TabKey; onChange: (t: TabKey) => void; progress: SharedValue<number> }) {
    const [width, setWidth] = useState(0);
    const tabWidth = width / TABS.length;
    const slide = useAnimatedStyle(() => ({ transform: [{ translateX: progress.value * tabWidth }] }));

    return (
        <GlassPanel radius={22} style={{ padding: 4 }}>
            <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && (
                    <Animated.View style={[{ position: "absolute", top: 0, bottom: 0, left: 0, width: tabWidth }, slide]}>
                        <View className="h-full w-full rounded-[18px] bg-white/10" />
                    </Animated.View>
                )}
                {TABS.map(({ key, label }) => (
                    <Pressable key={key} onPress={() => onChange(key)} accessibilityRole="tab" accessibilityState={{ selected: key === active }}
                        className="flex-1 flex-row items-center justify-center gap-1 py-2.5">
                        <Text numberOfLines={1} className={`text-sm ${key === active ? "font-medium text-white" : "text-neutral-500"}`}>{label}</Text>
                    </Pressable>
                ))}
            </View>
        </GlassPanel>
    );
}

/** Crossfade page: fades and drifts slightly backward (scale) — no vertical movement. */
function Page({ index, progress, active, children }: { index: number; progress: SharedValue<number>; active: boolean; children: React.ReactNode }) {
    const style = useAnimatedStyle(() => {
        const d = Math.min(1, Math.abs(progress.value - index));
        return { opacity: interpolate(d, [0, 1], [1, 0]), transform: [{ scale: interpolate(d, [0, 1], [1, 0.94]) }] };
    });
    return (
        <Animated.View pointerEvents={active ? "auto" : "none"} className="absolute inset-0" style={style}>
            {children}
        </Animated.View>
    );
}

/* ------------------------------- loading pieces -------------------------------- */
function Dot({ i }: { i: number }) {
    const v = useSharedValue(0);
    useEffect(() => {
        v.value = withDelay(i * 160, withRepeat(withSequence(withTiming(1, { duration: 480 }), withTiming(0, { duration: 480 })), -1));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const a = useAnimatedStyle(() => ({ opacity: 0.3 + v.value * 0.7, transform: [{ translateY: -4 * v.value }, { scale: 0.8 + v.value * 0.4 }] }));
    return <Animated.View style={a} className="w-2 h-2 rounded-full bg-zinc-200" />;
}
const Dots = () => <View className="flex-row items-center gap-1.5">{[0, 1, 2].map((i) => <Dot key={i} i={i} />)}</View>;

/** Inline "Igris is working" pill with cycling status text and a Stop button. */
function ThinkingRow({ onStop }: { onStop: () => void }) {
    const [i, setI] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setI((n) => (n + 1) % PHASES.length), 1800);
        return () => clearInterval(t);
    }, []);
    return (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(150)}
            className="self-start flex-row items-center gap-3 rounded-full border border-white/[0.08] bg-white/[0.04] pl-4 pr-1.5 py-1.5">
            <Dots />
            <Animated.Text key={i} entering={FadeIn.duration(300)} className="text-sm text-zinc-400">{PHASES[i]}</Animated.Text>
            <Pressable onPress={onStop} accessibilityLabel="Stop generating" hitSlop={8} className="h-7 w-7 items-center justify-center rounded-full bg-white/10">
                <Square size={11} color="#e4e4e7" fill="#e4e4e7" />
            </Pressable>
        </Animated.View>
    );
}

/* ------------------------------- remember tab --------------------------------- */
type Memory = { id: string; text: string; status: "saving" | "saved" | "failed" };
const STARTERS = ["My name is ", "I prefer short answers", "I'm working on ", "Always reply in "];

function RememberTab({ getUserId, bottomPad }: { getUserId: () => Promise<string>; bottomPad: number }) {
    const [note, setNote] = useState("");
    const [items, setItems] = useState<Memory[]>([]);
    const [focused, setFocused] = useState(false);

    const save = useCallback(async (raw: string, retryId?: string) => {
        const text = raw.trim();
        if (!text) return;
        const id = retryId ?? uid();
        const mark = (status: Memory["status"]) => setItems((p) => p.map((m) => (m.id === id ? { ...m, status } : m)));
        if (retryId) mark("saving");
        else { setItems((p) => [{ id, text, status: "saving" }, ...p]); setNote(""); }
        try {
            const userId = await getUserId();
            await pythonApi.post("/remember", { userId, text });
            mark("saved");
        } catch (e) {
            console.error("remember failed:", e);
            mark("failed");
        }
    }, [getUserId]);

    const ready = note.trim().length > 0;

    return (
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}
            contentContainerClassName="w-full max-w-2xl self-center px-4 pt-6 gap-5" contentContainerStyle={{ paddingBottom: bottomPad }}>
            <Reveal delay={0} duration={500} y={10} className="items-center gap-3">
                <View className="h-16 w-16 rounded-full items-center justify-center border border-white/[0.12] bg-white/[0.05]"
                    style={{ shadowColor: "#fff", shadowOpacity: 0.12, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } }}>
                    <Brain size={26} color="#e4e4e7" />
                </View>
                <Text className="text-xl font-medium tracking-tight text-zinc-100 text-center">What should Igris remember?</Text>
                <Text className="text-sm text-zinc-500 text-center px-6">Facts, preferences, anything. Igris will keep it in mind from now on.</Text>
            </Reveal>

            <View className="rounded-3xl border bg-white/[0.04] p-4" style={{ borderColor: focused ? "rgba(255,255,255,0.24)" : "rgba(255,255,255,0.1)" }}>
                <TextInput
                    value={note} onChangeText={setNote} multiline placeholder="e.g. I'm vegetarian and I live in Delhi"
                    placeholderTextColor="#71717a" onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    textAlignVertical="top" maxLength={500} className="text-zinc-100 text-base leading-6 p-0 min-h-[96px]" />
                <View className="flex-row items-center justify-between mt-3">
                    <Text className="text-xs text-zinc-600">{note.length}/500</Text>
                    <Pressable disabled={!ready} onPress={() => save(note)}
                        className={`flex-row items-center gap-2 rounded-full px-5 py-2.5 ${ready ? "bg-white" : "bg-white/10"}`}>
                        <Brain size={15} color={ready ? "#18181b" : "#52525b"} />
                        <Text className={`text-sm font-semibold ${ready ? "text-zinc-900" : "text-zinc-600"}`}>Remember</Text>
                    </Pressable>
                </View>
            </View>

            <View className="flex-row flex-wrap gap-2">
                {STARTERS.map((s) => (
                    <Pressable key={s} onPress={() => setNote((n) => (n ? n : s))} className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2">
                        <Text className="text-[13px] text-zinc-400">{s.trim()}…</Text>
                    </Pressable>
                ))}
            </View>

            {items.length > 0 && (
                <View className="gap-2">
                    <Text className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500 px-1">Saved this session</Text>
                    {items.map((m) => (
                        <Animated.View key={m.id} entering={FadeIn.duration(250)} layout={LinearTransition.duration(300)}>
                            <Pressable disabled={m.status !== "failed"} onPress={() => save(m.text, m.id)}
                                className="flex-row items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3">
                                <Text className="flex-1 text-sm text-zinc-300">{m.text}</Text>
                                {m.status === "saving" && <ActivityIndicator size="small" color="#a1a1aa" />}
                                {m.status === "saved" && <Check size={16} color="#a1a1aa" />}
                                {m.status === "failed" && <Text className="text-xs text-red-400">Tap to retry</Text>}
                            </Pressable>
                        </Animated.View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
}

/* ------------------------------------ screen ---------------------------------- */
export default function AskIgris({ onSend }: { onSend?: (p: { text: string; attachment: Attachment | null }) => void } = {}) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const keyboardOpen = useKeyboardVisible();

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpening, setIsOpening] = useState(false);
    const [greeting] = useState(getRandomGreeting);
    const [igrisHistory, setIgrisHistory] = useState<Chat[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeTitle, setActiveTitle] = useState("");
    const [currentUserId, setCurrentUserId] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [tab, setTab] = useState<TabKey>("ask");
    const [showJump, setShowJump] = useState(false);

    const scrollRef = useRef<ScrollView>(null);
    const atBottomRef = useRef(true);
    const abortRef = useRef<AbortController | null>(null);

    const hasStarted = messages.length > 0;
    const heroSize = Math.min(190, Math.max(120, width * 0.42));
    const canSend = text.trim().length > 0 || !!attachment;
    const SB_W = Math.min(width * 0.86, 380);
    const dockCenter = insets.top + HEADER_H / 2 + 8; // docked mark sits a little below the header line
    const dockPadding = keyboardOpen ? KEYBOARD_GAP : insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP;

    /* ---------- shared values ---------- */
    const pager = useSharedValue(0);    // 0 = Ask, 1 = Remember
    const sb = useSharedValue(0);       // sidebar progress
    const started = useSharedValue(0);  // 0 = hero mark, 1 = docked in header
    const heroTop = useSharedValue(0);  // y of hero block inside the page
    const pagerTop = useSharedValue(0); // y of the page area inside the screen
    const startPager = useSharedValue(0);
    const startSb = useSharedValue(0);

    useEffect(() => { started.value = withTiming(hasStarted ? 1 : 0, { duration: 620, easing: EASE_OUT }); }, [hasStarted]); // eslint-disable-line react-hooks/exhaustive-deps

    useAnimatedReaction(() => sb.value > 0.5, (cur, prev) => { if (cur !== prev) runOnJS(setSidebarOpen)(cur); });

    const setSidebar = useCallback((open: boolean) => {
        if (open) runOnJS(dismissKeyboard)();
        sb.value = withTiming(open ? 1 : 0, TIMING);
    }, [sb]);

    const goTab = useCallback((k: TabKey) => {
        setTab(k);
        setMenuOpen(false);
        runOnJS(dismissKeyboard)();
        pager.value = withTiming(k === "ask" ? 0 : 1, TIMING);
    }, [pager]);

    /* ---------- one pan: left edge → sidebar, sideways → switch tabs ---------- */
    const pan = Gesture.Pan()
        .activeOffsetX([-14, 14])
        .failOffsetY([-18, 18])
        .onBegin(() => { startPager.value = pager.value; startSb.value = sb.value; })
        .onUpdate((e) => {
            const tx = e.translationX;
            const clamp = (v: number) => Math.min(1, Math.max(0, v));
            if (startSb.value > 0.01) { sb.value = clamp(startSb.value + tx / (SB_W * 0.8)); return; }
            if (startPager.value < 0.5) {
                if (tx > 0) { sb.value = clamp(tx / (SB_W * 0.8)); pager.value = 0; }
                else { sb.value = 0; pager.value = clamp(-tx / (width * 0.55)); }
            } else {
                pager.value = clamp(1 - tx / (width * 0.55));
            }
        })
        .onEnd((e) => {
            const vx = e.velocityX;
            if (startSb.value > 0.01 || sb.value > 0.01) {
                const open = vx > 700 ? true : vx < -700 ? false : sb.value > 0.5;
                if (open) runOnJS(dismissKeyboard)();
                sb.value = withTiming(open ? 1 : 0, TIMING);
                return;
            }
            const next = vx < -500 ? 1 : vx > 500 ? 0 : pager.value > 0.5 ? 1 : 0;
            pager.value = withTiming(next, TIMING);
            runOnJS(setTab)(next ? "remember" : "ask");
        });

    /* ---------- animated styles ---------- */
    const mainStyle = useAnimatedStyle(() => ({
        borderRadius: sb.value * 28,
        transform: [{ translateX: sb.value * SB_W * 0.28 }, { scale: 1 - sb.value * 0.06 }],
    }));
    const backdropStyle = useAnimatedStyle(() => ({ opacity: sb.value * 0.55 }));
    const markStyle = useAnimatedStyle(() => {
        const hero = pagerTop.value + heroTop.value + heroSize / 2;
        const cy = interpolate(started.value, [0, 1], [hero, dockCenter]);
        const s = interpolate(started.value, [0, 1], [1, DOCK_MARK / heroSize]);
        const measured = heroTop.value > 0 || started.value > 0 ? 1 : 0;
        return {
            opacity: (1 - (1 - started.value) * pager.value) * measured,
            transform: [{ translateY: cy - heroSize / 2 }, { scale: s }],
        };
    });
    const discStyle = useAnimatedStyle(() => ({ opacity: started.value }));

    /* ---------- user + history ---------- */
    const resolveUserId = useCallback(async () => {
        if (currentUserId) return currentUserId;
        const u = await authStorage.getUser<any>();
        const id = u?.id || u?._id || "";
        if (id) setCurrentUserId(id);
        return id as string;
    }, [currentUserId]);

    const getIgrisHistory = useCallback(async (userId: string) => {
        if (!userId) return;
        try {
            const { data } = await nodeApi.get(`/history/${userId}`);
            const raw = Array.isArray(data) ? data : data?.history ?? data?.conversations ?? [];
            const list: Chat[] = Array.isArray(raw) ? raw.filter((c: any) => c?._id) : [];
            // keep chats we added locally until the server list actually contains them
            setIgrisHistory((prev) => {
                const ids = new Set(list.map((c) => c._id));
                return [...prev.filter((c) => c.local && !ids.has(c._id)), ...list];
            });
        } catch (e) { console.error("Error fetching Igris history:", e); }
    }, []);

    useEffect(() => { (async () => { getIgrisHistory(await resolveUserId()); })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { if (sidebarOpen && currentUserId) getIgrisHistory(currentUserId); }, [sidebarOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const openIgrisChat = async (chat: Chat) => {
        if (!chat?._id || isLoading || isOpening) return;
        setSidebar(false);
        goTab("ask");
        setIsOpening(true);
        try {
            const userId = await resolveUserId();
            const { data } = await pythonApi.get(`/history/${userId}/${chat._id}`);
            atBottomRef.current = true;
            setActiveConversationId(chat._id);
            setActiveTitle(chat.title);
            setMessages(toMessages(data));
        } catch (e) {
            console.error("Error opening Igris chat:", e);
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: "Couldn't load that chat. Please try again.", isError: true }]);
        } finally { setIsOpening(false); }
    };

    const newConversation = useCallback(() => {
        abortRef.current?.abort();
        setActiveConversationId(null);
        setActiveTitle("");
        setMessages([]);
        setText("");
        setAttachment(null);
        setSidebar(false);
        goTab("ask");
    }, [setSidebar, goTab]);

    /* ---------- pickers ---------- */
    const pickImage = async () => {
        setMenuOpen(false);
        const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
        const a = r.assets?.[0];
        if (!r.canceled && a) {
            setAttachment({ name: a.fileName ?? `image-${Date.now()}.jpg`, size: a.fileSize ?? 0, kind: "image", type: a.mimeType ?? "image/jpeg", preview: a.uri, uri: a.uri });
        }
    };
    const pickPdf = async () => {
        setMenuOpen(false);
        const r = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true });
        const a = r.assets?.[0];
        if (!r.canceled && a) {
            setAttachment({ name: a.name, size: a.size ?? 0, kind: "pdf", type: a.mimeType ?? "application/pdf", preview: null, uri: a.uri });
        }
    };
    const removeAttachment = useCallback(() => setAttachment(null), []);

    /* ---------- send ---------- */
    const handleSend = useCallback(async () => {
        const question = text.trim();
        if ((!question && !attachment) || isLoading) return;

        const outgoing = attachment;
        const isImage = outgoing?.kind === "image";
        const title = question.slice(0, 60) || "New Conversation";
        const isNewChat = !activeConversationId;
        const userMsgId = uid();
        const controller = new AbortController();
        abortRef.current = controller;

        atBottomRef.current = true;
        setMessages((prev) => [...prev, { id: userMsgId, role: "user", text: question, attachment: outgoing }]);
        setText(""); setAttachment(null); setMenuOpen(false); setIsLoading(true);
        onSend?.({ text: question, attachment: outgoing });

        try {
            const userId = await resolveUserId();
            let data: any;
            if (isImage && outgoing) {
                const body = new FormData();
                body.append("question", question);
                body.append("title", title);
                body.append("userId", userId);
                body.append("file", { uri: outgoing.uri, name: outgoing.name, type: outgoing.type } as any);
                body.append("systemprompt", question || "Describe the image.");
                if (activeConversationId) body.append("conversationId", activeConversationId);
                ({ data } = await pythonApi.post("/describe_image", body, {
                    headers: { "Content-Type": "multipart/form-data" },
                    transformRequest: (d) => d, // stops axios from touching RN's FormData
                    signal: controller.signal,
                }));
            } else {
                if (!question) throw new Error("Only images can be sent without a message.");
                ({ data } = await pythonApi.post("/askPrompt",
                    { question, title, userId, conversationId: activeConversationId, source: null },
                    { signal: controller.signal }));
            }

            const convId: string | undefined = data?.conversation?._id ?? data?.conversationId;
            const convTitle: string = data?.conversation?.title || title;
            if (convId) {
                setActiveConversationId(convId);
                setActiveTitle((t) => t || convTitle);
                if (isNewChat) {
                    // show it in the drawer immediately, then confirm with the server
                    setIgrisHistory((prev) => [{ _id: convId, title: convTitle, local: true }, ...prev.filter((c) => c._id !== convId)]);
                    setTimeout(() => getIgrisHistory(userId), 1500);
                }
            } else if (__DEV__) {
                console.warn("[Igris] response had no conversation id, so the chat can't be saved/listed:", Object.keys(data ?? {}));
            }

            const replyText = data?.answer ?? data?.prompt ?? data?.text ?? "Hmm, no reply came back.";
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
        } catch (err: any) {
            if (axios.isCancel(err)) {
                // user pressed Stop: undo the bubble and give them their text back
                setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
                setText(question); setAttachment(outgoing);
            } else {
                console.error("send failed:", err);
                const msg = /^Only images/.test(err?.message) ? err.message : apiError(err, "Couldn't reach the server. Please try again.");
                setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: msg, isError: true }]);
            }
        } finally {
            abortRef.current = null;
            setIsLoading(false);
        }
    }, [text, attachment, onSend, isLoading, activeConversationId, getIgrisHistory, resolveUserId]);

    const stopGenerating = useCallback(() => abortRef.current?.abort(), []);

    /* ---------- scrolling ---------- */
    const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
        const near = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
        atBottomRef.current = near;
        setShowJump((s) => (s === !near ? s : !near));
    };

    const composer = (
        <Composer
            text={text} setText={setText} attachment={attachment} onRemoveAttachment={removeAttachment}
            onSend={handleSend} canSend={canSend} isLoading={isLoading}
            menuOpen={menuOpen} setMenuOpen={setMenuOpen} onPickImage={pickImage} onPickPdf={pickPdf} />
    );

    const headerTitle = tab === "ask" ? activeTitle : "Memory";

    return (
        <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#000" }}>
            <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black">
                <StatusBar barStyle="light-content" backgroundColor="#000" />
                <GestureDetector gesture={pan}>
                    <View className="flex-1 bg-black">
                        {/* ---------------- main surface (shifts + scales when the sidebar opens) ---------------- */}
                        <Animated.View className="flex-1 bg-black overflow-hidden" style={[{ paddingTop: insets.top }, mainStyle]}>
                            {/* ambient glow */}
                            <View pointerEvents="none" className="absolute inset-0 items-center">
                                <View className="absolute -top-[120px] w-[420px] h-[420px] rounded-full bg-white/[0.035]" />
                            </View>

                            {/* header: topic left, mark centre (docked), menu right */}
                            {/* header: menu left, mark centre (docked), topic right */}
                            <Reveal delay={0} duration={600} y={14} className="z-20">
                                <View style={{ height: HEADER_H }} className="flex-row items-center justify-between px-4 border-b border-white/[0.06]">
                                    <Pressable
                                        onPress={() => setSidebar(!sidebarOpen)}
                                        hitSlop={12}
                                        accessibilityLabel="Toggle sidebar"
                                        className="h-10 w-10 -ml-2 items-center justify-center active:opacity-50">
                                        <Menu size={22} color="#d4d4d8" />
                                    </Pressable>
                                    <View style={{ maxWidth: width / 2 - DOCK_MARK / 2 - 28 }}>
                                        {!!headerTitle && (
                                            <Animated.Text key={headerTitle} entering={FadeIn.duration(300)} numberOfLines={1} className="text-sm font-medium text-zinc-400 text-right">
                                                {headerTitle}
                                            </Animated.Text>
                                        )}
                                    </View>
                                </View>
                            </Reveal>

                            {/* tabs */}
                            <Reveal delay={80} duration={600} y={14} className="px-4 pt-5 pb-2 z-10">
                                <View className="w-full max-w-[544px] self-center">
                                    <IgrisTabs active={tab} onChange={goTab} progress={pager} />
                                </View>
                            </Reveal>

                            {/* pages */}
                            <View className="flex-1" onLayout={(e) => { pagerTop.value = e.nativeEvent.layout.y; }}>
                                <Page index={0} progress={pager} active={tab === "ask"}>
                                    <View className="flex-1">
                                        <View className="flex-1">
                                            {hasStarted ? (
                                                <Animated.View entering={FadeIn.duration(300)} className="flex-1">
                                                    <ScrollView
                                                        ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
                                                        showsVerticalScrollIndicator={false} scrollEventThrottle={32} onScroll={onScroll}
                                                        onContentSizeChange={() => { if (atBottomRef.current) scrollRef.current?.scrollToEnd({ animated: true }); }}
                                                        contentContainerClassName="w-full max-w-2xl self-center px-4 pt-6 pb-4 gap-4">
                                                        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                                                        {isLoading && <ThinkingRow onStop={stopGenerating} />}
                                                    </ScrollView>
                                                    {showJump && (
                                                        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} className="absolute bottom-3 self-center">
                                                            <NeoButton label="Scroll to latest" size={38} onPress={() => { atBottomRef.current = true; scrollRef.current?.scrollToEnd({ animated: true }); }}>
                                                                <ArrowDown size={17} color="#d4d4d8" />
                                                            </NeoButton>
                                                        </Animated.View>
                                                    )}
                                                </Animated.View>
                                            ) : (
                                                <Animated.View exiting={FadeOut.duration(180)} className="flex-1 items-center justify-center px-4">
                                                    <View
                                                        className="items-center gap-4"
                                                        onLayout={(e) => {
                                                            const y = e.nativeEvent.layout.y;
                                                            heroTop.value = heroTop.value === 0 ? y : withTiming(y, { duration: 260 });
                                                        }}>
                                                        {/* the global mark lives here visually */}
                                                        <View style={{ width: heroSize, height: heroSize }} />
                                                        <Text className="text-center text-zinc-100 font-medium tracking-tight px-2"
                                                            style={{ fontSize: Math.min(30, Math.max(20, width * 0.034 + 8)) }}>
                                                            {greeting}
                                                        </Text>
                                                        <View className="flex-row flex-wrap justify-center gap-2 px-2">
                                                            {SUGGESTIONS.map((s, i) => (
                                                                <Reveal key={s.label} delay={500 + i * 70} duration={450} y={8}>
                                                                    <Pressable onPress={() => setText(s.prompt)} className="rounded-full border border-white/[0.1] bg-white/[0.04] px-3.5 py-2">
                                                                        <Text className="text-[13px] text-zinc-400">{s.label}</Text>
                                                                    </Pressable>
                                                                </Reveal>
                                                            ))}
                                                        </View>
                                                    </View>
                                                </Animated.View>
                                            )}
                                        </View>

                                        {/* tap-outside to close attach menu */}
                                        {menuOpen && <Pressable onPress={() => setMenuOpen(false)} className="absolute inset-0 z-[5]" />}

                                        {/* composer dock — always at the bottom, above the floating tab bar */}
                                        <View className="w-full items-center px-4 z-10" style={{ paddingBottom: dockPadding }}>
                                            <View className="w-full max-w-[544px] pt-2">
                                                <Reveal delay={240} duration={600} y={14}>{composer}</Reveal>
                                            </View>
                                        </View>

                                        {isOpening && (
                                            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} className="absolute inset-0 z-20 items-center justify-center bg-black/55">
                                                <Glass intensity={60} className="rounded-full px-6 py-4"><Dots /></Glass>
                                            </Animated.View>
                                        )}
                                    </View>
                                </Page>

                                <Page index={1} progress={pager} active={tab === "remember"}>
                                    <RememberTab getUserId={resolveUserId} bottomPad={dockPadding + 16} />
                                </Page>
                            </View>

                            {/* the one and only Igris mark: hero in the centre, docks into the header when a chat starts */}
                            <Animated.View pointerEvents="none" className="absolute z-30"
                                style={[{ left: (width - heroSize) / 2, top: 0, width: heroSize, height: heroSize }, markStyle]}>
                                <Animated.View
                                    style={[{
                                        position: "absolute", left: heroSize * 0.04, top: heroSize * 0.04, width: heroSize * 0.92, height: heroSize * 0.92,
                                        borderRadius: heroSize, backgroundColor: "#0b0b0d", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)",
                                        shadowColor: "#000", shadowOpacity: 0.9, shadowRadius: 44, shadowOffset: { width: 0, height: 26 }, elevation: 12,
                                    }, discStyle]} />
                                <IgrisMark size={heroSize} />
                            </Animated.View>
                        </Animated.View>

                        {/* dim + tap-to-close */}
                        <Animated.View pointerEvents={sidebarOpen ? "auto" : "none"} className="absolute inset-0 bg-black z-40" style={backdropStyle}>
                            <Pressable className="flex-1" onPress={() => setSidebar(false)} />
                        </Animated.View>

                        <Sidebar
                            progress={sb} width={SB_W} open={sidebarOpen} chats={igrisHistory} activeId={activeConversationId}
                            topInset={insets.top} bottomInset={insets.bottom}
                            onSelect={openIgrisChat} onNew={newConversation} onClose={() => setSidebar(false)} />
                    </View>
                </GestureDetector>
            </KeyboardAvoidingView>
        </GestureHandlerRootView>
    );
}