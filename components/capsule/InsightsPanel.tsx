import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View, LayoutChangeEvent, StyleSheet, Keyboard } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { capsuleApi } from '../services/capsule/capsuleApi';
import { COLORS } from '../../constants/capsule/constants';
import type { Capsule, CapsuleUser } from '../../constants/capsule/types';
import { Avatar } from '../ui/capsule/Avatar';
import { CommentsPanel } from './CommentsPanel';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  SharedValue,
} from 'react-native-reanimated';

export type InsightsTab = 'views' | 'likes' | 'comments';

const TAB_KEYS: InsightsTab[] = ['views', 'likes', 'comments'];
const TAB_COUNT = TAB_KEYS.length;
const PILL_PADDING = 3;

// Critically-damped-ish spring: settles fast, no wobble.
const SPRING = { damping: 30, stiffness: 300, mass: 0.8, overshootClamping: true } as const;

interface Props {
  capsule: Capsule;
  initialTab: InsightsTab;
  onCommentAdded?: () => void;
}

function UserRow({ name, avatar, sub, liked }: { name: string; avatar?: string; sub?: string; liked?: boolean }) {
  return (
    <View className="flex-row items-center px-4 py-2.5">
      <Avatar uri={avatar} size={38} />
      <View className="ml-3 flex-1">
        <Text className="text-[14px] font-semibold text-white" numberOfLines={1}>
          {name}
        </Text>
        {sub ? <Text className="text-[12px] text-neutral-500">{sub}</Text> : null}
      </View>
      {liked ? <Ionicons name="heart" size={16} color={COLORS.like} /> : null}
    </View>
  );
}

function EmptyState({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View className="items-center px-8 pt-14">
      <Ionicons name={icon} size={28} color={COLORS.dim} style={{ opacity: 0.6 }} />
      <Text className="mt-3 text-center text-[14px] text-neutral-500">{label}</Text>
    </View>
  );
}

// ───────────────────────── Tab button (colour follows the swipe) ─────────────────────────
function TabButton({
  index,
  label,
  count,
  progress,
  onPress,
}: {
  index: number;
  label: string;
  count: number;
  progress: SharedValue<number>;
  onPress: () => void;
}) {
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(
      Math.min(Math.abs(progress.value - index), 1),
      [0, 1],
      [COLORS.text, COLORS.dim],
    ),
  }));

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      hitSlop={{ top: 6, bottom: 6 }}
      style={styles.tabButton}
    >
      <Animated.Text style={[styles.tabLabel, labelStyle]}>
        {label} {count}
      </Animated.Text>
    </Pressable>
  );
}

// ───────────────────────── One swipeable page (fade + subtle scale) ─────────────────────────
function Page({
  index,
  width,
  height,
  progress,
  children,
}: {
  index: number;
  width: number;
  height: number;
  progress: SharedValue<number>;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const input = [index - 1, index, index + 1];
    return {
      opacity: interpolate(progress.value, input, [0, 1, 0], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(progress.value, input, [0.96, 1, 0.96], Extrapolation.CLAMP) }],
    };
  });
  // explicit pixel width AND height: FlatLists have no intrinsic height, so without this they collapse to 0
  return <Animated.View style={[{ width, height }, style]}>{children}</Animated.View>;
}

// Owner-only sheet content: Views · Likes · Comments.
export function InsightsPanel({ capsule, initialTab, onCommentAdded }: Props) {
  const initialIndex = Math.max(0, TAB_KEYS.indexOf(initialTab));

  const [tab, setTab] = useState<InsightsTab>(initialTab);
  const [likes, setLikes] = useState<CapsuleUser[] | null>(null);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [barWidth, setBarWidth] = useState(0);

  // progress is the *fractional* page position (0 … 2). The finger drives it directly.
  const progress = useSharedValue(initialIndex);
  const startProgress = useSharedValue(initialIndex);
  const widthSV = useSharedValue(0);

  // ── sync with parent-provided tab ──
  useEffect(() => {
    const i = TAB_KEYS.indexOf(initialTab);
    setTab(initialTab);
    progress.value = withSpring(i, SPRING);
  }, [initialTab, progress]);

  // close the keyboard when leaving the Comments tab
  useEffect(() => {
    if (tab !== 'comments') Keyboard.dismiss();
  }, [tab]);

  // ── fetch likes once, and prefetch so the swipe never shows a spinner mid-gesture ──
  useEffect(() => {
    if (likes) return;
    capsuleApi
      .getLikes(capsule.id)
      .then(setLikes)
      .catch(() => setLikes([]));
  }, [capsule.id, likes]);

  const goTo = useCallback(
    (i: number) => {
      setTab(TAB_KEYS[i]);
      progress.value = withSpring(i, SPRING);
    },
    [progress],
  );

  const commitTab = useCallback((i: number) => setTab(TAB_KEYS[i]), []);

  // ── true finger-following pan ──
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12]) // only claim the touch after a clear horizontal move…
    .failOffsetY([-12, 12]) // …so vertical list scrolling still works normally
    .onBegin(() => {
      startProgress.value = Math.round(progress.value);
    })
    .onUpdate((e) => {
      const w = widthSV.value || 1;
      let next = startProgress.value - e.translationX / w;
      // rubber-band at the edges instead of a hard stop
      if (next < 0) next = next * 0.25;
      else if (next > TAB_COUNT - 1) next = TAB_COUNT - 1 + (next - (TAB_COUNT - 1)) * 0.25;
      progress.value = next;
    })
    .onEnd((e) => {
      const w = widthSV.value || 1;
      // project where the finger "wants" to go using velocity, but never skip more than one page
      const projected = progress.value - (e.velocityX / w) * 0.18;
      const from = startProgress.value;
      const target = Math.min(Math.max(Math.round(projected), from - 1, 0), Math.min(from + 1, TAB_COUNT - 1));
      progress.value = withSpring(target, { ...SPRING, velocity: -e.velocityX / w });
      runOnJS(commitTab)(target);
    });

  // ── animated styles ──
  const trackStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -progress.value * widthSV.value }],
  }));

  const pillWidth = barWidth > 0 ? (barWidth - PILL_PADDING * 2) / TAB_COUNT : 0;
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * pillWidth }],
  }));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    widthSV.value = w;
    setWidth(w);
    setHeight(h);
  };

  const tabs: { key: InsightsTab; label: string; count: number }[] = [
    { key: 'views', label: 'Views', count: capsule.viewers?.length || 0 },
    { key: 'likes', label: 'Likes', count: capsule.likesCount },
    { key: 'comments', label: 'Comments', count: capsule.commentsCount },
  ];

  const listPadding = { paddingBottom: 32 };

  return (
    <View style={{ flex: 1 }}>
      {/* Segmented tab bar with a sliding pill that tracks the swipe */}
      <View style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
        <View style={styles.tabBar} onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}>
          {pillWidth > 0 && <Animated.View style={[styles.pill, { width: pillWidth }, pillStyle]} />}
          {tabs.map((t, i) => (
            <TabButton
              key={t.key}
              index={i}
              label={t.label}
              count={t.count}
              progress={progress}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      </View>

      {/* Swipeable pages */}
      <View style={{ flex: 1, overflow: 'hidden' }} onLayout={onLayout}>
        {width > 0 && height > 0 && (
          <GestureDetector gesture={pan}>
            <Animated.View
              style={[
                { position: 'absolute', top: 0, left: 0, width: width * TAB_COUNT, height, flexDirection: 'row' },
                trackStyle,
              ]}
            >
              <Page index={0} width={width} height={height} progress={progress}>
                <FlatList
                  data={capsule.viewers || []}
                  keyExtractor={(v) => v.id}
                  renderItem={({ item }) => <UserRow name={item.username} avatar={item.profilePic} />}
                  ListEmptyComponent={<EmptyState icon="eye-outline" label="No views yet" />}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={listPadding}
                />
              </Page>

              <Page index={1} width={width} height={height} progress={progress}>
                {likes === null ? (
                  <View className="flex-1 items-center justify-center">
                    <ActivityIndicator color={COLORS.dim} />
                  </View>
                ) : (
                  <FlatList
                    data={likes}
                    keyExtractor={(u) => u.id}
                    renderItem={({ item }) => <UserRow name={item.username} avatar={item.avatar} />}
                    ListEmptyComponent={<EmptyState icon="heart-outline" label="No likes yet" />}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={listPadding}
                  />
                )}
              </Page>

              <Page index={2} width={width} height={height} progress={progress}>
                <CommentsPanel capsuleId={capsule.id} initialComments={capsule.comments} onAdded={onCommentAdded} />
              </Page>
            </Animated.View>
          </GestureDetector>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    padding: PILL_PADDING,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pill: {
    position: 'absolute',
    top: PILL_PADDING,
    bottom: PILL_PADDING,
    left: PILL_PADDING,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  tabButton: { flex: 1, paddingVertical: 9, alignItems: 'center' },
  tabLabel: { fontSize: 13, fontWeight: '600' },
});