import { authStorage } from '@/lib/auth/authStorage'
import { API_URL } from '@/lib/utils'
import axios from 'axios'
import { useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import { AppState } from 'react-native'

export type Conversation = {
    contactId: string
    /** preview text of the latest message */
    text: string
    type?: string
    fromMe: boolean
    timestamp: string
    /** messages from them that I have not opened yet */
    unread: number
}

const POLL_MS = 12000

/**
 * Latest message + unread count per contact, for sorting and highlighting the Messages list.
 * Refreshes when the tab gets focus, when the app returns to the foreground and every 12s while visible.
 * (The chat socket only lives inside an open chat, so the list polls instead of listening.)
 */
export function useConversations() {
    const [conversations, setConversations] = useState<Record<string, Conversation>>({})
    const [refreshing, setRefreshing] = useState(false)
    const inFlight = useRef(false)

    const load = useCallback(async () => {
        if (inFlight.current) return
        inFlight.current = true
        try {
            const token = await authStorage.getToken()
            const headers = token ? { Authorization: `Bearer ${token}` } : undefined
            const { data } = await axios.get(`${API_URL}/api/chat/conversations`, { headers, timeout: 15000 })
            const next: Record<string, Conversation> = {}
            for (const c of data?.conversations ?? []) next[String(c.contactId)] = c
            setConversations(next)
        } catch (error: any) {
            // older backend without /conversations: at least keep the unread counts working
            if (error?.response?.status === 404) {
                try {
                    const token = await authStorage.getToken()
                    const { data } = await axios.get(`${API_URL}/api/chat/unread`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                    })
                    setConversations((prev) => {
                        const next: Record<string, Conversation> = {}
                        for (const [id, c] of Object.entries(prev)) next[id] = { ...c, unread: data?.byContact?.[id] ?? 0 }
                        for (const [id, n] of Object.entries<number>(data?.byContact ?? {})) {
                            if (!next[id]) next[id] = { contactId: id, text: '', fromMe: false, timestamp: new Date().toISOString(), unread: n }
                        }
                        return next
                    })
                } catch {
                    /* ignore */
                }
            } else {
                console.log('conversations load failed', error?.message)
            }
        } finally {
            inFlight.current = false
        }
    }, [])

    useFocusEffect(
        useCallback(() => {
            load()
            const timer = setInterval(load, POLL_MS)
            const sub = AppState.addEventListener('change', (s) => s === 'active' && load())
            return () => {
                clearInterval(timer)
                sub.remove()
            }
        }, [load])
    )

    const refresh = useCallback(async () => {
        setRefreshing(true)
        await load()
        setRefreshing(false)
    }, [load])

    /** Clear the highlight right away when a chat is opened (the server marks it read on open). */
    const markOpened = useCallback((contactId: string) => {
        setConversations((prev) => (prev[contactId] ? { ...prev, [contactId]: { ...prev[contactId], unread: 0 } } : prev))
    }, [])

    return { conversations, refreshing, refresh, markOpened }
}