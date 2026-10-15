import React, { useCallback, useRef, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Animated from 'react-native-reanimated';
import { CapsuleTray, useTrayHeight } from './CapsuleTray';
import { CollapsibleCapsuleTray } from './CollapsibleCapsuleTray';
import { CapsuleViewer } from './CapsuleViewer';
import { useCapsules } from '../../hooks/capsule/useCapsules';
import { useCollapsibleTray } from '../../hooks/capsule/useCollapsibleTray';
import type { Rect } from '../../constants/capsule/types';

// Example wiring. Replace `posts` with your real feed.
const posts: { id: string }[] = [];

export default function CapsuleFeedScreen() {
  const router = useRouter();
  const trayHeight = useTrayHeight();
  const { onScroll, trayStyle } = useCollapsibleTray(trayHeight);
  const capsules = useCapsules();
  const [viewer, setViewer] = useState<{ userId: string; origin: Rect } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // refetch when coming back from the create screen (skip the first focus)
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) first.current = false;
      else capsules.reload();
    }, [capsules.reload]), // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await capsules.reload();
    setRefreshing(false);
  };

  return (
    <View className="flex-1 bg-black">
      <Animated.FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        renderItem={() => null}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: trayHeight }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#9A9A9A"
            progressViewOffset={trayHeight}
          />
        }
        ListEmptyComponent={
          <Text className="px-8 pt-20 text-center text-neutral-600">Your feed goes here</Text>
        }
      />

      <CollapsibleCapsuleTray height={trayHeight} trayStyle={trayStyle}>
        <CapsuleTray
          groups={capsules?.groups}
          currentUserId={capsules.me?.id}
          onAdd={() => router.push('/capsule/create')}
          onOpen={(userId, origin) => setViewer({ userId, origin })}
        />
      </CollapsibleCapsuleTray>

      <CapsuleViewer
        visible={!!viewer && !!capsules.me}
        groups={capsules?.groups}
        startUserId={viewer?.userId ?? ''}
        origin={viewer?.origin ?? null}
        currentUserId={capsules.me?.id ?? ''}
        onClose={() => setViewer(null)}
        onViewed={capsules.markSeen}
        onToggleLike={capsules.toggleLike}
        onToggleSave={capsules.toggleSave}
        onDelete={capsules.remove}
        onCommentAdded={capsules.bumpComments}
        // onSend={(capsule) => openYourSendToChatSheet(capsule)}
      />
    </View>
  );
}
