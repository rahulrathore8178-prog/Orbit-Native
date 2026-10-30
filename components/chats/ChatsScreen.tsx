import {
  ActionSheet, Avatar, Glass, IconButton, SheetOption, Toast, ToastData, ToastVariant, captureBackdrop,
} from '@/components/ui/chats/ui'
import { OrbitBackdrop } from '@/components/search/OrbitbackDrop'
import { MediaDraft, Message } from '@/hooks/chats/useChat'
import { useCall } from '@/lib/calls/callProvider'
import { Friend } from '@/redux/slice/friends'
import { Ionicons } from '@expo/vector-icons'
import * as Clipboard from 'expo-clipboard'
import * as Haptics from 'expo-haptics'
import * as ImagePicker from 'expo-image-picker'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, Modal, Platform, Pressable, Text, View } from 'react-native'
import { KeyboardAvoidingView } from 'react-native-keyboard-controller'
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn, ZoomOut } from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SharedPostBubble } from './SharedPostBubble'
import { useFocusEffect } from 'expo-router'
import { setActiveChat } from '@/hooks/chats/activeChat'
import { useSelector } from 'react-redux'
import { RootState } from '@/redux/store'
import { ChatOrbitLoader } from './ChatOrbitLoader'
import { Composer } from './Composer'
import { MediaBubble, VideoViewer } from './MediaBubble'
import { MediaPreview } from './MediaPreview'
import { ImageViewer } from '@/components/comments/CommentUI'
import GiphyPanel from '@/components/comments/GiphyPanel'

type Props = {
  contact: Friend
  messages: Message[] // oldest -> newest
  isConnected: boolean
  toast: ToastData | null
  hasMore: boolean
  onBack: () => void
  onSend: (text: string) => boolean | Promise<boolean>
  onSendMedia: (draft: MediaDraft) => Promise<boolean> | boolean
  onRetry: (id: string) => void
  onDiscard: (id: string) => void
  onLoadOlder: () => void
  onEditMessage: (id: string, text: string) => Promise<'ok' | 'read' | 'error'>
  onOpenProfile: (contact: Friend) => void
  onDeleteMessage: (id: string, scope: 'me' | 'everyone') => void
  onClearChat: () => void
  onNotify: (text: string, variant?: ToastVariant) => void
}

type Sheet = { kind: 'message'; message: Message } | { kind: 'attach' } | { kind: 'menu' }

const BUBBLE_ENTER = FadeInUp.springify().damping(16).mass(0.5)
const MAX_VIDEO_BYTES = 30 * 1024 * 1024
const MAX_VIDEO_SECONDS = 120

// ---------- Text bubble ----------
const TextBubble = memo(function TextBubble({ item, isMe, tail, onLongPress }: { item: Message; isMe: boolean; tail: boolean; onLongPress: (m: Message) => void }) {
  return (
    <Pressable
      onLongPress={() => onLongPress(item)}
      delayLongPress={250}
      className={`max-w-[80%] rounded-[22px] border px-4 py-2.5 active:opacity-85 ${isMe ? 'border-blue-400/20 bg-[#0f2a6b]' : 'border-white/10 bg-[#17171a]'} ${tail ? (isMe ? 'rounded-br-md' : 'rounded-bl-md') : ''}`}
    >
      <Text className={`text-[15px] leading-[21px] ${isMe ? 'text-blue-50' : 'text-gray-100'}`}>{item.content}</Text>
      <View className="mt-1 flex-row items-center gap-1 self-end">
        {item.edited && <Text className={`text-[10px] italic ${isMe ? 'text-blue-200/60' : 'text-gray-400'}`}>edited</Text>}
        <Text className={`text-[10px] ${isMe ? 'text-blue-200/60' : 'text-gray-400'}`}>{item.time}</Text>
        {isMe && <Ionicons name={item.read ? 'checkmark-done' : 'checkmark'} size={14} color={item.read ? '#38bdf8' : 'rgba(191,219,254,0.6)'} />}
      </View>
    </Pressable>
  )
})

type RowProps = {
  item: Message
  tail: boolean
  gap: boolean
  onLongPress: (m: Message) => void
  onOpenImage: (u: string) => void
  onOpenVideo: (u: string) => void
  onRetry: (m: Message) => void
  onDiscard: (m: Message) => void
}

const Row = memo(function Row({ item, tail, gap, onLongPress, onOpenImage, onOpenVideo, onRetry, onDiscard }: RowProps) {
  const isMe = item.sender === 'me'
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item])
  return (
    <Animated.View
      entering={item.fresh ? BUBBLE_ENTER : undefined}
      className={`flex-row ${isMe ? 'justify-end' : 'justify-start'}`}
      style={{ marginTop: gap ? 8 : 0 }}
    >
      {item.media ? (
        <MediaBubble item={item} isMe={isMe} tail={tail} onLongPress={onLongPress} onOpenImage={onOpenImage} onOpenVideo={onOpenVideo} onRetry={onRetry} onDiscard={onDiscard} />
      ) : item.sharedPostId ? (
        <SharedPostBubble postId={item.sharedPostId} initialPost={item.sharedPost} isMe={isMe} onLongPress={handleLongPress} />
      ) : (
        <TextBubble item={item} isMe={isMe} tail={tail} onLongPress={onLongPress} />
      )}
    </Animated.View>
  )
})

// ---------- Screen ----------
export function ChatScreen({
  contact, messages, isConnected, toast, hasMore, onBack, onSend, onSendMedia, onRetry, onDiscard, onLoadOlder,
  onEditMessage, onOpenProfile, onDeleteMessage, onClearChat, onNotify,
}: Props) {
  const insets = useSafeAreaInsets()
  const listRef = useRef<FlatList<Message>>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showJump, setShowJump] = useState(false)
  const [preview, setPreview] = useState<MediaDraft | null>(null)
  const [viewImage, setViewImage] = useState<string | null>(null)
  const [viewVideo, setViewVideo] = useState<string | null>(null)
  const [gifOpen, setGifOpen] = useState(false)
  const [backdrop, setBackdrop] = useState<string | undefined>()
  const loading = useSelector((s: RootState) => s.chat.loading)

  useFocusEffect(
    useCallback(() => {
      setActiveChat(contact._id)
      return () => setActiveChat(null)
    }, [contact._id])
  )

  const data = useMemo(() => [...messages].reverse(), [messages]) // inverted list wants newest first
  const editing = useMemo(() => messages.find((m) => m.id === editingId) ?? null, [messages, editingId])
  const cancelEdit = useCallback(() => setEditingId(null), [])

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
      if (result === 'ok') { setEditingId(null); return true }
      if (result === 'read') {
        setEditingId(null)
        onNotify("Message was seen, so it can't be edited", 'info')
      } else onNotify("Couldn't edit the message", 'info')
      return false
    },
    [editingId, onEditMessage, onNotify]
  )

  const closeSheet = useCallback(() => setSheet(null), [])
  const openMenu = useCallback(() => setSheet({ kind: 'menu' }), [])
  const handleProfile = useCallback(() => onOpenProfile(contact), [onOpenProfile, contact])
  const hint = useCallback((t: string) => onNotify(t, 'info'), [onNotify])

  const { startCall, state: callState, isReady: callsReady } = useCall()
  const placeCall = useCallback(
    (type: 'audio' | 'video') => {
      if (callState.phase !== 'idle' && callState.phase !== 'ended') return
      if (!callsReady) return onNotify('Connecting… try again in a moment', 'info')
      startCall({ id: contact._id, username: contact.username, profilePic: contact.profilePic }, type)
    },
    [callState.phase, callsReady, contact, onNotify, startCall]
  )

  const toBottom = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), [])

  const handleSend = useCallback((text: string) => { toBottom(); return onSend(text) }, [onSend, toBottom])
  const sendDraft = useCallback((d: MediaDraft) => {
    if (!onSendMedia) return onNotify('Media sending is not connected yet', 'info')
    toBottom()
    onSendMedia(d)
  }, [onSendMedia, toBottom, onNotify])

  // ----- system camera / gallery (crop for photos, trim on iOS for videos) -----
  const assetToDraft = useCallback(
    (a: ImagePicker.ImagePickerAsset): MediaDraft | null => {
      const isVideo = a.type === 'video'
      const duration = a.duration ? Math.round(a.duration / (a.duration > 1000 ? 1000 : 1)) : undefined
      if (isVideo && a.fileSize && a.fileSize > MAX_VIDEO_BYTES) { onNotify('Video is too large (max 30 MB)', 'info'); return null }
      if (isVideo && duration && duration > MAX_VIDEO_SECONDS) { onNotify('Videos can be up to 2 minutes', 'info'); return null }
      return {
        kind: isVideo ? 'video' : 'image',
        uri: a.uri,
        mime: a.mimeType ?? (isVideo ? 'video/mp4' : 'image/jpeg'),
        name: a.fileName ?? (isVideo ? 'video.mp4' : 'photo.jpg'),
        width: a.width,
        height: a.height,
        duration,
      }
    },
    [onNotify]
  )

  const pickOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images', 'videos'],
    allowsEditing: true, // photos: system crop. videos: system trim (iOS)
    quality: 0.85,
    videoMaxDuration: MAX_VIDEO_SECONDS,
    exif: false,
  }

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync()
    if (!perm.granted) return onNotify('Camera permission denied', 'info')
    const res = await ImagePicker.launchCameraAsync(pickOptions)
    if (res.canceled || !res.assets[0]) return
    const d = assetToDraft(res.assets[0])
    if (d) setPreview(d)
  }, [assetToDraft, onNotify]) // eslint-disable-line react-hooks/exhaustive-deps

  const openGallery = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync(pickOptions)
    if (res.canceled || !res.assets[0]) return
    const d = assetToDraft(res.assets[0])
    if (d) setPreview(d)
  }, [assetToDraft]) // eslint-disable-line react-hooks/exhaustive-deps

  const openSheet = useCallback(async (next: Sheet) => {
    const uri = await captureBackdrop()
    setBackdrop(uri)
    setSheet(next)
  }, [])
  const openAttach = useCallback(() => openSheet({ kind: 'attach' }), [openSheet])

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
      const m = messages.find((x) => x.id === sheet.message.id) ?? sheet.message
      const mine = m.sender === 'me'
      if (m.status) {
        return { title: m.status === 'failed' ? "Couldn't send" : 'Sending…', options: [{ label: 'Discard', icon: 'trash-outline', destructive: true, onPress: () => onDiscard(m.id) }] }
      }
      const canEdit = mine && !m.read && !m.sharedPostId && !!m.content
      const del: SheetOption[] = [
        { label: 'Delete for me', icon: 'trash-outline', destructive: true, onPress: () => onDeleteMessage(m.id, 'me') },
        ...(mine ? [{ label: 'Unsend for everyone', icon: 'arrow-undo-outline' as const, destructive: true, onPress: () => onDeleteMessage(m.id, 'everyone') }] : []),
      ]
      const title = m.sharedPostId ? 'Shared post' : m.content ? (m.content.length > 80 ? `${m.content.slice(0, 80)}…` : m.content) : m.media ? 'Media' : undefined
      return {
        title,
        options: [
          ...(m.content ? [{ label: 'Copy', icon: 'copy-outline' as const, onPress: () => { Clipboard.setStringAsync(m.content).then(() => onNotify('Copied to clipboard')) } }] : []),
          ...(canEdit ? [{ label: 'Edit', icon: 'create-outline' as const, onPress: () => setEditingId(m.id) }] : []),
          ...del,
        ],
      }
    }

    if (sheet.kind === 'attach') {
      return {
        title: 'Share',
        options: [
          { label: 'Camera', icon: 'camera-outline', onPress: openCamera },
          { label: 'Photos & videos', icon: 'image-outline', onPress: openGallery },
          { label: 'GIFs & stickers', icon: 'happy-outline', onPress: () => setGifOpen(true) },
        ],
      }
    }

    return {
      options: [
        { label: 'View profile', icon: 'person-outline', onPress: handleProfile },
        { label: 'Clear chat (for me)', icon: 'trash-outline', destructive: true, onPress: onClearChat },
      ],
    }
  }, [sheet, messages, onNotify, onDeleteMessage, onDiscard, onClearChat, handleProfile, openCamera, openGallery])

  const handleRetry = useCallback((m: Message) => onRetry(m.id), [onRetry])
  const handleDiscard = useCallback((m: Message) => onDiscard(m.id), [onDiscard])

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const newer = data[index - 1]
      const older = data[index + 1]
      return (
        <Row
          item={item}
          tail={!newer || newer.sender !== item.sender}
          gap={!!older && older.sender !== item.sender}
          onLongPress={handleBubbleLongPress}
          onOpenImage={setViewImage}
          onOpenVideo={setViewVideo}
          onRetry={handleRetry}
          onDiscard={handleDiscard}
        />
      )
    },
    [data, handleBubbleLongPress, handleRetry, handleDiscard]
  )

  const empty = !loading && messages.length === 0

  return (
    <View className="flex-1 overflow-hidden bg-black">
      <OrbitBackdrop />
      {loading && messages.length === 0 && <ChatOrbitLoader />}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <Animated.View entering={FadeInDown.duration(320)}>
          <Glass className="flex-row items-center gap-2 rounded-b-[28px] border-b border-white/10 px-3 pb-3" style={{ paddingTop: insets.top + 8 }}>
            <IconButton name="chevron-back" onPress={onBack} compact />
            <Pressable onPress={handleProfile} className="flex-1 flex-row items-center gap-3 active:opacity-70">
              <Avatar uri={contact.profilePic} name={contact.username} className="h-10 w-10" />
              <View className="flex-1">
                <Text numberOfLines={1} className="text-[15px] font-semibold text-white">{contact.username}</Text>
                <Text className={`text-[11px] ${isConnected ? 'text-gray-400' : 'text-amber-400'}`}>
                  {isConnected ? 'Tap for contact info' : 'Connecting…'}
                </Text>
              </View>
            </Pressable>
            <IconButton name="call-outline" onPress={() => placeCall('audio')} compact size={18} />
            <IconButton name="videocam-outline" onPress={() => placeCall('video')} compact size={19} />
            <IconButton name="ellipsis-vertical" onPress={openMenu} compact size={18} />
          </Glass>
        </Animated.View>

        <Animated.View entering={FadeIn.duration(380)} className="flex-1">
          <FlatList
            ref={listRef}
            data={data}
            inverted
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            className="flex-1"
            contentContainerClassName="gap-[3px] px-3.5 py-4"
            onScroll={(e) => setShowJump(e.nativeEvent.contentOffset.y > 400)}
            scrollEventThrottle={64}
            onEndReached={hasMore ? onLoadOlder : undefined} // inverted: the "end" is the oldest message
            onEndReachedThreshold={0.4}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={10}
            windowSize={9}
          />

          {/* empty state is NOT inside the inverted list, so it can't come out flipped */}
          {empty && (
            <Animated.View entering={FadeIn.duration(300)} pointerEvents="none" className="absolute inset-0 items-center justify-center gap-2">
              <View className="h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.05]">
                <Text className="text-3xl">👋</Text>
              </View>
              <Text className="text-sm text-gray-500">No messages yet. Say hi!</Text>
            </Animated.View>
          )}

          {showJump && (
            <Animated.View entering={ZoomIn.duration(160)} exiting={ZoomOut.duration(140)} className="absolute bottom-3 right-4">
              <Pressable onPress={toBottom} accessibilityLabel="Scroll to latest message" className="h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-neutral-900/95 active:bg-neutral-800">
                <Ionicons name="chevron-down" size={20} color="#e5e5e5" />
              </Pressable>
            </Animated.View>
          )}
          <Toast toast={toast} />
        </Animated.View>

        <Composer
          safeBottom={insets.bottom}
          contactId={contact._id}
          onSend={handleSend}
          onAttach={openAttach}
          onCamera={openCamera}
          onSendVoice={sendDraft}
          onHint={hint}
          editing={editing}
          onCancelEdit={cancelEdit}
          onSubmitEdit={submitEdit}
        />
      </KeyboardAvoidingView>

      <ActionSheet visible={!!sheet} backdrop={backdrop} title={sheetConfig.title} options={sheetConfig.options} onClose={closeSheet} />

      <MediaPreview draft={preview} onCancel={() => setPreview(null)} onSend={(d) => { setPreview(null); sendDraft(d) }} />
      <ImageViewer uri={viewImage} onClose={() => setViewImage(null)} />
      <VideoViewer uri={viewVideo} onClose={() => setViewVideo(null)} />

      <Modal visible={gifOpen} transparent animationType="slide" statusBarTranslucent onRequestClose={() => setGifOpen(false)}>
        <Pressable className="flex-1 bg-black/50" onPress={() => setGifOpen(false)} />
        <View className="h-[420px] overflow-hidden rounded-t-[28px] border border-white/10 bg-neutral-950" style={{ paddingBottom: insets.bottom }}>
          <View className="items-center py-2.5"><View className="h-1.5 w-11 rounded-full bg-white/25" /></View>
          <GiphyPanel
            onPick={(g: any) => {
              setGifOpen(false)
              sendDraft({ kind: g.kind, url: g.url, width: g.width, height: g.height })
            }}
          />
        </View>
      </Modal>
    </View>
  )
}