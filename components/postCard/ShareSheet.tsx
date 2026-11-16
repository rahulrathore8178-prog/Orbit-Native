import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sharePostToContact } from '../services/chat/sharePost';
import { COLORS } from '../ui/neo';
import { Avatar, fetchRecipients, showShareToast, type Recipient } from './ShareQuick';

const AVATAR = 54;

type Props = {
    visible: boolean;
    postId: string | null;
    currentUserId: string;
    onClose: () => void;
};

const tick = () => {
    if (Platform.OS !== 'web') Haptics.selectionAsync();
};

export default function ShareSheet({ visible, postId, currentUserId, onClose }: Props) {
    const insets = useSafeAreaInsets();
    const [users, setUsers] = useState<Recipient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [sending, setSending] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            setUsers(await fetchRecipients(currentUserId));
        } catch (e: any) {
            console.error('Share recipients error:', e);
            console.error('Share recipients error data:', e?.response?.status, e?.response?.data);
            setError('Could not load people');
        } finally {
            setLoading(false);
        }
    }, [currentUserId]);

    useEffect(() => {
        if (!visible) return;
        setSelected(new Set());
        setQuery('');
        load();
    }, [visible, load]);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? users.filter((u) => u.username.toLowerCase().includes(q)) : users;
    }, [users, query]);

    const toggle = useCallback((id: string) => {
        tick();
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const send = useCallback(async () => {
        if (!postId || selected.size === 0 || sending) return;
        setSending(true);
        setError(null);

        const ids = Array.from(selected);
        const results = await Promise.allSettled(ids.map((id) => sharePostToContact(id, postId)));
        const failed = ids.filter((_, i) => results[i].status === 'rejected');
        setSending(false);

        if (failed.length === 0) {
            if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onClose();
            // let the sheet start sliding away, then drop the toast from the top
            setTimeout(() => showShareToast('Shared', ids.length > 1 ? `with ${ids.length} people` : undefined), 250);
            return;
        }
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setSelected(new Set(failed)); // keep only the failed ones selected so Retry resends just those
        setError(
            failed.length === ids.length
                ? 'Could not send. Try again.'
                : `Couldn't send to ${failed.length} of ${ids.length}. Try again.`,
        );
    }, [postId, selected, sending, onClose]);

    const renderItem = useCallback(
        ({ item }: { item: Recipient }) => {
            const on = selected.has(item._id);
            return (
                <Pressable
                    onPress={() => toggle(item._id)}
                    className={`mx-2 flex-row items-center rounded-3xl px-3 py-2 ${on ? 'bg-white/10' : ''}`}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={item.username}
                >
                    <Avatar user={item} size={AVATAR} />
                    <Text numberOfLines={1} className="ml-3.5 flex-1 text-[16px] font-semibold text-white">
                        {item.username}
                    </Text>
                    <View
                        className={`h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-white bg-white' : 'border-white/40'
                            }`}
                    >
                        {on && <Ionicons name="checkmark" size={16} color="#0a0c12" />}
                    </View>
                </Pressable>
            );
        },
        [selected, toggle],
    );

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
                <Pressable onPress={onClose} className="absolute inset-0 bg-black/40" accessibilityLabel="Close share" />

                <View
                    className="overflow-hidden rounded-t-[32px] border border-b-0 border-white/15"
                    style={{ height: '72%' }}
                >
                    <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
                    <View pointerEvents="none" className="absolute inset-0 bg-[rgba(10,12,18,0.9)]" />

                    <View className="items-center pb-1.5 pt-2.5">
                        <View className="h-[5px] w-11 rounded-full bg-white/20" />
                    </View>

                    <View className="flex-row items-center px-4 pb-3 pt-1.5">
                        <Text className="flex-1 text-xl font-extrabold text-white">Send to</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close share">
                            <Ionicons name="close" size={24} color="#fff" />
                        </Pressable>
                    </View>

                    <View className="mx-4 mb-2 flex-row items-center rounded-2xl bg-white/10 px-3">
                        <Ionicons name="search" size={16} color={COLORS.muted} />
                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search people"
                            placeholderTextColor={COLORS.muted}
                            autoCapitalize="none"
                            autoCorrect={false}
                            className="ml-2 flex-1 py-2.5 text-[14px] text-white"
                        />
                        {query.length > 0 && (
                            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                                <Ionicons name="close-circle" size={16} color={COLORS.muted} />
                            </Pressable>
                        )}
                    </View>

                    <View className="flex-1">
                        {loading ? (
                            <View className="flex-1 items-center justify-center">
                                <ActivityIndicator color={COLORS.accent} />
                            </View>
                        ) : users.length === 0 && error ? (
                            <View className="flex-1 items-center justify-center gap-3 px-6">
                                <Text className="text-center text-sm text-white/70">{error}</Text>
                                <Pressable onPress={load} className="rounded-2xl bg-white/10 px-5 py-2.5">
                                    <Text className="text-sm font-bold text-white">Retry</Text>
                                </Pressable>
                            </View>
                        ) : (
                            <FlatList
                                data={filtered}
                                extraData={selected}
                                keyExtractor={(u) => u._id}
                                renderItem={renderItem}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                initialNumToRender={12}
                                windowSize={7}
                                contentContainerStyle={{ paddingVertical: 4 }}
                                ListEmptyComponent={
                                    <Text className="mt-10 text-center text-sm text-white/60">No people found</Text>
                                }
                            />
                        )}
                    </View>

                    <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
                        {error && users.length > 0 ? (
                            <Text className="mb-2 text-center text-[13px] text-red-400">{error}</Text>
                        ) : null}
                        <Pressable
                            onPress={send}
                            disabled={selected.size === 0 || sending}
                            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
                            className={`items-center rounded-2xl py-3.5 ${selected.size === 0 || sending ? 'bg-white/10' : 'bg-white'
                                }`}
                        >
                            {sending ? (
                                <ActivityIndicator color="#0a0c12" />
                            ) : (
                                <Text
                                    className={`text-[15px] font-bold ${selected.size === 0 ? 'text-white/50' : 'text-[#0a0c12]'}`}
                                >
                                    {selected.size > 0 ? `Send (${selected.size})` : 'Send'}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}