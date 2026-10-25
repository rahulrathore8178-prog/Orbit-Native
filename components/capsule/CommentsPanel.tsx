import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Keyboard, Platform, Text, TextInput, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { capsuleApi } from '../services/capsule/capsuleApi';
import { COLORS } from '../../constants/capsule/constants';
import type { CapsuleComment, RawCapsuleComment } from '../../constants/capsule/types';
import { normalizeComment } from './normalizeComment';
import { timeAgo } from '../../constants/capsule/time';
import { Avatar } from '../ui/capsule/Avatar';
import { NeoButton } from '../ui/capsule/NeoButton';

interface Props {
  capsuleId: string;
  /** comments exactly as the backend sends them on the capsule (author / content / createdAt …) */
  initialComments?: RawCapsuleComment[];
  onAdded?: () => void;
}

// newest first
const toSortedList = (raw?: RawCapsuleComment[]): CapsuleComment[] =>
  (raw ?? [])
    .map(normalizeComment)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

/**
 * Animated bottom inset equal to how much the keyboard actually covers THIS view.
 * It measures the view on screen, so it is correct no matter where the sheet sits
 * (a sheet that doesn't reach the screen bottom, safe areas, Android adjustResize…).
 */
function useKeyboardOverlap(ref: React.RefObject<View | null>) {
  const overlap = useSharedValue(0);
  const keyboardTop = useRef<number | null>(null); // screen Y where the keyboard starts (null = hidden)
  const duration = useRef(200);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback(
    (value: number) => {
      overlap.value = withTiming(value, { duration: duration.current, easing: Easing.out(Easing.cubic) });
    },
    [overlap],
  );

  // Re-measure where this view really is *now* and pad only by what the keyboard still covers.
  // On Android the window is often already resized by the system (adjustResize / edge-to-edge);
  // measuring after that settles means we never add a second, duplicate lift.
  const recompute = useCallback(() => {
    const top = keyboardTop.current;
    if (top == null) return apply(0);
    ref.current?.measureInWindow((_x, y, _w, h) => {
      if (keyboardTop.current == null) return;
      apply(Math.max(0, Math.round(y + h - keyboardTop.current)));
    });
  }, [ref, apply]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      duration.current = ios ? e.duration || 250 : 180;
      if (timer.current) clearTimeout(timer.current);
      // iOS: the window never resizes, measure right away. Android: let the resize land first.
      if (ios) recompute();
      else timer.current = setTimeout(recompute, 60);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', (e) => {
      keyboardTop.current = null;
      duration.current = ios ? e.duration || 250 : 180;
      if (timer.current) clearTimeout(timer.current);
      apply(0);
    });
    return () => {
      show.remove();
      hide.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [recompute, apply]);

  // If the system resizes this view while the keyboard is open, correct the inset.
  const onLayout = useCallback(() => {
    if (keyboardTop.current != null) recompute();
  }, [recompute]);

  return { overlap, onLayout };
}

export function CommentsPanel({ capsuleId, initialComments, onAdded }: Props) {
  const [items, setItems] = useState<CapsuleComment[]>(() => toSortedList(initialComments));
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const rootRef = useRef<View>(null);
  const { overlap: keyboardOverlap, onLayout: onRootLayout } = useKeyboardOverlap(rootRef);
  const insetStyle = useAnimatedStyle(() => ({ paddingBottom: keyboardOverlap.value }));

  // keep in sync if the parent refreshes the capsule (e.g. after onAdded → refetch)
  useEffect(() => {
    setItems((prev) => {
      const fromServer = toSortedList(initialComments);
      // don't drop a just-posted comment that the server copy doesn't contain yet
      const missing = prev.filter((p) => !fromServer.some((s) => s.id === p.id));
      return fromServer.length >= prev.length ? fromServer : [...missing, ...fromServer];
    });
  }, [initialComments]);

  const send = useCallback(async () => {
    const t = text.trim();
    if (!t || sending) return;
    setSending(true);
    setText('');
    try {
      const created = await capsuleApi.addComment(capsuleId, t);
      setItems((prev) => [created, ...prev]);
      onAdded?.();
    } catch {
      setText(t); // give the text back so nothing is lost
    } finally {
      setSending(false);
    }
  }, [text, sending, capsuleId, onAdded]);

  const renderItem = useCallback(
    ({ item }: { item: CapsuleComment }) => (
      <View className="flex-row px-4 py-2.5">
        <Avatar uri={item.user.avatar} size={34} />
        <View className="ml-3 flex-1">
          <Text className="text-[13px] font-semibold text-white">
            {item.user.username}
            <Text className="font-normal text-neutral-500">{'  '}{timeAgo(item.createdAt)}</Text>
          </Text>
          <Text className="mt-0.5 text-[14px] text-neutral-200">{item.text}</Text>
        </View>
      </View>
    ),
    [],
  );

  const empty = useMemo(
    () => (
      <View className="items-center px-8 pt-12">
        <Text className="text-[15px] text-neutral-300">No comments yet</Text>
        <Text className="mt-1 text-center text-[13px] text-neutral-500">Start the conversation.</Text>
      </View>
    ),
    [],
  );

  return (
    // plain View is measured; the inner Animated.View shrinks the list and lifts the input
    <View ref={rootRef} collapsable={false} onLayout={onRootLayout} style={{ flex: 1 }}>
      <Animated.View style={[{ flex: 1 }, insetStyle]}>
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          initialNumToRender={10}
          ListEmptyComponent={empty}
          style={{ flex: 1 }}
        />

        <View className="flex-row items-center px-4 pb-4 pt-2">
          <View
            className="mr-3 flex-1 justify-center rounded-full px-4"
            style={{
              height: 46,
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderWidth: 1,
              borderColor: COLORS.glassBorder,
            }}
          >
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={COLORS.dim}
              style={{ color: COLORS.text, fontSize: 15 }}
              returnKeyType="send"
              maxLength={500}
              onSubmitEditing={send}
            />
          </View>
          <NeoButton
            icon="arrow-up"
            size={44}
            onPress={send}
            disabled={!text.trim() || sending}
            accessibilityLabel="Post comment"
          />
        </View>
      </Animated.View>
    </View>
  );
}