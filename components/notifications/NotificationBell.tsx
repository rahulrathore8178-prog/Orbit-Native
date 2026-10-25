import { useEffect } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Bell } from 'lucide-react-native';
import Animated, {
    Easing,
    ZoomIn,
    ZoomOut,
    cancelAnimation,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSelector } from 'react-redux';
import { useAppDispatch } from '@/redux/store';
import { fetchNotifications, hydrateSeen, selectHasUnseen } from '@/redux/slice/notifications/notificationsSlice';

const POLL_MS = 30_000;

/**
 * Keeps notifications fresh: loads once, then re-checks every 30s and whenever the app
 * comes back to the foreground. If you have a socket, dispatch notificationReceived(item)
 * from it and you can raise POLL_MS or remove the interval.
 */
function useNotificationsSync() {
    const dispatch = useAppDispatch();
    useEffect(() => {
        dispatch(hydrateSeen());
        const pull = () => dispatch(fetchNotifications({ silent: true }));
        pull();
        const timer = setInterval(pull, POLL_MS);
        const sub = AppState.addEventListener('change', (s) => s === 'active' && pull());
        return () => {
            clearInterval(timer);
            sub.remove();
        };
    }, [dispatch]);
}

export default function NotificationBell() {
    useNotificationsSync();
    const hasUnseen = useSelector(selectHasUnseen);

    const press = useSharedValue(1);
    const swing = useSharedValue(0);
    const pulse = useSharedValue(0);

    // a new notification: the bell rings once and the red mark starts a soft pulse
    useEffect(() => {
        if (hasUnseen) {
            swing.value = withSequence(
                withTiming(14, { duration: 90 }),
                withRepeat(withTiming(-14, { duration: 150 }), 4, true),
                withTiming(0, { duration: 90 }),
            );
            pulse.value = 0;
            pulse.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.out(Easing.ease) }), -1, false);
        } else {
            cancelAnimation(pulse);
            pulse.value = 0;
        }
    }, [hasUnseen, swing, pulse]);

    const bellStyle = useAnimatedStyle(() => ({
        transform: [{ scale: press.value }, { rotate: `${swing.value}deg` }],
    }));
    const ringStyle = useAnimatedStyle(() => ({
        opacity: interpolate(pulse.value, [0, 1], [0.55, 0]),
        transform: [{ scale: interpolate(pulse.value, [0, 1], [1, 2.8]) }],
    }));

    return (
        <Pressable
            onPress={() => {
                Haptics.selectionAsync();
                router.push('/notifications');
            }}
            onPressIn={() => (press.value = withSpring(0.88, { damping: 15, stiffness: 400 }))}
            onPressOut={() => (press.value = withSpring(1, { damping: 15, stiffness: 400 }))}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hasUnseen ? 'Notifications, new' : 'Notifications'}
            className="h-9 w-9 items-end justify-center"
        >
            <Animated.View style={bellStyle}>
                <Bell color="white" size={26} />
            </Animated.View>

            {hasUnseen && (
                <Animated.View
                    entering={ZoomIn.springify().damping(12)}
                    exiting={ZoomOut.duration(160)}
                    className="absolute right-0 top-0.5 h-3 w-3 items-center justify-center"
                >
                    <Animated.View style={ringStyle} className="absolute h-3 w-3 rounded-full bg-rose-500" />
                    <View className="h-2.5 w-2.5 rounded-full border-[1.5px] border-black bg-rose-500" />
                </Animated.View>
            )}
        </Pressable>
    );
}
