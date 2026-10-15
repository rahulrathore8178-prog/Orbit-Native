import { API_URL, getAuthHeaders } from '@/app/utils';
import axios from 'axios';
import {
    AudioModule,
    RecordingPresets,
    setAudioModeAsync,
    useAudioRecorder,
    useAudioRecorderState,
} from 'expo-audio';
import { BlurView } from 'expo-blur';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Check, Image as ImageIcon, Mic, Plus, RefreshCw, Square, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Easing,
    Image,
    KeyboardAvoidingView,
    LayoutChangeEvent,
    Modal,
    PanResponder,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { MyOrbital, fetchMyOrbitals, resolveUrl } from '../orbital/orbitalData';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';
import {
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    ANALYSIS_PROMPT,
    MAX_CAPTION,
    MAX_IMAGE_SIZE,
    MAX_RECORDING_SECONDS,
    MAX_VIDEO_SIZE,
    POST_TYPES,
    PostTarget,
    PostType,
    resolveMime,
} from './postConstant';
import { IconButton, RecordingBar, VideoPreview, VoiceNotePreview } from './PostMedia';

/* ---------- types ---------- */
type PickedMedia = { uri: string; kind: 'image' | 'video'; mime: string; name: string };
type Voice = { uri: string; duration: number };
type CurrentUser = { username?: string; profilePic?: string };

type Props = {
    /** called once per created post; `target` tells you whether it went to the feed or an orbital */
    onPostCreated?: (post: any, target: PostTarget) => void;
    user?: CurrentUser;
    /** distance from the bottom of the parent view, raise it if the screen sits behind a bar */
    bottomOffset?: number;
};

/* ---------- helpers ---------- */
const AUDIO_EXT = Platform.OS === 'web' ? 'webm' : 'm4a';
const AUDIO_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

const errMsg = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ?? fallback;

const notify = (title: string, message: string) =>
    Platform.OS === 'web' ? window.alert(`${title}\n\n${message}`) : Alert.alert(title, message);

/** React Native appends {uri,name,type}; the web needs a real Blob. */
async function appendFile(form: FormData, field: string, file: { uri: string; name: string; type: string }) {
    if (Platform.OS === 'web') {
        const blob = await (await fetch(file.uri)).blob();
        form.append(field, blob, file.name);
    } else {
        form.append(field, file as any);
    }
}

/** Fire-and-forget: sends an image to your VLM describe endpoint. Never blocks or fails the post. */
async function analyzeImage(img: PickedMedia, postId?: string) {
    try {
        const f = new FormData();
        await appendFile(f, 'file', { uri: img.uri, name: img.name, type: img.mime });
        f.append('type', img.mime);
        f.append('prompt', ANALYSIS_PROMPT);
        if (postId) f.append('post_id', String(postId));
        await axios.post(`${API_URL}/postdata`, f, {
            withCredentials: true,
            headers: { ...(await getAuthHeaders()) },
        });
    } catch (e) {
        console.warn('Image analysis failed', axios.isAxiosError(e) ? e.response?.data : e);
    }
}

/* ---------- post type tabs (glass track + sliding neo pill) ---------- */
const PAD = 6;

function TabLabel({ label, tabIndex, anim }: { label: string; tabIndex: number; anim: Animated.Value }) {
    const range = POST_TYPES.map((_, i) => i);
    const active = anim.interpolate({ inputRange: range, outputRange: range.map((k) => (k === tabIndex ? 1 : 0)) });
    const inactive = anim.interpolate({ inputRange: range, outputRange: range.map((k) => (k === tabIndex ? 0 : 1)) });

    return (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.Text style={{ color: COLORS.muted, fontSize: 14, fontWeight: '700', opacity: inactive }}>
                {label}
            </Animated.Text>
            <Animated.Text
                style={{ position: 'absolute', color: COLORS.text, fontSize: 14, fontWeight: '800', opacity: active }}
            >
                {label}
            </Animated.Text>
        </View>
    );
}

function TypeTabs({ value, onChange }: { value: PostType; onChange: (v: PostType) => void }) {
    const index = POST_TYPES.findIndex((t) => t.value === value);
    const anim = useRef(new Animated.Value(index)).current;
    const [w, setW] = useState(0);

    useEffect(() => {
        Animated.timing(anim, {
            toValue: index,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [index, anim]);

    const tabW = w > 0 ? (w - PAD * 2) / POST_TYPES.length : 0;
    const translateX = anim.interpolate({
        inputRange: POST_TYPES.map((_, i) => i),
        outputRange: POST_TYPES.map((_, i) => i * tabW),
    });

    return (
        <GlassPanel radius={20} style={{ height: 52 }}>
            <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
                {tabW > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: PAD,
                            top: PAD,
                            bottom: PAD,
                            width: tabW,
                            transform: [{ translateX }],
                        }}
                    >
                        <NeoView radius={14} style={{ flex: 1 }} />
                    </Animated.View>
                )}
                <View style={{ flex: 1, flexDirection: 'row', padding: PAD }}>
                    {POST_TYPES.map((t, i) => (
                        <Pressable
                            key={t.value}
                            style={{ flex: 1 }}
                            onPress={() => onChange(t.value)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: value === t.value }}
                        >
                            <TabLabel label={t.label} tabIndex={i} anim={anim} />
                        </Pressable>
                    ))}
                </View>
            </View>
        </GlassPanel>
    );
}

/* ---------- orbital picker ---------- */
function OrbitalPicker({
    orbitals,
    loading,
    error,
    selectedId,
    onSelect,
    onRetry,
}: {
    orbitals: MyOrbital[] | null;
    loading: boolean;
    error: string;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRetry: () => void;
}) {
    return (
        <GlassPanel radius={22} style={{ paddingVertical: 14 }}>
            <Text
                style={{
                    color: COLORS.muted,
                    fontSize: 12,
                    fontWeight: '700',
                    letterSpacing: 0.8,
                    textTransform: 'uppercase',
                    paddingHorizontal: 14,
                    marginBottom: 10,
                }}
            >
                Post to orbital
            </Text>

            {loading ? (
                <ActivityIndicator color={COLORS.accent} style={{ paddingVertical: 10 }} />
            ) : error ? (
                <View style={{ paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Text style={{ color: '#c98a8a', fontSize: 13, flex: 1 }}>{error}</Text>
                    <Pressable onPress={onRetry}>
                        {({ pressed }) => (
                            <NeoView radius={12} pressed={pressed} contentStyle={{ paddingHorizontal: 14, paddingVertical: 8 }}>
                                <Text style={{ color: COLORS.text, fontSize: 12, fontWeight: '700' }}>Retry</Text>
                            </NeoView>
                        )}
                    </Pressable>
                </View>
            ) : !orbitals?.length ? (
                <Text style={{ color: COLORS.muted, fontSize: 13, paddingHorizontal: 14 }}>
                    You don&apos;t have any orbitals to post to yet.
                </Text>
            ) : (
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 4 }}
                >
                    {orbitals.map((o) => {
                        const selected = o._id === selectedId;
                        const img = resolveUrl(o.image);
                        return (
                            <Pressable key={o._id} onPress={() => onSelect(o._id)} accessibilityRole="button">
                                {({ pressed }) => (
                                    <NeoView
                                        radius={16}
                                        pressed={pressed || selected}
                                        contentStyle={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            gap: 8,
                                            paddingHorizontal: 12,
                                            paddingVertical: 8,
                                        }}
                                    >
                                        {img ? (
                                            <Image source={{ uri: img }} style={{ width: 22, height: 22, borderRadius: 11 }} />
                                        ) : (
                                            <View
                                                style={{
                                                    width: 22,
                                                    height: 22,
                                                    borderRadius: 11,
                                                    backgroundColor: 'rgba(255,255,255,0.1)',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Text style={{ color: COLORS.text, fontSize: 11, fontWeight: '700' }}>
                                                    {(o.name?.trim()?.[0] ?? '?').toUpperCase()}
                                                </Text>
                                            </View>
                                        )}
                                        <Text
                                            numberOfLines={1}
                                            style={{
                                                color: selected ? COLORS.accent : COLORS.text,
                                                fontSize: 13,
                                                fontWeight: '700',
                                                maxWidth: 140,
                                            }}
                                        >
                                            {o.name}
                                        </Text>
                                        {selected && <Check size={14} color={COLORS.accent} />}
                                    </NeoView>
                                )}
                            </Pressable>
                        );
                    })}
                </ScrollView>
            )}
        </GlassPanel>
    );
}

/* ---------- main ---------- */
export default function CreatePost({ onPostCreated, user, bottomOffset = 65 }: Props) {
    const { height } = useWindowDimensions();

    // sheet visibility: mounted first, then animated (same pattern as the side drawer)
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const progress = useRef(new Animated.Value(0)).current;

    // draft
    const [postType, setPostType] = useState<PostType>('feed');
    const [caption, setCaption] = useState('');
    const [media, setMedia] = useState<PickedMedia | null>(null);
    const [voice, setVoice] = useState<Voice | null>(null);
    const [selectedOrbitalId, setSelectedOrbitalId] = useState<string | null>(null);

    // orbitals to post to
    const [orbitals, setOrbitals] = useState<MyOrbital[] | null>(null);
    const [orbLoading, setOrbLoading] = useState(false);
    const [orbError, setOrbError] = useState('');

    const [isPosting, setIsPosting] = useState(false);
    const [error, setError] = useState('');

    // voice recording
    const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
    const recState = useAudioRecorderState(recorder, 250);
    const isRecording = recState.isRecording;
    const stoppingRef = useRef(false);

    const hasDraft = caption.trim().length > 0 || !!media || !!voice || isRecording;
    const canPost = !isPosting && !isRecording && (caption.trim().length > 0 || !!media || !!voice);

    /* ----- sheet animation ----- */
    useEffect(() => {
        if (open && mounted) {
            Animated.timing(progress, {
                toValue: 1,
                duration: 320,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        } else if (!open && mounted) {
            Animated.timing(progress, {
                toValue: 0,
                duration: 240,
                easing: Easing.in(Easing.cubic),
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
    }, [open, mounted, progress]);

    const openSheet = () => {
        setMounted(true);
        setOpen(true);
    };

    /* ----- recording ----- */
    const startRecording = async () => {
        if (media) return setError('Remove the attached image/video before recording a voice note');
        setError('');
        try {
            const perm = await AudioModule.requestRecordingPermissionsAsync();
            if (!perm.granted) return setError('Microphone permission denied');
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
            await recorder.prepareToRecordAsync();
            stoppingRef.current = false;
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
            if (recorder.uri) setVoice({ uri: recorder.uri, duration: seconds });
        } catch {
            setError('Could not save the recording');
        }
    };

    // hard stop at the max length
    useEffect(() => {
        if (isRecording && recState.durationMillis >= MAX_RECORDING_SECONDS * 1000) stopRecording();
    }, [isRecording, recState.durationMillis]);

    /* ----- media ----- */
    const acceptAsset = (asset: ImagePicker.ImagePickerAsset) => {
        if (voice || isRecording) return setError('Remove your voice note before attaching an image or video');

        const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
        const mime = resolveMime(asset.uri, kind, asset.mimeType);
        const allowed = kind === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
        if (!allowed.includes(mime)) return setError(`Unsupported type: ${mime}`);

        const max = kind === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
        if (asset.fileSize && asset.fileSize > max) {
            return setError(kind === 'video' ? 'Video must be under 50MB' : 'Image must be under 8MB');
        }

        setMedia({
            uri: asset.uri,
            kind,
            mime,
            name: asset.fileName ?? `upload.${mime.split('/')[1] ?? 'jpg'}`,
        });
        setError('');
    };

    const pickFromGallery = async () => {
        const res = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
        });
        if (!res.canceled && res.assets[0]) acceptAsset(res.assets[0]);
    };

    const pickFromCamera = async () => {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) return setError('Camera permission denied');
        const res = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images', 'videos'],
            quality: 0.9,
            videoMaxDuration: 60,
        });
        if (!res.canceled && res.assets[0]) acceptAsset(res.assets[0]);
    };

    /* ----- orbitals ----- */
    const loadOrbitals = useCallback(async () => {
        setOrbLoading(true);
        setOrbError('');
        try {
            setOrbitals(await fetchMyOrbitals());
        } catch {
            setOrbError('Could not load your orbitals');
        } finally {
            setOrbLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open && postType !== 'feed' && orbitals === null && !orbLoading && !orbError) loadOrbitals();
    }, [open, postType, orbitals, orbLoading, orbError, loadOrbitals]);

    /* ----- close ----- */
    const requestClose = async () => {
        if (isPosting) return;
        if (isRecording) await stopRecording(); // keep what was recorded as the draft
        setOpen(false);
    };
    const requestCloseRef = useRef(requestClose);
    requestCloseRef.current = requestClose;

    // drag the grabber down to dismiss
    const pan = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderMove: (_, g) => {
                    if (g.dy > 0) progress.setValue(Math.max(0, 1 - g.dy / height));
                },
                onPanResponderRelease: (_, g) => {
                    if (g.dy > 120 || g.vy > 0.9) requestCloseRef.current();
                    else
                        Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
                },
                onPanResponderTerminate: () => {
                    Animated.spring(progress, { toValue: 1, useNativeDriver: true, bounciness: 0, speed: 18 }).start();
                },
            }),
        [height, progress]
    );

    /* ----- post ----- */
    const resetDraft = () => {
        setCaption('');
        setMedia(null);
        setVoice(null);
        setError('');
    };

    const handlePost = async () => {
        const trimmed = caption.trim();
        const targets: PostTarget[] = postType === 'both' ? ['feed', 'orbital'] : [postType];

        if (targets.includes('orbital') && !selectedOrbitalId) return setError('Select an orbital first');
        if (!trimmed && !media && !voice) return setError('Write something or attach an image, video, or voice note');
        if (caption.length > MAX_CAPTION) return setError(`Exceeds ${MAX_CAPTION} chars`);

        setIsPosting(true);
        setError('');

        try {
            const buildForm = async () => {
                const f = new FormData();
                if (trimmed) f.append('content', trimmed);
                if (voice) {
                    await appendFile(f, 'media', { uri: voice.uri, name: `voice-note.${AUDIO_EXT}`, type: AUDIO_MIME });
                    f.append('voiceNoteDuration', String(voice.duration));
                } else if (media) {
                    await appendFile(f, 'media', { uri: media.uri, name: media.name, type: media.mime });
                }
                return f;
            };

            const endpoints: Record<PostTarget, string> = {
                feed: `${API_URL}/api/community/posts`,
                orbital: `${API_URL}/api/orbital/${selectedOrbitalId}/posts`,
            };
            const headers = { ...(await getAuthHeaders()) };

            const results = await Promise.allSettled(
                targets.map(async (target) => {
                    const { data } = await axios.post(endpoints[target], await buildForm(), {
                        withCredentials: true,
                        headers,
                    });
                    return { target, post: data?.post };
                })
            );

            const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
            const failed = results.flatMap((r, i) =>
                r.status === 'rejected' ? [{ target: targets[i], reason: r.reason }] : []
            );

            if (!created.length) {
                setError(errMsg(failed[0]?.reason, 'Post failed'));
                return;
            }

            const imageToAnalyze = media?.kind === 'image' ? media : null;
            created.forEach((c) => {
                onPostCreated?.(c.post, c.target);
                if (imageToAnalyze) analyzeImage(imageToAnalyze, c.post?.id ?? c.post?._id);
            });

            resetDraft();
            setOpen(false);

            if (failed.length) {
                notify(
                    'Partly posted',
                    `Posted to ${created.map((c) => c.target).join(' & ')}, but the ${failed
                        .map((f) => f.target)
                        .join(' & ')} post failed: ${errMsg(failed[0].reason, 'unknown error')}`
                );
            }
        } catch (e) {
            setError(errMsg(e, 'Post failed'));
        } finally {
            setIsPosting(false);
        }
    };

    /* ----- render ----- */
    const translateX = 0;
    const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] });
    const backdropOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0, 0.6] });
    const avatar = resolveUrl(user?.profilePic);
    const needsOrbital = postType !== 'feed';

    return (
        <>
            {/* floating button */}
            <View pointerEvents="box-none" style={{ position: 'absolute', right: 20, bottom: bottomOffset }}>
                <Pressable onPress={openSheet} accessibilityRole="button" accessibilityLabel="Create post">
                    {({ pressed }) => (
                        <GlassPanel radius={26} style={{ padding: 9 }}>
                            <NeoView radius={20} pressed={pressed} style={{ width: 50, height: 50 }}>
                                <Plus size={24} color={COLORS.text} strokeWidth={2.4} />
                            </NeoView>
                            {hasDraft && (
                                <View
                                    style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        width: 10,
                                        height: 10,
                                        borderRadius: 5,
                                        backgroundColor: COLORS.accent,
                                    }}
                                />
                            )}
                        </GlassPanel>
                    )}
                </Pressable>
            </View>

            {mounted && (
                <Modal
                    visible={mounted}
                    transparent
                    animationType="none"
                    statusBarTranslucent
                    onRequestClose={requestClose}
                >
                    <Animated.View
                        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
                    />
                    <Pressable style={StyleSheet.absoluteFill} onPress={requestClose} accessibilityLabel="Close composer" />

                    <KeyboardAvoidingView
                        style={{ flex: 1, justifyContent: 'flex-end' }}
                        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                        pointerEvents="box-none"
                    >
                        <Animated.View
                            style={[styles.sheet, { maxHeight: height * 0.92, transform: [{ translateX }, { translateY }] }]}
                        >
                            <BlurView
                                intensity={60}
                                tint="dark"
                                experimentalBlurMethod="dimezisBlurView"
                                style={StyleSheet.absoluteFill}
                            />
                            <View
                                pointerEvents="none"
                                style={[StyleSheet.absoluteFill, { backgroundColor: 'black/10' }]}
                            />

                            {/* grabber */}
                            <View {...pan.panHandlers} style={styles.grabberArea}>
                                <View style={styles.grabber} />
                            </View>

                            {/* header */}
                            <View style={styles.header}>
                                <NeoView radius={22} style={{ width: 44, height: 44 }}>
                                    {avatar ? (
                                        <Image source={{ uri: avatar }} style={{ width: 38, height: 38, borderRadius: 19 }} />
                                    ) : (
                                        <Text style={{ color: COLORS.text, fontSize: 17, fontWeight: '800' }}>
                                            {(user?.username?.trim()?.[0] ?? 'Y').toUpperCase()}
                                        </Text>
                                    )}
                                </NeoView>
                                <Text numberOfLines={1} style={styles.username}>
                                    {user?.username || 'You'}
                                </Text>
                                <IconButton Icon={X} label="Close composer" onPress={requestClose} size={40} />
                            </View>

                            {/* body */}
                            <ScrollView
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8, gap: 12 }}
                            >
                                <TypeTabs
                                    value={postType}
                                    onChange={(v) => {
                                        setPostType(v);
                                        setError('');
                                    }}
                                />

                                {needsOrbital && (
                                    <OrbitalPicker
                                        orbitals={orbitals}
                                        loading={orbLoading}
                                        error={orbError}
                                        selectedId={selectedOrbitalId}
                                        onSelect={setSelectedOrbitalId}
                                        onRetry={loadOrbitals}
                                    />
                                )}

                                {media && (
                                    <GlassPanel radius={24} style={{ height: 260 }}>
                                        {media.kind === 'video' ? (
                                            <VideoPreview uri={media.uri} />
                                        ) : (
                                            <Image source={{ uri: media.uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                        )}
                                        <View style={{ position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 8 }}>
                                            <IconButton Icon={RefreshCw} label="Change media" size={36} onPress={pickFromGallery} />
                                            <IconButton Icon={Trash2} label="Remove media" size={36} onPress={() => setMedia(null)} />
                                        </View>
                                    </GlassPanel>
                                )}

                                {isRecording && (
                                    <RecordingBar
                                        seconds={Math.floor(recState.durationMillis / 1000)}
                                        max={MAX_RECORDING_SECONDS}
                                        onStop={stopRecording}
                                    />
                                )}

                                {voice && !isRecording && (
                                    <VoiceNotePreview
                                        key={voice.uri}
                                        uri={voice.uri}
                                        duration={voice.duration}
                                        onRemove={() => setVoice(null)}
                                    />
                                )}

                                <GlassPanel radius={22} style={{ padding: 14 }}>
                                    <TextInput
                                        value={caption}
                                        onChangeText={setCaption}
                                        placeholder="Add a caption and #hashtags"
                                        placeholderTextColor={COLORS.muted}
                                        selectionColor="#ffffff"
                                        maxLength={MAX_CAPTION}
                                        multiline
                                        style={{
                                            color: COLORS.text,
                                            fontSize: 16,
                                            lineHeight: 24,
                                            minHeight: 110,
                                            textAlignVertical: 'top',
                                            padding: 0,
                                        }}
                                    />
                                    <Text style={{ color: COLORS.muted, fontSize: 11, marginTop: 8, textAlign: 'right' }}>
                                        {caption.length}/{MAX_CAPTION}
                                    </Text>
                                </GlassPanel>

                                {postType === 'both' && (
                                    <Text style={{ color: COLORS.muted, fontSize: 12, textAlign: 'center' }}>
                                        This will be posted to your feed and to the selected orbital.
                                    </Text>
                                )}
                            </ScrollView>

                            {/* error */}
                            {!!error && (
                                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                                    <GlassPanel radius={14} style={{ paddingHorizontal: 12, paddingVertical: 9 }}>
                                        <Text style={{ color: '#f87171', fontSize: 12 }}>{error}</Text>
                                    </GlassPanel>
                                </View>
                            )}

                            {/* footer: neo tools + Post */}
                            <View style={styles.footer}>
                                <IconButton Icon={ImageIcon} label="Add photo or video" onPress={pickFromGallery} />
                                {Platform.OS !== 'web' && <IconButton Icon={Camera} label="Open camera" onPress={pickFromCamera} />}
                                <IconButton
                                    Icon={isRecording ? Square : Mic}
                                    label={isRecording ? 'Stop recording' : 'Record voice note'}
                                    onPress={isRecording ? stopRecording : startRecording}
                                    color={isRecording ? '#f87171' : COLORS.text}
                                    active={isRecording}
                                />

                                <Pressable style={{ flex: 1 }} onPress={handlePost} disabled={!canPost} accessibilityRole="button">
                                    {({ pressed }) => (
                                        <NeoView
                                            radius={16}
                                            pressed={pressed}
                                            style={{ height: 46, opacity: canPost ? 1 : 0.5 }}
                                        >
                                            {isPosting ? (
                                                <ActivityIndicator color={COLORS.text} />
                                            ) : (
                                                <Text style={{ color: COLORS.text, fontSize: 15, fontWeight: '800', letterSpacing: 0.3 }}>
                                                    Post
                                                </Text>
                                            )}
                                        </NeoView>
                                    )}
                                </Pressable>
                            </View>
                        </Animated.View>
                    </KeyboardAvoidingView>
                </Modal>
            )}
        </>
    );
}

const styles = StyleSheet.create({
    sheet: {
        overflow: 'hidden',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: COLORS.glassBorder,
        backgroundColor: 'rgba(10,12,18,0.6)',
    },
    grabberArea: { alignItems: 'center', paddingTop: 10, paddingBottom: 6 },
    grabber: { width: 44, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.22)' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingTop: 6,
        paddingBottom: 14,
    },
    username: { flex: 1, color: COLORS.text, fontSize: 16, fontWeight: '700' },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 18,
    },
});