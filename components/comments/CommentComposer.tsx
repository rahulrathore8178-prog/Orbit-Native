import {
    AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { ArrowUp, Image as ImageIcon, Mic, Smile, Sticker, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator, Animated, Easing, Keyboard, Platform, Pressable, Text, TextInput, View,
} from 'react-native';
import { RecordingBar, VoiceNotePreview } from '../posts/PostMedia';
import { COLORS } from '../ui/neo';
import { FadeIn } from './CommentUI';
import { Attachment, Comment, Draft, MAX_COMMENT, MAX_VOICE_SECONDS } from '../services/comments/commentsApi';
import GiphyPanel from './GiphyPanel';
import { EmojiPanel, removeLastChar } from './panels';
import { prepareImage } from '@/lib/comments/prepareMedia';

const PANEL_H = 300;
const ICON = '#d4d8e1';
// Speech-quality voice notes: mono, ~32kbps AAC (about 240KB per minute).
const VOICE_PRESET = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 32000 };

type PanelKind = 'none' | 'emoji' | 'giphy';

type Props = {
    replyingTo: Comment | null;
    onCancelReply: () => void;
    /** Fire and forget: the sheet shows the comment instantly and uploads in the background. */
    onSend: (draft: Draft) => void;
    keyboardVisible: boolean;
    bottomInset: number;
};

const ToolButton = ({ Icon, label, onPress, active, disabled }: {
    Icon: any; label: string; onPress: () => void; active?: boolean; disabled?: boolean;
}) => (
    <Pressable
        onPress={onPress}
        disabled={disabled}
        hitSlop={4}
        accessibilityRole="button"
        accessibilityLabel={label}
        className={`h-9 w-9 items-center justify-center rounded-full active:opacity-60 ${active ? 'bg-white/10' : ''} ${disabled ? 'opacity-40' : ''}`}
    >
        <Icon size={20} strokeWidth={2.2} color={active ? COLORS.accent : ICON} />
    </Pressable>
);

export default function CommentComposer({ replyingTo, onCancelReply, onSend, keyboardVisible, bottomInset }: Props) {
    const inputRef = useRef<TextInput>(null);
    const [text, setText] = useState('');
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [panel, setPanel] = useState<PanelKind>('none');
    const [panelMounted, setPanelMounted] = useState(false);
    const [preparing, setPreparing] = useState(false);
    const [focused, setFocused] = useState(false);
    const [error, setError] = useState('');

    const panelAnim = useRef(new Animated.Value(0)).current;
    const lastPanel = useRef<'emoji' | 'giphy'>('emoji');
    if (panel !== 'none') lastPanel.current = panel;

    const recorder = useAudioRecorder(VOICE_PRESET);
    const recState = useAudioRecorderState(recorder, 250);
    const isRecording = recState.isRecording;
    const stoppingRef = useRef(false);

    const canSend = (text.trim().length > 0 || !!attachment) && !isRecording && !preparing;

    /* send button springs when it switches between mic and send */
    const pop = useRef(new Animated.Value(1)).current;
    useEffect(() => {
        pop.setValue(0.82);
        Animated.spring(pop, { toValue: 1, useNativeDriver: true, bounciness: 14, speed: 18 }).start();
    }, [canSend, pop]);

    /* panel height animation; content stays mounted until it has closed */
    useEffect(() => {
        if (panel !== 'none') setPanelMounted(true);
        Animated.timing(panelAnim, {
            toValue: panel === 'none' ? 0 : 1,
            duration: 240,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: false,
        }).start(({ finished }) => {
            if (finished && panel === 'none') setPanelMounted(false);
        });
    }, [panel, panelAnim]);
    const panelHeight = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, PANEL_H] });

    const openPanel = (p: 'emoji' | 'giphy') => {
        if (panel === p) {
            setPanel('none');
            inputRef.current?.focus();
            return;
        }
        Keyboard.dismiss();
        setPanel(p);
    };

    useEffect(() => {
        if (replyingTo) inputRef.current?.focus();
    }, [replyingTo?._id]);

    /* voice */
    const startRecording = async () => {
        setError('');
        try {
            const perm = await AudioModule.requestRecordingPermissionsAsync();
            if (!perm.granted) return setError('Microphone permission denied');
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            stoppingRef.current = false;
            Keyboard.dismiss();
            setPanel('none');
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => { });
            recorder.record();
        } catch {
            setError('Could not access microphone');
        }
    };

    const stopRecording = async () => {
        if (stoppingRef.current) return;
        stoppingRef.current = true;
        const seconds = Math.max(1, Math.round(recState.durationMillis / 1000));
        try {
            await recorder.stop();
            await new Promise((r) => setTimeout(r, 250)); // let the file finish writing
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            if (recorder.uri) setAttachment({ kind: 'voice', uri: recorder.uri, duration: seconds });
        } catch {
            setError('Could not save the recording');
        }
    };

    useEffect(() => {
        if (isRecording && recState.durationMillis >= MAX_VOICE_SECONDS * 1000) stopRecording();
    }, [isRecording, recState.durationMillis]);

    /* image */
    const pickImage = async () => {
        setError('');
        const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, exif: false });
        if (res.canceled || !res.assets[0]) return;
        setPreparing(true);
        try {
            setAttachment(await prepareImage(res.assets[0]));
            setPanel('none');
        } catch {
            setError('Could not use that image');
        } finally {
            setPreparing(false);
        }
    };

    const send = () => {
        if (!canSend) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => { });
        onSend({ content: text.trim(), attachment });
        setText('');
        setAttachment(null);
        setError('');
        setPanel('none');
    };

    const bottomPad = keyboardVisible || panel !== 'none' ? 10 : bottomInset + 10;
    const thumbUri = attachment && attachment.kind !== 'voice' ? (attachment.kind === 'image' ? attachment.uri : attachment.url) : null;

    return (
        <View className="border-t border-white/10">
            <View className="gap-2.5 px-3.5 pt-2.5" style={{ paddingBottom: bottomPad }}>
                {replyingTo ? (
                    <FadeIn key={replyingTo._id} y={6}>
                        <View className="flex-row items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
                            <Text className="flex-1 text-[12.5px]" style={{ color: COLORS.muted }} numberOfLines={1}>
                                Replying to <Text style={{ color: COLORS.text, fontWeight: '800' }}>@{replyingTo.author.username}</Text>
                            </Text>
                            <Pressable onPress={onCancelReply} hitSlop={10} accessibilityLabel="Cancel reply" className="h-6 w-6 items-center justify-center rounded-full bg-white/10 active:opacity-60">
                                <X size={14} color={ICON} />
                            </Pressable>
                        </View>
                    </FadeIn>
                ) : null}

                {attachment ? (
                    <FadeIn key={thumbUri ?? 'voice'} y={8}>
                        {attachment.kind === 'voice' ? (
                            <VoiceNotePreview uri={attachment.uri} duration={attachment.duration} onRemove={() => setAttachment(null)} />
                        ) : (
                            <View className="h-24 w-24">
                                <Image
                                    source={{ uri: thumbUri! }}
                                    className="h-24 w-24 rounded-2xl bg-white/5"
                                    contentFit={attachment.kind === 'sticker' ? 'contain' : 'cover'}
                                />
                                <Pressable
                                    onPress={() => setAttachment(null)}
                                    hitSlop={8}
                                    accessibilityLabel="Remove attachment"
                                    className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full border border-white/25 bg-[#14161e] active:opacity-60"
                                >
                                    <X size={13} color="#fff" />
                                </Pressable>
                            </View>
                        )}
                    </FadeIn>
                ) : null}

                {error ? <Text className="text-xs text-red-400">{error}</Text> : null}

                {isRecording ? (
                    <RecordingBar seconds={Math.floor(recState.durationMillis / 1000)} max={MAX_VOICE_SECONDS} onStop={stopRecording} />
                ) : (
                    <View className="flex-row items-end gap-2">
                        <View
                            className="flex-1 flex-row items-end rounded-3xl border bg-white/5 px-1.5 py-1"
                            style={{ borderColor: focused ? COLORS.accent : 'rgba(255,255,255,0.12)' }}
                        >
                            <ToolButton Icon={Smile} label="Emoji" active={panel === 'emoji'} onPress={() => openPanel('emoji')} />
                            <TextInput
                                ref={inputRef}
                                value={text}
                                onChangeText={setText}
                                onFocus={() => { setFocused(true); setPanel('none'); }}
                                onBlur={() => setFocused(false)}
                                placeholder={replyingTo ? `Reply to @${replyingTo.author.username}` : 'Add a comment…'}
                                placeholderTextColor={COLORS.muted}
                                selectionColor={COLORS.accent}
                                maxLength={MAX_COMMENT}
                                multiline
                                className="min-h-[38px] max-h-28 flex-1 px-1 text-[15px] leading-[21px]"
                                style={{
                                    color: COLORS.text,
                                    paddingTop: Platform.OS === 'ios' ? 9 : 7,
                                    paddingBottom: Platform.OS === 'ios' ? 9 : 7,
                                    textAlignVertical: 'center',
                                }}
                            />
                            <ToolButton Icon={Sticker} label="GIFs and stickers" active={panel === 'giphy'} onPress={() => openPanel('giphy')} />
                            <ToolButton Icon={ImageIcon} label="Add photo" disabled={preparing} onPress={pickImage} />
                        </View>

                        <Animated.View style={{ transform: [{ scale: pop }] }}>
                            <Pressable
                                onPress={canSend ? send : startRecording}
                                disabled={preparing}
                                accessibilityRole="button"
                                accessibilityLabel={canSend ? 'Send comment' : 'Record voice note'}
                                className="h-11 w-11 items-center justify-center rounded-full border active:opacity-80"
                                style={{
                                    backgroundColor: canSend ? COLORS.accent : 'rgba(255,255,255,0.1)',
                                    borderColor: canSend ? COLORS.accent : 'rgba(255,255,255,0.14)',
                                }}
                            >
                                {preparing ? (
                                    <ActivityIndicator color="#fff" />
                                ) : canSend ? (
                                    <ArrowUp size={22} color="#fff" strokeWidth={2.6} />
                                ) : (
                                    <Mic size={20} strokeWidth={2.2} color={ICON} />
                                )}
                            </Pressable>
                        </Animated.View>
                    </View>
                )}

                {text.length > MAX_COMMENT - 80 ? (
                    <Text className="text-right text-[11px]" style={{ color: text.length >= MAX_COMMENT ? '#f87171' : COLORS.muted }}>
                        {text.length}/{MAX_COMMENT}
                    </Text>
                ) : null}
            </View>

            <Animated.View style={{ height: panelHeight, overflow: 'hidden' }}>
                <View style={{ height: PANEL_H }}>
                    {panelMounted &&
                        (lastPanel.current === 'emoji' ? (
                            <EmojiPanel
                                onPick={(e) => setText((t) => (t + e).slice(0, MAX_COMMENT))}
                                onBackspace={() => setText((t) => removeLastChar(t))}
                            />
                        ) : (
                            <GiphyPanel
                                onPick={(g) => {
                                    setAttachment({ kind: g.kind, url: g.url, width: g.width, height: g.height });
                                    setPanel('none');
                                }}
                            />
                        ))}
                </View>
            </Animated.View>
        </View>
    );
}