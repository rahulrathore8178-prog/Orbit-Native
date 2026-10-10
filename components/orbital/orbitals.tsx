import { ChevronRight, Crown, Globe, Lock, Shield, User, Users } from 'lucide-react-native';
import React, { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { COLORS, GlassPanel, NeoView } from '../sideDrawer/neo';
import { MyOrbital, Orbital, resolveUrl } from './orbitalData';

type Props = {
    orbital: Orbital | MyOrbital;
    onPress?: (orbital: Orbital | MyOrbital) => void;
};

function Chip({ children }: { children: React.ReactNode }) {
    return (
        <NeoView
            pressed
            radius={999}
            contentStyle={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 10,
                paddingVertical: 5,
            }}
        >
            {children}
        </NeoView>
    );
}

const ROLE_META = {
    creator: { label: 'Creator', Icon: Crown },
    admin: { label: 'Admin', Icon: Shield },
    member: { label: 'Member', Icon: User },
} as const;

export default function OrbitalCard({ orbital, onPress }: Props) {
    console.log('Rendering OrbitalCard for orbital:', orbital);
    const [imgFailed, setImgFailed] = useState(false);
    const [avatarFailed, setAvatarFailed] = useState(false);

    const imageUri = resolveUrl(orbital?.image);
    const isPrivate = orbital?.visibility === 'private';
    const VisIcon = isPrivate ? Lock : Globe;

   const creator = (orbital as Orbital)?.author;   // undefined on "my orbitals" items
  const role = (orbital as MyOrbital)?.role;       // undefined on "joined" items
    const avatarUri = resolveUrl(creator?.profilePic);
    const roleMeta = role ? ROLE_META[role] ?? ROLE_META.member : undefined;

    const hasDescription = !!orbital?.description?.trim();

    return (
        <Pressable
            onPress={() => onPress?.(orbital)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${orbital?.name}`}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.985 : 1 }] })}
        >
            <GlassPanel radius={24} style={{ padding: 14 }}>
                {/* top row */}
                <View className="flex-row items-center">
                    <NeoView radius={20} style={{ width: 68, height: 68 }}>
                        {imageUri && !imgFailed ? (
                            <Image
                                source={{ uri: imageUri }}
                                onError={() => setImgFailed(true)}
                                style={{ width: 60, height: 60, borderRadius: 16 }}
                            />
                        ) : (
                            <Text className="text-2xl font-extrabold text-[#E8EAF0]">
                                {(orbital?.name || '?').charAt(0).toUpperCase() || 'Orbital'}
                            </Text>
                        )}
                    </NeoView>

                    <View className="ml-3.5 flex-1">
                        <Text className="text-[17px] font-extrabold text-[#E8EAF0]" numberOfLines={1}>
                            {orbital?.name}
                        </Text>
                        <Text
                            className={`mt-1 text-[13px] leading-[18px] ${hasDescription ? 'text-[#7C8494]' : 'italic text-[#566070]'
                                }`}
                            numberOfLines={2}
                        >
                            {hasDescription ? orbital?.description : 'No description yet'}
                        </Text>
                    </View>

                    <NeoView radius={14} style={{ width: 36, height: 36, marginLeft: 10 }}>
                        <ChevronRight size={18} color={COLORS.text} />
                    </NeoView>
                </View>

                {/* meta row */}
                <View className="mt-3.5 flex-row items-center justify-between">
                    <View className="flex-row items-center gap-2">
                        <Chip>
                            <Users size={13} color={COLORS.muted} />
                            <Text className="text-[12px] font-semibold text-[#E8EAF0]">
                                {orbital.memberCount}
                            </Text>
                        </Chip>
                        <Chip>
                            <VisIcon size={13} color={COLORS.muted} />
                            <Text className="text-[12px] font-semibold text-[#E8EAF0]">
                                {isPrivate ? 'Private' : 'Open'}
                            </Text>
                        </Chip>
                    </View>

                    {creator ? (
                        <View className="flex-row items-center" style={{ maxWidth: '42%' }}>
                            {avatarUri && !avatarFailed ? (
                                <Image
                                    source={{ uri: avatarUri }}
                                    onError={() => setAvatarFailed(true)}
                                    style={{ width: 22, height: 22, borderRadius: 11 }}
                                />
                            ) : (
                                <View
                                    className="items-center justify-center bg-white/10"
                                    style={{ width: 22, height: 22, borderRadius: 11 }}
                                >
                                    <Text className="text-[11px] font-bold text-[#E8EAF0]">
                                        {creator.username.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                            )}
                            <Text className="ml-2 flex-shrink text-[12px] text-[#7C8494]" numberOfLines={1}>
                                @{creator.username}
                            </Text>
                        </View>
                    ) : roleMeta ? (
                        <NeoView
                            accent={role === 'creator'}
                            radius={999}
                            contentStyle={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 12,
                                paddingVertical: 5,
                            }}
                        >
                            <roleMeta.Icon size={13} color={role === 'creator' ? '#fff' : COLORS.text} />
                            <Text
                                className={`text-[12px] font-bold ${role === 'creator' ? 'text-white' : 'text-[#E8EAF0]'
                                    }`}
                            >
                                {roleMeta.label}
                            </Text>
                        </NeoView>
                    ) : null}
                </View>
            </GlassPanel>
        </Pressable>
    );
}