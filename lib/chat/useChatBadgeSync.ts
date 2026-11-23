import { authStorage } from '@/lib/auth/authStorage'
import { API_URL } from '@/lib/utils'
import axios from 'axios'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import { setUnreadChats } from '@/redux/slice/chatBadgeSlice' // <- adjust name/path

const POLL_MS = 12000

/** Keeps the tab-bar chat badge fresh from app launch, independent of the Messages tab being mounted. */
export function useChatBadgeSync() {
    const dispatch = useDispatch<any>()
    const status = useSelector((s: any) => s.auth.status)
    const activeAccountId = useSelector((s: any) => s.auth.activeAccountId)
    const inFlight = useRef(false)

    const load = useCallback(async () => {
        if (inFlight.current) return
        inFlight.current = true
        const requestAccountId = activeAccountId
        try {
            const token = await authStorage.getToken()
            const { data } = await axios.get(`${API_URL}/api/chat/unread`, {
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                timeout: 15000,
            })
            if (requestAccountId !== activeAccountId) return
            // number of chats with unread messages (not total messages)
            const chats = Object.values<number>(data?.byContact ?? {}).filter((n) => n > 0).length
            dispatch(setUnreadChats(chats))
        } catch (e: any) {
            console.log('chat badge sync failed', e?.message)
        } finally {
            inFlight.current = false
        }
    }, [activeAccountId, dispatch])

    useEffect(() => {
        if (status !== 'signedIn') {
            dispatch(setUnreadChats(0))
            return
        }
        inFlight.current = false
        load()
        const timer = setInterval(load, POLL_MS)
        const sub = AppState.addEventListener('change', (s) => s === 'active' && load())
        return () => {
            clearInterval(timer)
            sub.remove()
        }
    }, [status, activeAccountId, load, dispatch])
}