import { authStorage } from '@/lib/auth/authStorage'
import { useEffect, useState } from 'react'
import { useSelector } from 'react-redux'

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

export function useMyUserId(): string | undefined {
    const reduxUserId = useSelector((s: any) => s.dashboard?.currentUser?.id ?? s.auth?.user?._id ?? s.auth?.user?.id)
    const activeAccountId = useSelector((s: any) => s.auth?.activeAccountId)
    const [tokenUserId, setTokenUserId] = useState<string | null>(null)

    useEffect(() => {
        let alive = true
        const accountAtStart = activeAccountId
        ; (async () => {
            const fromToken = userIdFromToken(await authStorage.getToken())
            if (alive && accountAtStart === authStorage.getActiveIdSync()) {
                setTokenUserId(fromToken ?? null)
            }
        })()
        return () => { alive = false }
    }, [activeAccountId])

    return reduxUserId ? String(reduxUserId) : tokenUserId ?? undefined
}