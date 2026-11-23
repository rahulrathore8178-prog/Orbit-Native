import React, { useCallback, useEffect, useRef } from 'react';
import { Animated, BackHandler, StyleSheet } from 'react-native';
import { FlarePager } from './FlarePager';
import type { FlarePost } from '@/constants/flares/types';

type Props = {
    posts: FlarePost[];
    initialIndex: number;
    onClose: () => void;
    onEndReached?: () => void;
    viewsPaused?: boolean;
    onOpenComments: (id: string) => void;
    onShare: (id: string) => void;
};

export function FlareViewerOverlay({ posts, initialIndex, onClose, onEndReached, viewsPaused, onOpenComments, onShare }: Props) {
    const p = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(p, { toValue: 1, useNativeDriver: true, damping: 22, stiffness: 220, mass: 0.9 }).start();
    }, [p]);

    const close = useCallback(() => {
        Animated.timing(p, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
            if (finished) onClose();
        });
    }, [p, onClose]);

    useEffect(() => {
        const sub = BackHandler.addEventListener('hardwareBackPress', () => {
            close();
            return true;
        });
        return () => sub.remove();
    }, [close]);

    return (
        <Animated.View
            style={[
                StyleSheet.absoluteFillObject,
                {
                    zIndex: 100,
                    elevation: 100,
                    backgroundColor: '#000',
                    opacity: p,
                    transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }],
                },
            ]}
        >
            <FlarePager
                posts={posts}
                initialIndex={initialIndex}
                hasTabBar={false}
                title="Flares"
                onBack={close}
                onEndReached={onEndReached}
                viewsPaused={viewsPaused}
                onOpenComments={onOpenComments}
                onShare={onShare}
            />
        </Animated.View>
    );
}