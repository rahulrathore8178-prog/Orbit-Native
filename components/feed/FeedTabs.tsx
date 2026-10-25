import { FEED_TABS, FeedTab } from '@/hooks/feed/useFeedTabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    Extrapolation,
    interpolate,
    SharedValue,
    useAnimatedStyle,
    useSharedValue,
} from 'react-native-reanimated';

const TRACK_PADDING = 4; // matches `p-1` on the track

// Reanimated components don't pick up NativeWind `className` in this project,
// so the pill's look is a real style. All text/layout classes live on plain components.
const styles = StyleSheet.create({
    pill: {
        position: 'absolute',
        top: TRACK_PADDING,
        bottom: TRACK_PADDING,
        left: TRACK_PADDING,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
});

type LabelProps = {
    index: FeedTab;
    label: string;
    selected: boolean;
    position: SharedValue<number>;
    onPress: () => void;
};

function TabLabel({ index, label, selected, position, onPress }: LabelProps) {
    // label fades with the finger, same as the pill
    const fade = useAnimatedStyle(() => ({
        opacity: interpolate(position.get(), [0, 1], index === 0 ? [1, 0.45] : [0.45, 1], Extrapolation.CLAMP),
    }));

    return (
        <Pressable
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            className="flex-1 items-center py-2"
        >
            <Animated.View style={fade}>
                <Text className="text-sm font-semibold tracking-wide text-white">{label}</Text>
            </Animated.View>
        </Pressable>
    );
}

type Props = {
    position: SharedValue<number>;
    active: FeedTab;
    onSelect: (tab: FeedTab) => void;
};

/** Glass segmented control whose pill slides in sync with the pager (and the finger). */
export function FeedTabs({ position, active, onSelect }: Props) {
    const trackWidth = useSharedValue(0);

    const pill = useAnimatedStyle(() => {
        const pillWidth = (trackWidth.get() - TRACK_PADDING * 2) / FEED_TABS.length;
        return { width: pillWidth, transform: [{ translateX: position.get() * pillWidth }] };
    });

    return (
        <View
            onLayout={(e) => trackWidth.set(e.nativeEvent.layout.width)}
            accessibilityRole="tablist"
            className="
                self-center
                w-[90%]
                max-w-[400px]
                flex-row
                rounded-full
                border
                border-white/10
                bg-black/30
                p-1
                "
            >
            <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
            {FEED_TABS.map((label, i) => (
                <TabLabel
                    key={label}
                    index={i as FeedTab}
                    label={label}
                    selected={active === i}
                    position={position}
                    onPress={() => onSelect(i as FeedTab)}
                />
            ))}
        </View>
    );
}
