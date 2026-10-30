import { useEffect, useRef } from 'react'
import { useDispatch, useStore } from 'react-redux'
import { usePathname } from 'expo-router'
import { useMyUserId } from '@/hooks/chats/useMyUserId'
import { acquireChatSocket, subscribeChatSocket } from './chatSocket' // adjust path to where chatSocket.ts lives
import { setUnread } from '@/redux/slice/chatBadgeSlice'

const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')

export function useChatBadge(apiUrl: string) {
    const dispatch = useDispatch()
    const store = useStore<any>()
    const myId = useMyUserId()
    const pathname = usePathname()

    // latest pathname for the socket listener without resubscribing
    const onChatTabRef = useRef(false)
    onChatTabRef.current = pathname === '/chat'

    useEffect(() => {
        if (!myId) return
        // Keeps the shared socket alive for the whole app, not just inside an open chat.
        const release = acquireChatSocket(myId, apiUrl)

        const off = subscribeChatSocket((data) => {
            if (data?.type !== 'chat-message') return
            const m = data.message || {}
            const senderId = toId(m.senderId ?? m.sender)
            if (!senderId || senderId === myId) return

            if (onChatTabRef.current) return // already looking at the messages tab
            if (store.getState().chatBadge.openChatId === senderId) return // reading this very chat

            dispatch(setUnread(true))
        })

        return () => {
            off()
            release()
        }
    }, [myId, apiUrl, dispatch, store])
}