import { Avatar, Glass } from '@/components/ui/chats/ui'
import type { Message } from '@/hooks/chats/useChat'
import { toReply } from '@/hooks/chats/useChat'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, Text, TextInput, useWindowDimensions, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, { FadeIn, FadeInDown, SlideInDown, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'
import { replyLabel } from './ReplyQuote'
import { showToast } from '../ui/GlassToast'

const MAX_PICK = 10

const FriendRow = memo(function FriendRow({ f, on, onPress }: { f: Friend; on: boolean; onPress: (id: string) => void }) {
    return (
        <Pressable onPress={() => onPress(f._id)} className="flex-row items-center gap-3 px-5 py-2.5 active:bg-white/5">
            <Avatar uri={f.profilePic} name={f.username} className="h-11 w-11" />
            <Text numberOfLines={1} className="flex-1 text-[15px] font-medium text-gray-100">{f.username}</Text>
            <View className={`h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-sky-400 bg-sky-500' : 'border-white/25'}`}>
                {on && (
                    <Animated.View entering={ZoomIn.duration(140)}>
                        <Ionicons name="checkmark" size={15} color="#fff" />
                    </Animated.View>
                )}
            </View>
        </Pressable>
    )
})

export function ForwardSheet({
    message, onClose, onSend,
}: {
    message: Message | null
    onClose: () => void
    onSend: (recipientIds: string[]) => Promise<boolean>
}) {
    const visible = !!message
    const insets = useSafeAreaInsets()
    const { height } = useWindowDimensions()
    const dispatch = useAppDispatch()
    const friends = useSelector((s: RootState) => s.friends.friends) as Friend[]
    const [query, setQuery] = useState('')
    const [picked, setPicked] = useState<string[]>([])
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!visible) return
        setQuery('')
        setPicked([])
        setBusy(false)
        if (!friends.length) dispatch(fetchFriends(undefined))
    }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

    const list = useMemo(() => {
        const q = query.trim().toLowerCase()
        return q ? friends.filter((f) => f.username.toLowerCase().includes(q)) : friends
    }, [friends, query])
    const byId = useMemo(() => new Map(friends.map((f) => [f._id, f])), [friends])

    const toggle = useCallback((id: string) => {
        setPicked((cur) => {
            if (cur.includes(id)) { Haptics.selectionAsync().catch(() => { }); return cur.filter((x) => x !== id) }
            if (cur.length >= MAX_PICK) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => { }); return cur }
            Haptics.selectionAsync().catch(() => { })
            return [...cur, id]
        })
    }, [])

const send = async () => {
    if (!picked.length || busy) return
    const recipients = picked
        .map((id) => byId.get(id))
        .filter(Boolean) as Friend[]

    setBusy(true)
    const ok = await onSend(picked)
    setBusy(false)
    if (!ok) return

    onClose()

    if (recipients.length === 1) {
        const f = recipients[0]
        console.log('Forwarded message to', f, f._id)
        showToast({
            variant: 'message',
            title: 'Message forwarded',
            subtitle: `Sent to ${f.username}`,
            avatar: f.profilePic,
            url: `/chats/${f._id}`, // tap opens that contact's chat
        })
    } else {
        showToast({
            variant: 'success',
            title: `Forwarded to ${recipients.length} people`,
            subtitle: recipients.map((f) => f.username).join(', '),
            // no url: several chats, so nothing single to open
        })
    }
}

    const label = message ? replyLabel(toReply(message)) : null
    const sheetH = Math.min(height * 0.82, 720)

    return (
        <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
            <View className="flex-1 justify-end">
                <Animated.View entering={FadeIn.duration(180)} className="absolute inset-0 bg-black/60">
                    <Pressable className="flex-1" onPress={onClose} />
                </Animated.View>

                <KeyboardAvoidingView behavior="padding">
                    <Animated.View entering={SlideInDown.duration(280)}>
                        <Glass intensity={75} className="rounded-t-[28px] border border-white/15" style={{ height: sheetH }}>
                            <View className="items-center pb-1 pt-2.5"><View className="h-1.5 w-11 rounded-full bg-white/25" /></View>

                            <View className="flex-row items-center px-5 pb-2 pt-2">
                                <View className="flex-1">
                                    <Text className="text-[18px] font-bold text-white">Forward to</Text>
                                    <Text className="text-[12px] text-gray-400">
                                        {picked.length ? `${picked.length} selected · up to ${MAX_PICK}` : 'Pick one or more people'}
                                    </Text>
                                </View>
                                <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close" className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                                    <Ionicons name="close" size={20} color="#e5e5e5" />
                                </Pressable>
                            </View>

                            {label && (
                                <View className="mx-5 mb-2.5 flex-row items-center gap-2 rounded-2xl bg-white/[0.06] px-3 py-2">
                                    <Ionicons name="arrow-redo" size={14} color="#38bdf8" />
                                    {label.icon && <Ionicons name={label.icon} size={13} color="rgba(255,255,255,0.65)" />}
                                    <Text numberOfLines={1} className="flex-1 text-[13px] text-gray-300">{label.text}</Text>
                                </View>
                            )}

                            <View className="mx-5 mb-2 h-11 flex-row items-center rounded-full border border-white/10 bg-white/[0.07] px-4">
                                <Ionicons name="search" size={17} color="#9ca3af" />
                                <TextInput
                                    value={query}
                                    onChangeText={setQuery}
                                    placeholder="Search"
                                    placeholderTextColor="#737373"
                                    selectionColor="#38bdf8"
                                    className="ml-2.5 flex-1 py-0 text-[15px] text-gray-100"
                                />
                                {!!query && (
                                    <Pressable onPress={() => setQuery('')} hitSlop={8}>
                                        <Ionicons name="close-circle" size={17} color="#737373" />
                                    </Pressable>
                                )}
                            </View>

                            {picked.length > 0 && (
                                <Animated.View entering={FadeInDown.duration(160)}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 px-5 py-2">
                                        {picked.map((id) => {
                                            const f = byId.get(id)
                                            if (!f) return null
                                            return (
                                                <Animated.View key={id} entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(120)}>
                                                    <Pressable onPress={() => toggle(id)} className="w-14 items-center active:opacity-70">
                                                        <View>
                                                            <Avatar uri={f.profilePic} name={f.username} className="h-12 w-12" />
                                                            <View className="absolute -right-1 -top-1 h-[18px] w-[18px] items-center justify-center rounded-full border border-neutral-900 bg-neutral-700">
                                                                <Ionicons name="close" size={11} color="#fff" />
                                                            </View>
                                                        </View>
                                                        <Text numberOfLines={1} className="mt-1 text-[11px] text-gray-300">{f.username}</Text>
                                                    </Pressable>
                                                </Animated.View>
                                            )
                                        })}
                                    </ScrollView>
                                </Animated.View>
                            )}

                            <FlatList
                                data={list}
                                keyExtractor={(f) => f._id}
                                renderItem={({ item }) => <FriendRow f={item} on={picked.includes(item._id)} onPress={toggle} />}
                                extraData={picked}
                                keyboardShouldPersistTaps="handled"
                                showsVerticalScrollIndicator={false}
                                className="flex-1"
                                ListEmptyComponent={
                                    <View className="items-center px-8 pt-12">
                                        <Text className="text-center text-[14px] text-gray-500">
                                            {friends.length ? 'No one matches that search.' : 'No friends to forward to yet.'}
                                        </Text>
                                    </View>
                                }
                            />

                            <View className="border-t border-white/10 px-5 pt-3" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
                                <Pressable
                                    onPress={send}
                                    disabled={!picked.length || busy}
                                    className={`h-12 flex-row items-center justify-center gap-2 rounded-full ${picked.length ? 'bg-sky-500 active:opacity-80' : 'bg-white/10'}`}
                                >
                                    {busy ? <ActivityIndicator color="#fff" /> : <Ionicons name="paper-plane" size={17} color={picked.length ? '#fff' : '#6b7280'} />}
                                    <Text className={`text-[15px] font-semibold ${picked.length ? 'text-white' : 'text-gray-500'}`}>
                                        {picked.length ? `Send to ${picked.length}` : 'Select people'}
                                    </Text>
                                </Pressable>
                            </View>
                        </Glass>
                    </Animated.View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    )
}