import Ionicons from '@expo/vector-icons/Ionicons';
import axios from 'axios';
import { BlurView } from 'expo-blur';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
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
import { API_URL } from '../../lib/utils';
import { getAuthHeaders } from '../services/feed/postUtils';
import { COLORS } from '../ui/neo';

/**
 * TODO: point these at your real endpoints.
 *  RECIPIENTS_URL  GET  -> Recipient[]  (or { users: Recipient[] })  people the user can send to
 *  SHARE_URL       POST -> { postId, recipientIds }                   delivers the post (e.g. as a chat message)
 */
const RECIPIENTS_URL = `${API_URL}/api/chat/recipients`;
const SHARE_URL = `${API_URL}/api/chat/share-post`;

type Recipient = { _id: string; username: string; profilePic?: string };

type Props = {
    visible: boolean;
    postId: string | null;
    currentUserId: string;
    onClose: () => void;
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
            const res = await axios.get(RECIPIENTS_URL, {
                withCredentials: true,
                headers: await getAuthHeaders(),
            });
            const list: Recipient[] = res.data?.users ?? res.data ?? [];
            setUsers(list.filter((u) => u._id !== currentUserId));
        } catch (e) {
            console.error('Share recipients error:', e);
            console.error('Share recipients error data:', e.response?.status, e.response?.data);
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
        try {
            await axios.post(
                SHARE_URL,
                { postId, recipientIds: Array.from(selected) },
                { withCredentials: true, headers: await getAuthHeaders() },
            );
            onClose();
        } catch (e) {
            console.error('Share post error:', e);
            setError('Could not send. Try again.');
        } finally {
            setSending(false);
        }
    }, [postId, selected, sending, onClose]);

    const renderItem = ({ item }: { item: Recipient }) => {
        const on = selected.has(item._id);
        return (
            <Pressable onPress={() => toggle(item._id)} className="flex-row items-center px-4 py-2.5">
                {item.profilePic ? (
                    <Image source={{ uri: item.profilePic }} className="h-11 w-11 rounded-full" />
                ) : (
                    <View className="h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/15">
                        <Text className="text-base font-bold text-white">{item.username.charAt(0).toUpperCase()}</Text>
                    </View>
                )}
                <Text numberOfLines={1} className="ml-3 flex-1 text-[15px] font-semibold text-white">
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
    };

    return (
        <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end">
                <Pressable onPress={onClose} className="absolute inset-0 bg-black/40" accessibilityLabel="Close share" />

                <View
                    className="overflow-hidden rounded-t-[32px] border border-b-0 border-white/15"
                    style={{ height: '70%' }}
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
                                keyExtractor={(u) => u._id}
                                renderItem={renderItem}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
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
                            className={`items-center rounded-2xl py-3 ${selected.size === 0 || sending ? 'bg-white/10' : 'bg-white'
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