import { LIKE_COLOR } from '@/constants/flares/contants';
import type { FlareHandlers, FlarePost } from '@/constants/flares/types';
import { usePostActions } from '@/hooks/feed/usePostActions';
import { useFlareLayout } from '@/hooks/flares/useFlaresLayout';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, GestureResponderEvent, Platform, Pressable, View } from 'react-native';
import { FlareActions } from './FlareActions';
import { FlareAuthorRow } from './FlareAuthorRow';
import { FlareCaption } from './FlareCaption';
import { FlareControls } from './FlareControls';
import { FlareMedia } from './FlareMedia';
import { resolveMedia } from './flaresUtils';

const DOUBLE_TAP_MS = 240;

type Props = {
    post: FlarePost;
    active: boolean;
    near: boolean;
    pageH: number;
    muted: boolean;
    isFollowing: boolean;
    handlers: FlareHandlers;
};

function FlareItemBase({ post, active, near, pageH, muted, isFollowing, handlers }: Props) {
    const { width, topChrome, actionsBottom } = useFlareLayout();
    const media = useMemo(() => resolveMedia(post), [post.video, post.image, post.voiceNote, post.mediaWidth, post.mediaHeight]);
    const isVideo = media?.type === 'video';
    const actions = usePostActions(post);

    const [paused, setPaused] = useState(false);
    const playing = active && !paused;

    const lastTap = useRef(0);
    const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const burstScale = useRef(new Animated.Value(0)).current;
    const burstOpacity = useRef(new Animated.Value(0)).current;
    const pauseAnim = useRef(new Animated.Value(0)).current;
    const [burst, setBurst] = useState({ x: 0, y: 0, rot: 0 });

    useEffect(() => { if (!active) setPaused(false); }, [active]);

    useEffect(() => {
        Animated.spring(pauseAnim, { toValue: paused && isVideo ? 1 : 0, useNativeDriver: true, damping: 14, stiffness: 220, mass: 0.7 }).start();
    }, [paused, isVideo, pauseAnim]);

    useEffect(() => () => { if (tapTimer.current) clearTimeout(tapTimer.current); }, []);

    const playBurst = (x: number, y: number) => {
        setBurst({ x, y, rot: Math.random() * 30 - 15 });
        burstScale.setValue(0.4);
        burstOpacity.setValue(1);
        Animated.parallel([
            Animated.spring(burstScale, { toValue: 1, useNativeDriver: true, damping: 9, stiffness: 200, mass: 0.6 }),
            Animated.sequence([
                Animated.delay(420),
                Animated.timing(burstOpacity, { toValue: 0, duration: 240, useNativeDriver: true }),
            ]),
        ]).start();
    };

    const onTap = (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        const now = Date.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
            if (tapTimer.current) clearTimeout(tapTimer.current);
            lastTap.current = 0;
            playBurst(locationX, locationY);
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => { });
            actions.like(true);
            return;
        }
        lastTap.current = now;
        tapTimer.current = setTimeout(() => {
            lastTap.current = 0;
            if (isVideo) setPaused((p) => !p);
        }, DOUBLE_TAP_MS);
    };

    if (!media) return <View className="bg-black" style={{ width, height: pageH }} />;

    return (
        <View className="overflow-hidden bg-black" style={{ width, height: pageH }}>
            <FlareMedia media={media} pageH={pageH} active={active} near={near} playing={playing} muted={muted} />

            {/* full-screen tap layer sits under all the UI */}
            <Pressable className="absolute inset-0" onPress={onTap} />

            {/* scrims fade to transparent, so nothing ever looks cut off at the bottom */}
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: topChrome + 150 }}
            />
            <LinearGradient
                pointerEvents="none"
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: actionsBottom + 230 }}
            />

            <View pointerEvents="box-none" className="absolute inset-x-0 top-0" style={{ paddingTop: topChrome }}>
                <FlareAuthorRow post={post} isFollowing={isFollowing} handlers={handlers} />
                {isVideo && (
                    <FlareControls
                        paused={paused}
                        muted={muted}
                        onTogglePause={() => setPaused((p) => !p)}
                        onToggleMute={handlers.onToggleMute}
                    />
                )}
            </View>

            <View pointerEvents="box-none" className="absolute inset-x-0 bottom-0 px-4" style={{ paddingBottom: actionsBottom }}>
                <FlareCaption post={post} onHashtag={handlers.onHashtag} />
                <FlareActions postId={post.id} actions={actions} onComment={handlers.onOpenComments} onShare={handlers.onShare} />
            </View>

            <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                <Animated.View
                    style={{
                        opacity: pauseAnim,
                        transform: [{ scale: pauseAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                    }}
                >
                    <View className="h-20 w-20 items-center justify-center rounded-full bg-black/45">
                        <Ionicons name="play" size={36} color="#fff" style={{ marginLeft: 4 }} />
                    </View>
                </Animated.View>
            </View>

            <View pointerEvents="none" className="absolute inset-0">
                <Animated.View
                    style={{
                        position: 'absolute',
                        left: burst.x - 52,
                        top: burst.y - 52,
                        opacity: burstOpacity,
                        transform: [{ scale: burstScale }, { rotate: `${burst.rot}deg` }],
                    }}
                >
                    <Ionicons name="heart" size={104} color={LIKE_COLOR} />
                </Animated.View>
            </View>
        </View>
    );
}

export const FlareItem = memo(FlareItemBase);