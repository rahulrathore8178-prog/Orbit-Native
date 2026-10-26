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
import { OrbitBackdrop } from '@/components/search/OrbitbackDrop'
import { Message } from '@/hooks/chats/useChat'
import { Friend } from '@/redux/slice/friends'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Platform, Pressable, Text, TextInput, View } from 'react-native'
// Frame-synced keyboard handling on both platforms (replaces RN's KeyboardAvoidingView).
import { KeyboardAvoidingView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn, ZoomOut, interpolate, useAnimatedStyle } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedPostBubble } from './SharedPostBubble'

type Props = {
  contact: Friend
  messages: Message[] // oldest -> newest
  isConnected: boolean
  toast: ToastData | null
  onBack: () => void
  onSend: (text: string) => boolean
  /** resolves 'read' when the server refuses because the message was already seen */
  onEditMessage: (id: string, text: string) => Promise<'ok' | 'read' | 'error'>
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
          className={`max-w-[78%] rounded-2xl border px-4 py-2.5 active:opacity-80 ${isMe ? 'rounded-br-md border-blue-500/25 bg-[#0a1c4a]' : 'rounded-bl-md border-white/5 bg-neutral-900'}`}
        >
          <Text className={`text-[14.5px] leading-5 ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>{item.content}</Text>
          <View className="mt-1 flex-row items-center gap-1 self-end">
            {item.edited && <Text className={`text-[10px] italic ${isMe ? 'text-blue-200/60' : 'text-gray-400'}`}>edited</Text>}
            <Text className={`text-[10px] ${isMe ? 'text-blue-200/60' : 'text-gray-400'}`}>{item.time}</Text>
            {isMe && (
              <Ionicons
                name={item.read ? 'checkmark-done' : 'checkmark'}
                size={14}
                color={item.read ? '#38bdf8' : 'rgba(191,219,254,0.6)'}
              />
            )}
          </View>
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
  editing,
  onCancelEdit,
  onSubmitEdit,
}: {
  safeBottom: number
  onSend: (text: string) => boolean | Promise<boolean>
  onAttach: () => void
  onVoice: () => void
  /** message being edited (its text is loaded into the input) */
  editing: Message | null
  onCancelEdit: () => void
  onSubmitEdit: (text: string) => Promise<boolean>
}) {
  const [text, setText] = useState('')
  const inputRef = useRef<TextInput>(null)
  const wasEditing = useRef(false)
  const hasText = text.trim().length > 0

  // entering edit mode loads the message into the input; leaving it clears the input again
  useEffect(() => {
    if (editing) {
      wasEditing.current = true
      setText(editing.content)
      setTimeout(() => inputRef.current?.focus(), 60)
    } else if (wasEditing.current) {
      wasEditing.current = false
      setText('')
    }
  }, [editing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (editing) {
      if (trimmed === editing.content.trim()) return onCancelEdit() // nothing changed
      await onSubmitEdit(trimmed) // the parent leaves edit mode on success and keeps it open on failure
      return
    }
    setText('')
    const ok = await onSend(trimmed)
    if (!ok) setText((cur) => cur || trimmed)
  }

  return (
    <Animated.View className="border-t border-white/10 bg-neutral-950 px-3 pt-2.5" style={wrapStyle}>
      {editing && (
        <Animated.View entering={FadeInUp.duration(160)} className="mb-2 flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
          <Ionicons name="pencil" size={14} color="#38bdf8" />
          <View className="flex-1">
            <Text className="text-[11px] font-semibold text-sky-400">Editing message</Text>
            <Text numberOfLines={1} className="text-[12px] text-gray-400">{editing.content}</Text>
          </View>
          <Pressable onPress={onCancelEdit} hitSlop={10} accessibilityLabel="Cancel edit">
            <Ionicons name="close" size={18} color="#a3a3a3" />
          </Pressable>
        </Animated.View>
      )}
      <View className="flex-row items-end gap-2">
      {!editing && <IconButton name="attach" onPress={onAttach} />}

      {/* Inset (pressed-in) neumorphic input */}
      <View className="min-h-[40px] flex-1 justify-center rounded-3xl border border-white/5 border-t-black bg-black px-4">
        <TextInput
          ref={inputRef}
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
          <IconButton name={editing ? 'checkmark' : 'send'} onPress={submit} solid color="#fff" size={17} />
        ) : editing ? (
          <IconButton name="close" onPress={onCancelEdit} />
        ) : (
          <IconButton name="mic-outline" onPress={onVoice} />
        )}
      </Animated.View>
      </View>
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
  onEditMessage,
  onOpenProfile,
  onDeleteMessage,
  onClearChat,
  onNotify,
}: Props) {
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<Message>>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showJump, setShowJump] = useState(false)

  // Inverted list wants newest first. Offset 0 is the bottom, so the chat opens
  // at the latest message with no scrolling, and the latest message stays
  // visible when the keyboard opens or the composer grows.
  const data = useMemo(() => [...messages].reverse(), [messages])

  // always the live copy, so "seen" arriving over the socket is reflected immediately
  const editing = useMemo(() => messages.find((m) => m.id === editingId) ?? null, [messages, editingId])
  const cancelEdit = useCallback(() => setEditingId(null), [])

  // seen while editing -> editing is no longer allowed
  useEffect(() => {
    if (editing?.read) {
      setEditingId(null)
      onNotify("Message was seen, so it can't be edited", 'info')
    }
  }, [editing?.read]) // eslint-disable-line react-hooks/exhaustive-deps

  const submitEdit = useCallback(
    async (text: string) => {
      if (!editingId) return false
      const result = await onEditMessage(editingId, text)
      if (result === 'ok') {
        setEditingId(null)
        return true
      }
      if (result === 'read') {
        setEditingId(null)
        onNotify("Message was seen, so it can't be edited", 'info')
      } else {
        onNotify("Couldn't edit the message", 'info')
      }
      return false
    },
    [editingId, onEditMessage, onNotify]
  )

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
      // use the live copy: it may have been seen while the sheet was opening
      const m = messages.find((x) => x.id === sheet.message.id) ?? sheet.message
      // edit only my own text messages that haven't been seen yet
      const canEdit = m.sender === 'me' && !m.read && !m.sharedPostId
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
          ...(canEdit ? [{ label: 'Edit', icon: 'create-outline' as const, onPress: () => setEditingId(m.id) }] : []),
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
  }, [sheet, messages, onNotify, soon, onDeleteMessage, onClearChat, handleProfile])

  const renderItem = useCallback(
    ({ item }: { item: Message }) => <MessageBubble item={item} onLongPress={handleBubbleLongPress} />,
    [handleBubbleLongPress]
  )

  return (
    <View className="flex-1 overflow-hidden bg-black">
      <OrbitBackdrop />
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(320)}>
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
        </Animated.View>

        {/* Messages — only this part scrolls; the toast floats just above the input */}
        <Animated.View entering={FadeIn.duration(380)} className="flex-1">
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            className="flex-1"
            contentContainerClassName="gap-2.5 px-4 py-4"
            onScroll={(e) => setShowJump(e.nativeEvent.contentOffset.y > 400)}
            scrollEventThrottle={64}
            ListEmptyComponent={EmptyChat}
            keyboardShouldPersistTaps="handled"
            // iOS: drag down into the keyboard to dismiss it. Android: scrolling never closes it.
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={9}
          />
          {/* jump back to the newest message (the list is inverted, so offset 0 is the bottom) */}
          {showJump && (
            <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(140)} className="absolute bottom-3 right-4">
              <Pressable
                onPress={() => listRef.current?.scrollToOffset({ offset: 0, animated: true })}
                accessibilityLabel="Scroll to latest message"
                className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-neutral-900/95 shadow-lg shadow-black active:bg-neutral-800"
              >
                <Ionicons name="chevron-down" size={20} color="#e5e5e5" />
              </Pressable>
            </Animated.View>
          )}
          <Toast toast={toast} />
        </Animated.View>

        {/* Input — static */}
        <Composer
          safeBottom={insets.bottom}
          onSend={handleSend}
          onAttach={openAttach}
          onVoice={handleVoiceNote}
          editing={editing}
          onCancelEdit={cancelEdit}
          onSubmitEdit={submitEdit}
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