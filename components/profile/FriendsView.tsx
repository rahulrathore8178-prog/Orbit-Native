import { Friend } from '@/components/profile/profile';
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import FriendsList from './FriendsList';
import OrbitFriends from './OrbitFriends';

type Mode = 'orbit' | 'list';

type Props = {
    friends: Friend[];
    onOpen: (userId: string) => void;
    defaultMode?: Mode;
};

const SEG_W = 76;
const SEG_H = 32;

export default function FriendsView({ friends, onOpen, defaultMode = 'orbit' }: Props) {
    const [mode, setMode] = useState<Mode>(defaultMode);
    const x = useSharedValue(defaultMode === 'orbit' ? 0 : SEG_W);

    useEffect(() => {
        x.value = withTiming(mode === 'orbit' ? 0 : SEG_W, { duration: 220 });
    }, [mode, x]);

    const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

    return (
        <View style={{ backgroundColor: '#000' }}>
            <View
                style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                }}
            >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>
                    Friends <Text style={{ color: 'rgba(255,255,255,0.45)' }}>{friends.length}</Text>
                </Text>

                <View
                    style={{
                        flexDirection: 'row',
                        padding: 3,
                        borderRadius: 999,
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.08)',
                    }}
                >
                    <Animated.View
                        pointerEvents="none"
                        style={[
                            {
                                position: 'absolute',
                                left: 3,
                                top: 3,
                                width: SEG_W,
                                height: SEG_H,
                                borderRadius: 999,
                                backgroundColor: 'rgba(129,140,248,0.28)',
                            },
                            indicator,
                        ]}
                    />
                    {(['orbit', 'list'] as Mode[]).map((m) => (
                        <Pressable
                            key={m}
                            onPress={() => setMode(m)}
                            accessibilityRole="button"
                            accessibilityState={{ selected: mode === m }}
                            style={{ width: SEG_W, height: SEG_H, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <Text
                                style={{
                                    fontSize: 13,
                                    fontWeight: '600',
                                    color: mode === m ? '#fff' : 'rgba(255,255,255,0.5)',
                                }}
                            >
                                {m === 'orbit' ? 'Orbit' : 'List'}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            </View>

            {mode === 'orbit' ? (
                <OrbitFriends friends={friends} onOpen={onOpen} />
            ) : (
                <FriendsList friends={friends} onOpen={onOpen} />
            )}
        </View>
    );
}