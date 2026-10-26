import { FriendRequest } from '@/components/profile/profile';
import { GlassPanel } from '@/components/ui/neo';
import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';

type Props = {
    requests: FriendRequest[];
    onOpen: (userId: string) => void;
    onAccept: (requestId: string) => void;
    onReject: (requestId: string) => void;
};

/** Incoming friend requests. Only rendered on your own private profile. Same look as FriendsList. */
export default function RequestsList({ requests, onOpen, onAccept, onReject }: Props) {
    if (requests.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No pending requests.</Text>;
    }

    return (
        <GlassPanel radius={24} style={{ padding: 8 }}>
            {requests.map(({ requestId, user }) => (
                <View key={requestId} className="flex-row items-center gap-3 rounded-[18px] p-2.5">
                    <Pressable
                        onPress={() => onOpen(user.id)}
                        accessibilityRole="button"
                        className="flex-1 flex-row items-center gap-3"
                    >
                        <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-neutral-800">
                            {user.profilePic ? (
                                <Image source={{ uri: user.profilePic }} className="h-full w-full" resizeMode="cover" />
                            ) : (
                                <Text className="text-base font-semibold text-white">
                                    {user.username.charAt(0).toUpperCase()}
                                </Text>
                            )}
                        </View>
                        <Text className="flex-1 text-base font-semibold text-white" numberOfLines={1}>
                            {user.username}
                        </Text>
                    </Pressable>

                    <Pressable
                        onPress={() => onAccept(requestId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Accept ${user.username}`}
                        className="rounded-full bg-neutral-100 px-4 py-2 active:opacity-80"
                    >
                        <Text className="text-[13px] font-semibold text-black">Accept</Text>
                    </Pressable>
                    <Pressable
                        onPress={() => onReject(requestId)}
                        accessibilityRole="button"
                        accessibilityLabel={`Decline ${user.username}`}
                        className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 active:opacity-80"
                    >
                        <Text className="text-[13px] font-semibold text-white/70">Decline</Text>
                    </Pressable>
                </View>
            ))}
        </GlassPanel>
    );
}