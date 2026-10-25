import { ArrowUp, FileText, Image as ImageIcon, Paperclip, X } from "lucide-react-native";
import React, { Dispatch, ReactNode, SetStateAction, useEffect, useState } from "react";
import { Image, NativeSyntheticEvent, Pressable, Text, TextInput, TextInputContentSizeChangeEventData, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { Glass, NeoButton, Reveal } from "./primitives";
import { Attachment, formatSize, MAX_TEXTAREA_HEIGHT, W } from "./utils";

function MenuRow({ icon, label, onPress }: { icon: ReactNode; label: string; onPress: () => void }) {
    const p = useSharedValue(0);
    const a = useAnimatedStyle(() => ({ backgroundColor: `rgba(255,255,255,${0.07 * p.value})` }));
    return (
        <Pressable
            onPress={onPress}
            onPressIn={() => { p.value = withTiming(1, { duration: 80 }); }}
            onPressOut={() => { p.value = withTiming(0, { duration: 200 }); }}>
            <Animated.View className="flex-row items-center gap-2.5 px-3 py-2.5" style={a}>
                {icon}<Text className="text-sm text-zinc-200">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

interface ComposerProps {
    text: string;
    setText: (t: string) => void;
    attachment: Attachment | null;
    onRemoveAttachment: () => void;
    onSend: () => void;
    canSend: boolean;
    isLoading: boolean;
    menuOpen: boolean;
    setMenuOpen: Dispatch<SetStateAction<boolean>>;
    onPickImage: () => void;
    onPickPdf: () => void;
}

export default function Composer(props: ComposerProps) {
    const { text, setText, attachment, onRemoveAttachment, onSend, canSend, isLoading, menuOpen, setMenuOpen, onPickImage, onPickPdf } = props;
    const [height, setHeight] = useState(24);
    const [focused, setFocused] = useState(false);
    const f = useSharedValue(0);

    useEffect(() => { f.value = withTiming(focused ? 1 : 0, { duration: 200 }); }, [focused]); // eslint-disable-line react-hooks/exhaustive-deps

    const border = useAnimatedStyle(() => ({
        borderColor: interpolateColor(f.value, [0, 1], [W(0.1), W(0.24)]),
        shadowOpacity: 0.35 + f.value * 0.25,
    }));

    const onSize = (e: NativeSyntheticEvent<TextInputContentSizeChangeEventData>) =>
        setHeight(Math.min(e.nativeEvent.contentSize.height, MAX_TEXTAREA_HEIGHT));

    const sendActive = canSend && !isLoading;

    return (
        <Animated.View
            className="rounded-[26px]"
            style={[{ shadowColor: "#000", shadowRadius: 24, shadowOffset: { width: 0, height: 16 }, elevation: 12 }, border]}>
            <Glass intensity={45} className="rounded-[26px] px-4 pt-4 pb-3" style={{ borderColor: "transparent" }}>
                {attachment && (
                    <Reveal duration={250} y={6} className="self-start mb-3 max-w-full">
                        <View className="flex-row items-center gap-2 rounded-2xl pl-2 pr-3 py-2 border border-white/[0.08] bg-white/[0.04]">
                            <View className="w-9 h-9 rounded-xl overflow-hidden bg-white/10 items-center justify-center">
                                {attachment.kind === "image" && attachment.preview
                                    ? <Image source={{ uri: attachment.preview }} className="w-full h-full" />
                                    : <FileText size={16} color="#d4d4d8" />}
                            </View>
                            <View className="shrink">
                                <Text numberOfLines={1} className="text-sm text-zinc-200 max-w-[200px]">{attachment.name}</Text>
                                <Text className="text-xs text-zinc-500">{formatSize(attachment.size)}</Text>
                            </View>
                            <NeoButton label="Remove attachment" size={24} onPress={onRemoveAttachment}><X size={14} color="#a1a1aa" /></NeoButton>
                        </View>
                    </Reveal>
                )}

                {/* height is measured at runtime, so it must stay in style */}
                <TextInput
                    value={text} onChangeText={setText} multiline editable={!isLoading}
                    placeholder="Ask something..." placeholderTextColor="#71717a"
                    onContentSizeChange={onSize} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                    textAlignVertical="top" scrollEnabled={height >= MAX_TEXTAREA_HEIGHT}
                    className={`text-zinc-100 text-base leading-6 p-0 ${isLoading ? "opacity-60" : "opacity-100"}`}
                    style={{ height: Math.max(24, height) }} />

                <View className="flex-row items-center justify-between mt-2 z-10">
                    <View>
                        <NeoButton label="Attach a file" onPress={() => setMenuOpen((o) => !o)} disabled={isLoading}>
                            <Paperclip size={18} color="#a1a1aa" />
                        </NeoButton>
                        {menuOpen && (
                            <Reveal duration={160} y={6} className="absolute bottom-[46px] left-0 w-44 z-20">
                                <Glass intensity={60} className="rounded-2xl py-1" style={{ backgroundColor: "rgba(26,26,30,0.85)" }}>
                                    <MenuRow icon={<ImageIcon size={16} color="#a1a1aa" />} label="Image" onPress={onPickImage} />
                                    <MenuRow icon={<FileText size={16} color="#a1a1aa" />} label="PDF" onPress={onPickPdf} />
                                </Glass>
                            </Reveal>
                        )}
                    </View>

                    <NeoButton label="Send message" active={sendActive} disabled={!sendActive} onPress={onSend}>
                        <ArrowUp size={18} strokeWidth={2.5} color={sendActive ? "#18181b" : "#52525b"} />
                    </NeoButton>
                </View>
            </Glass>
        </Animated.View>
    );
}
