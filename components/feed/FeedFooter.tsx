import React from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
// adjust to wherever your ChatOrbitLoader file lives
import { OrbitSpinner } from '@/components/chats/ChatOrbitLoader';

const SLOT_H = 76; // fixed height so the list never jumps when the loader appears/disappears

type Props = {
    loading: boolean;
    hasMore: boolean;
    hasItems: boolean;
    /** Height of the floating tab bar (+ safe area), so the loader sits just above it. */
    bottomInset: number;
};

/** List footer: orbit loader while the next page loads, a quiet end marker when there is no more. */
export function FeedFooter({ loading, hasMore, hasItems, bottomInset }: Props) {
    return (
        <View pointerEvents="none" style={{ paddingBottom: bottomInset }}>
            <View style={{ height: SLOT_H, alignItems: 'center', justifyContent: 'center' }}>
                {loading ? (
                    <Animated.View
                        key="loading"
                        entering={FadeIn.duration(220)}
                        exiting={FadeOut.duration(180)}
                        style={{ alignItems: 'center' }}
                    >
                        <OrbitSpinner scale={0.4} />
                        <Text
                            style={{
                                marginTop: 2,
                                color: 'rgba(255,255,255,0.45)',
                                fontSize: 10,
                                letterSpacing: 2.4,
                                textTransform: 'uppercase',
                            }}
                        >
                            Loading more
                        </Text>
                    </Animated.View>
                ) : !hasMore && hasItems ? (
                    <Animated.Text
                        key="end"
                        entering={FadeIn.duration(300)}
                        style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, letterSpacing: 1.6 }}
                    >
                        You're all caught up
                    </Animated.Text>
                ) : null}
            </View>
        </View>
    );
}