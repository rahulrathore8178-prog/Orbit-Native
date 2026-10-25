import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Clock, MessageCircle, Phone, UserCheck, UserPlus } from 'lucide-react-native';
import { COLORS, NeoView } from '@/components/ui/neo';
import IconButton from '@/components/options/IconButton';
import { FriendStatus } from '@/components/profile/profile';


type Props = {
    friendStatus: FriendStatus;
    onToggleFriend: () => void;
    onMessage: () => void;
    onCall: () => void;
};

// One place that decides what the friend button looks like for each status
const FRIEND_BUTTON: Record<
    FriendStatus,
    { label: string; Icon: typeof UserPlus; accent: boolean; iconColor: string }
> = {
    none: { label: 'Add friend', Icon: UserPlus, accent: true, iconColor: '#fff' },
    request_sent: { label: 'Requested', Icon: Clock, accent: false, iconColor: COLORS.text },
    request_received: { label: 'Accept request', Icon: UserCheck, accent: true, iconColor: '#fff' },
    friends: { label: 'Friends', Icon: UserCheck, accent: false, iconColor: COLORS.text },
    self: { label: '', Icon: UserPlus, accent: false, iconColor: COLORS.text },
};

/** Only rendered on other people's profiles. */
export default function ProfileActions({ friendStatus, onToggleFriend, onMessage, onCall, locked }: Props) {
    const { label, Icon: FriendIcon, accent, iconColor } = FRIEND_BUTTON[friendStatus] ?? FRIEND_BUTTON.none;

    return (
        <View className="flex-row items-center gap-3 px-5">
            <Pressable className="flex-1" onPress={onToggleFriend} accessibilityRole="button" accessibilityLabel={label}>
                {({ pressed }) => (
                    <NeoView accent={accent} radius={22} pressed={pressed} style={{ height: 44 }}>
                        <View className="flex-row items-center gap-2">
                            <FriendIcon size={16} color={iconColor} strokeWidth={2} />
                            <Text className="text-[15px] font-semibold text-white">{label}</Text>
                        </View>
                    </NeoView>
                )}
            </Pressable>

            {!locked && (
                <>
                    <Pressable className="flex-1" onPress={onMessage} accessibilityRole="button">
                        {({ pressed }) => (
                            <NeoView radius={22} pressed={pressed} style={{ height: 44 }}>
                                <View className="flex-row items-center gap-2">
                                    <MessageCircle size={16} color={COLORS.text} strokeWidth={2} />
                                    <Text className="text-[15px] font-semibold text-white">Message</Text>
                                </View>
                            </NeoView>
                        )}
                    </Pressable>


                    <IconButton Icon={Phone} label="Call" onPress={onCall} />
                </>
            )}
        </View>
    );
}