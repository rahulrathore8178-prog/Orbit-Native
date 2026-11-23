import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, { Extrapolation, interpolate, SharedValue, useAnimatedStyle, useSharedValue } from 'react-native-reanimated'

const LABELS = ['Posts', 'Media'] as const
const PAD = 4 // matches p-1 on the track

const styles = StyleSheet.create({
    pill: {
        position: 'absolute',
        top: PAD,
        bottom: PAD,
        left: PAD,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        backgroundColor: 'rgba(255,255,255,0.10)',
    },
})

function Label({ index, label, selected, position, onPress }: {
    index: 0 | 1; label: string; selected: boolean; position: SharedValue<number>; onPress: () => void
}) {
    const fade = useAnimatedStyle(() => ({
        opacity: interpolate(position.get(), [0, 1], index === 0 ? [1, 0.45] : [0.45, 1], Extrapolation.CLAMP),
    }))
    return (
        <Pressable onPress={onPress} accessibilityRole="tab" accessibilityState={{ selected }} className="flex-1 items-center py-2">
            <Animated.View style={fade}>
                <Text className="text-sm font-semibold tracking-wide text-white">{label}</Text>
            </Animated.View>
        </Pressable>
    )
}

export function SharedTabs({ position, active, onSelect }: { position: SharedValue<number>; active: 0 | 1; onSelect: (t: 0 | 1) => void }) {
    const trackW = useSharedValue(0)
    const pill = useAnimatedStyle(() => {
        const w = (trackW.get() - PAD * 2) / LABELS.length
        return { width: w, transform: [{ translateX: position.get() * w }] }
    })
    return (
        <View
            onLayout={(e) => trackW.set(e.nativeEvent.layout.width)}
            accessibilityRole="tablist"
            className="w-[90%] max-w-[400px] flex-row self-center rounded-full border border-white/10 bg-black/30 p-1"
        >
            <Animated.View pointerEvents="none" style={[styles.pill, pill]} />
            {LABELS.map((label, i) => (
                <Label key={label} index={i as 0 | 1} label={label} selected={active === i} position={position} onPress={() => onSelect(i as 0 | 1)} />
            ))}
        </View>
    )
}