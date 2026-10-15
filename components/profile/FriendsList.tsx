import { Friend } from '@/components/profile/profile';
import { GlassPanel } from '@/components/ui/neo';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

type Props = {
    friends: Friend[];
    onOpen: (userId: string) => void;
};

export default function FriendsList({ friends, onOpen }: Props) {
    if (friends.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No friends yet.</Text>;
    }

    return (
        <GlassPanel radius={24} style={{ padding: 8 }}>
            {friends.map((friend) => (
                <Pressable key={friend.id} onPress={() => onOpen(friend.id)} accessibilityRole="button">
                    {({ pressed }) => (
                        <View className={`flex-row items-center gap-3 rounded-[18px] p-2.5 ${pressed ? 'bg-white/5' : ''}`}>
                            <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-neutral-800">
                                {friend.profilePic ? (
                                    <Image source={{ uri: friend.profilePic }} className="h-full w-full" resizeMode="cover" />
                                ) : (
                                    <Text className="text-base font-semibold text-white">{friend.username.charAt(0).toUpperCase()}</Text>
                                )}
                            </View>
                            <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                                {friend.username}
                            </Text>
                        </View>
                    )}
                </Pressable>
            ))}
        </GlassPanel>
    );
}