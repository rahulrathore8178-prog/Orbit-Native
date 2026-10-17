import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { Image as ImageIcon, Mic, Send, Smile, Square, Trash2, Video as VideoIcon, X } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, Platform, Pressable, Text, TextInput, View, Animated, Easing } from 'react-native';
import { IconButton, RecordingBar, VideoPreview, VoiceNotePreview } from '../posts/PostMedia';
import {
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    resolveMime,
} from '../posts/postConstant';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';
import { FadeIn } from './CommentUI';
import { Attachment, Comment, Draft } from './commentsApi';
import { EmojiPanel, GifPanel, removeLastChar } from './panels';

const PANEL_H = 270;
const MAX_COMMENT = 1000;
const MAX_VOICE_SECONDS = 60;

type PanelKind = 'none' | 'emoji' | 'gif';

type Props = {
    replyingTo: Comment | null;
    onCancelReply: () => void;
    /** resolve with an error message, or null on success */
    onSubmit: (draft: Draft) => Promise<string | null>;
    keyboardVisible: boolean;
    bottomInset: number;
};

export default function CommentComposer({ replyingTo, onCancelReply, onSubmit, keyboardVisible, bottomInset }: Props) {
    const inputRef = useRef<TextInput>(null);
    const [text, setText] = useState('');
    const [attachment, setAttachment] = useState<Attachment | null>(null);
    const [panel, setPanel] = useState<PanelKind>('none');
    const [panelMounted, setPanelMounted] = useState(false);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');

    const panelAnim = useRef(new Animated.Value(0)).current;
    const lastPanel = useRef<'emoji' | 'gif'>('emoji');
    if (panel !== 'none') lastPanel.current = panel;

    // voice recording
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recState = useAudioRecorderState(recorder, 250);
    const isRecording = recState.isRecording;
    const stoppingRef = useRef(false);

    const canSend = !sending && !isRecording && (text.trim().length > 0 || !!attachment);

    /* ----- emoji / gif panel: height animates, content stays mounted until it has closed ----- */
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

    const openPanel = (p: 'emoji' | 'gif') => {
        if (panel === p) {
            setPanel('none');
            inputRef.current?.focus();
            return;
        }
        Keyboard.dismiss();
        setPanel(p);
    };

    /* ----- reply target ----- */
    useEffect(() => {
        if (!replyingTo) return;
        setText((t) => (t.trim() ? t : `@${replyingTo.author.username} `));
        inputRef.current?.focus();
    }, [replyingTo?._id]);

    /* ----- recording ----- */
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
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
            if (recorder.uri) setAttachment({ kind: 'voice', uri: recorder.uri, duration: seconds });
        } catch {
            setError('Could not save the recording');
        }
    };

    useEffect(() => {
        if (isRecording && recState.durationMillis >= MAX_VOICE_SECONDS * 1000) stopRecording();
    }, [isRecording, recState.durationMillis]);

    /* ----- media ----- */
    const acceptAsset = (asset: ImagePicker.ImagePickerAsset) => {
        const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
        const mime = resolveMime(asset.uri, kind, asset.mimeType);
        const allowed = kind === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
        if (!allowed.includes(mime)) return setError(`Unsupported type: ${mime}`);

        const max = kind === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (asset.fileSize && asset.fileSize > max) {
            return setError(kind === 'video' ? 'Video must be under 50MB' : 'Image must be under 8MB');
        }

        setAttachment({ kind, uri: asset.uri, mime, name: asset.fileName ?? `upload.${mime.split('/')[1] ?? 'jpg'}` });
        setError('');
        setPanel('none');
    };

    const pickMedia = async (kind: 'image' | 'video') => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: [kind === 'image' ? 'images' : 'videos'],
            quality: 0.9,
        });
        if (!res.canceled && res.assets[0]) acceptAsset(res.assets[0]);
    };

    /* ----- submit ----- */
    const submit = async () => {
        if (!canSend) return;
        setSending(true);
        setError('');
        const err = await onSubmit({ content: text.trim(), attachment });
        setSending(false);
        if (err) {
            setError(err);
        } else {
            setText('');
            setAttachment(null);
            setPanel('none');
        }
    };

    /* ----- render ----- */
    const bottomPad = keyboardVisible || panel !== 'none' ? 10 : bottomInset + 10;
    const tools = isRecording || sending;

    return (
        <View style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' }}>
            <View style={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: bottomPad, gap: 10 }}>
                {replyingTo && (
                    <FadeIn key={replyingTo._id} y={6}>
                        <GlassPanel
                            radius={14}
                            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 }}
                        >
                            <Text style={{ flex: 1, color: COLORS.muted, fontSize: 12 }} numberOfLines={1}>
                                Replying to <Text style={{ color: COLORS.text, fontWeight: '700' }}>@{replyingTo.author.username}</Text>
                            </Text>
                            <Pressable onPress={onCancelReply} hitSlop={10} accessibilityLabel="Cancel reply">
                                <X size={16} color={COLORS.muted} />
                            </Pressable>
                        </GlassPanel>
                    </FadeIn>
                )}

                {attachment && (
                    <FadeIn key={attachment.kind === 'gif' ? attachment.url : attachment.uri} y={8}>
                        {attachment.kind === 'voice' ? (
                            <VoiceNotePreview
                                uri={attachment.uri}
                                duration={attachment.duration}
                                onRemove={() => setAttachment(null)}
                            />
                        ) : (
                            <GlassPanel radius={20} style={{ height: 150 }}>
                                {attachment.kind === 'video' ? (
                                    <VideoPreview uri={attachment.uri} />
                                ) : (
                                    <Image
                                        source={{ uri: attachment.kind === 'gif' ? attachment.url : attachment.uri }}
                                        style={{ width: '100%', height: '100%' }}
                                        resizeMode="contain"
                                    />
                                )}
                                <View style={{ position: 'absolute', top: 8, right: 8 }}>
                                    <IconButton Icon={Trash2} label="Remove attachment" size={34} onPress={() => setAttachment(null)} />
                                </View>
                            </GlassPanel>
                        )}
                    </FadeIn>
                )}

                {!!error && <Text style={{ color: '#f87171', fontSize: 12 }}>{error}</Text>}

                {isRecording ? (
                    <RecordingBar
                        seconds={Math.floor(recState.durationMillis / 1000)}
                        max={MAX_VOICE_SECONDS}
                        onStop={stopRecording}
                    />
                ) : (
                    <GlassPanel radius={22} style={{ paddingHorizontal: 14, paddingVertical: Platform.OS === 'ios' ? 11 : 4 }}>
                        <TextInput
                            ref={inputRef}
                            value={text}
                            onChangeText={setText}
                            onFocus={() => setPanel('none')}
                            placeholder={replyingTo ? `Reply to @${replyingTo.author.username}` : 'Add a comment...'}
                            placeholderTextColor={COLORS.muted}
                            selectionColor="#ffffff"
                            maxLength={MAX_COMMENT}
                            multiline
                            style={{
                                color: COLORS.text,
                                fontSize: 15,
                                lineHeight: 21,
                                minHeight: 24,
                                maxHeight: 110,
                                padding: 0,
                                textAlignVertical: 'center',
                            }}
                        />
                    </GlassPanel>
                )}

                {/* tools + send */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <IconButton Icon={ImageIcon} label="Add photo" size={42} disabled={tools} onPress={() => pickMedia('image')} />
                    <IconButton Icon={VideoIcon} label="Add video" size={42} disabled={tools} onPress={() => pickMedia('video')} />
                    <IconButton
                        Icon={isRecording ? Square : Mic}
                        label={isRecording ? 'Stop recording' : 'Record voice note'}
                        size={42}
                        disabled={sending}
                        color={isRecording ? '#f87171' : COLORS.text}
                        active={isRecording}
                        onPress={isRecording ? stopRecording : startRecording}
                    />
                    <IconButton
                        Icon={Smile}
                        label="Emoji"
                        size={42}
                        disabled={tools}
                        active={panel === 'emoji'}
                        color={panel === 'emoji' ? COLORS.accent : COLORS.text}
                        onPress={() => openPanel('emoji')}
                    />
                    <Pressable
                        onPress={() => openPanel('gif')}
                        disabled={tools}
                        accessibilityRole="button"
                        accessibilityLabel="GIF"
                        style={{ opacity: tools ? 0.45 : 1 }}
                    >
                        {({ pressed }) => (
                            <NeoView radius={15} pressed={pressed || panel === 'gif'} style={{ width: 42, height: 42 }}>
                                <Text style={{ color: panel === 'gif' ? COLORS.accent : COLORS.text, fontSize: 12, fontWeight: '800' }}>
                                    GIF
                                </Text>
                            </NeoView>
                        )}
                    </Pressable>

                    <View style={{ flex: 1 }} />

                    <Pressable onPress={submit} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Send comment">
                        {({ pressed }) => (
                            <NeoView
                                accent={canSend}
                                pressed={pressed && canSend}
                                radius={16}
                                style={{ width: 52, height: 44, opacity: canSend ? 1 : 0.5 }}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#fff" />
                                ) : (
                                    <Send size={19} color={canSend ? '#fff' : COLORS.muted} />
                                )}
                            </NeoView>
                        )}
                    </Pressable>
                </View>
            </View>

            {/* emoji / gif panel */}
            <Animated.View style={{ height: panelHeight, overflow: 'hidden' }}>
                <View style={{ height: PANEL_H }}>
                    {panelMounted &&
                        (lastPanel.current === 'emoji' ? (
                            <EmojiPanel
                                onPick={(e) => setText((t) => (t + e).slice(0, MAX_COMMENT))}
                                onBackspace={() => setText((t) => removeLastChar(t))}
                            />
                        ) : (
                            <GifPanel
                                onPick={(g) => {
                                    setAttachment({ kind: 'gif', url: g.url });
                                    setPanel('none');
                                }}
                            />
                        ))}
                </View>
            </Animated.View>
        </View>
    );
}