import { normalizePost, type SharedPostData } from '@/components/services/chat/sharedPost'
import { useMyUserId } from '@/hooks/chats/useMyUserId'
import { acquireChatSocket, isChatSocketConnected, subscribeChatSocket, subscribeChatStatus } from './chatSocket'
import { authStorage } from '@/lib/auth/authStorage'
import { Friend } from '@/redux/slice/friends'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useAppDispatch } from '@/redux/store'
import { setChatLoading } from '@/redux/slice/chatSlice'

// ---------- Types ----------

export type Message = {
  id: string
  content: string
  sender: 'me' | 'them'
  time: string
  fresh?: boolean
  /** my message was seen by the other person (only meaningful when sender === 'me') */
  read?: boolean
  edited?: boolean
  sharedPostId?: string
  sharedPost?: SharedPostData
}

// ---------- Helpers ----------

export const formatTime = (d?: string | number | Date) =>
  (d ? new Date(d) : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// 502/503/504 or no response at all (timeout / network) = server waking up or restarting
const isTransient = (e: any) => {
  const status = e?.response?.status
  return !status || status === 502 || status === 503 || status === 504
}

// One place to read the auth token (the app currently stores it under a few keys).
const getToken = async (): Promise<string | null> =>
  (await authStorage.getToken()) ?? (await AsyncStorage.getItem('user')) ?? (await AsyncStorage.getItem('token'))

/** Pulls the shared-post fields out of a raw API / websocket message. */
export function extractShare(raw: any): Pick<Message, 'sharedPostId' | 'sharedPost'> {
  const populated = raw?.sharedPost && typeof raw.sharedPost === 'object' ? raw.sharedPost : undefined
  const id =
    raw?.sharedPostId ?? populated?.id ?? populated?._id ?? (typeof raw?.sharedPost === 'string' ? raw.sharedPost : undefined)
  return id
    ? { sharedPostId: String(id), sharedPost: populated ? normalizePost(populated) : undefined }
    : {}
}

// ---------- Hook ----------

type Params = {
  apiUrl: string
  selectedContact: Friend | null
  /** called when the user tries to send while the socket is down */
  onOffline: () => void
}

export function useChat({ apiUrl, selectedContact, onOffline }: Params) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const dispatch = useAppDispatch();

  const myId = useMyUserId()

  // Keep the latest values available to socket listeners without reconnecting.
  const selectedRef = useRef<Friend | null>(null)
  const onOfflineRef = useRef(onOffline)
  const refetchRef = useRef<() => void>(() => { })
  const markReadRef = useRef<() => void>(() => { })
  useEffect(() => {
    selectedRef.current = selectedContact
  }, [selectedContact])
  useEffect(() => {
    onOfflineRef.current = onOffline
  }, [onOffline])

  // ----- Shared WebSocket (one connection for the whole app, see lib/chats/chatSocket.ts) -----
  useEffect(() => {
    if (!myId) {
      console.log('WS: no user id yet, not connecting')
      return
    }

    const release = acquireChatSocket(myId, apiUrl)
    setIsConnected(isChatSocketConnected())

    const offStatus = subscribeChatStatus((connected, reconnected) => {
      setIsConnected(connected)
      // The server was unreachable for a while: catch up on anything we missed.
      if (connected && reconnected) refetchRef.current()
    })

    const offMessage = subscribeChatSocket((data) => {
      try {
        const open = selectedRef.current
        const openIds = open ? [toId(open._id), toId((open as any).id)] : []

        // The other person opened the chat: all my messages to them are now seen.
        if (data.type === 'messages-read') {
          if (openIds.includes(toId(data.readerId))) {
            setMessages((prev) =>
              prev.some((x) => x.sender === 'me' && !x.read) ? prev.map((x) => (x.sender === 'me' ? { ...x, read: true } : x)) : prev
            )
          }
          return
        }

        // A message was edited (by the other person, before I saw it).
        if (data.type === 'message-edited') {
          const em = data.message || {}
          const eid = String(em.id ?? em._id ?? '')
          if (!eid) return
          setMessages((prev) => prev.map((x) => (x.id === eid ? { ...x, content: em.text ?? em.content ?? x.content, edited: true } : x)))
          return
        }

        if (data.type !== 'chat-message') return

        const m = data.message || {}
        const senderId = toId(m.senderId ?? m.sender)
        const text = m.text ?? m.content ?? ''
        const share = extractShare(m)

        // A shared post has empty text, so only drop messages with neither text nor a post.
        if (!senderId || (!text && !share.sharedPostId)) return
        if (senderId === myId) return // ignore echoes of my own messages

        if (!open || !openIds.includes(senderId)) return

        const incoming: Message = {
          id: String(m.id ?? m._id ?? Date.now()),
          content: text,
          sender: 'them',
          time: formatTime(m.timestamp || m.createdAt || m.time),
          fresh: true,
          ...share,
        }
        setMessages((prev) => (prev.some((x) => x.id === incoming.id) ? prev : [...prev, incoming]))
        // I'm looking at this chat right now, so the new message counts as seen.
        markReadRef.current()
      } catch (error) {
        console.error('Chat WebSocket message error', error)
      }
    })

    return () => {
      offMessage()
      offStatus()
      release()
      setIsConnected(false)
    }
  }, [myId, apiUrl])

  // ----- Load history when a chat is opened -----
  const getMessages = useCallback(async () => {
    dispatch(setChatLoading(true))

    try {
      const id = selectedContact?._id
      const t0 = Date.now()

      console.log('[chat] getMessages start', id)

      if (!id) {
        setMessages([])
        return
      }

      const toMessage = (m: any): Message => {
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
          time:
            m.time &&
              /[:]/.test(String(m.time)) &&
              String(m.time).length <= 8
              ? m.time
              : formatTime(
                m.createdAt ??
                m.timestamp ??
                m.time
              ),
          read: m.read !== false,
          edited: !!m.edited,
          ...extractShare(m),
        }
      }

      const MAX_TRIES = 4

      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        try {
          const token = await getToken()

          console.log('[chat] token ms', Date.now() - t0)

          const response = await axios.get(
            `${apiUrl}/api/chat/${id}`,
            {
              withCredentials: true,
              timeout: 20000,
              headers: token
                ? {
                  Authorization: `Bearer ${token}`,
                }
                : undefined,
            }
          )

          console.log(
            '[chat] response ms',
            Date.now() - t0
          )

          if (selectedRef.current?._id !== id) {
            return
          }

          setMessages(
            (response.data.messages ?? []).map(
              toMessage
            )
          )

          return
        } catch (error) {
          const last = attempt === MAX_TRIES - 1

          if (!isTransient(error) || last) {
            console.error(
              'Error fetching messages:',
              error
            )
            return
          }

          await sleep(1500 * 2 ** attempt)

          if (selectedRef.current?._id !== id) {
            return
          }
        }
      }
    } finally {
      dispatch(setChatLoading(false))
    }
  }, [selectedContact, myId, apiUrl])

  useEffect(() => {
    refetchRef.current = getMessages
    getMessages()
  }, [getMessages])

  // ----- Send -----
  const sendMessage = useCallback(
    async (text: string, sharedPostId?: string): Promise<boolean> => {
      const contact = selectedRef.current
      if (!contact || !myId) return false

      try {
        const token = await getToken()
        const { data } = await axios.post(
          `${apiUrl}/api/chat/${contact._id}`,
          { text, sharedPostId },
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        )

        const saved = data?.message
        const next: Message = {
          id: String(saved?.id ?? saved?._id ?? Date.now()),
          content: saved?.text ?? text,
          sender: 'me',
          time: formatTime(saved?.timestamp ?? new Date()),
          fresh: true,
          read: false,
          ...extractShare(saved ?? { sharedPostId }),
        }

        setMessages((prev) => (prev.some((m) => m.id === next.id) ? prev : [...prev, next]))
        return true
      } catch (error) {
        console.error('Send message error:', error)
        return false
      }
    },
    [myId, apiUrl]
  )

  // ----- Seen: tell the server I read this conversation (it notifies the sender over the socket) -----
  const markRead = useCallback(async () => {
    const contact = selectedRef.current
    if (!contact) return
    try {
      const token = await getToken()
      await axios.patch(`${apiUrl}/api/chat/${contact._id}/read`, {}, { headers: token ? { Authorization: `Bearer ${token}` } : undefined })
    } catch (error) {
      console.log('markRead failed', (error as any)?.message)
    }
  }, [apiUrl])
  useEffect(() => {
    markReadRef.current = markRead
  }, [markRead])

  // ----- Edit (only possible until the other person has seen the message) -----
  const editMessage = useCallback(
    async (id: string, text: string): Promise<'ok' | 'read' | 'error'> => {
      const clean = text.trim()
      if (!clean) return 'error'
      try {
        const token = await getToken()
        await axios.patch(
          `${apiUrl}/api/chat/${id}`,
          { text: clean },
          { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
        )
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: clean, edited: true } : m)))
        return 'ok'
      } catch (error: any) {
        // 400 = already seen: lock the message in the UI too
        if (error?.response?.status === 400) {
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, read: true } : m)))
          return 'read'
        }
        console.error('Edit message error:', error)
        return 'error'
      }
    },
    [apiUrl]
  )

  // ----- Local-only actions (TODO: wire to your API when the endpoints exist) -----
  const deleteMessage = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.id !== id)), [])
  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isConnected, sendMessage, editMessage, markRead, deleteMessage, clearMessages }
}