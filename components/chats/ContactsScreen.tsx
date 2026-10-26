import { OrbitBackdrop } from '@/components/search/OrbitbackDrop'
import { KEYBOARD_GAP, TAB_BAR_GAP, TAB_BAR_HEIGHT } from '@/components/search/constants'
import { ActionSheet, Avatar, SheetOption } from '@/components/ui/chats/ui'
import type { Conversation } from '@/hooks/chats/useConversations'
import { Friend } from '@/redux/slice/friends'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native'
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
  FadeInDown,
  FadeInUp,
  LinearTransition,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

type Props = {
  contacts: Friend[]
  conversations: Record<string, Conversation>
  refreshing: boolean
  onRefresh: () => void
  onSelect: (contact: Friend) => void
  onOpenProfile: (contact: Friend) => void
  onNotify: (text: string) => void
}

const toggle = (set: Set<string>, id: string) => {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

// ---------- helpers ----------

const timeLabel = (iso?: string) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000)
  if (days <= 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'short' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

const previewOf = (c?: Conversation) => {
  if (!c || (!c.text && c.type !== 'shared_post')) return 'Say hi 👋'
  const body = c.type === 'shared_post' ? 'Shared a post' : c.text
  return c.fromMe ? `You: ${body}` : body
}

// ---------- Row ----------

const ContactRow = memo(function ContactRow({
  contact,
  convo,
  index,
  pinned,
  muted,
  onPress,
  onLongPress,
}: {
  contact: Friend
  convo?: Conversation
  index: number
  pinned: boolean
  muted: boolean
  onPress: (c: Friend) => void
  onLongPress: (c: Friend) => void
}) {
  const scale = useSharedValue(1)
  const press = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const unread = convo?.unread ?? 0
  const isNew = unread > 0

  return (
    <Animated.View
      entering={index < 9 ? FadeInDown.delay(index * 45).springify().damping(18) : undefined}
      layout={LinearTransition.springify().damping(20).stiffness(220)}
      style={press}
      className="mx-4 mb-2.5"
    >
      <Pressable
        onPress={() => onPress(contact)}
        onLongPress={() => onLongPress(contact)}
        delayLongPress={250}
        onPressIn={() => (scale.value = withSpring(0.975, { damping: 18, stiffness: 320 }))}
        onPressOut={() => (scale.value = withSpring(1, { damping: 14, stiffness: 260 }))}
        className={`flex-row items-center gap-3 overflow-hidden rounded-2xl border px-3 py-3 ${
          isNew ? 'border-sky-400/25 border-t-sky-300/30 bg-sky-500/[0.09]' : 'border-white/5 border-t-white/10 bg-white/[0.04]'
        }`}
      >
        {/* soft accent edge on conversations with something new */}
        {isNew && <View className="absolute bottom-3 left-0 top-3 w-[3px] rounded-r-full bg-sky-400" />}

        <Avatar uri={contact.profilePic} name={contact.username} className="h-14 w-14" />

        <View className="flex-1">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className={`flex-1 text-[15px] text-white ${isNew ? 'font-bold' : 'font-semibold'}`}>
              {contact.username}
            </Text>
            {!!convo?.timestamp && (
              <Text className={`text-[11px] ${isNew ? 'font-semibold text-sky-300' : 'text-neutral-500'}`}>
                {timeLabel(convo.timestamp)}
              </Text>
            )}
          </View>
          <View className="mt-0.5 flex-row items-center gap-2">
            <Text numberOfLines={1} className={`flex-1 text-[13px] ${isNew ? 'text-sky-100/90' : 'text-neutral-500'}`}>
              {previewOf(convo)}
            </Text>
            {muted && <Ionicons name="volume-mute" size={14} color="#737373" />}
            {pinned && <Ionicons name="pin" size={14} color="#a3a3a3" />}
            {isNew && (
              <View className="min-w-[20px] items-center rounded-full bg-sky-400 px-1.5 py-[1px]">
                <Text className="text-[11px] font-bold text-black">{unread > 99 ? '99+' : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
})

// ---------- Search dock (bottom, above the floating tab bar, follows the keyboard) ----------

function SearchDock({ value, onChangeText }: { value: string; onChangeText: (t: string) => void }) {
  const insets = useSafeAreaInsets()
  const [focused, setFocused] = useState(false)
  const f = useSharedValue(0)
  useEffect(() => {
    f.value = withTiming(focused ? 1 : 0, { duration: 200 })
  }, [focused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Rests above the tab bar; as the keyboard rises the gap glides down to a small margin (driven by the keyboard itself).
  const { progress } = useReanimatedKeyboardAnimation()
  const rest = insets.bottom + TAB_BAR_HEIGHT + TAB_BAR_GAP
  const wrap = useAnimatedStyle(() => ({ paddingBottom: interpolate(progress.value, [0, 1], [rest, KEYBOARD_GAP]) }))
  const border = useAnimatedStyle(() => ({
    borderColor: interpolateColor(f.value, [0, 1], ['rgba(255,255,255,0.10)', 'rgba(125,211,252,0.45)']),
  }))

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(450)} style={wrap} className="px-4 pt-2">
      <Animated.View style={border} className="rounded-[28px] border bg-neutral-950/95 p-1.5">
        <View className="flex-row items-center gap-2 rounded-3xl border border-white/[0.04] bg-[#050505] py-1 pl-4 pr-2">
          <Ionicons name="search" size={18} color="#737373" />
          <TextInput
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search chats"
            placeholderTextColor="#737373"
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            className="min-w-0 flex-1 py-2.5 text-[15px] text-neutral-100"
          />
          {value.length > 0 && (
            <Pressable onPress={() => onChangeText('')} hitSlop={8} className="h-8 w-8 items-center justify-center rounded-full bg-white/10">
              <Ionicons name="close" size={16} color="#d4d4d4" />
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Animated.View>
  )
}

// ---------- Screen ----------

export function ContactsScreen({ contacts, conversations, refreshing, onRefresh, onSelect, onOpenProfile, onNotify }: Props) {
  const insets = useSafeAreaInsets()
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Friend | null>(null) // contact whose long-press menu is open
  // Local-only for now (TODO: persist / call your API later)
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const [muted, setMuted] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  // pinned first, then the most recent conversation, then people you haven't talked to (A-Z)
  const data = useMemo(() => {
    const q = query.trim().toLowerCase()
    const ts = (id: string) => {
      const t = conversations[id]?.timestamp
      return t ? new Date(t).getTime() || 0 : 0
    }
    return contacts
      .filter((c) => !hidden.has(c._id) && (!q || c.username.toLowerCase().includes(q)))
      .sort(
        (a, b) =>
          Number(pinned.has(b._id)) - Number(pinned.has(a._id)) ||
          ts(b._id) - ts(a._id) ||
          a.username.localeCompare(b.username)
      )
  }, [contacts, query, hidden, pinned, conversations])

  const totalUnread = useMemo(() => Object.values(conversations).reduce((n, c) => n + (c.unread || 0), 0), [conversations])

  const handleLongPress = useCallback((c: Friend) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setActive(c)
  }, [])
  const closeSheet = useCallback(() => setActive(null), [])

  const options = useMemo<SheetOption[]>(() => {
    if (!active) return []
    const id = active._id
    return [
      {
        label: pinned.has(id) ? 'Unpin chat' : 'Pin chat',
        icon: pinned.has(id) ? 'pin-outline' : 'pin',
        onPress: () => setPinned((s) => toggle(s, id)),
      },
      {
        label: muted.has(id) ? 'Unmute' : 'Mute notifications',
        icon: muted.has(id) ? 'notifications-outline' : 'notifications-off-outline',
        onPress: () => setMuted((s) => toggle(s, id)),
      },
      { label: 'View profile', icon: 'person-outline', onPress: () => onOpenProfile(active) },
      {
        label: 'Delete chat',
        icon: 'trash-outline',
        destructive: true,
        onPress: () => {
          setHidden((s) => toggle(s, id))
          onNotify('Chat deleted')
        },
      },
    ]
  }, [active, pinned, muted, onOpenProfile, onNotify])

  const renderItem = useCallback(
    ({ item, index }: { item: Friend; index: number }) => (
      <ContactRow
        contact={item}
        convo={conversations[item._id]}
        index={index}
        pinned={pinned.has(item._id)}
        muted={muted.has(item._id)}
        onPress={onSelect}
        onLongPress={handleLongPress}
      />
    ),
    [conversations, pinned, muted, onSelect, handleLongPress]
  )

  return (
    <View className="flex-1 overflow-hidden bg-black">
      <OrbitBackdrop />

      {/* the list shrinks as the keyboard opens, and the search dock rides on top of it */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(450)} className="px-5 pb-3" style={{ paddingTop: insets.top + 12 }}>
          <View className="flex-row items-center justify-center gap-2">
            <Text className="text-center text-2xl font-bold text-white">Messages</Text>
            {totalUnread > 0 && (
              <View className="rounded-full border border-sky-400/30 bg-sky-500/15 px-2 py-0.5">
                <Text className="text-[11px] font-semibold text-sky-300">{totalUnread > 99 ? '99+' : totalUnread} new</Text>
              </View>
            )}
          </View>
        </Animated.View>

        <FlatList
          data={data}
          keyExtractor={(c) => c._id}
          renderItem={renderItem}
          extraData={conversations}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          initialNumToRender={14}
          windowSize={9}
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#ffffff" />}
          ListEmptyComponent={
            <Animated.View entering={FadeInDown.delay(200)} className="items-center gap-3 py-24">
              <Ionicons name="chatbubbles-outline" size={40} color="#404040" />
              <Text className="text-sm text-gray-500">{query ? 'No matches' : 'No conversations yet'}</Text>
            </Animated.View>
          }
        />

        <SearchDock value={query} onChangeText={setQuery} />
      </KeyboardAvoidingView>

      <ActionSheet visible={!!active} title={active?.username} options={options} onClose={closeSheet} />
    </View>
  )
}