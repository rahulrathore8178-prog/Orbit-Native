import React, { useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Crown, Globe, Lock, Shield, User, Users } from 'lucide-react-native';
import { COLORS, GlassPanel, NeoView } from '../sideDrawer/neo';
import { MyOrbital, Orbital, resolveUrl } from './orbitalData';

const ROLE_META = {
    creator: { label: 'Creator', Icon: Crown },
    admin: { label: 'Admin', Icon: Shield },
    member: { label: 'Member', Icon: User },
} as const;

function Chip({ children }: { children: React.ReactNode }) {
    return (
        <NeoView
            pressed
            radius={999}
            contentStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 12,
                paddingVertical: 6,
            }}
        >
            {children}
        </NeoView>
    );
}

export default function OrbitalDetail() {
    const { id, data } = useLocalSearchParams<{ id: string; data?: string }>();
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const [imgFailed, setImgFailed] = useState(false);

    const orbital = useMemo<Orbital | MyOrbital | null>(() => {
        try {
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    }, [data]);

    const imageUri = resolveUrl(orbital?.image);
    const isPrivate = orbital?.visibility === 'private';
    const VisIcon = isPrivate ? Lock : Globe;
    const creator = orbital ? (orbital as Orbital)?.creator : undefined;
    const role = orbital ? (orbital as MyOrbital).role : undefined;
    const roleMeta = role ? ROLE_META[role] ?? ROLE_META.member : undefined;

    return (
        <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <View className="flex-row items-center justify-between px-4 pt-3">
                <Pressable onPress={() => router.back()} hitSlop={8} accessibilityLabel="Go back">
                    {({ pressed }) => (
                        <NeoView radius={20} pressed={pressed} style={{ width: 42, height: 42 }}>
                            <ChevronLeft size={22} color={COLORS.text} />
                        </NeoView>
                    )}
                </Pressable>
                <Text
                    className="flex-1 px-3 text-center text-[18px] font-extrabold text-[#E8EAF0]"
                    numberOfLines={1}
                >
                    {orbital?.name ?? 'Orbital'}
                </Text>
                <View style={{ width: 42 }} />
            </View>

            {!orbital ? (
                <View className="px-4 pt-6">
                    <GlassPanel radius={24} style={{ padding: 20 }}>
                        <Text className="text-center text-[14px] text-[#7C8494]">
                            Couldn't load this orbital (id: {id}).
                        </Text>
                    </GlassPanel>
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 24 }}
                >
                    {/* Cover + name */}
                    <GlassPanel radius={28} style={{ padding: 20, alignItems: 'center' }}>
                        <NeoView radius={36} style={{ width: 112, height: 112 }}>
                            {imageUri && !imgFailed ? (
                                <Image
                                    source={{ uri: imageUri }}
                                    onError={() => setImgFailed(true)}
                                    style={{ width: 100, height: 100, borderRadius: 30 }}
                                />
                            ) : (
                                <Text className="text-4xl font-extrabold text-[#E8EAF0]">
                                    {(orbital.name || '?').charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </NeoView>

                        <Text className="mt-4 text-center text-[24px] font-extrabold text-[#E8EAF0]">
                            {orbital.name}
                        </Text>

                        <View className="mt-3 flex-row items-center gap-2">
                            <Chip>
                                <Users size={14} color={COLORS.muted} />
                                <Text className="text-[13px] font-semibold text-[#E8EAF0]">
                                    {orbital.memberCount} {orbital.memberCount === 1 ? 'member' : 'members'}
                                </Text>
                            </Chip>
                            <Chip>
                                <VisIcon size={14} color={COLORS.muted} />
                                <Text className="text-[13px] font-semibold text-[#E8EAF0]">
                                    {isPrivate ? 'Private' : 'Open'}
                                </Text>
                            </Chip>
                        </View>
                    </GlassPanel>

                    {/* About */}
                    <GlassPanel radius={24} style={{ padding: 18, marginTop: 14 }}>
                        <Text className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[#7C8494]">
                            About
                        </Text>
                        <Text className="text-[15px] leading-[22px] text-[#E8EAF0]">
                            {orbital.description?.trim() ? orbital.description : 'No description yet.'}
                        </Text>
                    </GlassPanel>

                    {/* Creator (joined tab) or your role (my orbitals tab) */}
                    {creator ? (
                        <GlassPanel radius={24} style={{ padding: 18, marginTop: 14 }}>
                            <Text className="mb-1 text-[13px] font-bold uppercase tracking-wider text-[#7C8494]">
                                Created by
                            </Text>
                            <Text className="text-[16px] font-bold text-[#E8EAF0]">@{creator.username}</Text>
                        </GlassPanel>
                    ) : roleMeta ? (
                        <GlassPanel radius={24} style={{ padding: 18, marginTop: 14 }}>
                            <Text className="mb-2 text-[13px] font-bold uppercase tracking-wider text-[#7C8494]">
                                Your role
                            </Text>
                            <View className="flex-row">
                                <NeoView
                                    accent={role === 'creator'}
                                    radius={999}
                                    contentStyle={{
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 6,
                                        paddingHorizontal: 14,
                                        paddingVertical: 6,
                                    }}
                                >
                                    <roleMeta.Icon size={14} color={role === 'creator' ? '#fff' : COLORS.text} />
                                    <Text
                                        className={`text-[13px] font-bold ${role === 'creator' ? 'text-white' : 'text-[#E8EAF0]'
                                            }`}
                                    >
                                        {roleMeta.label}
                                    </Text>
                                </NeoView>
                            </View>
                        </GlassPanel>
                    ) : null}
                </ScrollView>
            )}
        </View>
    );
}