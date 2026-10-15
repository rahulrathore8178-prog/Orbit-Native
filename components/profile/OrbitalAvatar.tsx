import React, { useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import Animated, {
    Easing,
    cancelAnimation,
    useAnimatedStyle,
    useReducedMotion,
    useSharedValue,
    withRepeat,
    withTiming,
} from 'react-native-reanimated';
import { Camera } from 'lucide-react-native';

const AVATAR = 96;
const GLOW = 124;
const STAGE = 208; // the square everything is centred in

// Every element is placed with explicit offsets, so the layout is identical on iOS, Android and web.
const centred = (size: number) => (STAGE - size) / 2;

// size = ring diameter, duration = ms per revolution (0 = static ring), direction: 1 clockwise, -1 counter
const RINGS = [
    { size: 132, duration: 30000, direction: 1, dot: true },
    { size: 170, duration: 44000, direction: -1, dot: true },
    { size: 208, duration: 0, direction: 1, dot: false },
];

type RingProps = (typeof RINGS)[number];

function OrbitRing({ size, duration, direction, dot }: RingProps) {
    const rotation = useSharedValue(0);
    const reduceMotion = useReducedMotion();

    useEffect(() => {
        if (!duration || reduceMotion) return;
        rotation.value = withRepeat(
            withTiming(direction * 360, { duration, easing: Easing.linear }),
            -1,
            false
        );
        return () => cancelAnimation(rotation);
    }, [duration, direction, reduceMotion, rotation]);

    const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

    return (
        <Animated.View
            style={[{ position: 'absolute', top: centred(size), left: centred(size), width: size, height: size }, spin]}
        >
            <View className="h-full w-full rounded-full border border-white/[0.07]" />
            {dot && (
                <View className="absolute h-1.5 w-1.5 rounded-full bg-white/60" style={{ top: -3, left: size / 2 - 3 }} />
            )}
        </Animated.View>
    );
}

type Props = {
    uri?: string;
    name: string;
    editable: boolean;
    uploading: boolean;
    onPress: () => void;
};

export default function OrbitalAvatar({ uri, name, editable, uploading, onPress }: Props) {
    return (
        <View className="self-center" style={{ width: STAGE, height: STAGE }}>
            <View
                className="absolute rounded-full bg-white/[0.03]"
                style={{ top: centred(GLOW), left: centred(GLOW), width: GLOW, height: GLOW }}
            />

            {RINGS.map((ring) => (
                <OrbitRing key={ring.size} {...ring} />
            ))}

            <Pressable
                onPress={onPress}
                disabled={!editable || uploading}
                accessibilityRole="imagebutton"
                accessibilityLabel={editable ? 'Change profile photo' : 'Profile photo'}
                className='backdrop-blur-lg'
                style={{ position: 'absolute', top: centred(AVATAR), left: centred(AVATAR), width: AVATAR, height: AVATAR }}
            >
                <View className="h-full w-full items-center justify-center overflow-hidden rounded-full border-2 border-white/20 bg-neutral-800">
                    {uri ? (
                        <Image source={{ uri }} className="h-full w-full" resizeMode="cover" />
                    ) : (
                        <Text className="text-4xl font-semibold text-white">{name.charAt(0).toUpperCase()}</Text>
                    )}
                    {uploading && (
                        <View className="absolute inset-0 items-center justify-center bg-black/55">
                            <ActivityIndicator color="#fff" />
                        </View>
                    )}
                </View>

                {editable && !uploading && (
                    <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-neutral-900">
                        <Camera size={14} color="#fff" strokeWidth={2} />
                    </View>
                )}
            </Pressable>
        </View>
    );
}