import { Pressable, Text, View } from 'react-native';
import { Lock } from 'lucide-react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import type { FriendStatus } from '@/components/profile/profile';

const COPY: Partial<Record<FriendStatus, { body: string; cta?: string }>> = {
    none: { body: 'Send a friend request to see their posts.', cta: 'Send friend request' },
    request_sent: { body: "Your request is on its way. You'll see their posts once they accept." },
    request_received: { body: "They've sent you a request. Accept it to see their posts." },
};

/** Shown instead of the tabs when a profile is private and you aren't friends yet. */
export default function PrivateNotice({
    friendStatus,
    onAction,
}: {
    friendStatus: FriendStatus;
    onAction?: () => void;
}) {
    const copy = COPY[friendStatus] ?? COPY.none!;

    return (
        <Animated.View
            entering={FadeInDown.springify().damping(20)}
            className="items-center rounded-3xl border border-white/10 bg-white/[0.04] px-6 py-10"
        >
            <View className="h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                <Lock size={22} color="rgba(255,255,255,0.85)" />
            </View>
            <Text className="mt-5 text-[17px] font-semibold text-white">This profile is private</Text>
            <Text className="mt-2 text-center text-[14px] leading-[21px] text-white/50">{copy.body}</Text>

            {copy.cta && onAction ? (
                <Pressable
                    onPress={onAction}
                    accessibilityRole="button"
                    className="mt-6 rounded-full bg-neutral-100 px-6 py-3 active:opacity-80"
                >
                    <Text className="text-[14px] font-semibold text-black">{copy.cta}</Text>
                </Pressable>
            ) : null}
        </Animated.View>
    );
}