import { authStorage } from "@/lib/auth/authStorage";
import { useKeyboardVisible } from "@/hooks/useKeyboardVisible";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Menu } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Pressable, ScrollView, StatusBar, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeOut, LinearTransition } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Composer from "../../components/igris/Composer";
import IgrisMark from "../../components/igris/IgrisMark";
import { LoadingOverlay, MessageBubble } from "../../components/igris/Messages";
import { NeoButton, Reveal } from "../../components/igris/primitives";
import Sidebar from "../../components/igris/Sidebar";
import { KEYBOARD_GAP, TAB_BAR_GAP, TAB_BAR_HEIGHT } from "../../components/search/constants";
import { Attachment, authHeaders, Chat, EASE_OUT, getRandomGreeting, IGRIS_NODE_URL, Message, PYTHON_API_URL, uid } from "../../components/igris/utils";

/** Read a response as text first: a wrong URL / proxy error returns HTML, which would crash res.json(). */
async function readJson(res: Response) {
    const raw = await res.text();
    let data: any = null;
    try { data = JSON.parse(raw); } catch { /* not JSON */ }
    if (!res.ok) throw new Error(data?.error ?? data?.message ?? `Request failed (${res.status})`);
    return data;
}

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

export default function AskIgris({ onSend }: { onSend?: (p: { text: string; attachment: Attachment | null }) => void } = {}) {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const keyboardOpen = useKeyboardVisible();

    const [messages, setMessages] = useState<Message[]>([]);
    const [text, setText] = useState("");
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [greeting] = useState(getRandomGreeting);
    const [igrisHistory, setIgrisHistory] = useState<Chat[]>([]);
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
    const [activeTitle, setActiveTitle] = useState("");
    const [currentUserId, setCurrentUserId] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const scrollRef = useRef<ScrollView>(null);

    const hasStarted = messages.length > 0;
    const heroSize = Math.min(128, Math.max(80, width * 0.2));
    const canSend = text.trim().length > 0 || !!attachment;

    // Same trick as the search bar: rest above the floating tab bar; when the keyboard opens the bar is hidden, so sit just above the keyboard.
    const dockPadding = keyboardOpen ? KEYBOARD_GAP : insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP;

    /** Resolve the logged-in user id (state may not be loaded yet when the user acts fast). */
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
            const res = await fetch(`${IGRIS_NODE_URL}/history/${userId}`, { headers: await authHeaders() });
            const data = await readJson(res);
            const list = Array.isArray(data) ? data : data?.history ?? data?.conversations ?? [];
            setIgrisHistory(Array.isArray(list) ? list.filter((c: any) => c?._id) : []);
        } catch (e) { console.error("Error fetching Igris history:", e); }
    }, []);

    useEffect(() => {
        (async () => {
            const id = await resolveUserId();
            getIgrisHistory(id);
        })();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // refresh the list every time the drawer is opened, so it is never stale
    useEffect(() => {
        if (sidebarOpen && currentUserId) getIgrisHistory(currentUserId);
    }, [sidebarOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const openIgrisChat = async (chat: Chat) => {
        if (!chat?._id || isLoading) return;
        setSidebarOpen(false);
        setIsLoading(true);
        try {
            const userId = await resolveUserId();
            const res = await fetch(`${PYTHON_API_URL}/history/${userId}/${chat._id}`, { headers: await authHeaders() });
            const data = await readJson(res);
            setActiveConversationId(chat._id);
            setActiveTitle(chat.title);
            setMessages(toMessages(data));
        } catch (e) {
            console.error("Error opening Igris chat:", e);
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: "Couldn't load that chat. Please try again.", isError: true }]);
        } finally { setIsLoading(false); }
    };

    const newConversation = useCallback(() => {
        setActiveConversationId(null);
        setActiveTitle("");
        setMessages([]);
        setText("");
        setAttachment(null);
        setSidebarOpen(false);
    }, []);

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

        setMessages((prev) => [...prev, { id: uid(), role: "user", text: question, attachment: outgoing }]);
        setText(""); setAttachment(null); setMenuOpen(false); setIsLoading(true);
        onSend?.({ text: question, attachment: outgoing });

        try {
            let data: any;
            if (isImage && outgoing) {
                const body = new FormData();
                body.append("question", question);
                body.append("title", title);
                body.append("file", { uri: outgoing.uri, name: outgoing.name, type: outgoing.type } as any);
                body.append("systemprompt", question || "Describe the image.");
                if (activeConversationId) body.append("conversationId", activeConversationId);
                // no Content-Type here: fetch adds the multipart boundary itself
                const res = await fetch(`${PYTHON_API_URL}/describe_image`, { method: "POST", headers: await authHeaders(), body });
                data = await readJson(res);
            } else {
                if (!question) throw new Error("Only images can be sent without a message.");
                const res = await fetch(`${PYTHON_API_URL}/askPrompt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", ...(await authHeaders()) },
                    body: JSON.stringify({ question, title, conversationId: activeConversationId, source: null }),
                });
                data = await readJson(res);
            }

            if (data?.conversation?._id) {
                setActiveConversationId(data.conversation._id);
                setActiveTitle((t) => t || data.conversation.title || title);
            }
            if (isNewChat) getIgrisHistory(await resolveUserId()); // new chat → show it in the drawer

            const replyText = data?.answer ?? data?.prompt ?? data?.text ?? "Hmm, no reply came back.";
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: replyText }]);
        } catch (err: any) {
            console.error("send failed:", err);
            const msg = /^Only images/.test(err?.message) ? err.message : "Couldn't reach the server. Please try again.";
            setMessages((prev) => [...prev, { id: uid(), role: "assistant", text: msg, isError: true }]);
        } finally {
            setIsLoading(false);
        }
    }, [text, attachment, onSend, isLoading, activeConversationId, getIgrisHistory, resolveUserId]);

    const composer = (
        <Composer
            text={text} setText={setText} attachment={attachment} onRemoveAttachment={removeAttachment}
            onSend={handleSend} canSend={canSend} isLoading={isLoading}
            menuOpen={menuOpen} setMenuOpen={setMenuOpen} onPickImage={pickImage} onPickPdf={pickPdf} />
    );

    return (
        // "padding" on both platforms (same as the search dock) so the composer rides above the keyboard
        <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black">
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <View className="flex-1 bg-black overflow-hidden" style={{ paddingTop: insets.top }}>
                {/* ambient glass glow */}
                <View pointerEvents="none" className="absolute inset-0 items-center">
                    <View className="absolute -top-[120px] w-[420px] h-[420px] rounded-full bg-white/[0.035]" />
                </View>

                {/* sidebar toggle — top-right (top depends on safe-area inset) */}
                <View className="absolute right-3 z-40" style={{ top: insets.top + 10 }}>
                    <NeoButton label="Toggle sidebar" size={36} onPress={() => setSidebarOpen((o) => !o)}>
                        <Menu size={18} color="#a1a1aa" />
                    </NeoButton>
                </View>

                {/* top bar */}
                <Reveal delay={0} duration={600} y={14} className="z-10">
                    <View className="flex-row items-center h-14 px-4 pr-14 border-b border-white/[0.06]">
                        <View className="flex-row items-center gap-2">
                            <View className="w-1.5 h-1.5 rounded-full bg-zinc-300/70" />
                            <Text className="text-sm font-semibold tracking-tight text-zinc-200">Ask Igris</Text>
                        </View>
                        <Text numberOfLines={1} className="flex-1 text-center text-sm font-medium text-zinc-500 px-3">
                            {activeTitle || "New chat"}
                        </Text>
                    </View>
                </Reveal>

                {/* message list */}
                {hasStarted && (
                    <ScrollView
                        ref={scrollRef} className="flex-1" keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"
                        showsVerticalScrollIndicator={false}
                        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
                        contentContainerClassName="w-full max-w-2xl self-center px-4 pt-6 pb-4 gap-4">
                        {messages.map((m) => <MessageBubble key={m.id} message={m} />)}
                    </ScrollView>
                )}

                {/* tap-outside to close attach menu */}
                {menuOpen && <Pressable onPress={() => setMenuOpen(false)} className="absolute inset-0 z-[5]" />}

                {/* composer dock — centred before the first message, pinned above the floating tab bar after */}
                <Animated.View
                    layout={LinearTransition.duration(480).easing(EASE_OUT)}
                    className={`w-full items-center justify-center px-4 z-10 ${hasStarted ? "" : "flex-1"}`}>
                    <Animated.View
                        layout={LinearTransition.duration(480).easing(EASE_OUT)}
                        className="w-full max-w-[544px] gap-4 pt-2"
                        style={{ paddingBottom: dockPadding }}>
                        {!hasStarted && (
                            <Reveal delay={120} duration={600} y={14} className="items-center gap-5 mb-1">
                                <Animated.View exiting={FadeOut.duration(200)} className="items-center gap-5">
                                    <IgrisMark size={heroSize} />
                                    <Text className="text-center text-zinc-100 font-medium tracking-tight px-2"
                                        style={{ fontSize: Math.min(30, Math.max(20, width * 0.034 + 8)) }}>
                                        {greeting}
                                    </Text>
                                </Animated.View>
                            </Reveal>
                        )}
                        <Reveal delay={240} duration={600} y={14}>{composer}</Reveal>
                    </Animated.View>
                </Animated.View>

                {isLoading && <LoadingOverlay />}

                <Sidebar
                    open={sidebarOpen} onClose={() => setSidebarOpen(false)}
                    chats={igrisHistory} onSelectChat={openIgrisChat} newConversation={newConversation} />
            </View>
        </KeyboardAvoidingView>
    );
}