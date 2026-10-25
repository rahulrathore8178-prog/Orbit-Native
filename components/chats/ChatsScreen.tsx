import {
  ActionSheet,
  Avatar,
  Glass,
  IconButton,
  SheetOption,
  Toast,
  ToastData,
  ToastVariant,
  captureBackdrop
} from '@/components/ui/chats/ui'
import { Message } from '@/hooks/chats/useChat'
import { Friend } from '@/redux/slice/friends'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useMemo, useRef, useState } from 'react'
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native'
// Frame-synced keyboard handling on both platforms (replaces RN's KeyboardAvoidingView).
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { FadeInUp, ZoomIn, interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedPostBubble } from './SharedPostBubble'

type Props = {
  contact: Friend
  messages: Message[] // oldest -> newest
  isConnected: boolean
  toast: ToastData | null
  onBack: () => void
  onSend: (text: string) => boolean
  onOpenProfile: (contact: Friend) => void
  onDeleteMessage: (id: string) => void
  onClearChat: () => void
  onNotify: (text: string, variant?: ToastVariant) => void
}

type Sheet = { kind: 'message'; message: Message } | { kind: 'attach' } | { kind: 'menu' }

// Built once, reused by every bubble.
const BUBBLE_ENTER = FadeInUp.springify().damping(16).mass(0.5)

// ---------- Message bubble (mine = dark blue, theirs = neutral grey) ----------

const MessageBubble = memo(function MessageBubble({ item, onLongPress }: { item: Message; onLongPress: (m: Message) => void }) {
  const isMe = item.sender === 'me'
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item])

  return (
    <Animated.View
      entering={item.fresh ? BUBBLE_ENTER : undefined}
      className={`flex-row ${isMe ? 'justify-end' : 'justify-start'}`}
    >
      {item.sharedPostId ? (
        <SharedPostBubble postId={item.sharedPostId} initialPost={item.sharedPost} isMe={isMe} onLongPress={handleLongPress} />
      ) : (
        <Pressable
          onLongPress={handleLongPress}
          delayLongPress={250}
          className={`max-w-[78%] rounded-2xl border px-4 py-2.5 active:opacity-80 ${isMe ? 'rounded-br-md border-blue-400/20 bg-blue-900' : 'rounded-bl-md border-white/5 bg-neutral-900'}`}
        >
          <Text className={`text-[14.5px] leading-5 ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>{item.content}</Text>
          <Text className={`mt-1 self-end text-[10px] ${isMe ? 'text-blue-200/60' : 'text-gray-400'}`}>{item.time}</Text>
        </Pressable>
      )}
    </Animated.View>
  )
})

// ---------- Composer (owns the input state so typing never re-renders the message list) ----------

const Composer = memo(function Composer({
  safeBottom,
  onSend,
  onAttach,
  onVoice,
}: {
  safeBottom: number
  onSend: (text: string) => boolean | Promise<boolean>
  onAttach: () => void
  onVoice: () => void
}) {
  const [text, setText] = useState('')
  const hasText = text.trim().length > 0

  // Bottom padding glides from "home indicator" spacing to a small gap as the keyboard rises,
  // driven by the keyboard itself, so there is no jump and no React re-render.
  const { progress } = useReanimatedKeyboardAnimation()
  const restBottom = Math.max(safeBottom, 12)
  const wrapStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(progress.value, [0, 1], [restBottom, 12]),
  }))

  const submit = async () => {
    const trimmed = text.trim()
    if (!trimmed) return
    setText('')
    const ok = await onSend(trimmed)
    if (!ok) setText((cur) => cur || trimmed)
  }

  return (
    <Animated.View
      className="flex-row items-end gap-2 border-t border-white/10 bg-neutral-950 px-3 pt-2.5"
      style={wrapStyle}
    >
      <IconButton name="attach" onPress={onAttach} />

      {/* Inset (pressed-in) neumorphic input */}
      <View className="min-h-[40px] flex-1 justify-center rounded-3xl border border-white/5 border-t-black bg-black px-4">
        <TextInput
          value={text}
          onChangeText={setText}
          multiline
          placeholder="Message..."
          placeholderTextColor="#737373"
          textAlignVertical="center"
          className="max-h-28 py-2 text-[14.5px] text-gray-100"
        />
      </View>

      <Animated.View key={hasText ? 'send' : 'mic'} entering={ZoomIn.duration(150)}>
        {hasText ? (
          <IconButton name="send" onPress={submit} solid color="#fff" size={17} />
        ) : (
          <IconButton name="mic-outline" onPress={onVoice} />
        )}
      </Animated.View>
    </Animated.View>
  )
})

// The list is inverted (flipped), so the empty state has to be flipped back.
const EmptyChat = (
  <View className="items-center py-20" style={{ transform: [{ scaleY: -1 }] }}>
    <Text className="text-sm text-gray-500">No messages yet. Say hi 👋</Text>
  </View>
)

// ---------- Chat screen ----------

export function ChatScreen({
  contact,
  messages,
  isConnected,
  toast,
  onBack,
  onSend,
  onOpenProfile,
  onDeleteMessage,
  onClearChat,
  onNotify,
}: Props) {
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<Message>>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)

  // Inverted list wants newest first. Offset 0 is the bottom, so the chat opens
  // at the latest message with no scrolling, and the latest message stays
  // visible when the keyboard opens or the composer grows.
  const data = useMemo(() => [...messages].reverse(), [messages])

  const closeSheet = useCallback(() => setSheet(null), [])
  const [backdrop, setBackdrop] = useState<string | undefined>()
  const openAttach = useCallback(() => setSheet({ kind: 'attach' }), [])
  const openMenu = useCallback(() => setSheet({ kind: 'menu' }), [])
  const soon = useCallback((what: string) => onNotify(`${what} coming soon`), [onNotify])
  const handleProfile = useCallback(() => onOpenProfile(contact), [onOpenProfile, contact])
  const handleVoiceNote = useCallback(() => soon('Voice notes'), [soon])

  // Sending always brings you back to the newest message, even if you had scrolled up.
  const handleSend = useCallback(
    (text: string) => {
      listRef.current?.scrollToOffset({ offset: 0, animated: true })
      return onSend(text)
    },
    [onSend]
  )

  const openSheet = useCallback(async (next: NonNullable<typeof sheet>) => {
    const uri = await captureBackdrop()
    setBackdrop(uri)
    setSheet(next)
  }, [])

  const handleBubbleLongPress = useCallback(
    (message: Message) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      openSheet({ kind: 'message', message })
    },
    [openSheet]
  )

  const sheetConfig = useMemo<{ title?: string; options: SheetOption[] }>(() => {
    if (!sheet) return { options: [] }

    if (sheet.kind === 'message') {
      const m = sheet.message
      if (m.sharedPostId) {
        return {
          title: 'Shared post',
          options: [{ label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => onDeleteMessage(m.id) }],
        }
      }
      return {
        title: m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content,
        options: [
          {
            label: 'Copy',
            icon: 'copy-outline',
            onPress: () => {
              Clipboard.setStringAsync(m.content).then(() => onNotify('Copied to clipboard'))
            },
          },
          { label: 'Forward', icon: 'arrow-redo-outline', onPress: () => soon('Forwarding') },
          { label: 'Delete', icon: 'trash-outline', destructive: true, onPress: () => onDeleteMessage(m.id) },
        ],
      }
    }

    if (sheet.kind === 'attach') {
      return {
        title: 'Attach',
        options: [
          { label: 'Camera', icon: 'camera-outline', onPress: () => soon('Camera') },
          { label: 'Photos & videos', icon: 'image-outline', onPress: () => soon('Gallery') },
          { label: 'Document', icon: 'document-text-outline', onPress: () => soon('Documents') },
          { label: 'Location', icon: 'location-outline', onPress: () => soon('Location sharing') },
        ],
      }
    }

    return {
      options: [
        { label: 'View profile', icon: 'person-outline', onPress: handleProfile },
        { label: 'Mute notifications', icon: 'notifications-off-outline', onPress: () => soon('Muting') },
        { label: 'Clear chat', icon: 'trash-outline', destructive: true, onPress: onClearChat },
      ],
    }
  }, [sheet, onNotify, soon, onDeleteMessage, onClearChat, handleProfile])

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble item={item} onLongPress={handleBubbleLongPress} />,
    [handleBubbleLongPress]
  )

  return (
    <View className="flex-1 bg-black">
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header — static */}
        <Glass
          className="flex-row items-center gap-2 border-b border-white/10 px-3 pb-3"
          style={{ paddingTop: insets.top + 8 }}
        >
          <IconButton name="chevron-back" onPress={onBack} compact />

          <Pressable onPress={handleProfile} className="flex-1 flex-row items-center gap-3 active:opacity-70">
            <Avatar uri={contact.profilePic} name={contact.username} className="h-10 w-10" />
            <View className="flex-1">
              <Text numberOfLines={1} className="text-[15px] font-semibold text-white">
                {contact.username}
              </Text>
              <Text className={`text-[11px] ${isConnected ? 'text-gray-400' : 'text-amber-400'}`}>
                {isConnected ? 'Tap for contact info' : 'Connecting…'}
              </Text>
            </View>
          </Pressable>

          <IconButton name="call-outline" onPress={() => soon('Voice calls')} compact size={18} />
          <IconButton name="videocam-outline" onPress={() => soon('Video calls')} compact size={19} />
          <IconButton name="ellipsis-vertical" onPress={openMenu} compact size={18} />
        </Glass>

        {/* Messages — only this part scrolls; the toast floats just above the input */}
        <View className="flex-1">
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            className="flex-1 bg-black"
            contentContainerClassName="gap-2.5 px-4 py-4"
            ListEmptyComponent={EmptyChat}
            keyboardShouldPersistTaps="handled"
            // iOS: drag down into the keyboard to dismiss it. Android: scrolling never closes it.
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={9}
          />
          <Toast toast={toast} />
        </View>

        {/* Input — static */}
        <Composer
          safeBottom={insets.bottom}
          onSend={handleSend}
          onAttach={openAttach}
          onVoice={handleVoiceNote}
        />
      </KeyboardAvoidingView>

      <ActionSheet
        visible={!!sheet}
        backdrop={backdrop}
        title={sheetConfig.title}
        options={sheetConfig.options}
        onClose={closeSheet}
      />
    </View>
  )
}