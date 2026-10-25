import { ActionSheet, Avatar, Glass, SheetOption } from '@/components/ui/chats/ui'
import { Friend } from '@/redux/slice/friends'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useMemo, useState } from 'react'
import { FlatList, Pressable, Text, TextInput, View } from 'react-native'

type Props = {
  contacts: Friend[]
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

// ---------- Row ----------

const ContactRow = memo(function ContactRow({
  contact,
  pinned,
  muted,
  onPress,
  onLongPress,
}: {
  contact: Friend
  pinned: boolean
  muted: boolean
  onPress: (c: Friend) => void
  onLongPress: (c: Friend) => void
}) {
  return (
    <Pressable
      onPress={() => onPress(contact)}
      onLongPress={() => onLongPress(contact)}
      delayLongPress={250}
      className="mx-4 mb-2.5 flex-row items-center gap-3 rounded-2xl border border-white/5 border-t-white/10 bg-white/[0.04] px-3 py-3 active:bg-white/10"
    >
      <Avatar uri={contact.profilePic} name={contact.username} className="h-14 w-14" />
      <Text numberOfLines={1} className="flex-1 text-[15px] font-semibold text-white">
        {contact.username}
      </Text>
      {muted && <Ionicons name="volume-mute" size={16} color="#737373" />}
      {pinned && <Ionicons name="pin" size={16} color="#a3a3a3" />}
    </Pressable>
  )
})

// ---------- Screen ----------

export function ContactsScreen({ contacts, onSelect, onOpenProfile, onNotify }: Props) {
  const [query, setQuery] = useState('')
  const [active, setActive] = useState<Friend | null>(null) // contact whose long-press menu is open
  // Local-only for now (TODO: persist / call your API later)
  const [pinned, setPinned] = useState<Set<string>>(new Set())
  const [muted, setMuted] = useState<Set<string>>(new Set())
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const data = useMemo(() => {
    const q = query.trim().toLowerCase()
    return contacts
      .filter((c) => !hidden.has(c._id) && (!q || c.username.toLowerCase().includes(q)))
      .sort((a, b) => Number(pinned.has(b._id)) - Number(pinned.has(a._id)))
  }, [contacts, query, hidden, pinned])

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
    ({ item }: { item: Friend }) => (
      <ContactRow
        contact={item}
        pinned={pinned.has(item._id)}
        muted={muted.has(item._id)}
        onPress={onSelect}
        onLongPress={handleLongPress}
      />
    ),
    [pinned, muted, onSelect, handleLongPress]
  )

  return (
    <View className="flex-1 bg-black">
      <View className="px-5 pb-3 pt-14">
        <Text className="mb-4 text-center text-2xl font-bold text-white">Messages</Text>
        <Glass className="flex-row items-center gap-2 rounded-2xl border border-white/10 px-4">
          <Ionicons name="search" size={17} color="#737373" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor="#737373"
            autoCorrect={false}
            returnKeyType="search"
            className="flex-1 py-3 text-[14.5px] text-gray-100"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={17} color="#737373" />
            </Pressable>
          )}
        </Glass>
      </View>

      <FlatList
        data={data}
        keyExtractor={(c) => c._id}
        renderItem={renderItem}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={14}
        windowSize={9}
        contentContainerClassName="pb-36 pt-1"
        ListEmptyComponent={
          <View className="items-center gap-3 py-24">
            <Ionicons name="chatbubbles-outline" size={40} color="#404040" />
            <Text className="text-sm text-gray-500">{query ? 'No matches' : 'No conversations yet'}</Text>
          </View>
        }
      />

      <ActionSheet visible={!!active} title={active?.username} options={options} onClose={closeSheet} />
    </View>
  )
}
