import { extractShare } from '@/hooks/chats/useChat'
import { useMyUserId } from '@/hooks/chats/useMyUserId'
import { getActiveChat } from '@/hooks/chats/activeChat'
import { acquireChatSocket, subscribeChatSocket } from '@/hooks/chats/chatSocket'
import { API_URL } from '@/lib/utils'
import { RootState } from '@/redux/store'
import { showToast } from '@/components/ui/GlassToast' // ADAPT: path of your universal toast file
import { useEffect, useRef } from 'react'
import { useSelector } from 'react-redux'

const toId = (v: any): string => String(v?._id ?? v?.id ?? v ?? '')

/** Mount once at the app root (inside the Redux provider). Renders nothing. */
export function IncomingChatToaster() {
    const myId = useMyUserId()
    const friends = useSelector((s: RootState) => s.friends.friends)
    const friendsRef = useRef(friends)
    useEffect(() => {
        friendsRef.current = friends
    }, [friends])

    useEffect(() => {
        if (!myId) return
        const release = acquireChatSocket(myId, API_URL)

        const off = subscribeChatSocket((data) => {
            if (data?.type !== 'chat-message') return

            const m = data.message || {}
            const senderId = toId(m.senderId ?? m.sender)
            const text: string = m.text ?? m.content ?? ''
            const isPost = !!extractShare(m).sharedPostId

            if (!senderId || (!text && !isPost)) return
            if (senderId === myId) return // my own message echoed back
            if (senderId === getActiveChat()) return // I'm already in this chat -> no toast

            const friend = friendsRef.current.find((f) => toId(f) === senderId)
            showToast({
                title: friend?.username ?? m.senderName ?? 'New message',
                subtitle: isPost ? 'Shared a post' : text.slice(0, 90),
                avatar: friend?.profilePic,
                variant: 'message',
                url: `/chats/${senderId}`,
            })
        })

        return () => {
            off()
            release()
        }
    }, [myId])

    return null
}