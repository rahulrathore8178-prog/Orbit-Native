// Client-side server pool: pure front-end failover. The backend needs NO changes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

export type PoolServer = { id: string; url: string };
export type FailKind = 'full' | 'down';

export const POOL: PoolServer[] = [
    { id: 's1', url: 'https://orb8-0kmr.onrender.com' },
    { id: 's2', url: 'https://orb8-6bfm.onrender.com' },
    { id: 's3', url: 'https://orb8-oeih.onrender.com' },
    { id: 's4', url: 'https://orb8.onrender.com' },
];

// Set EXPO_PUBLIC_DISABLE_FAILOVER=true only when intentionally using a local backend.
export const FAILOVER_ENABLED = process.env.EXPO_PUBLIC_DISABLE_FAILOVER !== 'true';

// One request may try every server at most twice (1-2-3-4-1-2-3-4), then gives up.
export const MAX_ATTEMPTS = POOL.length * 2;

export const ALL_DOWN_MESSAGE = 'Our servers are busy right now. Please try again in a little while.';

// Captured before the fetch patch is installed, so probes are never rewritten/retried.
const rawFetch: typeof fetch = globalThis.fetch.bind(globalThis);
const ACTIVE_SERVER_KEY = '@orbit/active-server';

const envUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
let active: PoolServer = POOL.find((s) => s.url === envUrl) ?? { id: 'env', url: envUrl || POOL[0].url };

const listeners = new Set<(s: PoolServer) => void>();
export const subscribe = (fn: (s: PoolServer) => void) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
};

export const getActive = () => active;
export const getActiveUrl = () => active.url;
export const getWsUrl = () => active.url.replace(/^http/, 'ws');

function setActive(s: PoolServer) {
    if (s.id === active.id) return;
    active = s;
    console.log(`[server] ACTIVE -> ${s.id} (${s.url})`);
    AsyncStorage.setItem(ACTIVE_SERVER_KEY, s.id).catch(() => { });
    listeners.forEach((fn) => { try { fn(s); } catch { } });
    void warmStandby(); // the new "next in line" should be awake
}

export function setActiveById(id: string) {
    const s = POOL.find((p) => p.id === id);
    if (s) setActive(s);
}

async function restoreActive() {
    if (!FAILOVER_ENABLED) return;
    try {
        const id = await AsyncStorage.getItem(ACTIVE_SERVER_KEY);
        const stored = POOL.find((s) => s.id === id);
        if (stored) setActive(stored);
        console.log(`[server] restored active = ${active.id} (${active.url})`);
    } catch { }
}

// ---------- "bad server" memory ----------
// down (502/504/network): short, a blip should not exile a server.
// full (503, Render suspends a service when its free bandwidth is used up): long.
const SHORT_TTL = 2 * 60_000;
const LONG_TTL = 20 * 60_000;
const badUntil = new Map<string, number>();
const markBad = (id: string, kind: FailKind) => {
    const until = Date.now() + (kind === 'full' ? LONG_TTL : SHORT_TTL);
    badUntil.set(id, Math.max(badUntil.get(id) ?? 0, until)); // never shorten an existing mark
};
const clearBad = (id: string) => { badUntil.delete(id); };
export const isBad = (id: string) => (badUntil.get(id) ?? 0) > Date.now();

/** Next server in the ring (s1 -> s2 -> s3 -> s4 -> s1), skipping known-bad ones when possible. */
export function nextServer(fromId: string): PoolServer {
    const i = POOL.findIndex((s) => s.id === fromId);
    for (let k = 1; k <= POOL.length; k++) {
        const cand = POOL[(i + k + POOL.length) % POOL.length];
        if (cand.id !== fromId && !isBad(cand.id)) return cand;
    }
    return POOL[(i + 1 + POOL.length) % POOL.length];
}

/**
 * Decide whether a response/error means "this server is unusable".
 * Our own backend's JSON errors (e.g. a normal 500 with {message}) are NOT failures:
 * only proxy/platform-style answers are.
 */
export function classifyFailure(status?: number, isJson = false, code?: string): FailKind | null {
    if (!status) return 'down';                       // network error / timeout
    if (status === 503) return !isJson || code === 'SERVER_FULL' ? 'full' : null;
    if (status === 502 || status === 504) return 'down';
    if (status === 500 && !isJson) return 'down';     // HTML error page from the platform
    return null;
}

/** Writes are only retried when the request almost certainly never reached the app. */
export function canRetry(method?: string, status?: number) {
    const m = (method ?? 'GET').toUpperCase();
    return m === 'GET' || m === 'HEAD' || m === 'OPTIONS' || status === 502 || status === 503;
}

/**
 * A request sent to `failedId` failed. Marks it bad and moves everybody to the next server.
 * Idempotent for parallel requests: if we already moved on, just returns the current server.
 */
export function failoverFrom(failedId: string, kind: FailKind): PoolServer {
    if (!FAILOVER_ENABLED) return active;
    if (failedId !== active.id) return active;
    console.log(`[server] ${failedId} failed (${kind}), switching`);
    markBad(failedId, kind);
    const next = nextServer(failedId);
    setActive(next);
    return next;
}

// ---------- "all servers busy" signal for the UI ----------
const allDownListeners = new Set<() => void>();
export const subscribeAllDown = (fn: () => void) => {
    allDownListeners.add(fn);
    return () => { allDownListeners.delete(fn); };
};
let lastAllDown = 0;
export function notifyAllDown() {
    const now = Date.now();
    if (now - lastAllDown < 3000) return; // many parallel requests -> one notification
    lastAllDown = now;
    allDownListeners.forEach((fn) => { try { fn(); } catch { } });
}
export function makeAllDownError(orig?: any) {
    const e: any = orig instanceof Error ? orig : new Error(ALL_DOWN_MESSAGE);
    e.message = ALL_DOWN_MESSAGE;
    e.code = 'ALL_SERVERS_UNAVAILABLE';
    if (!e.response) e.response = { status: 503, headers: {}, data: { code: 'ALL_SERVERS_UNAVAILABLE', message: ALL_DOWN_MESSAGE } };
    return e;
}
/** True right after every server refused us: new requests fail fast instead of re-hammering all four. */
export const allDownRecently = () => Date.now() - lastAllDown < 30_000 && POOL.every((s) => isBad(s.id));

// ---------- probing + keep-warm ----------
async function probe(s: PoolServer, timeoutMs: number): Promise<'ok' | FailKind> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        // Any answer (even Express's 404 for "/") proves the instance is awake.
        const res = await rawFetch(`${s.url}/`, { signal: ctrl.signal, headers: { 'Cache-Control': 'no-store' } });
        if (res.status === 503) return 'full';
        if (res.status === 502 || res.status === 504) return 'down';
        return 'ok';
    } catch {
        return 'down';
    } finally {
        clearTimeout(timer);
    }
}

// Wakes the next server in line (Render free tier sleeps after ~15 min and takes 30-60 s to wake),
// so a switch is instant. Also learns early that the standby is full.
let warming = false;
async function warmStandby() {
    if (!FAILOVER_ENABLED || warming || AppState.currentState !== 'active') return;
    const next = nextServer(active.id);
    if (next.id === active.id) return;
    warming = true;
    let result: 'ok' | FailKind = 'ok';
    try {
        result = await probe(next, 60_000);
        if (result === 'ok') clearBad(next.id); else markBad(next.id, result);
    } finally {
        warming = false;
    }
    if (result !== 'ok') {
        const n2 = nextServer(active.id);
        if (!isBad(n2.id)) void warmStandby(); // warm the replacement standby
    }
}

const WARM_INTERVAL_MS = 9 * 60_000; // under Render's 15 min idle sleep
let warmTimer: ReturnType<typeof setInterval> | null = null;
function startKeepWarm() {
    if (!FAILOVER_ENABLED || warmTimer) return;
    void warmStandby();
    warmTimer = setInterval(() => { void warmStandby(); }, WARM_INTERVAL_MS);
}
function stopKeepWarm() {
    if (warmTimer) clearInterval(warmTimer);
    warmTimer = null;
}

let verifying: Promise<boolean> | null = null;
/**
 * For the WebSocket: when connecting keeps failing, check the active server over HTTP.
 * Returns true if we switched servers (the socket reconnects itself via subscribe()).
 */
export function verifyActiveOrSwitch(): Promise<boolean> {
    if (!FAILOVER_ENABLED) return Promise.resolve(false);
    if (verifying) return verifying;
    const target = active;
    verifying = (async () => {
        const r = await probe(target, 60_000);
        if (r === 'ok') { clearBad(target.id); return false; }
        if (r === 'down') {
            // Guard against the phone simply being offline: only switch if another server answers.
            const alt = nextServer(target.id);
            if (alt.id !== target.id && (await probe(alt, 20_000)) === 'down') return false;
        }
        failoverFrom(target.id, r);
        return true;
    })().finally(() => { verifying = null; });
    return verifying;
}

/** Resolves once the stored active server has been restored. */
const hydration = restoreActive();
export const ready: Promise<unknown> = hydration;

if (FAILOVER_ENABLED) {
    hydration.finally(() => { if (AppState.currentState === 'active') startKeepWarm(); });
    AppState.addEventListener('change', (s) => {
        if (s === 'active') startKeepWarm(); else stopKeepWarm();
    });
}