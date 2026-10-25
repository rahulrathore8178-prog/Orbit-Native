import { normalizePost, type SharedPostData } from '@/components/services/chat/sharedPost'
import { authStorage } from '@/lib/auth/authStorage'
import { Friend } from '@/redux/slice/friends'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSelector } from 'react-redux'

// ---------- Types ----------

export type Message = {
  id: string
  content: string
  sender: 'me' | 'them'
  time: string
  fresh?: boolean
  sharedPostId?: string
  sharedPost?: SharedPostData
}

// ---------- Helpers ----------

export const formatTime = (d?: string | number | Date) =>
  (d ? new Date(d) : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')

// http(s)://host  ->  ws(s)://host
const toWsUrl = (url?: string) => (url ?? '').replace(/^http/i, 'ws').replace(/\/+$/, '')

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

// 502/503/504 or no response at all (timeout / network) = server waking up or restarting
const isTransient = (e: any) => {
  const status = e?.response?.status
  return !status || status === 502 || status === 503 || status === 504
}

// One place to read the auth token (the app currently stores it under a few keys).
const getToken = async (): Promise<string | null> =>
  (await authStorage.getToken()) ?? (await AsyncStorage.getItem('user')) ?? (await AsyncStorage.getItem('token'))

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

  // ----- Current user id (same id your web app sends in "register") -----
  // TODO: adjust this selector to wherever your app stores the logged-in user.
  const reduxUserId = useSelector((s: any) => s.dashboard?.currentUser?.id ?? s.auth?.user?._id ?? s.auth?.user?.id)
  const [storedUserId, setStoredUserId] = useState<string | null>(null)
  useEffect(() => {
    ;(async () => {
      const saved = await AsyncStorage.getItem('userId')
      if (saved) return setStoredUserId(saved)
      const fromToken = userIdFromToken(await authStorage.getToken())
      if (fromToken) setStoredUserId(fromToken)
    })()
  }, [])
  const myId: string | undefined = reduxUserId ? String(reduxUserId) : storedUserId ?? undefined

  const wsRef = useRef<WebSocket | null>(null)
  // Keep the latest values available to socket listeners without reconnecting.
  const selectedRef = useRef<Friend | null>(null)
  const onOfflineRef = useRef(onOffline)
  const refetchRef = useRef<() => void>(() => {})
  useEffect(() => {
    selectedRef.current = selectedContact
  }, [selectedContact])
  useEffect(() => {
    onOfflineRef.current = onOffline
  }, [onOffline])

  // ----- WebSocket connection (same protocol as the web app) -----
  useEffect(() => {
    if (!myId) {
      console.log('WS: no user id yet, not connecting')
      return
    }

    let closedByUs = false
    let retry = 0
    let retryTimer: ReturnType<typeof setTimeout> | null = null
    const url = toWsUrl(apiUrl)

    const connect = () => {
      const socket = new WebSocket(url)
      wsRef.current = socket

      socket.onopen = async () => {
        if (wsRef.current !== socket) return // stale socket

        const token = await getToken()
        if (wsRef.current !== socket || socket.readyState !== WebSocket.OPEN) return

        socket.send(JSON.stringify({ type: 'register', userId: myId, token }))

        const wasReconnect = retry > 0
        retry = 0
        setIsConnected(true)

        // The server was unreachable for a while: catch up on anything we missed
        // (also recovers a history fetch that failed during a cold start).
        if (wasReconnect) refetchRef.current()
      }

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type !== 'chat-message') return

          const m = data.message || {}
          const senderId = toId(m.senderId ?? m.sender)
          const text = m.text ?? m.content ?? ''
          const share = extractShare(m)

          // A shared post has empty text, so only drop messages with neither text nor a post.
          if (!senderId || (!text && !share.sharedPostId)) return
          if (senderId === myId) return // ignore echoes of my own messages

          const open = selectedRef.current
          const openIds = open ? [toId(open._id), toId((open as any).id)] : []
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
        } catch (error) {
          console.error('Chat WebSocket message error', error)
        }
      }

      socket.onerror = (e: any) => console.log('WS: error', e?.message ?? e)

      socket.onclose = (e) => {
        console.log('WS: closed', e.code, e.reason)
        if (wsRef.current === socket) wsRef.current = null
        setIsConnected(false)
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
      setIsConnected(false)
    }
  }, [myId, apiUrl])

  // ----- Load history when a chat is opened -----
  const getMessages = useCallback(async () => {
    const id = selectedContact?._id
    if (!id) {
      setMessages([])
      return
    }

    const toMessage = (m: any): Message => {
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
        time:
          m.time && /[:]/.test(String(m.time)) && String(m.time).length <= 8
            ? m.time
            : formatTime(m.createdAt ?? m.timestamp ?? m.time),
        ...extractShare(m),
      }
    }

    const MAX_TRIES = 4
    for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
      try {
        const token = await getToken()
        const response = await axios.get(`${apiUrl}/api/chat/${id}`, {
          withCredentials: true,
          timeout: 20000,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        })
        if (selectedRef.current?._id !== id) return // user already switched/closed the chat
        setMessages((response.data.messages ?? []).map(toMessage))
        return
      } catch (error) {
        const last = attempt === MAX_TRIES - 1
        if (!isTransient(error) || last) {
          console.error('Error fetching messages:', error)
          return
        }
        // Server is probably waking up (Render cold start): wait 1.5s, 3s, 6s and try again.
        await sleep(1500 * 2 ** attempt)
        if (selectedRef.current?._id !== id) return
      }
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

  // ----- Local-only actions (TODO: wire to your API when the endpoints exist) -----
  const deleteMessage = useCallback((id: string) => setMessages((prev) => prev.filter((m) => m.id !== id)), [])
  const clearMessages = useCallback(() => setMessages([]), [])

  return { messages, isConnected, sendMessage, deleteMessage, clearMessages }
}