import * as Clipboard from "expo-clipboard";
import { Check, Copy, FileText } from "lucide-react-native";
import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Animated, {
    Easing,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import { Glass, NeoButton, Reveal } from "./primitives";
import { formatSize, Message } from "./utils";

/* ---------- **bold** inline parsing ---------- */
function MessageText({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\*\*[^*\n]+?\*\*)/g).map((part, i) =>
                part.startsWith("**") && part.endsWith("**") && part.length > 4
                    ? <Text key={i} className="font-bold">{part.slice(2, -2)}</Text>
                    : <Text key={i}>{part}</Text>)}
        </>
    );
}

/* ---------- bubble ---------- */
export function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === "user";
    const [copied, setCopied] = useState(false);
    const [showCopy, setShowCopy] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout>>();

    useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

    const handleCopy = async () => {
        if (!message.text) return;
        await Clipboard.setStringAsync(message.text);
        setCopied(true);
        timer.current = setTimeout(() => setCopied(false), 1200);
    };

    const bubble = isUser
        ? "bg-zinc-100 rounded-br-md"
        : message.isError
            ? "bg-red-950/40 border border-red-900/40 rounded-bl-md"
            : "bg-white/[0.05] border border-white/[0.08] rounded-bl-md";

    const textColor = isUser ? "text-zinc-900" : message.isError ? "text-red-300" : "text-zinc-100";
    const att = message.attachment;

    return (
        <Reveal
            duration={isUser ? 350 : 450} y={isUser ? 10 : 16} scale={isUser ? 0.98 : 0.96}
            className={`flex-row ${isUser ? "justify-end" : "justify-start"}`}>
            <Pressable onPress={() => setShowCopy((s) => !s)} className="max-w-[88%]">
                <View className={`rounded-2xl px-4 py-2.5 ${bubble}`}>
                    {att && (
                        <View className={`mb-2 flex-row self-start items-center gap-2 rounded-xl pl-1.5 pr-3 py-1.5 ${isUser ? "bg-black/10" : "bg-white/5"}`}>
                            <View className="w-7 h-7 rounded-lg overflow-hidden bg-black/10 items-center justify-center">
                                {att.kind === "image" && att.preview
                                    ? <Image source={{ uri: att.preview }} className="w-full h-full" />
                                    : <FileText size={14} color={isUser ? "#18181b" : "#f4f4f5"} />}
                            </View>
                            <View className="shrink">
                                <Text numberOfLines={1} className={`text-xs max-w-[180px] ${isUser ? "text-zinc-900" : "text-zinc-100"}`}>{att.name}</Text>
                                <Text className={`text-[11px] ${isUser ? "text-zinc-600" : "text-zinc-500"}`}>{formatSize(att.size)}</Text>
                            </View>
                        </View>
                    )}
                    {!!message.text && (
                        <Text selectable className={`text-[15px] leading-6 ${textColor}`}><MessageText text={message.text} /></Text>
                    )}
                </View>

                {showCopy && !!message.text && (
                    <Reveal duration={180} y={4} className={`absolute top-1.5 ${isUser ? "-left-2" : "-right-2"}`}>
                        <NeoButton label="Copy message" size={28} onPress={handleCopy}>
                            {copied ? <Check size={14} color="#fff" /> : <Copy size={14} color="#d4d4d8" />}
                        </NeoButton>
                    </Reveal>
                )}
            </Pressable>
        </Reveal>
    );
}

/* ---------- loading overlay ---------- */
function BounceDot({ delay }: { delay: number }) {
    const d: SharedValue<number> = useSharedValue(0);
    useEffect(() => {
        d.value = withDelay(delay, withRepeat(withSequence(
            withTiming(1, { duration: 440, easing: Easing.inOut(Easing.quad) }),
            withTiming(0, { duration: 660, easing: Easing.inOut(Easing.quad) }),
        ), -1));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const s = useAnimatedStyle(() => ({ opacity: 0.35 + d.value * 0.65, transform: [{ translateY: -4 * d.value }] }));
    return <Animated.View className="w-1.5 h-1.5 rounded-full bg-zinc-400" style={s} />;
}

export function LoadingOverlay() {
    const wave = useSharedValue(0);
    useEffect(() => {
        wave.value = withRepeat(withSequence(
            withTiming(1, { duration: 275 }), withTiming(-1, { duration: 550 }), withTiming(0, { duration: 275 }),
        ), -1);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const hand = useAnimatedStyle(() => ({ transform: [{ rotate: `${wave.value * 14}deg` }] }));

    return (
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center px-4 z-30">
            <Reveal duration={220} y={4} scale={0.98}>
                <Glass intensity={60} className="rounded-2xl px-5 py-3.5 flex-row items-center gap-2.5">
                    <Animated.Text className="text-lg" style={hand}>🤚</Animated.Text>
                    <Text className="text-zinc-100 text-[15px] font-medium">Ruko zara sabar karo</Text>
                    <View className="flex-row items-center gap-1 ml-0.5">
                        {[0, 150, 300].map((d) => <BounceDot key={d} delay={d} />)}
                    </View>
                </Glass>
            </Reveal>
        </View>
    );
}
