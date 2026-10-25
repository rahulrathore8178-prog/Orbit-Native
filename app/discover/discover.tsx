import Reveal from '@/components/options/Reveal';
import { useDiscover } from '@/hooks/discover/useDiscover'; // adjust to where the hook lives
import { COLORS, GlassPanel, NeoView } from '@/components/ui/neo';
import { API_URL } from '@/lib/utils';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft, Clock, MapPin, Radar, RotateCw, UserPlus } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    Easing,
    FlatList,
    Image,
    Linking,
    Pressable,
    RefreshControl,
    Text,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NearbyUser = ReturnType<typeof useDiscover>['users'][number];

// Backend can return http://localhost:5000/... which a phone can't reach
const resolveUrl = (url?: string | null) =>
    url ? url.replace(/^https?:\/\/localhost:5000/, API_URL) : undefined;

const formatDistance = (m?: number) => {
    if (typeof m !== 'number') return null;
    if (m < 1) return 'Right here';
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
};

/* ------------------------------ small parts ------------------------------ */

function SpinIcon({ spinning }: { spinning: boolean }) {
    const rot = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (!spinning) {
            rot.setValue(0);
            return;
        }
        const loop = Animated.loop(
            Animated.timing(rot, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }),
        );
        loop.start();
        return () => loop.stop();
    }, [spinning, rot]);

    const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
    return (
        <Animated.View style={{ transform: [{ rotate }] }}>
            <RotateCw size={18} color={COLORS.text} />
        </Animated.View>
    );
}

function RadarHero() {
    const rings = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        const anim = Animated.stagger(
            600,
            rings.map((v) =>
                Animated.loop(
                    Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                ),
            ),
        );
        anim.start();
        return () => anim.stop();
    }, [rings]);

    return (
        <View className="items-center">
            <View className="h-[260px] w-full items-center justify-center">
                {rings.map((v, i) => (
                    <Animated.View
                        key={i}
                        style={{
                            position: 'absolute',
                            opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 0] }),
                            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 2] }) }],
                        }}
                    >
                        <View className="h-[120px] w-[120px] rounded-full border border-white/30 bg-white/[0.04]" />
                    </Animated.View>
                ))}
                <NeoView radius={36} style={{ width: 72, height: 72 }}>
                    <Radar size={28} color={COLORS.accent} />
                </NeoView>
            </View>
            <Text className="text-lg font-extrabold text-white">Scanning your surroundings</Text>
            <Text className="mt-1.5 px-10 text-center text-[13px] leading-5 text-white/50">
                Looking for people within 500 m. Keep GPS on.
            </Text>
        </View>
    );
}

function Avatar({ name, uri }: { name?: string; uri?: string | null }) {
    const [broken, setBroken] = useState(false);
    const src = resolveUrl(uri);

    return (
        <View className="rounded-full border border-white/25 p-[3px]">
            {src && !broken ? (
                <Image source={{ uri: src }} onError={() => setBroken(true)} className="h-[52px] w-[52px] rounded-full" />
            ) : (
                <View className="h-[52px] w-[52px] items-center justify-center rounded-full bg-white/10">
                    <Text className="text-lg font-bold text-white">{name?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
            )}
        </View>
    );
}

function FriendAction({ status, onAdd }: { status?: string; onAdd: () => void }) {
    if (status === 'friends') {
        return (
            <View className="flex-row items-center rounded-full bg-emerald-400/10 px-3 py-2">
                <Check size={14} color="#34d399" />
                <Text className="ml-1 text-xs font-bold text-emerald-300">Friends</Text>
            </View>
        );
    }
    if (status === 'pending') {
        return (
            <View className="flex-row items-center rounded-full bg-white/5 px-3 py-2">
                <Clock size={14} color={COLORS.muted} />
                <Text className="ml-1 text-xs font-bold text-white/50">Pending</Text>
            </View>
        );
    }
    return (
        <Pressable onPress={onAdd} hitSlop={8} accessibilityRole="button" accessibilityLabel="Send friend request">
            {({ pressed }) => (
                <NeoView
                    radius={16}
                    pressed={pressed}
                    contentStyle={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' }}
                >
                    <UserPlus size={14} color={COLORS.text} />
                    <Text className="ml-1.5 text-xs font-bold text-white">Add</Text>
                </NeoView>
            )}
        </Pressable>
    );
}

function MessagePanel({
    title,
    body,
    actionLabel,
    onAction,
}: {
    title: string;
    body: string;
    actionLabel: string;
    onAction: () => void;
}) {
    return (
        <GlassPanel radius={28} style={{ padding: 28, alignItems: 'center', gap: 12 }}>
            <NeoView radius={28} style={{ width: 56, height: 56 }}>
                <Radar size={24} color={COLORS.muted} />
            </NeoView>
            <Text className="text-center text-base font-extrabold text-white">{title}</Text>
            <Text className="text-center text-[13px] leading-5 text-white/50">{body}</Text>
            <Pressable onPress={onAction} className="mt-1">
                {({ pressed }) => (
                    <NeoView radius={18} pressed={pressed} contentStyle={{ paddingHorizontal: 24, paddingVertical: 12 }}>
                        <Text className="text-sm font-bold text-white">{actionLabel}</Text>
                    </NeoView>
                )}
            </Pressable>
        </GlassPanel>
    );
}

/* --------------------------------- screen -------------------------------- */

export default function DiscoverScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { users, error, isScanning, scan, addFriend } = useDiscover();

    const firstScan = isScanning && users.length === 0;
    const hasUsers = users.length > 0;

    const onAdd = (id: string) => {
        Haptics.selectionAsync().catch(() => { });
        addFriend(id);
    };

    return (
        <View className="flex-1 bg-black">
            {/* soft colour behind the glass so the blur has something to catch */}
            <View pointerEvents="none" className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/15" />
            <View pointerEvents="none" className="absolute -left-28 top-80 h-72 w-72 rounded-full bg-sky-500/10" />

            {/* header */}
            <View className="px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
                <View className="flex-row items-center">
                    {router.canGoBack() ? (
                        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Go back" className="mr-3">
                            {({ pressed }) => (
                                <NeoView radius={22} pressed={pressed} style={{ width: 44, height: 44 }}>
                                    <ChevronLeft size={20} color={COLORS.text} />
                                </NeoView>
                            )}
                        </Pressable>
                    ) : null}

                    <View className="flex-1">
                        <Text className="text-[28px] font-extrabold text-white">Discover</Text>
                        <Text className="mt-0.5 text-[13px] text-white/50">People within 500 m of you</Text>
                    </View>

                    <Pressable onPress={scan} disabled={isScanning} hitSlop={10} accessibilityLabel="Scan again">
                        {({ pressed }) => (
                            <NeoView radius={22} pressed={pressed || isScanning} style={{ width: 44, height: 44 }}>
                                <SpinIcon spinning={isScanning} />
                            </NeoView>
                        )}
                    </Pressable>
                </View>

                {hasUsers ? (
                    <View className="mt-4 flex-row items-center self-start rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                        <View className="mr-2 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                        <Text className="text-xs font-semibold text-white/70">
                            {users.length} {users.length === 1 ? 'person' : 'people'} nearby
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* body */}
            {firstScan ? (
                <View className="flex-1 justify-center pb-24">
                    <RadarHero />
                </View>
            ) : error && !hasUsers ? (
                <View className="px-5 pt-6">
                    <MessagePanel
                        title={error.code === 'PERMISSION_DENIED' ? 'Location is off' : 'Couldn’t scan'}
                        body={error.message}
                        actionLabel={error.code === 'PERMISSION_DENIED' ? 'Open settings' : 'Try again'}
                        onAction={error.code === 'PERMISSION_DENIED' ? () => Linking.openSettings() : scan}
                    />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(u) => u._id}
                    showsVerticalScrollIndicator={false}
                    contentContainerClassName="px-5"
                    contentContainerStyle={{ paddingBottom: insets.bottom + 32, flexGrow: 1 }}
                    ItemSeparatorComponent={() => <View className="h-3" />}
                    refreshControl={
                        <RefreshControl
                            refreshing={isScanning && hasUsers}
                            onRefresh={scan}
                            tintColor="#ffffff"
                            colors={[COLORS.accent]}
                            progressBackgroundColor={COLORS.surface}
                        />
                    }
                    ListEmptyComponent={
                        <MessagePanel
                            title="No one within 500 m"
                            body="Nobody’s around right now. Try again from a busier spot."
                            actionLabel="Scan again"
                            onAction={scan}
                        />
                    }
                    renderItem={({ item, index }: { item: NearbyUser; index: number }) => {
                        const distance = formatDistance(item.distance);
                        return (
                            <Reveal delay={Math.min(index, 8) * 70}>
                                <GlassPanel radius={24} style={{ padding: 14 }}>
                                    <Pressable
                                        onPress={() => router.push(`/user/${item._id}`)}
                                        className="flex-row items-center"
                                        accessibilityRole="button"
                                        accessibilityLabel={`Open ${item.username}'s profile`}
                                    >
                                        <Avatar name={item.username} uri={item.profilePicture} />

                                        <View className="ml-3.5 flex-1">
                                            <Text numberOfLines={1} className="text-[16px] font-bold text-white">
                                                {item.username}
                                            </Text>
                                            {distance ? (
                                                <View className="mt-1.5 flex-row items-center self-start rounded-full bg-white/5 px-2.5 py-1">
                                                    <MapPin size={11} color={COLORS.muted} />
                                                    <Text className="ml-1 text-[11px] font-semibold text-white/60">{distance}</Text>
                                                </View>
                                            ) : null}
                                        </View>

                                        <FriendAction status={item.friendStatus} onAdd={() => onAdd(item._id)} />
                                    </Pressable>
                                </GlassPanel>
                            </Reveal>
                        );
                    }}
                />
            )}
        </View>
    );
}