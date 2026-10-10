// import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    LayoutRectangle,
    Platform,
    Pressable,
    ScrollView,
    StyleProp,
    Text,
    TextInput,
    TextStyle,
    View,
    ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Animated, {
    Easing,
    interpolateColor,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withDelay,
    withTiming,
} from 'react-native-reanimated';
import { ChevronLeft, Globe, Lock } from 'lucide-react-native';
import axios, { type Method } from 'axios';
import { API_URL, getAuthHeaders } from '@/app/utils';
import { OrbitalRole, OrbitalVisibility, resolveUrl } from './orbitalData';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

/* ---------- types ---------- */
type UserLite = {
    _id?: string;
    username?: string;
    fullName?: string;
    avatar?: string;
    profilePic?: string;
};

type DetailOrbital = {
    _id: string;
    name: string;
    description?: string;
    image?: string;
    avatar?: string;
    visibility: OrbitalVisibility;
    memberCount: number;
    creator?: UserLite;
    role?: OrbitalRole; // present when opened from "My orbitals"
};

type ViewerStatus = 'none' | 'pending' | 'active';
type Viewer = { status: ViewerStatus; role: OrbitalRole | null; isAdmin: boolean };

type Post = { _id: string; content: string; createdAt: string; author?: UserLite };
type Member = { _id: string; role?: OrbitalRole; user?: UserLite };
type JoinRequest = { _id: string; user: UserLite & { _id: string } };
type TabKey = 'posts' | 'members' | 'requests';

type DetailResponse = Partial<DetailOrbital> & {
    orbital?: DetailOrbital;
    viewer?: { status?: ViewerStatus; role?: OrbitalRole | null };
};

/* ---------- api ---------- */
// getAuthHeaders may be sync (web) or async (AsyncStorage on native); await handles both
async function api<T = any>(path: string, method: Method = 'get', data?: unknown) {
    return axios<T>({
        url: `${API_URL}/api/orbital${path}`,
        method,
        data,
        headers: { ...(await getAuthHeaders()) },
    });
}

const errMsg = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ??
    fallback;

// Alert.alert does nothing on web, so fall back to window.confirm there
const confirmAsync = (title: string, message: string, confirmText: string) =>
    Platform.OS === 'web'
        ? Promise.resolve(window.confirm(`${title}\n\n${message}`))
        : new Promise<boolean>((resolve) =>
            Alert.alert(
                title,
                message,
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                    { text: confirmText, style: 'destructive', onPress: () => resolve(true) },
                ],
                { cancelable: true, onDismiss: () => resolve(false) }
            )
        );

function parseSeed(raw?: string): DetailOrbital | null {
    if (!raw) return null;
    try {
        const o = JSON.parse(raw);
        return o && typeof o._id === 'string' && typeof o.name === 'string' ? (o as DetailOrbital) : null;
    } catch {
        return null;
    }
}

const initial = (s?: string) => (s?.trim()?.[0] ?? '?').toUpperCase();
const userAvatar = (u?: UserLite) => u?.avatar || u?.profilePic;

/* ---------- fonts (load with expo-font; they fall back to system if missing) ---------- */
const DISPLAY = { fontFamily: 'Syne-Bold' };
const MONO = { fontFamily: 'DMMono-Medium' };

/* ---------- surfaces ---------- */
function Glass({ children, className = '' }: { children: React.ReactNode; className?: string }) {
    return (
        <View className={`overflow-hidden rounded-[20px] border border-white/[0.08] bg-white/[0.04] ${className}`}>
            <View pointerEvents="none" className="absolute top-0 left-0 right-0 h-px bg-white/[0.06]" />
            {children}
        </View>
    );
}
const glassInner = 'bg-white/[0.03] border border-white/[0.06] rounded-[14px]';

const darkShadow: ViewStyle = {
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 5 },
    shadowRadius: 6,
    shadowOpacity: 0.7,
    elevation: Platform.OS === 'android' ? 8 : 0,
};
const lightShadow: ViewStyle = {
    shadowColor: '#fff',
    shadowOffset: { width: -3, height: -3 },
    shadowRadius: 5,
    shadowOpacity: 0.05,
};
const androidEdge: ViewStyle | null =
    Platform.OS === 'android' ? { borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' } : null;

function NeoButton({
    label,
    onPress,
    disabled,
    muted = false,
    small = false,
}: {
    label: string;
    onPress?: () => void;
    disabled?: boolean;
    muted?: boolean;
    small?: boolean;
}) {
    const p = useSharedValue(0);

    const outer = useAnimatedStyle(() => ({
        shadowOpacity: 0.05 * (1 - p.value),
        transform: [{ scale: 1 - 0.03 * p.value }],
    }));
    const inner = useAnimatedStyle(() => ({
        shadowOpacity: 0.7 * (1 - p.value),
        elevation: Platform.OS === 'android' ? 8 * (1 - p.value) : 0,
        backgroundColor: interpolateColor(p.value, [0, 1], ['#141414', '#0d0d0d']),
    }));

    return (
        <Animated.View
            style={[{ borderRadius: 12, backgroundColor: '#141414', opacity: disabled ? 0.5 : 1 }, lightShadow, outer]}
        >
            <Animated.View style={[{ borderRadius: 12 }, darkShadow, androidEdge, inner]}>
                <Pressable
                    disabled={disabled}
                    onPress={onPress}
                    onPressIn={() => {
                        p.value = withTiming(1, { duration: 90 });
                    }}
                    onPressOut={() => {
                        p.value = withTiming(0, { duration: 160 });
                    }}
                    className={`items-center justify-center ${small ? 'px-4 py-1.5' : 'px-6 py-2'}`}
                >
                    <Text
                        className={`font-semibold ${small ? 'text-xs' : 'text-[13px]'}`}
                        style={{ color: muted ? '#aaaaaa' : '#e8f0fe' }}
                    >
                        {label}
                    </Text>
                </Pressable>
            </Animated.View>
        </Animated.View>
    );
}

function NeoCircle({ size, children }: { size: number; children?: React.ReactNode }) {
    return (
        <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: '#141414' }, lightShadow]}>
            <View
                style={[
                    { width: size, height: size, borderRadius: size / 2, backgroundColor: '#141414' },
                    darkShadow,
                    androidEdge,
                ]}
                className="items-center justify-center overflow-hidden"
            >
                {children}
            </View>
        </View>
    );
}

function Avatar({
    uri,
    label,
    size = 40,
    textSize = 14,
    display = false,
}: {
    uri?: string;
    label?: string;
    size?: number;
    textSize?: number;
    display?: boolean;
}) {
    const [failed, setFailed] = useState(false);
    const src = resolveUrl(uri); // rewrites http://localhost:5000 so phones can load it

    if (src && !failed) {
        return (
            <Image
                source={{ uri: src }}
                onError={() => setFailed(true)}
                style={{ width: size, height: size, borderRadius: size / 2 }}
            />
        );
    }
    return (
        <NeoCircle size={size}>
            <Text className="font-semibold text-[#aaaaaa]" style={[{ fontSize: textSize }, display && DISPLAY]}>
                {initial(label)}
            </Text>
        </NeoCircle>
    );
}

function BackButton() {
    const router = useRouter();
    return (
        <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/orbital'))}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            className="self-start"
        >
            <NeoCircle size={42}>
                <ChevronLeft size={22} color="#e8f0fe" />
            </NeoCircle>
        </Pressable>
    );
}

const Empty = ({ text }: { text: string }) => (
    <Text className="text-[13px] text-[#777777] text-center py-10">{text}</Text>
);

// defined outside the page so it isn't re-created (and re-mounted) on every render
function Shell({ children }: { children: React.ReactNode }) {
    return (
        <SafeAreaView className="flex-1 bg-black">
            <View className="flex-1 px-4 py-4 gap-6">
                <BackButton />
                {children}
            </View>
        </SafeAreaView>
    );
}

/* ---------- motion helpers ---------- */
function Reveal({ index, children }: { index: number; children: React.ReactNode }) {
    const reduce = useReducedMotion();
    const v = useSharedValue(reduce ? 1 : 0);

    useEffect(() => {
        if (!reduce) {
            v.value = withDelay(index * 80, withTiming(1, { duration: 500, easing: Easing.out(Easing.quad) }));
        }
    }, []);

    const style = useAnimatedStyle(() => ({
        opacity: v.value,
        transform: [{ translateY: (1 - v.value) * 14 }],
    }));
    return <Animated.View style={style}>{children}</Animated.View>;
}

function TabFade({ tab, children }: { tab: string; children: React.ReactNode }) {
    const reduce = useReducedMotion();
    const v = useSharedValue(1);
    const mounted = useRef(false);

    useEffect(() => {
        if (!mounted.current) {
            mounted.current = true;
            return;
        }
        if (reduce) return;
        v.value = 0;
        v.value = withTiming(1, { duration: 250, easing: Easing.out(Easing.quad) });
    }, [tab]);

    const style = useAnimatedStyle(() => ({
        opacity: v.value,
        transform: [{ translateY: (1 - v.value) * 8 }],
    }));
    return <Animated.View style={style}>{children}</Animated.View>;
}

/* ---------- click-to-edit text ---------- */
type InlineEditProps = {
    value: string;
    onSave: (value: string) => Promise<void>;
    editable: boolean;
    multiline?: boolean;
    minLength?: number;
    maxLength?: number;
    placeholder?: string;
    textClass: string;
    textStyle?: StyleProp<TextStyle>;
    header?: boolean;
};

function InlineEdit({
    value,
    onSave,
    editable,
    multiline = false,
    minLength = 0,
    maxLength,
    placeholder,
    textClass,
    textStyle,
    header = false,
}: InlineEditProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const open = () => {
        if (!editable) return;
        setDraft(value);
        setError('');
        setEditing(true);
    };

    const cancel = () => {
        setEditing(false);
        setError('');
    };

    const save = async () => {
        const next = draft.trim();
        if (next.length < minLength) return setError(`Use at least ${minLength} characters`);
        if (next === value) return cancel();
        setSaving(true);
        try {
            await onSave(next);
            setEditing(false);
        } catch (e) {
            setError(errMsg(e, 'Could not save'));
        } finally {
            setSaving(false);
        }
    };

    if (!editing) {
        return (
            <Pressable onPress={open} disabled={!editable}>
                <Text className={textClass} style={textStyle} accessibilityRole={header ? 'header' : undefined}>
                    {value || placeholder}
                </Text>
            </Pressable>
        );
    }

    return (
        <View>
            <TextInput
                value={draft}
                onChangeText={setDraft}
                maxLength={maxLength}
                multiline={multiline}
                autoFocus
                selectionColor="#ffffff"
                returnKeyType={multiline ? 'default' : 'done'}
                onSubmitEditing={multiline ? undefined : save}
                className={`${textClass} w-full p-0 pb-1 border-b border-white/20 focus:border-white/50`}
                style={[textStyle, multiline && { minHeight: 72, textAlignVertical: 'top' }]}
            />
            <View className="flex-row items-center gap-2 mt-2">
                <NeoButton small label={saving ? 'Saving...' : 'Save'} onPress={save} disabled={saving} />
                <NeoButton small muted label="Cancel" onPress={cancel} />
                {!!error && <Text className="text-xs text-[#c98a8a] flex-1">{error}</Text>}
            </View>
        </View>
    );
}

/* ---------- page ---------- */
export default function OrbitalDetail() {
    const { id: orbitalId, data: seedRaw } = useLocalSearchParams<{ id: string; data?: string }>();
    const router = useRouter();
    const reduce = useReducedMotion();

    // the list passes the orbital along, so the page renders instantly and refreshes in the background
    const seed = useMemo(() => parseSeed(seedRaw), [seedRaw]);

    const [orbital, setOrbital] = useState<DetailOrbital | null>(seed);
    const [viewer, setViewer] = useState<Viewer>(() =>
        seed?.role
            ? { status: 'active', role: seed.role, isAdmin: seed.role === 'admin' || seed.role === 'creator' }
            : { status: 'none', role: null, isAdmin: false }
    );
    // from "My orbitals" we already know the role; otherwise wait for the server before showing Join/Exit
    const [viewerReady, setViewerReady] = useState(Boolean(seed?.role));
    const [loadError, setLoadError] = useState('');

    const [tab, setTab] = useState<TabKey>('posts');
    const [posts, setPosts] = useState<Post[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [tabLoading, setTabLoading] = useState(false);

    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState('');

    const ready = Boolean(orbital);
    const isMember = viewer.status === 'active';
    const isPending = viewer.status === 'pending';
    const isPrivate = orbital?.visibility === 'private';
    const isCreator = viewer.role === 'creator';
    const VisIcon = isPrivate ? Lock : Globe;

    const tabs: { key: TabKey; label: string; count?: number }[] = [
        { key: 'posts', label: 'Posts' },
        { key: 'members', label: 'Members', count: orbital?.memberCount },
        ...(isPrivate && viewer.isAdmin
            ? [{ key: 'requests' as const, label: 'Requests', count: requests.length }]
            : []),
    ];

    /* ---------- tab underline: transform-only, so it never triggers layout ---------- */
    const tabLayouts = useRef<Partial<Record<TabKey, LayoutRectangle>>>({});
    const underlineInit = useRef(false);
    const ux = useSharedValue(0);
    const us = useSharedValue(0);

    const moveUnderline = useCallback(
        (key: TabKey) => {
            const l = tabLayouts.current[key];
            if (!l) return;
            const centerX = l.x + l.width / 2 - 0.5; // 1px bar scaled to the tab width
            if (!underlineInit.current || reduce) {
                ux.value = centerX;
                us.value = l.width;
                underlineInit.current = true;
            } else {
                const cfg = { duration: 350, easing: Easing.out(Easing.cubic) };
                ux.value = withTiming(centerX, cfg);
                us.value = withTiming(l.width, cfg);
            }
        },
        [reduce]
    );

    useEffect(() => {
        moveUnderline(tab);
    }, [tab, tabs.length, moveUnderline]);

    const underlineStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: ux.value }, { scaleX: us.value }],
    }));

    /* ---------- data ---------- */
    useEffect(() => {
        if (!orbitalId) return;
        let cancelled = false;
        api<DetailResponse>(`/${orbitalId}`)
            .then(({ data }) => {
                if (cancelled) return;
                const o = (data.orbital ?? data) as DetailOrbital;
                // merge, so fields the detail endpoint omits (e.g. creator) keep the list's values
                setOrbital((prev) => ({ ...(prev ?? {}), ...o }) as DetailOrbital);
                setViewer((prev) => {
                    const role = data.viewer?.role ?? o.role ?? prev.role;
                    return {
                        status: data.viewer?.status ?? (role ? 'active' : 'none'),
                        role,
                        isAdmin: role === 'admin' || role === 'creator',
                    };
                });
                setViewerReady(true);
                setLoadError('');
            })
            .catch((e) => !cancelled && setLoadError(errMsg(e, 'Could not load this orbital')));
        return () => {
            cancelled = true;
        };
    }, [orbitalId]);

    useEffect(() => {
        if (!ready || !isMember || !orbitalId) return;
        let cancelled = false;
        setTabLoading(true);
        api(`/${orbitalId}/${tab}`)
            .then(({ data }) => {
                if (cancelled) return;
                if (tab === 'posts') setPosts(data.posts ?? []);
                if (tab === 'members') setMembers(data.members ?? []);
                if (tab === 'requests') setRequests(data.requests ?? []);
            })
            .catch(() => { })
            .finally(() => !cancelled && setTabLoading(false));
        return () => {
            cancelled = true;
        };
    }, [tab, orbitalId, ready, isMember]);

    // the requests badge needs the list as soon as an admin lands on a private orbital
    useEffect(() => {
        if (ready && isPrivate && viewer.isAdmin && orbitalId) {
            api(`/${orbitalId}/requests`)
                .then(({ data }) => setRequests(data.requests ?? []))
                .catch(() => { });
        }
    }, [ready, isPrivate, viewer.isAdmin, orbitalId]);

    /* ---------- actions ---------- */
    const run = async (fn: () => Promise<void>) => {
        setBusy(true);
        setActionError('');
        try {
            await fn();
        } catch (e) {
            setActionError(errMsg(e, 'Something went wrong'));
        } finally {
            setBusy(false);
        }
    };

    const bumpMembers = (n: number) =>
        setOrbital((o) => (o ? { ...o, memberCount: Math.max(0, o.memberCount + n) } : o));

    const handleJoin = () =>
        run(async () => {
            const { data } = await api<{ status: ViewerStatus }>(`/${orbitalId}/join`, 'post');
            setViewer((v) => ({ ...v, status: data.status }));
            if (data.status === 'active') bumpMembers(1);
        });

    const handleCancelRequest = () =>
        run(async () => {
            await api(`/${orbitalId}/join`, 'delete');
            setViewer((v) => ({ ...v, status: 'none' }));
        });

    const handleLeave = () =>
        run(async () => {
            await api(`/${orbitalId}/leave`, 'delete');
            setViewer({ status: 'none', role: null, isAdmin: false });
            setTab('posts');
            bumpMembers(-1);
        });

    const handleApprove = (userId: string) =>
        run(async () => {
            await api(`/${orbitalId}/requests/${userId}/approve`, 'patch');
            setRequests((r) => r.filter((x) => x.user._id !== userId));
            bumpMembers(1);
        });

    const handleReject = (userId: string) =>
        run(async () => {
            await api(`/${orbitalId}/requests/${userId}`, 'delete');
            setRequests((r) => r.filter((x) => x.user._id !== userId));
        });

    const destroyOrbital = async () => {
        const ok = await confirmAsync(
            'Destroy orbital?',
            'This permanently deletes the orbital, its members and all its posts.',
            'Destroy'
        );
        if (!ok) return;
        run(async () => {
            await api(`/deleteorbital/${orbitalId}`, 'delete');
            router.canGoBack() ? router.back() : router.replace('/orbital');
        });
    };

    const handleMessage = () => {
        // TODO: open the orbital's chat
    };

    const saveField = (field: 'name' | 'description') => async (value: string) => {
        await api(`/${orbitalId}`, 'patch', { [field]: value });
        setOrbital((o) => (o ? { ...o, [field]: value } : o));
    };

    /* ---------- render ---------- */
    if (!orbital) {
        return (
            <Shell>
                <Glass className="p-8">
                    <Text className="text-center text-[#777777]">{loadError || 'Loading orbital...'}</Text>
                </Glass>
            </Shell>
        );
    }

    const renderContent = () => {
        if (!viewerReady) return <Empty text="Loading..." />;
        if (!isMember) {
            return (
                <Empty
                    text={
                        isPrivate
                            ? 'This orbital is private. Request to join to see its posts and members.'
                            : 'Join this orbital to see its posts and members.'
                    }
                />
            );
        }
        if (tabLoading) return <Empty text="Loading..." />;

        if (tab === 'posts') {
            if (!posts.length) return <Empty text="No posts yet." />;
            return (
                <View className="gap-3">
                    {posts.map((p) => (
                        <View key={p._id} className={`${glassInner} p-4`}>
                            <View className="flex-row items-center gap-3 mb-2">
                                <Avatar uri={userAvatar(p.author)} label={p.author?.username} size={32} textSize={12} />
                                <View>
                                    <Text className="text-[13px] font-semibold text-[#e8f0fe]">{p.author?.username}</Text>
                                    <Text className="text-[11px] text-[#777777]">{new Date(p.createdAt).toLocaleDateString()}</Text>
                                </View>
                            </View>
                            <Text className="text-[13px] leading-[21px] text-[#cccccc]">{p.content}</Text>
                        </View>
                    ))}
                </View>
            );
        }

        if (tab === 'members') {
            if (!members.length) return <Empty text="No members to show." />;
            return (
                <View className="flex-row flex-wrap gap-3">
                    {members.map((m) => (
                        <View key={m._id} className={`${glassInner} p-3 flex-row items-center gap-3 w-full sm:w-[48.5%]`}>
                            <Avatar uri={userAvatar(m.user)} label={m.user?.username} />
                            <View className="flex-1 min-w-0">
                                <Text numberOfLines={1} className="text-[13px] font-semibold text-[#e8f0fe]">
                                    {m.user?.username}
                                </Text>
                                <Text numberOfLines={1} className="text-[11px] text-[#777777]">
                                    {m.user?.fullName}
                                </Text>
                            </View>
                            {(m.role === 'admin' || m.role === 'creator') && (
                                <View className="border border-white/10 rounded-full px-2 py-0.5">
                                    <Text className="text-[11px] text-[#aaaaaa]">{m.role}</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            );
        }

        if (!requests.length) return <Empty text="No pending requests." />;
        return (
            <View className="gap-3">
                {requests.map((r) => (
                    <View key={r._id} className={`${glassInner} p-3 flex-row items-center gap-3`}>
                        <Avatar uri={userAvatar(r.user)} label={r.user?.username} />
                        <View className="flex-1 min-w-0">
                            <Text numberOfLines={1} className="text-[13px] font-semibold text-[#e8f0fe]">
                                {r.user?.username}
                            </Text>
                            <Text numberOfLines={1} className="text-[11px] text-[#777777]">
                                {r.user?.fullName}
                            </Text>
                        </View>
                        <NeoButton small label="Approve" disabled={busy} onPress={() => handleApprove(r.user._id)} />
                        <NeoButton small muted label="Reject" disabled={busy} onPress={() => handleReject(r.user._id)} />
                    </View>
                ))}
            </View>
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-black">
            <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View className="w-full max-w-3xl self-center gap-6">
                        <BackButton />

                        {/* header */}
                        <Reveal index={0}>
                            <Glass className="p-6">
                                <View className="flex-col sm:flex-row gap-5">
                                    <View>
                                        <Avatar
                                            uri={orbital.image ?? orbital.avatar}
                                            label={orbital.name}
                                            size={88}
                                            textSize={34}
                                            display
                                        />
                                    </View>

                                    <View className="flex-1 min-w-0">
                                        <InlineEdit
                                            header
                                            value={orbital.name}
                                            onSave={saveField('name')}
                                            editable={viewer.isAdmin}
                                            minLength={3}
                                            maxLength={50}
                                            textClass="text-[26px] sm:text-[30px] leading-[32px] text-[#e8f0fe]"
                                            textStyle={DISPLAY}
                                        />
                                        <InlineEdit
                                            value={orbital.description ?? ''}
                                            onSave={saveField('description')}
                                            editable={viewer.isAdmin}
                                            multiline
                                            maxLength={500}
                                            placeholder={viewer.isAdmin ? 'Tap to add a description' : 'No description yet.'}
                                            textClass="text-[13px] leading-[21px] text-[#aaaaaa] mt-1"
                                        />

                                        <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 mt-3">
                                            <View className="flex-row items-center gap-[6px] border border-white/10 rounded-full px-2.5 py-0.5">
                                                <VisIcon size={11} color="#aaaaaa" />
                                                <Text className="text-[12px] text-[#aaaaaa]">{orbital.visibility}</Text>
                                            </View>

                                            {!!orbital.creator && (
                                                <>
                                                    <Text className="text-[12px] text-[#aaaaaa]">Creator:</Text>
                                                    <View className="flex-row items-center gap-[4px] border border-white/10 rounded-full px-2.5 py-0.5">
                                                        {!!resolveUrl(orbital.creator.profilePic) && (
                                                            <Image
                                                                source={{ uri: resolveUrl(orbital.creator.profilePic) }}
                                                                style={{ width: 16, height: 16, borderRadius: 8 }}
                                                            />
                                                        )}
                                                        <Text className="text-[12px] text-[#aaaaaa]">
                                                            {orbital.creator.username || 'Unknown'}
                                                        </Text>
                                                    </View>
                                                </>
                                            )}
                                        </View>
                                    </View>
                                </View>

                                {viewerReady && (
                                    <View className="flex-row flex-wrap items-center gap-3 mt-6">
                                        {/* only non-members can join */}
                                        {!isMember && !isPending && (
                                            <NeoButton
                                                label={isPrivate ? 'Request to join' : 'Join'}
                                                disabled={busy}
                                                onPress={handleJoin}
                                            />
                                        )}

                                        {/* pending users can cancel their request */}
                                        {isPending && (
                                            <NeoButton muted label="Requested · Cancel" disabled={busy} onPress={handleCancelRequest} />
                                        )}

                                        {/* only the creator can destroy */}
                                        {isCreator && (
                                            <NeoButton muted label="Destroy Orbital" disabled={busy} onPress={destroyOrbital} />
                                        )}

                                        {/* admins and normal members can leave */}
                                        {isMember && !isCreator && (
                                            <NeoButton muted label="Exit Orbital" disabled={busy} onPress={handleLeave} />
                                        )}

                                        {/* only members can message */}
                                        {isMember && <NeoButton label="Message" onPress={handleMessage} />}
                                    </View>
                                )}

                                {!!actionError && <Text className="text-xs text-[#c98a8a] mt-3">{actionError}</Text>}
                                {!!loadError && <Text className="text-xs text-[#c98a8a] mt-3">{loadError}</Text>}
                            </Glass>
                        </Reveal>

                        {/* tabs */}
                        <Reveal index={1}>
                            <View className="border-b border-white/[0.08]">
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
                                    <View className="flex-row gap-8 px-2">
                                        {tabs.map((t) => (
                                            <Pressable
                                                key={t.key}
                                                onPress={() => setTab(t.key)}
                                                onLayout={(e) => {
                                                    tabLayouts.current[t.key] = e.nativeEvent.layout;
                                                    if (t.key === tab) moveUnderline(tab);
                                                }}
                                                className="py-3"
                                            >
                                                <Text
                                                    className="text-[14px]"
                                                    style={[MONO, { color: tab === t.key ? '#ffffff' : '#777777', fontWeight: '600' }]}
                                                >
                                                    {`[ ${t.label}${t.count !== undefined ? ` ${t.count}` : ''} ]`}
                                                </Text>
                                            </Pressable>
                                        ))}
                                        <Animated.View
                                            pointerEvents="none"
                                            style={[
                                                { position: 'absolute', bottom: 0, left: 0, height: 2, width: 1, backgroundColor: '#fff' },
                                                underlineStyle,
                                            ]}
                                        />
                                    </View>
                                </ScrollView>
                            </View>
                        </Reveal>

                        {/* content */}
                        <Reveal index={2}>
                            <Glass className="p-5">
                                <TabFade tab={tab}>{renderContent()}</TabFade>
                            </Glass>
                        </Reveal>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}