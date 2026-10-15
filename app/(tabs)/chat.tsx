import { ChatScreen } from '@/components/chats/ChatsScreen'
import '@/global.css'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
    FlatList,
    Image,
    Pressable,
    Text,
    View
} from 'react-native'
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { useSelector } from 'react-redux'
import { API_URL } from '../../lib/utils'

// ---------- Types ----------

type Message = {
  id: string
  content: string
  sender: 'me' | 'them'
  time: string
}

const formatTime = (d?: string | number | Date) =>
  (d ? new Date(d) : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

// http(s)://host  ->  ws(s)://host  (same host/port your web client connects to)
const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')

const toWsUrl = (url?: string) => (url ?? '').replace(/^http/i, 'ws').replace(/\/+$/, '')

// Minimal JWT payload reader (no library) so we can get the user id from the stored token.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const b64decode = (input: string) => {
  let bits = 0
  let value = 0
  let out = ''
  for (const ch of input.replace(/=+$/, '')) {
    const idx = B64.indexOf(ch)
    if (idx < 0) continue
    value = (value << 6) | idx
    bits += 6
    if (bits >= 8) {
      bits -= 8
      out += String.fromCharCode((value >> bits) & 0xff)
      value &= (1 << bits) - 1
    }
  }
  return out
}
const userIdFromToken = (token?: string | null): string | undefined => {
  try {
    if (!token) return undefined
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const p = JSON.parse(b64decode(payload))
    const id = p.id ?? p._id ?? p.userId ?? p.user?.id ?? p.user?._id ?? p.sub
    return id ? String(id) : undefined
  } catch {
    return undefined
  }
}

// ---------- Message bubble ----------

function MessageBubble({ item }: { item: Message }) {
  const isMe = item.sender === 'me'
  return (
    <Animated.View
      entering={FadeInUp.springify().damping(14).mass(0.5)}
      style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}
      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-gray-700' : 'bg-neutral-800'}`}
    >
      <Text className="text-gray-100 text-[14.5px] leading-5">{item.content}</Text>
      <Text className="text-gray-400 text-[10px] mt-1 self-end">{item.time}</Text>
    </Animated.View>
  )
}

// ---------- Contacts list screen ----------

function ContactsScreen({
  contacts,
  filteredFriends,
  onSelect,
}: {
  contacts?: Friend[]
  filteredFriends?: Friend[]
  onSelect: (contact: Friend) => void
}) {
  const data = filteredFriends ?? contacts ?? []
  // const profilePic = stripHost(contacts?.profilePic)
  // console.log('contacts', contacts);
  // console.log('filteredFriends', filteredFriends);
  return (
    <View style={{ flex: 1 }} className="flex-1 bg-black pt-14">
      <Text className="text-white text-center text-2xl font-bold px-5 pb-4">Messages</Text>
      <FlatList
        data={data}
        keyExtractor={(c) => c._id}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-900 ml-[88px]" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            className="flex-row items-center gap-3 px-5 py-3 active:bg-neutral-900"
          >
            <View className="relative">
              <Image source={{ uri: item?.profilePic }} className="h-14 w-14 rounded-full" />
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-[15px] font-semibold">{item.username}</Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

// ---------- Chat screen ----------

// function ChatScreen({
//   contact,
//   onBack,
//   messages,
//   onSend,
// }: {
//   contact: Friend
//   onBack: () => void
//   messages: Message[]
//   onSend: (text: string) => boolean
// }) {
//   const input = useSelector((state: RootState) => state.chat.input)
//   const listRef = useRef<FlatList>(null)
//   const dispatch = useAppDispatch()

//   const handleSend = () => {
//     const trimmed = input.trim()
//     if (!trimmed) return
//     // Only clear the input if the message actually went out, so nothing typed is lost.
//     if (onSend(trimmed)) dispatch({ type: 'chat/setInput', payload: '' })
//   }

//   return (
//     <Animated.View entering={SlideInRight.duration(220)} style={{ flex: 1 }} className="bg-black">
//       <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="flex-1">
//         {/* Header — static */}
//         <View className="flex-row items-center gap-3 px-3 pt-14 pb-3 bg-neutral-950 border-b border-neutral-800">
//           <Pressable onPress={onBack} hitSlop={8} className="p-1">
//             <Ionicons name="chevron-back" size={24} color="white" />
//           </Pressable>

//           <Image source={{ uri: contact.profilePic }} className="h-10 w-10 rounded-full" />

//           <View className="flex-1">
//             <Text className="text-white text-[15px] font-semibold">{contact.username}</Text>
//           </View>

//           <Pressable hitSlop={8} className="p-1.5">
//             <Ionicons name="information-circle-outline" size={22} color="white" />
//           </Pressable>
//           <Pressable hitSlop={8} className="p-1.5">
//             <Feather name="phone" size={19} color="white" />
//           </Pressable>
//           <Pressable hitSlop={8} className="p-1.5">
//             <Ionicons name="videocam-outline" size={23} color="white" />
//           </Pressable>
//         </View>

//         {/* Chat — only this part scrolls */}
//         <FlatList
//           ref={listRef}
//           data={messages}
//           keyExtractor={(m) => m.id}
//           renderItem={({ item }) => <MessageBubble item={item} />}
//           className="flex-1 bg-black"
//           contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}
//           onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
//         />

//         {/* Input — static */}
//         <View className="flex-row items-center gap-2 px-3 py-2.5 bg-neutral-900 border-t border-neutral-800">
//           <Pressable hitSlop={6} className="p-1.5">
//             <Feather name="paperclip" size={20} color="#9ca3af" />
//           </Pressable>

//           <View className="flex-1 flex-row items-center bg-neutral-700 rounded-full px-3 py-1.5">
//             <Pressable hitSlop={6} className="pr-2">
//               <Ionicons name="happy-outline" size={19} color="#9ca3af" />
//             </Pressable>
//             <TextInput
//               value={input}
//               onChangeText={(text) => dispatch({ type: 'chat/setInput', payload: text })}
//               onSubmitEditing={handleSend}
//               returnKeyType="send"
//               placeholder="Message..."
//               placeholderTextColor="#9ca3af"
//               className="flex-1 text-white text-[14px]"
//             />
//           </View>

//           <Pressable hitSlop={6} className="p-1.5">
//             <Ionicons name="camera-outline" size={21} color="#9ca3af" />
//           </Pressable>

//           <Pressable hitSlop={6} className="p-1.5" onPress={handleSend}>
//             {input.trim().length > 0 ? (
//               <Ionicons name="send" size={20} color="white" />
//             ) : (
//               <Ionicons name="mic-outline" size={22} color="#9ca3af" />
//             )}
//           </Pressable>
//         </View>
//       </KeyboardAvoidingView>
//     </Animated.View>
//   );
// };

// ---------- Root ----------

export default function MessagesApp() {
  const dispatch = useAppDispatch()
  const [selectedContact, setSelectedContact] = useState<Friend | null>(null)
  const friends = useSelector((state: RootState) => state.friends.friends)
  const [query, setQuery] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  // ----- Current user id (same id your web app sends in "register") -----
  // TODO: adjust this selector to wherever your app stores the logged-in user.
  const reduxUserId = useSelector((s: any) => s.dashboard?.currentUser?.id ?? s.auth?.user?._id ?? s.auth?.user?.id)
  const [storedUserId, setStoredUserId] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      const saved = await AsyncStorage.getItem('userId')
      if (saved) return setStoredUserId(saved)
      const fromToken = userIdFromToken(await AsyncStorage.getItem('token'))
      if (fromToken) setStoredUserId(fromToken)
    })()
  }, [])
  const myId: string | undefined = reduxUserId ? String(reduxUserId) : storedUserId ?? undefined

  // ----- Toast -----
  const [toast, setToast] = useState<string | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((text: string) => {
    setToast(text)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  const wsRef = useRef<WebSocket | null>(null)
  // Keep the latest selected contact available to socket listeners without reconnecting.
  const selectedRef = useRef<Friend | null>(null)
  useEffect(() => {
    selectedRef.current = selectedContact
  }, [selectedContact])

  // ----- WebSocket connection (same protocol as the web app) -----
  useEffect(() => {
    if (!myId) {
      console.log('WS: no user id yet, not connecting')
      return
    }

    let closedByUs = false
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const url = toWsUrl(API_URL)

    const connect = () => {
      console.log('WS: connecting to', url)
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onopen = () => {
        console.log('WS: open')
        retry = 0
        socket.send(JSON.stringify({ type: 'register', userId: myId }))
      }

      socket.onmessage = (event) => {
        try {
          console.log('WS: incoming', event.data)
          const data = JSON.parse(event.data)
          if (data.type !== 'chat-message') return

          const m = data.message || {}
          const senderId = toId(m.senderId ?? m.sender)
          const text = m.text ?? m.content
          if (!senderId || !text) return
          if (senderId === myId) return // ignore echoes of my own messages

          const open = selectedRef.current
          const openIds = open ? [toId(open._id), toId((open as any).id)] : []
          if (!open || !openIds.includes(senderId)) {
            // console.log('WS: ignored (not open chat). sender:', senderId, 'open:', openIds)
            return
          }

          const incoming: Message = {
            id: String(m.id ?? m._id ?? Date.now()),
            content: text,
            sender: 'them',
            time: formatTime(m.timestamp || m.createdAt || m.time),
          }
          setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]))
        } catch (error) {
          console.error('Chat WebSocket message error', error)
        }
      }

      socket.onerror = (e: any) => console.log('WS: error', e?.message ?? e)

      socket.onclose = (e) => {
        console.log('WS: closed', e.code, e.reason)
        if (wsRef.current === socket) wsRef.current = null
        if (closedByUs) return
        // Reconnect with backoff (1s, 2s, 4s ... max 10s)
        const delay = Math.min(1000 * 2 ** retry, 10000)
        retry += 1
        retryTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      closedByUs = true
      if (retryTimer) clearTimeout(retryTimer)
      const s = wsRef.current
      wsRef.current = null
      s?.close()
    }
  }, [myId])

  // ----- Load history when a chat is opened -----
  const getMessages = useCallback(async () => {
    const id = selectedContact?._id
    if (!id) {
      setMessages([])
      return
    }
    try {
      const token = await AsyncStorage.getItem('token')
      const response = await axios.get(`${API_URL}/api/chat/${id}`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      const list: Message[] = (response.data.messages ?? []).map((m: any) => {
        // Keep 'me'/'them' if the API already sends it; otherwise work it out from the sender id.
        const sender: 'me' | 'them' =
          m.sender === 'me' || m.sender === 'them'
            ? m.sender
            : toId(m.senderId ?? m.sender) === myId
              ? 'me'
              : 'them'
        return {
          id: String(m.id ?? m._id),
          content: m.content ?? m.text ?? '',
          sender,
          time: m.time && /[:]/.test(String(m.time)) && String(m.time).length <= 8 ? m.time : formatTime(m.createdAt ?? m.timestamp ?? m.time),
        }
      })
      setMessages(list)
    } catch (error) {
      console.error('Error fetching messages:', error)
    }
  }, [selectedContact, myId])

  useEffect(() => {
    getMessages()
  }, [getMessages])

  useEffect(() => {
    dispatch(fetchFriends())
  }, [])

  // ----- Send -----
  const handleSend = useCallback(
    (text: string): boolean => {
      const contact = selectedRef.current
      const ws = wsRef.current
      if (!contact) return false

      if (!myId || !ws || ws.readyState !== WebSocket.OPEN) {
        showToast('Message not sent. Check your internet connection.')
        return false
      }

      const now = new Date()
      const id = String(Date.now())
      try {
        // Same payload shape as the web client.
        ws.send(
          JSON.stringify({
            type: 'chat-message',
            message: { id, senderId: myId, recipientId: contact._id, text, time: now },
          })
        )
      } catch {
        showToast('Message not sent. Check your internet connection.')
        return false
      }

      setMessages((prev) => [...prev, { id, content: text, sender: 'me', time: formatTime(now) }])
      return true
    },
    [myId, showToast]
  )

  const filteredFriends = useMemo(() => {
    if (!query.trim()) return friends
    const q = query.trim().toLowerCase()
    return friends.filter((f: Friend) => f.username.toLowerCase().includes(q))
  }, [friends, query])

  return (
    <View style={{ flex: 1 }}>
      {toast && (
        <Animated.View
          entering={FadeInUp.duration(200)}
          exiting={FadeOutUp.duration(200)}
          pointerEvents="none"
          style={{ position: 'absolute', top: 56, left: 0, right: 0, zIndex: 50, alignItems: 'center' }}
        >
          <View className="bg-neutral-800 border border-neutral-700 rounded-full px-4 py-2 flex-row items-center gap-2">
            <Ionicons name="cloud-offline-outline" size={16} color="#f87171" />
            <Text className="text-gray-100 text-[13px]">{toast}</Text>
          </View>
        </Animated.View>
      )}
      {selectedContact ? (
        <ChatScreen
          messages={messages}
          contact={selectedContact}
          onBack={() => setSelectedContact(null)}
          onSend={handleSend}
        />
      ) : (
        <ContactsScreen contacts={friends} filteredFriends={filteredFriends} onSelect={setSelectedContact} />
      )}
    </View>
  )
}