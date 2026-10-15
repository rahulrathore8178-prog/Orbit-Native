import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Text, TextInput, View } from 'react-native';
import { capsuleApi } from '../services/capsule/capsuleApi';
import { COLORS } from '../../constants/capsule/constants';
import type { CapsuleComment } from '../../constants/capsule/types';
import { timeAgo } from '../../constants/capsule/time';
import { Avatar } from '../ui/capsule/Avatar';
import { NeoButton } from '../ui/capsule/NeoButton';

interface Props {
  capsuleId: string;
  onAdded?: () => void;
}

export function CommentsPanel({ capsuleId, onAdded }: Props) {
  const [items, setItems] = useState<CapsuleComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    capsuleApi
      .getComments(capsuleId)
      .then((d) => alive && setItems(d))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [capsuleId]);

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
            <Text className="font-normal text-neutral-500">  {timeAgo(item.createdAt)}</Text>
          </Text>
          <Text className="mt-0.5 text-[14px] text-neutral-200">{item.text}</Text>
        </View>
      </View>
    ),
    [],
  );

  return (
    <View style={{ flex: 1 }}>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={COLORS.dim} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          initialNumToRender={10}
          ListEmptyComponent={
            <View className="items-center px-8 pt-12">
              <Text className="text-[15px] text-neutral-300">No comments yet</Text>
              <Text className="mt-1 text-center text-[13px] text-neutral-500">
                Start the conversation.
              </Text>
            </View>
          }
        />
      )}
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
    </View>
  );
}
