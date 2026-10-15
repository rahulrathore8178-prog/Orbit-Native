import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CAPSULE, COLORS } from '../../constants/capsule/constants';
import { useCapsuleProgress } from '../../hooks/capsule/useCapsuleProgress';
import type { Capsule, CapsuleGroup, Rect } from '../../constants/capsule/types';
import { GlassSheet } from './GlassSheet';
import { CapsuleHeader } from './CapsuleHeader';
import { CommentsPanel } from './CommentsPanel';
import { HeartBurst, useHeartBurst } from './HeartBurst';
import { InsightsPanel, InsightsTab } from './InsightsPanel';
import { OwnerActionBar } from './OwnerActionBar';
import { ViewerActionBar } from './ViewerActionBar';

export interface CapsuleViewerProps {
  visible: boolean;
  groups: CapsuleGroup[];
  startUserId: string;
  origin: Rect | null; // tray pill rect, so the viewer grows out of it
  currentUserId: string;
  onClose: () => void;
  onViewed: (capsuleId: string) => void;
  onToggleLike: (capsuleId: string) => void;
  onToggleSave: (capsuleId: string) => void;
  onDelete: (capsuleId: string) => Promise<void>;
  onCommentAdded: (capsuleId: string) => void;
  onSend?: (capsule: Capsule) => void; // default: system share sheet
}

type SheetState = { kind: 'comments' } | { kind: 'insights'; tab: InsightsTab } | null;

const startIndex = (g: CapsuleGroup | undefined, ownId: string) => {
  if (!g || g.user.id === ownId) return 0;
  const i = g.capsules.findIndex((c) => !c.seen);
  return i === -1 ? 0 : i;
};

export function CapsuleViewer(props: CapsuleViewerProps) {
  if (!props.visible) return null;
  return <ViewerContent {...props} />;
}

function ViewerContent({
  groups,
  startUserId,
  origin,
  currentUserId,
  onClose,
  onViewed,
  onToggleLike,
  onToggleSave,
  onDelete,
  onCommentAdded,
  onSend,
}: CapsuleViewerProps) {
  const { width: W, height: H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const FINAL = useMemo(
    () => ({
      x: 8,
      y: insets.top + 4,
      w: W - 16,
      h: H - insets.top - insets.bottom - 8,
    }),
    [W, H, insets.top, insets.bottom],
  );

  // ── state ────────────────────────────────────────────────
  const [gid, setGid] = useState(startUserId);
  const [ci, setCi] = useState(() =>
    startIndex(groups.find((g) => g.user.id === startUserId), currentUserId),
  );
  const [sheet, setSheet] = useState<SheetState>(null);
  const [held, setHeld] = useState(false);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [restartTick, setRestartTick] = useState(0);
  const lastSheet = useRef<SheetState>(null);
  if (sheet) lastSheet.current = sheet;
  const closing = useRef(false);
  const pending = useRef<(() => void) | null>(null);

  const gi = groups.findIndex((g) => g.user.id === gid);
  const group = groups[gi];
  const capsule = group?.capsules[ci];
  const isOwn = group?.user.id === currentUserId;
  const hasNextGroup = gi >= 0 && gi < groups?.length - 1;
  const hasPrevGroup = gi > 0;
  const loaded = !!capsule && loadedId === capsule.id;

  // ── shared values ────────────────────────────────────────
  const fallback = { x: W / 2 - 30, y: H / 2 - 50, width: 60, height: 100 };
  const o = origin ?? fallback;
  const open = useSharedValue(0);
  const ox = useSharedValue(o.x);
  const oy = useSharedValue(o.y);
  const ow = useSharedValue(o.width);
  const oh = useSharedValue(o.height);
  const dragY = useSharedValue(0);
  const contentX = useSharedValue(0);
  const contentOpacity = useSharedValue(1);
  const axis = useSharedValue(0); // 0 undecided · 1 horizontal · 2 vertical
  const heart = useHeartBurst();

  // ── open animation ───────────────────────────────────────
  useEffect(() => {
    open.value = withSpring(1, CAPSULE.OPEN_SPRING);
  }, [open]);

  // ── close animation (shrinks back into the tray pill) ────
  const finishClose = useCallback(() => onClose(), [onClose]);
  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setSheet(null);
    if (!origin || gid !== startUserId) {
      ox.value = fallback.x;
      oy.value = fallback.y;
      ow.value = fallback.width;
      oh.value = fallback.height;
    }
    dragY.value = withTiming(0, { duration: CAPSULE.CLOSE_MS });
    open.value = withTiming(
      0,
      { duration: CAPSULE.CLOSE_MS, easing: Easing.in(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishClose)();
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, gid, startUserId, finishClose]);

  // ── slide transition between users ───────────────────────
  const finishSlide = useCallback(
    (dir: 1 | -1) => {
      pending.current?.();
      pending.current = null;
      contentX.value = dir * W * 0.4;
      contentOpacity.value = 0;
      contentX.value = withSpring(0, { damping: 22, stiffness: 220 });
      contentOpacity.value = withTiming(1, { duration: 180 });
    },
    [W, contentX, contentOpacity],
  );

  const slideTo = useCallback(
    (dir: 1 | -1, commit: () => void) => {
      pending.current = commit;
      contentOpacity.value = withTiming(0, { duration: 150 });
      contentX.value = withTiming(
        -dir * W,
        { duration: 150, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) runOnJS(finishSlide)(dir);
        },
      );
    },
    [W, contentX, contentOpacity, finishSlide],
  );

  // ── navigation ───────────────────────────────────────────
  const goNext = useCallback(() => {
    if (!group) return;
    if (ci < group.capsules?.length - 1) {
      setCi(ci + 1);
      return;
    }
    const ng = groups[gi + 1];
    if (ng) {
      slideTo(1, () => {
        setGid(ng.user.id);
        setCi(startIndex(ng, currentUserId));
      });
    } else {
      close();
    }
  }, [group, ci, groups, gi, slideTo, close, currentUserId]);

  const goPrev = useCallback(() => {
    if (ci > 0) {
      setCi(ci - 1);
      return;
    }
    const pg = groups[gi - 1];
    if (pg) {
      slideTo(-1, () => {
        setGid(pg.user.id);
        setCi(0);
      });
    } else {
      setRestartTick((t) => t + 1); // first capsule: just restart it
    }
  }, [ci, groups, gi, slideTo]);

  const swipeGroup = useCallback(
    (dir: 1 | -1) => {
      const target = groups[gi + dir];
      if (!target) return;
      slideTo(dir, () => {
        setGid(target.user.id);
        setCi(dir === 1 ? startIndex(target, currentUserId) : 0);
      });
    },
    [groups, gi, slideTo, currentUserId],
  );

  const openSwipeUpSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSheet(isOwn ? { kind: 'insights', tab: 'views' } : { kind: 'comments' });
  }, [isOwn]);

  const handleDoubleTap = useCallback(
    (x: number, y: number) => {
      if (!capsule || isOwn) return;
      heart.play(x, y);
      if (!capsule.likedByMe) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onToggleLike(capsule.id);
      }
    },
    [capsule, isOwn, heart, onToggleLike],
  );

  // ── progress timer ───────────────────────────────────────
  const progress = useCapsuleProgress({
    duration: CAPSULE.DURATION_MS,
    paused: !loaded || !!sheet || held || closing.current,
    resetKey: `${capsule?.id ?? ''}:${restartTick}`,
    onComplete: goNext,
  });

  // ── side effects ─────────────────────────────────────────
  useEffect(() => {
    if (capsule && !isOwn && !capsule.seen) onViewed(capsule.id);
  }, [capsule?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Preload the next image so the transition never shows a spinner.
  useEffect(() => {
    const next = group?.capsules[ci + 1] ?? groups[gi + 1]?.capsules[0];
    if (next) Image.prefetch(next.mediaUrl);
  }, [group, ci, groups, gi]);

  // Keep indices valid after deletes / list changes.
  useEffect(() => {
    if (closing.current) return;
    if (!group || group.capsules?.length === 0) close();
    else if (ci > group.capsules?.length - 1) setCi(group.capsules?.length - 1);
  }, [group, ci, close]);

  // ── gestures ─────────────────────────────────────────────
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(250)
      .onEnd((e, ok) => {
        if (!ok) return;
        if (e.x < FINAL.w * 0.3) runOnJS(goPrev)();
        else runOnJS(goNext)();
      });

    const doubleTap = Gesture.Tap()
      .numberOfTaps(2)
      .maxDelay(250)
      .onEnd((e, ok) => {
        if (ok) runOnJS(handleDoubleTap)(e.x, e.y);
      });

    // hold to pause
    const hold = Gesture.LongPress()
      .minDuration(220)
      .onStart(() => runOnJS(setHeld)(true))
      .onFinalize(() => runOnJS(setHeld)(false));

    const pan = Gesture.Pan()
      .activeOffsetX([-12, 12])
      .activeOffsetY([-12, 12])
      .onStart(() => {
        axis.value = 0;
      })
      .onUpdate((e) => {
        if (axis.value === 0) {
          axis.value = Math.abs(e.translationX) > Math.abs(e.translationY) ? 1 : 2;
        }
        if (axis.value === 1) {
          const blocked =
            (e.translationX < 0 && !hasNextGroup) || (e.translationX > 0 && !hasPrevGroup);
          contentX.value = blocked ? e.translationX * 0.25 : e.translationX;
        } else {
          dragY.value = e.translationY > 0 ? e.translationY : e.translationY * 0.2;
        }
      })
      .onEnd((e) => {
        if (axis.value === 1) {
          const dx = e.translationX;
          if ((dx < -W * 0.22 || e.velocityX < -700) && hasNextGroup) runOnJS(swipeGroup)(1);
          else if ((dx > W * 0.22 || e.velocityX > 700) && hasPrevGroup) runOnJS(swipeGroup)(-1);
          else contentX.value = withSpring(0, { damping: 20, stiffness: 240 });
        } else if (axis.value === 2) {
          if (e.translationY > 110 || e.velocityY > 900) {
            runOnJS(close)();
          } else {
            if (e.translationY < -70 || e.velocityY < -900) runOnJS(openSwipeUpSheet)();
            dragY.value = withSpring(0, { damping: 20, stiffness: 240 });
          }
        }
        axis.value = 0;
      });

    return Gesture.Race(pan, hold, Gesture.Exclusive(doubleTap, tap));
  }, [
    FINAL.w,
    W,
    goNext,
    goPrev,
    handleDoubleTap,
    hasNextGroup,
    hasPrevGroup,
    swipeGroup,
    close,
    openSwipeUpSheet,
    axis,
    contentX,
    dragY,
  ]);

  // ── animated styles ──────────────────────────────────────
  const rectStyle = useAnimatedStyle(() => {
    const p = open.value;
    return {
      left: interpolate(p, [0, 1], [ox.value, FINAL.x]),
      top: interpolate(p, [0, 1], [oy.value, FINAL.y]),
      width: interpolate(p, [0, 1], [ow.value, FINAL.w]),
      height: interpolate(p, [0, 1], [oh.value, FINAL.h]),
      transform: [
        { translateY: dragY.value },
        { scale: interpolate(dragY.value, [0, H], [1, 0.55], Extrapolation.CLAMP) },
      ],
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity:
      Math.min(open.value, 1) * interpolate(dragY.value, [0, H * 0.4], [1, 0], Extrapolation.CLAMP),
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateX: contentX.value }],
  }));

  // Glass panels fade in once the capsule has (almost) finished growing.
  const chromeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(open.value, [0.75, 1], [0, 1], Extrapolation.CLAMP),
  }));

  // ── actions ──────────────────────────────────────────────
  const handleSend = () => {
    if (!capsule) return;
    if (onSend) onSend(capsule);
    else Share.share({ message: capsule.mediaUrl });
  };

  const handleDelete = () => {
    if (!capsule) return;
    Alert.alert('Delete this capsule?', 'It will be removed for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await onDelete(capsule.id);
          } catch {
            Alert.alert('Could not delete', 'Please try again.');
          }
        },
      },
    ]);
  };

  const shown = sheet ?? lastSheet.current;

  return (
    <Modal transparent statusBarTranslucent animationType="none" visible onRequestClose={close}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, backdropStyle]}
        />

        <Animated.View
          style={[
            {
              position: 'absolute',
              overflow: 'hidden',
              backgroundColor: COLORS.surface,
              borderRadius: CAPSULE.VIEWER_RADIUS,
              borderWidth: 1,
              borderColor: COLORS.border,
            },
            rectStyle,
          ]}
        >
          {capsule && group ? (
            <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
              {/* media + gestures */}
              <GestureDetector gesture={gesture}>
                <View style={StyleSheet.absoluteFill}>
                  <Image
                    key={capsule.id}
                    source={{ uri: capsule.mediaUrl }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    onLoad={() => setLoadedId(capsule.id)}
                    onError={() => setLoadedId(capsule.id)}
                  />
                  <HeartBurst x={heart.x} y={heart.y} scale={heart.scale} opacity={heart.opacity} />
                </View>
              </GestureDetector>

              {/* glass panels (top + bottom) */}
              <Animated.View
                pointerEvents="box-none"
                style={[StyleSheet.absoluteFill, { justifyContent: 'space-between' }, chromeStyle]}
              >
                <CapsuleHeader
                  count={group.capsules?.length}
                  activeIndex={ci}
                  progress={progress}
                  user={group.user}
                  createdAt={capsule.createdAt}
                  isOwn={isOwn}
                  onClose={close}
                />
                {isOwn ? (
                  <OwnerActionBar
                    capsule={capsule}
                    onViews={() => setSheet({ kind: 'insights', tab: 'views' })}
                    onLikes={() => setSheet({ kind: 'insights', tab: 'likes' })}
                    onComments={() => setSheet({ kind: 'insights', tab: 'comments' })}
                    onSend={handleSend}
                    onDelete={handleDelete}
                  />
                ) : (
                  <ViewerActionBar
                    capsule={capsule}
                    onLike={() => onToggleLike(capsule.id)}
                    onComment={() => setSheet({ kind: 'comments' })}
                    onSave={() => onToggleSave(capsule.id)}
                    onSend={handleSend}
                  />
                )}
              </Animated.View>
            </Animated.View>
          ) : null}

          {/* comments (viewer) · views / likes / comments (owner) */}
          <GlassSheet
            visible={!!sheet}
            onClose={() => setSheet(null)}
            title={shown?.kind === 'comments' ? 'Comments' : 'Activity'}
          >
            {capsule && shown?.kind === 'comments' && (
              <CommentsPanel
                capsuleId={capsule.id}
                onAdded={() => onCommentAdded(capsule.id)}
              />
            )}
            {capsule && shown?.kind === 'insights' && (
              <InsightsPanel
                capsule={capsule}
                initialTab={shown.tab}
                onCommentAdded={() => onCommentAdded(capsule.id)}
              />
            )}
          </GlassSheet>
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}
