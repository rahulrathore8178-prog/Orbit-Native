import { authStorage } from '@/lib/auth/authStorage'
import AsyncStorage from '@react-native-async-storage/async-storage'

type MessageHandler = (data: any) => void
type StatusHandler = (connected: boolean, reconnected: boolean) => void

const messageHandlers = new Set<MessageHandler>()
const statusHandlers = new Set<StatusHandler>()

let socket: WebSocket | null = null
let userId = ''
let wsUrl = ''
let currentKey = ''
let refs = 0
let gen = 0
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let connected = false
let closedByUs = true

const toWsUrl = (url?: string) => (url ?? '').replace(/^http/i, 'ws').replace(/\/+$/, '')

const getToken = async (): Promise<string | null> =>
    (await authStorage.getToken()) ?? (await AsyncStorage.getItem('user')) ?? (await AsyncStorage.getItem('token'))

const setConnected = (value: boolean, reconnected = false) => {
    connected = value
    statusHandlers.forEach((h) => h(value, reconnected))
}

function connect() {
    const s = new WebSocket(wsUrl)
    socket = s

    s.onopen = async () => {
        if (socket !== s) return
        const token = await getToken()
        if (socket !== s || s.readyState !== WebSocket.OPEN) return
        s.send(JSON.stringify({ type: 'register', userId, token }))
        const wasReconnect = retry > 0
        retry = 0
        setConnected(true, wasReconnect)
    }

    s.onmessage = (event) => {
        let data: any
        try {
            data = JSON.parse(event.data)
        } catch {
            return
        }
        messageHandlers.forEach((h) => {
            try {
                h(data)
            } catch (e) {
                console.error('Chat socket handler error', e)
            }
        })
    }

    s.onerror = (e: any) => console.log('WS: error', e?.message ?? e)

    s.onclose = (e) => {
        console.log('WS: closed', e.code, e.reason)
        if (socket === s) socket = null
        setConnected(false)
        if (closedByUs) return
        const delay = Math.min(1000 * 2 ** retry, 10000) // 1s, 2s, 4s ... max 10s
        retry += 1
        retryTimer = setTimeout(connect, delay)
    }
}

function start() {
    closedByUs = false
    retry = 0
    connect()
}

function stop() {
    closedByUs = true
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    const s = socket
    socket = null
    s?.close()
    setConnected(false)
}

/** Ref-counted: the socket lives while at least one caller holds it. Returns a release function. */
export function acquireChatSocket(uid: string, apiUrl: string) {
    const key = `${uid}|${apiUrl}`
    if (refs > 0 && key !== currentKey) {
        stop() // account / server changed
        refs = 0
        gen += 1
    }
    currentKey = key
    userId = uid
    wsUrl = toWsUrl(apiUrl)
    refs += 1
    if (refs === 1) start()

    const myGen = gen
    let released = false
    return () => {
        if (released || myGen !== gen) return
        released = true
        refs = Math.max(0, refs - 1)
        if (refs === 0) stop()
    }
}

export const subscribeChatSocket = (h: MessageHandler) => {
    messageHandlers.add(h)
    return () => {
        messageHandlers.delete(h)
    }
}

export const subscribeChatStatus = (h: StatusHandler) => {
    statusHandlers.add(h)
    return () => {
        statusHandlers.delete(h)
    }
}

export const isChatSocketConnected = () => connected