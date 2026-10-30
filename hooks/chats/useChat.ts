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
import { setOpenChatId } from '@/redux/slice/chatBadgeSlice'

// ---------- Types ----------
export type MessageMedia = {
  type: 'image' | 'video' | 'audio' | 'gif' | 'sticker'
  url: string
  width?: number
  height?: number
  duration?: number
}

export type Message = {
  id: string
  content: string
  sender: 'me' | 'them'
  time: string
  fresh?: boolean
  read?: boolean
  edited?: boolean
  sharedPostId?: string
  sharedPost?: SharedPostData
  media?: MessageMedia
  status?: 'sending' | 'failed'
  progress?: number
}

/** What the app hands over to send an attachment. */
export type MediaDraft = {
  kind: 'image' | 'video' | 'voice' | 'gif' | 'sticker'
  uri?: string // local file (image / video / voice)
  mime?: string
  name?: string
  url?: string // gif / sticker (GIPHY)
  width?: number
  height?: number
  duration?: number // seconds
  text?: string // caption (not for voice notes)
}

// ---------- Helpers ----------
export const formatTime = (d?: string | number | Date) =>
  (d ? new Date(d) : new Date()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
const isTransient = (e: any) => {
  const status = e?.response?.status
  return !status || status === 502 || status === 503 || status === 504
}
const getToken = async (): Promise<string | null> =>
  (await authStorage.getToken()) ?? (await AsyncStorage.getItem('user')) ?? (await AsyncStorage.getItem('token'))
const authHeaders = async () => {
  const t = await getToken()
  return t ? { Authorization: `Bearer ${t}` } : {}
}

export function extractShare(raw: any): Pick<Message, 'sharedPostId' | 'sharedPost'> {
  const populated = raw?.sharedPost && typeof raw.sharedPost === 'object' ? raw.sharedPost : undefined
  const id =
    raw?.sharedPostId ?? populated?.id ?? populated?._id ?? (typeof raw?.sharedPost === 'string' ? raw.sharedPost : undefined)
  return id ? { sharedPostId: String(id), sharedPost: populated ? normalizePost(populated) : undefined } : {}
}

const toMedia = (m: any, apiUrl: string): MessageMedia | undefined => {
  if (!m?.url || !m.type) return undefined
  return {
    type: m.type,
    url: /^https?:/i.test(m.url) ? m.url : `${apiUrl}${m.url}`,
    width: m.width,
    height: m.height,
    duration: m.duration,
  }
}

const mapMessage = (m: any, myId: string, apiUrl: string): Message => {
  const sender: 'me' | 'them' =
    m.sender === 'me' || m.sender === 'them' ? m.sender : toId(m.senderId ?? m.sender) === myId ? 'me' : 'them'
  return {
    id: String(m.id ?? m._id),
    content: m.text ?? m.content ?? '',
    sender,
    time: formatTime(m.timestamp ?? m.createdAt ?? m.time),
    read: m.read !== false,
    edited: !!m.edited,
    media: toMedia(m.media, apiUrl),
    ...extractShare(m),
  }
}

const tempMedia = (d: MediaDraft): MessageMedia => ({
  type: d.kind === 'voice' ? 'audio' : d.kind,
  url: d.uri ?? d.url ?? '',
  width: d.width,
  height: d.height,
  duration: d.duration,
})

// ---------- Hook ----------
type Params = { apiUrl: string; selectedContact: Friend | null; onOffline: () => void }

export function useChat({ apiUrl, selectedContact, onOffline }: Params) {
  const [messages, setMessages] = useState<Message[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const dispatch = useAppDispatch()
  const myId = useMyUserId()

  const selectedRef = useRef<Friend | null>(null)
  const onOfflineRef = useRef(onOffline)
  const refetchRef = useRef<() => void>(() => { })
  const markReadRef = useRef<() => void>(() => { })
  const pendingRef = useRef(new Map<string, { contactId: string; draft: MediaDraft }>())
  const loadingOlder = useRef(false)

  useEffect(() => { selectedRef.current = selectedContact }, [selectedContact])
  useEffect(() => { onOfflineRef.current = onOffline }, [onOffline])
  useEffect(() => {
    dispatch(setOpenChatId(selectedContact ? toId(selectedContact._id) : null))
    return () => { dispatch(setOpenChatId(null)) }
  }, [selectedContact?._id, dispatch])

  const patchMsg = useCallback((id: string, changes: Partial<Message>) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...changes } : m)))
  }, [])

  // ----- Shared WebSocket -----
  useEffect(() => {
    if (!myId) return
    const release = acquireChatSocket(myId, apiUrl)
    setIsConnected(isChatSocketConnected())

    const offStatus = subscribeChatStatus((connected, reconnected) => {
      setIsConnected(connected)
      if (connected && reconnected) refetchRef.current()
    })

    const offMessage = subscribeChatSocket((data) => {
      try {
        const open = selectedRef.current
        const openIds = open ? [toId(open._id), toId((open as any).id)] : []

        if (data.type === 'messages-read') {
          if (openIds.includes(toId(data.readerId))) {
            setMessages((prev) =>
              prev.some((x) => x.sender === 'me' && !x.read) ? prev.map((x) => (x.sender === 'me' ? { ...x, read: true } : x)) : prev
            )
          }
          return
        }

        if (data.type === 'message-edited') {
          const em = data.message || {}
          const eid = String(em.id ?? em._id ?? '')
          if (!eid) return
          setMessages((prev) => prev.map((x) => (x.id === eid ? { ...x, content: em.text ?? em.content ?? x.content, edited: true } : x)))
          return
        }

        // the other person unsent a message
        if (data.type === 'message-deleted') {
          const did = String(data.messageId ?? '')
          if (did) setMessages((prev) => prev.filter((x) => x.id !== did))
          return
        }

        if (data.type !== 'chat-message') return

        const m = data.message || {}
        const senderId = toId(m.senderId ?? m.sender)
        const text = m.text ?? m.content ?? ''
        const share = extractShare(m)
        const media = toMedia(m.media, apiUrl)

        if (!senderId || (!text && !share.sharedPostId && !media)) return
        if (senderId === myId) return
        if (!open || !openIds.includes(senderId)) return

        const incoming: Message = {
          id: String(m.id ?? m._id ?? Date.now()),
          content: text,
          sender: 'them',
          time: formatTime(m.timestamp || m.createdAt || m.time),
          fresh: true,
          media,
          ...share,
        }
        setMessages((prev) => (prev.some((x) => x.id === incoming.id) ? prev : [...prev, incoming]))
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

  // ----- History (newest page) -----
  const getMessages = useCallback(async () => {
    dispatch(setChatLoading(true))
    try {
      const id = selectedContact?._id
      if (!id) {
        setMessages([])
        return
      }
      const MAX_TRIES = 4
      for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
        try {
          const response = await axios.get(`${apiUrl}/api/chat/${id}`, {
            withCredentials: true,
            timeout: 20000,
            headers: await authHeaders(),
          })
          if (selectedRef.current?._id !== id) return
          const fetched: Message[] = (response.data.messages ?? []).map((m: any) => mapMessage(m, myId, apiUrl))
          // keep anything still uploading or failed
          setMessages((prev) => [...fetched, ...prev.filter((m) => m.status)])
          setHasMore(!!response.data.hasMore)
          return
        } catch (error) {
          const last = attempt === MAX_TRIES - 1
          if (!isTransient(error) || last) {
            console.error('Error fetching messages:', error)
            return
          }
          await sleep(1500 * 2 ** attempt)
          if (selectedRef.current?._id !== id) return
        }
      }
    } finally {
      dispatch(setChatLoading(false))
    }
  }, [selectedContact, myId, apiUrl, dispatch])

  useEffect(() => {
    refetchRef.current = getMessages
    getMessages()
  }, [getMessages])

  /** Older page, called when the user scrolls to the top of the chat. */
  const loadOlder = useCallback(async () => {
    const contact = selectedRef.current
    if (!contact || !hasMore || loadingOlder.current) return
    const oldest = messages.find((m) => !m.status)
    if (!oldest) return
    loadingOlder.current = true
    try {
      const { data } = await axios.get(`${apiUrl}/api/chat/${contact._id}`, {
        params: { before: oldest.id },
        timeout: 20000,
        headers: await authHeaders(),
      })
      if (selectedRef.current?._id !== contact._id) return
      const older: Message[] = (data.messages ?? []).map((m: any) => mapMessage(m, myId, apiUrl))
      setMessages((prev) => {
        const have = new Set(prev.map((m) => m.id))
        return [...older.filter((m) => !have.has(m.id)), ...prev]
      })
      setHasMore(!!data.hasMore)
    } catch (e) {
      console.log('loadOlder failed', (e as any)?.message)
    } finally {
      loadingOlder.current = false
    }
  }, [hasMore, messages, myId, apiUrl])

  // ----- Send text / shared post -----
  const sendMessage = useCallback(
    async (text: string, sharedPostId?: string): Promise<boolean> => {
      const contact = selectedRef.current
      if (!contact || !myId) return false
      try {
        const { data } = await axios.post(
          `${apiUrl}/api/chat/${contact._id}`,
          { text, sharedPostId },
          { headers: await authHeaders() }
        )
        const saved = data?.message
        const next: Message = {
          ...mapMessage(saved ?? { text, sender: 'me', sharedPostId }, myId, apiUrl),
          sender: 'me',
          fresh: true,
          read: false,
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

  // ----- Send media (shown instantly, uploaded in the background) -----
  const deliver = useCallback(
    async (tempId: string): Promise<boolean> => {
      const p = pendingRef.current.get(tempId)
      if (!p) return false
      const { draft, contactId } = p
      patchMsg(tempId, { status: 'sending', progress: 0 })
      let last = 0

      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const headers: Record<string, string> = { ...(await authHeaders()) }
          let body: any
          if (draft.kind === 'gif' || draft.kind === 'sticker') {
            body = { text: draft.text, gifUrl: draft.url, gifKind: draft.kind, gifWidth: draft.width, gifHeight: draft.height }
          } else {
            const f = new FormData()
            if (draft.text) f.append('text', draft.text)
            const isVoice = draft.kind === 'voice'
            f.append('media', {
              uri: draft.uri,
              name: draft.name ?? (isVoice ? 'voice.m4a' : draft.kind === 'video' ? 'video.mp4' : 'photo.jpg'),
              type: draft.mime ?? (isVoice ? 'audio/mp4' : draft.kind === 'video' ? 'video/mp4' : 'image/jpeg'),
            } as any)
            if (draft.duration) f.append('mediaDuration', String(draft.duration))
            if (draft.width) f.append('mediaWidth', String(draft.width))
            if (draft.height) f.append('mediaHeight', String(draft.height))
            body = f
            headers['Content-Type'] = 'multipart/form-data'
          }

          const { data } = await axios.post(`${apiUrl}/api/chat/${contactId}`, body, {
            headers,
            timeout: 120000,
            onUploadProgress: (e) => {
              if (!e.total) return
              const v = e.loaded / e.total
              if (v - last >= 0.05 || v === 1) {
                last = v
                patchMsg(tempId, { progress: v })
              }
            },
          })

          pendingRef.current.delete(tempId)
          const real: Message = { ...mapMessage(data.message, myId, apiUrl), sender: 'me', read: false }
          setMessages((prev) => {
            const withoutDup = prev.filter((m) => m.id !== real.id)
            return withoutDup.map((m) => (m.id === tempId ? real : m))
          })
          return true
        } catch (e: any) {
          const noResponse = axios.isAxiosError(e) && !e.response
          if (!noResponse || attempt === 2) {
            console.warn('[chat media send failed]', e?.response?.status, e?.response?.data, e?.message)
            patchMsg(tempId, { status: 'failed' })
            return false
          }
          await sleep(600 * (attempt + 1)) // dropped connection: try again automatically
        }
      }
      return false
    },
    [apiUrl, myId, patchMsg]
  )

  const sendMedia = useCallback(
    async (draft: MediaDraft): Promise<boolean> => {
      const contact = selectedRef.current
      if (!contact || !myId) return false
      const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      pendingRef.current.set(tempId, { contactId: contact._id, draft })
      const temp: Message = {
        id: tempId,
        content: draft.text?.trim() ?? '',
        sender: 'me',
        time: formatTime(),
        fresh: true,
        read: false,
        status: 'sending',
        progress: 0,
        media: tempMedia(draft),
      }
      setMessages((prev) => [...prev, temp])
      return deliver(tempId)
    },
    [myId, deliver]
  )

  const retryMessage = useCallback((id: string) => { deliver(id) }, [deliver])
  const discardMessage = useCallback((id: string) => {
    pendingRef.current.delete(id)
    setMessages((prev) => prev.filter((m) => m.id !== id))
  }, [])

  // ----- Seen -----
  const markRead = useCallback(async () => {
    const contact = selectedRef.current
    if (!contact) return
    try {
      await axios.patch(`${apiUrl}/api/chat/${contact._id}/read`, {}, { headers: await authHeaders() })
    } catch (error) {
      console.log('markRead failed', (error as any)?.message)
    }
  }, [apiUrl])
  useEffect(() => { markReadRef.current = markRead }, [markRead])

  // ----- Edit -----
  const editMessage = useCallback(
    async (id: string, text: string): Promise<'ok' | 'read' | 'error'> => {
      const clean = text.trim()
      if (!clean) return 'error'
      try {
        await axios.patch(`${apiUrl}/api/chat/${id}`, { text: clean }, { headers: await authHeaders() })
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: clean, edited: true } : m)))
        return 'ok'
      } catch (error: any) {
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

  // ----- Delete: 'me' hides it for me, 'everyone' unsends it -----
  const deleteMessage = useCallback(
    async (id: string, scope: 'me' | 'everyone' = 'me') => {
      if (id.startsWith('tmp-')) return discardMessage(id)
      let removed: Message | undefined
      setMessages((prev) => {
        removed = prev.find((m) => m.id === id)
        return prev.filter((m) => m.id !== id)
      })
      try {
        await axios.delete(`${apiUrl}/api/chat/${id}`, { params: { scope }, headers: await authHeaders() })
      } catch (error) {
        console.error('Delete message error:', error)
        if (removed) {
          const back = removed
          setMessages((prev) => (prev.some((m) => m.id === id) ? prev : [...prev, back]))
        }
      }
    },
    [apiUrl, discardMessage]
  )

  const clearMessages = useCallback(async () => {
    const contact = selectedRef.current
    setMessages([])
    if (!contact) return
    try {
      await axios.delete(`${apiUrl}/api/chat/conversation/${contact._id}`, { headers: await authHeaders() })
    } catch (error) {
      console.error('Clear chat error:', error)
      refetchRef.current()
    }
  }, [apiUrl])

  return {
    messages, isConnected, hasMore, loadOlder,
    sendMessage, sendMedia, retryMessage, discardMessage,
    editMessage, markRead, deleteMessage, clearMessages,
  }
}