import { normalizePost, type SharedPostData } from '@/components/services/chat/sharedPost'
import { getAuthHeaders } from '@/components/services/feed/postUtils'
import { useMyUserId } from '@/hooks/chats/useMyUserId'
import { API_URL } from '@/lib/utils'
import axios from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'

export type SharedKind = 'posts' | 'media'
export type SharedMedia = { type: 'image' | 'video' | 'gif'; url: string; width?: number; height?: number; duration?: number }
export type SharedItem = { id: string; at: string; mine: boolean; postId?: string; post?: SharedPostData; media?: SharedMedia }

const map = (m: any, myId: string): SharedItem | null => {
    const base = { id: String(m.id), at: m.timestamp, mine: String(m.senderId) === myId }
    if (m.sharedPost) {
        const post = normalizePost(m.sharedPost)
        return { ...base, postId: post.id, post }
    }
    if (m.media?.url && ['image', 'video', 'gif'].includes(m.media.type)) {
        const url: string = m.media.url
        return {
            ...base,
            media: { type: m.media.type, url: /^https?:/i.test(url) ? url : `${API_URL}${url}`, width: m.media.width, height: m.media.height, duration: m.media.duration },
        }
    }
    return null
}

/** Newest first, paged. Starts loading when `enabled` first turns true. */
export function useSharedItems(contactId: string, kind: SharedKind, enabled: boolean) {
    const myId = useMyUserId()
    const [items, setItems] = useState<SharedItem[]>([])
    const [loading, setLoading] = useState(false)
    const [refreshing, setRefreshing] = useState(false)
    const [loaded, setLoaded] = useState(false)
    const [hasMore, setHasMore] = useState(true)
    const cursor = useRef<string | undefined>(undefined)
    const busy = useRef(false)

    const fetchPage = useCallback(
        async (reset: boolean) => {
            if (busy.current || !contactId || !myId) return
            busy.current = true
            setLoading(true)
            if (reset && loaded) setRefreshing(true)
            try {
                const { data } = await axios.get(`${API_URL}/api/chat/${contactId}/shared`, {
                    params: { type: kind, before: reset ? undefined : cursor.current },
                    headers: await getAuthHeaders(),
                    timeout: 20000,
                })
                const rows = ((data.items ?? []) as any[]).map((m) => map(m, myId)).filter(Boolean) as SharedItem[]
                setItems((prev) => {
                    if (reset) return rows
                    const have = new Set(prev.map((x) => x.id))
                    return [...prev, ...rows.filter((x) => !have.has(x.id))]
                })
                cursor.current = data.nextBefore ?? undefined
                setHasMore(!!data.hasMore)
            } catch (e) {
                console.log('shared items failed', (e as any)?.message)
                setHasMore(false)
            } finally {
                busy.current = false
                setLoaded(true)
                setLoading(false)
                setRefreshing(false)
            }
        },
        [contactId, myId, kind, loaded]
    )

    useEffect(() => {
        if (enabled && myId && !loaded && !busy.current) fetchPage(true)
    }, [enabled, myId, loaded, fetchPage])

    const loadMore = useCallback(() => { if (hasMore && loaded) fetchPage(false) }, [hasMore, loaded, fetchPage])
    const refresh = useCallback(() => { cursor.current = undefined; setHasMore(true); fetchPage(true) }, [fetchPage])

    return { items, loading, refreshing, loaded, hasMore, loadMore, refresh }
}