import Ionicons from '@expo/vector-icons/Ionicons'
import { BlurView } from 'expo-blur'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import {
    ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Modal,
    Platform, Pressable, StyleSheet, Text, TextInput, View,
} from 'react-native'
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown, ZoomIn } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { sharePostToContact } from '../services/chat/sharePost'
import { COLORS } from '../ui/neo'

// Assumed shape. `id` must be the same id you use as contact._id in chat.
export type ShareTarget = { id: string; username: string; profilePic?: string }

type Props = {
    visible: boolean
    postId: string | null
    friends: ShareTarget[]
    orbitals?: ShareTarget[] // accepted so the home screen doesn't change; not wired yet
    onClose: () => void
}

const Row = memo(function Row({ item, on, onToggle }: { item: ShareTarget; on: boolean; onToggle: (id: string) => void }) {
    return (
        <Pressable onPress={() => onToggle(item.id)} className="flex-row items-center px-4 py-2.5 active:bg-white/5">
            {item.profilePic ? (
                <Image source={{ uri: item.profilePic }} className="h-11 w-11 rounded-full" />
            ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full border border-white/35 bg-white/15">
                    <Text className="text-base font-bold text-white">{item.username?.charAt(0).toUpperCase()}</Text>
                </View>
            )}
            <Text numberOfLines={1} className="ml-3 flex-1 text-[15px] font-semibold text-white">{item.username}</Text>
            <View className={`h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-white bg-white' : 'border-white/40'}`}>
                {on && (
                    <Animated.View entering={ZoomIn.duration(120)}>
                        <Ionicons name="checkmark" size={16} color="#0a0c12" />
                    </Animated.View>
                )}
            </View>
        </Pressable>
    )
})

export default function ShareModal({ visible, postId, friends, onClose }: Props) {
    const insets = useSafeAreaInsets()

    // Keep the Modal mounted briefly after `visible` flips so the exit animation can play.
    const [mounted, setMounted] = useState(visible)
    useEffect(() => {
        if (visible) {
            setMounted(true)
            return
        }
        const t = setTimeout(() => setMounted(false), 260)
        return () => clearTimeout(t)
    }, [visible])

    const [query, setQuery] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (!visible) return
        setSelected(new Set())
        setQuery('')
        setError(null)
    }, [visible])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? friends.filter((f) => f.username?.toLowerCase().includes(q)) : friends
    }, [friends, query])

    const toggle = useCallback((id: string) => {
        Haptics.selectionAsync()
        setSelected((prev) => {
            const next = new Set(prev)
            next.has(id) ? next.delete(id) : next.add(id)
            return next
        })
    }, [])

    const send = useCallback(async () => {
        if (!postId || selected.size === 0 || sending) return
        setSending(true)
        setError(null)

        const ids = Array.from(selected)
        const results = await Promise.allSettled(ids.map((id) => sharePostToContact(id, postId)))
        const failed = ids.filter((_, i) => results[i].status === 'rejected')
        setSending(false)

        if (failed.length === 0) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
            onClose()
            return
        }
        setSelected(new Set(failed))
        setError(
            failed.length === ids.length
                ? 'Could not send. Try again.'
                : `Couldn't send to ${failed.length} of ${ids.length}. Try again.`
        )
    }, [postId, selected, sending, onClose])

    const count = selected.size
    const disabled = count === 0 || sending

    return (
        <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            {visible && (
                <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} className="absolute inset-0 bg-black/50">
                    <Pressable className="flex-1" onPress={onClose} accessibilityLabel="Close share" />
                </Animated.View>
            )}

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end" pointerEvents="box-none">
                {visible && (
                    <Animated.View
                        entering={SlideInDown.springify().damping(20).mass(0.6)}
                        exiting={SlideOutDown.duration(220)}
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

                        <FlatList
                            data={filtered}
                            extraData={selected}
                            keyExtractor={(f) => f.id}
                            renderItem={({ item }) => <Row item={item} on={selected.has(item.id)} onToggle={toggle} />}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                            className="flex-1"
                            ListEmptyComponent={<Text className="mt-10 text-center text-sm text-white/60">No people found</Text>}
                        />

                        <View className="px-4 pt-2" style={{ paddingBottom: insets.bottom + 12 }}>
                            {error ? <Text className="mb-2 text-center text-[13px] text-red-400">{error}</Text> : null}
                            <Pressable
                                onPress={send}
                                disabled={disabled}
                                className={`items-center rounded-2xl py-3 ${disabled ? 'bg-white/10' : 'bg-white active:opacity-80'}`}
                            >
                                {sending ? (
                                    <ActivityIndicator color="#0a0c12" />
                                ) : (
                                    <Text className={`text-[15px] font-bold ${count === 0 ? 'text-white/50' : 'text-[#0a0c12]'}`}>
                                        {count > 0 ? `Share (${count})` : 'Share'}
                                    </Text>
                                )}
                            </Pressable>
                        </View>
                    </Animated.View>
                )}
            </KeyboardAvoidingView>
        </Modal>
    )
}