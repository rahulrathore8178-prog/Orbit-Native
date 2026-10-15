import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { capsuleApi } from '../services/capsule/capsuleApi';
import { COLORS } from '../../constants/capsule/constants';
import { STATIC_VIEWERS } from './staticViews';
import type { Capsule, CapsuleUser } from '../../constants/capsule/types';
import { Avatar } from '../ui/capsule/Avatar';
import { CommentsPanel } from './CommentsPanel';

export type InsightsTab = 'views' | 'likes' | 'comments';

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
        <Text className="text-[14px] font-semibold text-white">{name}</Text>
        {sub ? <Text className="text-[12px] text-neutral-500">{sub}</Text> : null}
      </View>
      {liked ? <Ionicons name="heart" size={16} color={COLORS.like} /> : null}
    </View>
  );
}

// Owner-only sheet content: Views (static for now) · Likes · Comments.
export function InsightsPanel({ capsule, initialTab, onCommentAdded }: Props) {
  const [tab, setTab] = useState<InsightsTab>(initialTab);
  const [likes, setLikes] = useState<CapsuleUser[] | null>(null);

  useEffect(() => setTab(initialTab), [initialTab]);

  useEffect(() => {
    if (tab !== 'likes' || likes) return;
    capsuleApi
      .getLikes(capsule.id)
      .then(setLikes)
      .catch(() => setLikes([]));
  }, [tab, likes, capsule.id]);

  const tabs: { key: InsightsTab; label: string; count: number }[] = [
    { key: 'views', label: 'Views', count: STATIC_VIEWERS.length },
    { key: 'likes', label: 'Likes', count: capsule.likesCount },
    { key: 'comments', label: 'Comments', count: capsule.commentsCount },
  ];

  return (
    <View style={{ flex: 1 }}>
      <View className="flex-row px-4 pb-2" style={{ gap: 8 }}>
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              style={{
                flex: 1,
                paddingVertical: 9,
                borderRadius: 18,
                alignItems: 'center',
                backgroundColor: active ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.3)',
                borderWidth: 1,
                borderColor: active ? 'rgba(255,255,255,0.18)' : COLORS.border,
              }}
            >
              <Text style={{ color: active ? COLORS.text : COLORS.dim, fontSize: 13, fontWeight: '600' }}>
                {t.label} {t.count}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'views' && (
        <FlatList
          data={STATIC_VIEWERS}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <UserRow name={item.username} avatar={item.avatar} sub={item.when} liked={item.liked} />
          )}
        />
      )}

      {tab === 'likes' &&
        (likes === null ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color={COLORS.dim} />
          </View>
        ) : (
          <FlatList
            data={likes}
            keyExtractor={(u) => u.id}
            renderItem={({ item }) => <UserRow name={item.username} avatar={item.avatar} />}
            ListEmptyComponent={
              <Text className="px-8 pt-12 text-center text-[14px] text-neutral-500">No likes yet</Text>
            }
          />
        ))}

      {tab === 'comments' && <CommentsPanel capsuleId={capsule.id} onAdded={onCommentAdded} />}
    </View>
  );
}
