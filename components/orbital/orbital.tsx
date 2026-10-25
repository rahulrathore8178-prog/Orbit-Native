import { API_URL, getAuthHeaders } from '@/lib/utils';
import axios, { type Method } from 'axios';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Camera, Clock, Globe, Lock, LogOut, Trash2, UserPlus, Users } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Image, Platform, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ActionSheet, { SheetAction } from '@/components/ui/ActionSheet';
import IconButton from '@/components/options/IconButton';
import OrbitLoader from '@/components/ui/OrbitLoader';
import Reveal from '@/components/options/Reveal';
import { COLORS, GlassPanel, NeoView } from '@/components/ui/neo';
import OrbitalAvatar from '@/components/profile/OrbitalAvatar';
import EditableText from '@/components/profile/EditableText';
import Postcard from '@/components/postCard/PostCard';
import { toPostcardProps } from '@/components/postCard/toPostCardProps';
import { usePostSheets } from '@/components/postCard/UsePostSheet';
import { useCurrentUser } from '@/hooks/feed/useHomeFeed';
import { useOpenProfile } from '@/hooks/useOpenProfile';
import { SwipePager, useSwipeTabs } from '@/hooks/global/UseSwipeTabs';
import { resolveUri } from '@/components/services/profileMappers';
import { OrbitalRole, OrbitalVisibility, resolveUrl } from './orbitalData';

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
    role?: OrbitalRole; // present when opened from "Joined" / "Mine"
};

type ViewerStatus = 'none' | 'pending' | 'active';
type Viewer = { status: ViewerStatus; role: OrbitalRole | null; isAdmin: boolean };

type OrbitalPost = {
    id: string;
    content: string;
    image?: string;
    video?: string;
    voiceNote?: string;
    voiceNoteDuration?: number;
    mediaWidth?: number;
    mediaHeight?: number;
    createdAt?: string;
    likesCount: number;
    commentsCount: number;
    likedBy: string[];
    author: { id?: string; username: string; profilePic?: string };
};
type Member = { _id: string; role?: OrbitalRole; user?: UserLite };
type JoinRequest = { _id: string; user: UserLite & { _id: string } };
type TabKey = 'posts' | 'members' | 'requests';

type DetailResponse = Partial<DetailOrbital> & {
    orbital?: DetailOrbital;
    viewer?: { status?: ViewerStatus; role?: OrbitalRole | null };
};

const TAB_LABELS: Record<TabKey, string> = { posts: 'Posts', members: 'Members', requests: 'Requests' };

/* ---------- api ---------- */
// getAuthHeaders may be sync (web) or async (AsyncStorage on native); await handles both
async function api<T = any>(path: string, method: Method = 'get', data?: unknown) {
    const headers = await getAuthHeaders();
    return axios<T>({
        url: `${API_URL}/api/orbital${path}`,
        method,
        data,
        headers,
        withCredentials: true,
    });
}

// Sends the picked photo as multipart field "media", same field the create-orbital screen uses
type PickedPhoto = { uri: string; name: string; type: string };
async function uploadOrbitalImage(orbitalId: string, photo: PickedPhoto) {
    const form = new FormData();
    if (Platform.OS === 'web') {
        const blob = await (await fetch(photo.uri)).blob();
        form.append('media', blob, photo.name);
    } else {
        form.append('media', { uri: photo.uri, name: photo.name, type: photo.type } as any);
    }
    const headers = await getAuthHeaders();
    return axios.patch<{ orbital?: DetailOrbital }>(`${API_URL}/api/orbital/${orbitalId}/image`, form, {
        withCredentials: true,
        timeout: 30000,
        headers: { ...headers, 'Content-Type': 'multipart/form-data' },
    });
}

const errMsg = (e: unknown, fallback: string) =>
    (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ??
    fallback;

// Alert.alert does nothing on web, so fall back to window.alert / window.confirm there
const notify = (title: string, message?: string) =>
    Platform.OS === 'web' ? window.alert(message ? `${title}\n\n${message}` : title) : Alert.alert(title, message);

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

const idOf = (v: any): string => (typeof v === 'string' ? v : v?._id ?? v?.id ?? '');
const userAvatar = (u?: UserLite) => resolveUrl(u?.profilePic || u?.avatar);

// Orbital posts are normal Posts; this maps them to what the shared <Postcard /> expects.
function toOrbitalPost(raw: any): OrbitalPost {
    return {
        id: String(raw?._id ?? raw?.id),
        content: raw?.content ?? '',
        image: resolveUri(raw?.image),
        // video / voice note stay raw: Postcard adds the host itself, exactly like in the feed
        video: raw?.video || undefined,
        voiceNote: raw?.voiceNote || undefined,
        voiceNoteDuration: raw?.voiceNoteDuration || undefined,
        mediaWidth: raw?.mediaWidth,
        mediaHeight: raw?.mediaHeight,
        createdAt: raw?.createdAt,
        likesCount: raw?.likesCount ?? raw?.likes?.length ?? 0,
        commentsCount: raw?.commentsCount ?? raw?.comments?.length ?? 0,
        likedBy: Array.isArray(raw?.likes) ? raw.likes.map(idOf) : [],
        author: {
            id: idOf(raw?.author) || undefined,
            username: raw?.author?.username ?? 'Unknown',
            profilePic: resolveUri(raw?.author?.profilePic || raw?.author?.avatar),
        },
    };
}

/* ---------- small pieces (same look as the profile screen) ---------- */
function TopBar({ title, onBack }: { title: string; onBack: () => void }) {
    const insets = useSafeAreaInsets();
    return (
        <View className="flex-row items-center justify-between px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
            <View className="w-11">
                <IconButton Icon={ArrowLeft} label="Go back" onPress={onBack} />
            </View>
            <Text className="flex-1 px-2 text-center text-[15px] font-medium text-neutral-400" numberOfLines={1}>
                {title}
            </Text>
            <View className="w-11" />
        </View>
    );
}

function Chip({ children }: { children: React.ReactNode }) {
    return (
        <View className="flex-row items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
            {children}
        </View>
    );
}

function ActionButton({
    label,
    Icon,
    accent = false,
    disabled,
    onPress,
}: {
    label: string;
    Icon: typeof UserPlus;
    accent?: boolean;
    disabled?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable
            disabled={disabled}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityLabel={label}
            style={{ opacity: disabled ? 0.5 : 1 }}
        >
            {({ pressed }) => (
                <NeoView accent={accent} radius={22} pressed={pressed} style={{ height: 44 }}>
                    <View className="flex-row items-center gap-2">
                        <Icon size={16} color={accent ? '#fff' : COLORS.text} strokeWidth={2} />
                        <Text className="text-[15px] font-semibold text-white">{label}</Text>
                    </View>
                </NeoView>
            )}
        </Pressable>
    );
}

function OrbitalTabs({
    tabs,
    active,
    onChange,
    counts,
}: {
    tabs: TabKey[];
    active: TabKey;
    onChange: (tab: TabKey) => void;
    counts: Partial<Record<TabKey, number>>;
}) {
    const [width, setWidth] = useState(0);
    const index = useSharedValue(0);
    const tabWidth = width / tabs.length;

    useEffect(() => {
        index.value = withTiming(Math.max(0, tabs.indexOf(active)), {
            duration: 240,
            easing: Easing.out(Easing.cubic),
        });
    }, [active, tabs, index]);

    const slide = useAnimatedStyle(() => ({ transform: [{ translateX: index.value * tabWidth }] }));

    return (
        <GlassPanel radius={22} style={{ padding: 4 }}>
            <View className="flex-row" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
                {width > 0 && (
                    <Animated.View style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, width: tabWidth }, slide]}>
                        <View className="h-full w-full rounded-[18px] bg-white/10" />
                    </Animated.View>
                )}
                {tabs.map((key) => {
                    const isActive = key === active;
                    return (
                        <Pressable
                            key={key}
                            onPress={() => onChange(key)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: isActive }}
                            className="flex-1 flex-row items-center justify-center gap-1 py-2.5"
                        >
                            <Text className="text-sm font-bold text-white">{counts[key] ?? 0}</Text>
                            <Text
                                numberOfLines={1}
                                className={`text-sm ${isActive ? 'font-medium text-white' : 'text-neutral-500'}`}
                            >
                                {TAB_LABELS[key]}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </GlassPanel>
    );
}

function Face({ uri, label }: { uri?: string; label?: string }) {
    return (
        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-neutral-800">
            {uri ? (
                <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
            ) : (
                <Text className="text-base font-semibold text-white">{(label?.trim()?.[0] ?? '?').toUpperCase()}</Text>
            )}
        </View>
    );
}

function MembersList({ members, onOpen }: { members: Member[]; onOpen: (userId: string) => void }) {
    if (members.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No members to show.</Text>;
    }
    return (
        <GlassPanel radius={24} style={{ padding: 8 }}>
            {members.map((m) => (
                <Pressable
                    key={m._id}
                    onPress={() => m.user?._id && onOpen(m.user._id)}
                    accessibilityRole="button"
                >
                    {({ pressed }) => (
                        <View className={`flex-row items-center gap-3 rounded-[18px] p-2.5 ${pressed ? 'bg-white/5' : ''}`}>
                            <Face uri={userAvatar(m.user)} label={m.user?.username} />
                            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                                {m.user?.username}
                            </Text>
                            {(m.role === 'admin' || m.role === 'creator') && (
                                <View className="rounded-full border border-white/10 px-2.5 py-0.5">
                                    <Text className="text-[11px] text-neutral-400">{m.role}</Text>
                                </View>
                            )}
                        </View>
                    )}
                </Pressable>
            ))}
        </GlassPanel>
    );
}

function RequestsList({
    requests,
    busy,
    onOpen,
    onApprove,
    onReject,
}: {
    requests: JoinRequest[];
    busy: boolean;
    onOpen: (userId: string) => void;
    onApprove: (userId: string) => void;
    onReject: (userId: string) => void;
}) {
    if (requests.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No pending requests.</Text>;
    }
    return (
        <GlassPanel radius={24} style={{ padding: 8 }}>
            {requests.map((r) => (
                <View key={r._id} className="flex-row items-center gap-3 rounded-[18px] p-2.5">
                    <Pressable
                        onPress={() => onOpen(r.user._id)}
                        accessibilityRole="button"
                        className="flex-1 flex-row items-center gap-3"
                    >
                        <Face uri={userAvatar(r.user)} label={r.user?.username} />
                        <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                            {r.user?.username}
                        </Text>
                    </Pressable>
                    <Pressable
                        disabled={busy}
                        onPress={() => onApprove(r.user._id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Approve ${r.user?.username}`}
                        className="rounded-full bg-neutral-100 px-4 py-2 active:opacity-80"
                        style={{ opacity: busy ? 0.5 : 1 }}
                    >
                        <Text className="text-[13px] font-semibold text-black">Approve</Text>
                    </Pressable>
                    <Pressable
                        disabled={busy}
                        onPress={() => onReject(r.user._id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Reject ${r.user?.username}`}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 active:opacity-80"
                        style={{ opacity: busy ? 0.5 : 1 }}
                    >
                        <Text className="text-[13px] font-semibold text-white/70">Reject</Text>
                    </Pressable>
                </View>
            ))}
        </GlassPanel>
    );
}

/** Shown instead of the tabs until you are a member (same card as the profile's private notice). */
function LockedNotice({
    isPrivate,
    isPending,
    busy,
    onJoin,
}: {
    isPrivate: boolean;
    isPending: boolean;
    busy: boolean;
    onJoin: () => void;
}) {
    const Icon = isPrivate ? Lock : Globe;
    const title = isPrivate ? 'This orbital is private' : 'Join this orbital';
    const body = isPending
        ? "Your request is on its way. You'll see its posts and members once an admin approves."
        : isPrivate
            ? 'Request to join to see its posts and members.'
            : 'Join to see its posts and members.';

    return (
        <View className="items-center rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10">
            <View className="h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <Icon size={22} color="rgba(255,255,255,0.85)" />
            </View>
            <Text className="mt-5 text-[17px] font-semibold text-white">{title}</Text>
            <Text className="mt-2 text-center text-[14px] leading-[21px] text-white/50">{body}</Text>
            {!isPending && (
                <Pressable
                    onPress={onJoin}
                    disabled={busy}
                    accessibilityRole="button"
                    className="mt-6 rounded-full bg-neutral-100 px-6 py-3 active:opacity-80"
                    style={{ opacity: busy ? 0.5 : 1 }}
                >
                    <Text className="text-[14px] font-semibold text-black">{isPrivate ? 'Request to join' : 'Join'}</Text>
                </Pressable>
            )}
        </View>
    );
}

/* ---------- page ---------- */
export default function OrbitalDetail() {
    const { id: orbitalId, data: seedRaw } = useLocalSearchParams<{ id: string; data?: string }>();
    const router = useRouter();
    const openProfile = useOpenProfile();
    const currentUser = useCurrentUser();
    const meId = String(currentUser?.id ?? (currentUser as any)?._id ?? '');
    const { openComments, openShare, commentsCountFor, sheets } = usePostSheets(currentUser);

    // the list passes the orbital along, so the page renders instantly and refreshes in the background
    const seed = useMemo(() => parseSeed(seedRaw), [seedRaw]);

    const [orbital, setOrbital] = useState<DetailOrbital | null>(seed);
    const [viewer, setViewer] = useState<Viewer>(() =>
        seed?.role
            ? { status: 'active', role: seed.role, isAdmin: seed.role === 'admin' || seed.role === 'creator' }
            : { status: 'none', role: null, isAdmin: false }
    );
    // from "Joined" / "Mine" we already know the role; otherwise wait for the server before showing Join/Exit
    const [viewerReady, setViewerReady] = useState(Boolean(seed?.role));
    const [loadError, setLoadError] = useState('');

    const [posts, setPosts] = useState<OrbitalPost[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [requests, setRequests] = useState<JoinRequest[]>([]);
    const [contentLoading, setContentLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    const [busy, setBusy] = useState(false);
    const [imageBusy, setImageBusy] = useState(false);
    const [actionError, setActionError] = useState('');
    const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

    const ready = Boolean(orbital);
    const isMember = viewer.status === 'active';
    const isPending = viewer.status === 'pending';
    const isPrivate = orbital?.visibility === 'private';
    const isCreator = viewer.role === 'creator';
    const showRequests = isPrivate && viewer.isAdmin; // only admins of a private orbital see join requests
    const VisIcon = isPrivate ? Lock : Globe;
    const orbitalImage = orbital?.image || orbital?.avatar;

    const TAB_KEYS = useMemo<TabKey[]>(
        () => ['posts', 'members', ...(showRequests ? (['requests'] as const) : [])],
        [showRequests]
    );
    const swipe = useSwipeTabs({ count: TAB_KEYS.length });
    const tab = TAB_KEYS[swipe.index] ?? 'posts';

    /* ---------- data ---------- */
    const loadDetail = useCallback(async () => {
        if (!orbitalId) return;
        try {
            const { data } = await api<DetailResponse>(`/${orbitalId}`);
            const o = (data.orbital ?? data) as DetailOrbital;
            // merge, so fields the detail endpoint omits keep the list's values
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
        } catch (e) {
            setLoadError(errMsg(e, 'Could not load this orbital'));
        }
    }, [orbitalId]);

    useEffect(() => {
        loadDetail();
    }, [loadDetail]);

    // posts and members are members-only; requests are admins-only (the server enforces both)
    const fetchContent = useCallback(async () => {
        if (!orbitalId) return { posts: [], members: [], requests: [] };
        const [p, m, r] = await Promise.all([
            api(`/${orbitalId}/posts`).then(({ data }) => (data.posts ?? []) as any[]).catch(() => [] as any[]),
            api(`/${orbitalId}/members`).then(({ data }) => (data.members ?? []) as Member[]).catch(() => [] as Member[]),
            showRequests
                ? api(`/${orbitalId}/requests`).then(({ data }) => (data.requests ?? []) as JoinRequest[]).catch(() => [] as JoinRequest[])
                : Promise.resolve([] as JoinRequest[]),
        ]);
        return { posts: p.map(toOrbitalPost), members: m, requests: r };
    }, [orbitalId, showRequests]);

    useEffect(() => {
        if (!ready || !isMember) return;
        let cancelled = false;
        setContentLoading(true);
        fetchContent()
            .then((r) => {
                if (cancelled) return;
                setPosts(r.posts);
                setMembers(r.members);
                setRequests(r.requests);
            })
            .finally(() => !cancelled && setContentLoading(false));
        return () => {
            cancelled = true;
        };
    }, [ready, isMember, fetchContent]);

    const refresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await loadDetail();
            if (isMember) {
                const r = await fetchContent();
                setPosts(r.posts);
                setMembers(r.members);
                setRequests(r.requests);
            }
        } finally {
            setRefreshing(false);
        }
    }, [loadDetail, fetchContent, isMember]);

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

    const goBack = () => (router.canGoBack() ? router.back() : router.replace('/orbital'));

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

    const handleLeave = async () => {
        const ok = await confirmAsync('Exit orbital?', "You'll stop seeing its posts and members.", 'Exit');
        if (!ok) return;
        run(async () => {
            await api(`/${orbitalId}/leave`, 'delete');
            setViewer({ status: 'none', role: null, isAdmin: false });
            setPosts([]);
            setMembers([]);
            setRequests([]);
            bumpMembers(-1);
        });
    };

    const handleApprove = (userId: string) =>
        run(async () => {
            await api(`/${orbitalId}/requests/${userId}/approve`, 'patch');
            setRequests((r) => r.filter((x) => x.user._id !== userId));
            bumpMembers(1);
            fetchContent().then((r) => setMembers(r.members));
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
            goBack();
        });
    };

    const deletePost = async (id: string) => {
        const prev = posts;
        setPosts((list) => list.filter((p) => p.id !== id));
        try {
            await api(`/${orbitalId}/posts/${id}`, 'delete');
        } catch (e) {
            setPosts(prev);
            notify('Something went wrong', errMsg(e, "Couldn't delete that post."));
        }
    };

    const saveName = async (value: string) => {
        if (value.length < 3) return notify('Name too short', 'Use at least 3 characters.');
        try {
            await api(`/${orbitalId}`, 'patch', { name: value });
            setOrbital((o) => (o ? { ...o, name: value } : o));
        } catch (e) {
            notify('Something went wrong', errMsg(e, "Couldn't update the name."));
        }
    };

    const saveDescription = async (value: string) => {
        try {
            await api(`/${orbitalId}`, 'patch', { description: value });
            setOrbital((o) => (o ? { ...o, description: value } : o));
        } catch (e) {
            notify('Something went wrong', errMsg(e, "Couldn't update the description."));
        }
    };

    const changeImage = async () => {
        if (!orbitalId) return;
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            notify('Photo access needed', 'Allow photo access in Settings to change the orbital photo.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets[0]) return;

        const asset = result.assets[0];
        const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg';
        const photo: PickedPhoto = {
            uri: asset.uri,
            name: asset.fileName ?? `orbital.${ext}`,
            type: asset.mimeType ?? (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'),
        };

        setImageBusy(true);
        setActionError('');
        try {
            const { data } = await uploadOrbitalImage(orbitalId, photo);
            const next = data.orbital?.image;
            setOrbital((o) => (o ? { ...o, image: next ?? o.image } : o));
        } catch (e) {
            setActionError(errMsg(e, "Couldn't upload the photo."));
        } finally {
            setImageBusy(false);
        }
    };

    const removeImage = async () => {
        const ok = await confirmAsync('Remove orbital photo?', 'The orbital goes back to its letter icon.', 'Remove');
        if (!ok) return;
        setImageBusy(true);
        setActionError('');
        try {
            await api(`/${orbitalId}/image`, 'delete');
            setOrbital((o) => (o ? { ...o, image: '', avatar: undefined } : o));
        } catch (e) {
            setActionError(errMsg(e, "Couldn't remove the photo."));
        } finally {
            setImageBusy(false);
        }
    };

    const avatarActions: SheetAction[] = [
        { label: orbitalImage ? 'Change photo' : 'Add photo', Icon: Camera, onPress: changeImage },
        ...(orbitalImage ? [{ label: 'Remove photo', Icon: Trash2, onPress: removeImage, destructive: true }] : []),
    ];

    /* ---------- render ---------- */
    if (!orbital) {
        return (
            <View className="flex-1 bg-black">
                <TopBar title="Orbital" onBack={goBack} />
                {!!loadError && <Text className="mt-10 px-6 text-center text-sm text-neutral-500">{loadError}</Text>}
                <OrbitLoader visible={!loadError} />
            </View>
        );
    }

    const creator = orbital.creator;
    const creatorPic = resolveUrl(creator?.profilePic);

    return (
        <View className="flex-1 bg-black">
            <TopBar title={`${isPrivate ? 'Private' : 'Open'} orbital`} onBack={goBack} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 48 }}
                keyboardShouldPersistTaps="handled"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#ffffff" />}
            >
                <Reveal>
                    <OrbitalAvatar
                        uri={resolveUrl(orbitalImage)}
                        name={orbital.name}
                        editable={viewer.isAdmin}
                        uploading={imageBusy}
                        onPress={() => setAvatarMenuOpen(true)}
                    />
                </Reveal>

                <Reveal delay={120} className="mt-1">
                    <View className="items-center px-6">
                        <EditableText
                            value={orbital.name}
                            editable={viewer.isAdmin}
                            maxLength={50}
                            onSave={saveName}
                            textClassName="text-center text-[26px] font-bold text-white"
                        />
                        <View className="mt-2 w-full">
                            <EditableText
                                multiline
                                allowEmpty
                                value={orbital.description ?? ''}
                                editable={viewer.isAdmin}
                                maxLength={500}
                                placeholder="Add a description"
                                onSave={saveDescription}
                                textClassName="text-center text-sm leading-5 text-neutral-300"
                            />
                        </View>
                    </View>

                    <View className="mt-3 flex-row flex-wrap items-center justify-center gap-2 px-6">
                        <Chip>
                            <VisIcon size={12} color="#a3a3a3" />
                            <Text className="text-[12px] text-neutral-400">{isPrivate ? 'Private' : 'Open'}</Text>
                        </Chip>
                        <Chip>
                            <Users size={12} color="#a3a3a3" />
                            <Text className="text-[12px] text-neutral-400">{orbital.memberCount} members</Text>
                        </Chip>
                        {!!creator && (
                            <Chip>
                                {!!creatorPic && (
                                    <Image source={{ uri: creatorPic }} style={{ width: 16, height: 16, borderRadius: 8 }} />
                                )}
                                <Text className="text-[12px] text-neutral-400">by @{creator.username || 'unknown'}</Text>
                            </Chip>
                        )}
                    </View>

                    {viewerReady && (
                        <View className="mt-5 px-5">
                            {/* only non-members can join */}
                            {!isMember && !isPending && (
                                <ActionButton
                                    accent
                                    Icon={UserPlus}
                                    label={isPrivate ? 'Request to join' : 'Join'}
                                    disabled={busy}
                                    onPress={handleJoin}
                                />
                            )}
                            {/* pending users can cancel their request */}
                            {isPending && (
                                <ActionButton Icon={Clock} label="Requested · Cancel" disabled={busy} onPress={handleCancelRequest} />
                            )}
                            {/* only the creator can destroy */}
                            {isCreator && <ActionButton Icon={Trash2} label="Destroy orbital" disabled={busy} onPress={destroyOrbital} />}
                            {/* admins and normal members can leave */}
                            {isMember && !isCreator && (
                                <ActionButton Icon={LogOut} label="Exit orbital" disabled={busy} onPress={handleLeave} />
                            )}
                        </View>
                    )}

                    {!!actionError && <Text className="mt-3 px-6 text-center text-xs text-[#c98a8a]">{actionError}</Text>}
                    {!!loadError && <Text className="mt-3 px-6 text-center text-xs text-[#c98a8a]">{loadError}</Text>}
                </Reveal>

                <Reveal delay={220} className="mt-6 gap-4 px-5">
                    {!viewerReady ? (
                        <Text className="mt-4 text-center text-sm text-neutral-500">Loading...</Text>
                    ) : !isMember ? (
                        <LockedNotice isPrivate={isPrivate} isPending={isPending} busy={busy} onJoin={handleJoin} />
                    ) : (
                        <>
                            <OrbitalTabs
                                tabs={TAB_KEYS}
                                active={tab}
                                onChange={(key) => swipe.goTo(TAB_KEYS.indexOf(key))}
                                counts={{ posts: posts.length, members: orbital.memberCount, requests: requests.length }}
                            />

                            <SwipePager swipe={swipe} autoHeight minPageHeight={320}>
                                <View key="posts" className="gap-4">
                                    {posts.length === 0 ? (
                                        <Text className="mt-4 text-center text-sm text-neutral-500">
                                            {contentLoading ? 'Loading...' : 'No posts yet.'}
                                        </Text>
                                    ) : (
                                        posts.map((post) => {
                                            const own = !!meId && post.author.id === meId;
                                            return (
                                                <Postcard
                                                    key={post.id}
                                                    {...toPostcardProps(
                                                        { ...post, isLikedByCurrentUser: !!meId && post.likedBy.includes(meId) } as any,
                                                        post.author
                                                    )}
                                                    commentsCount={commentsCountFor(post.id, post.commentsCount)}
                                                    isOwn={own}
                                                    showDelete={own || viewer.role === 'admin'}
                                                    onDelete={deletePost}
                                                    onPressComments={openComments}
                                                    onClickShare={openShare}
                                                />
                                            );
                                        })
                                    )}
                                </View>

                                <View key="members" className="gap-4">
                                    <MembersList members={members} onOpen={openProfile} />
                                </View>

                                {showRequests && (
                                    <View key="requests" className="gap-4">
                                        <RequestsList
                                            requests={requests}
                                            busy={busy}
                                            onOpen={openProfile}
                                            onApprove={handleApprove}
                                            onReject={handleReject}
                                        />
                                    </View>
                                )}
                            </SwipePager>
                        </>
                    )}
                </Reveal>
            </ScrollView>

            <ActionSheet visible={avatarMenuOpen && viewer.isAdmin} onClose={() => setAvatarMenuOpen(false)} actions={avatarActions} />
            {sheets}
        </View>
    );
}