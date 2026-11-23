import { authStorage } from '@/lib/auth/authStorage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { FAILOVER_ENABLED, getWsUrl, subscribe as subscribeServer, verifyActiveOrSwitch } from '../../components/services/serverPool'

type MessageHandler = (data: any) => void
type StatusHandler = (connected: boolean, reconnected: boolean) => void

const messageHandlers = new Set<MessageHandler>()
const statusHandlers = new Set<StatusHandler>()

let socket: WebSocket | null = null
let userId = ''
let wsUrl = '' // only used when failover is disabled (local backend)
let currentKey = ''
let refs = 0
let gen = 0
let retry = 0
let failedConnects = 0
let resync = false
let retryTimer: ReturnType<typeof setTimeout> | null = null
let connected = false
let closedByUs = true

const toWsUrl = (url?: string) => (url ?? '').replace(/^http/i, 'ws').replace(/\/+$/, '')
const currentWsUrl = () => (FAILOVER_ENABLED ? getWsUrl() : wsUrl)

const getToken = (): Promise<string | null> => authStorage.getToken()

const setConnected = (value: boolean, reconnected = false) => {
    connected = value
    statusHandlers.forEach((h) => h(value, reconnected))
}

function connect() {
    const s = new WebSocket(currentWsUrl())
    socket = s
    let opened = false

    s.onopen = async () => {
        if (socket !== s) return
        const token = await getToken()
        if (socket !== s || s.readyState !== WebSocket.OPEN) return
        opened = true
        s.send(JSON.stringify({ type: 'register', userId, token }))
        // After a server switch we must report "reconnected" so screens re-fetch what they missed.
        const wasReconnect = retry > 0 || resync
        retry = 0
        failedConnects = 0
        resync = false
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
        if (socket !== s) return // stale socket (we already replaced or stopped it)
        socket = null
        setConnected(false)
        if (closedByUs) return

        // Could not even connect: maybe this server is full/suspended. Check it over HTTP and
        // switch if so; the subscribeServer() handler below then reconnects to the new server.
        if (!opened) {
            failedConnects += 1
            if (FAILOVER_ENABLED && failedConnects >= 2) {
                failedConnects = 0
                verifyActiveOrSwitch().catch(() => { })
            }
        }

        const delay = Math.min(1000 * 2 ** retry, 10000) // 1s, 2s, 4s ... max 10s
        retry += 1
        retryTimer = setTimeout(connect, delay)
    }
}

function start() {
    closedByUs = false
    retry = 0
    failedConnects = 0
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

// The active API server changed: drop the old socket and reconnect to the new server right away.
function restartForNewServer() {
    if (refs === 0 || closedByUs) return
    if (retryTimer) clearTimeout(retryTimer)
    retryTimer = null
    const s = socket
    socket = null
    try { s?.close() } catch { }
    setConnected(false)
    retry = 0
    failedConnects = 0
    resync = true
    connect()
}
subscribeServer(restartForNewServer)

/** Ref-counted: the socket lives while at least one caller holds it. Returns a release function. */
export function acquireChatSocket(uid: string, apiUrl: string) {
    // With failover the server can change under us, so only the account identifies the socket.
    const key = FAILOVER_ENABLED ? uid : `${uid}|${apiUrl}`
    if (refs > 0 && key !== currentKey) {
        stop() // account changed
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