// Import this ONCE, first thing in your app entry (before any axios.create / fetch usage).
import axios, { AxiosError, AxiosInstance } from 'axios';
import {
    FAILOVER_ENABLED, POOL, MAX_ATTEMPTS, ready, getActive, failoverFrom, classifyFailure,
    canRetry, makeAllDownError, notifyAllDown, allDownRecently, ALL_DOWN_MESSAGE,
} from './serverPool';

const envUrl = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/+$/, '');
const origins = Array.from(new Set([...POOL.map((p) => p.url), envUrl].filter(Boolean)));

const isOrigin = (url: string, o: string) => url === o || url.startsWith(`${o}/`) || url.startsWith(`${o}?`);
const isApiUrl = (url?: string) => !!url && origins.some((o) => isOrigin(url, o));

export function rewriteOrigin<T extends string | undefined>(url: T, target: string): T {
    if (!url) return url;
    for (const o of origins) {
        if (isOrigin(url, o) && o !== target) return (target + url.slice(o.length)) as T;
    }
    return url;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const COLD_START_TIMEOUT_MS = 60_000; // a standby may still be waking up

// ---------------- axios ----------------
async function onRequest(cfg: any) {
    await Promise.race([ready, sleep(5_000)]);
    if (!cfg.__serverId && allDownRecently()) throw makeAllDownError(); // fail fast, new request only
    // On a retry we are pinned to the server chosen by the failover logic.
    const forced = cfg.__serverId ? POOL.find((p) => p.id === cfg.__serverId) : undefined;
    const target = forced ?? getActive();
    cfg.__serverId = target.id;
    cfg.baseURL = rewriteOrigin(cfg.baseURL, target.url);
    cfg.url = rewriteOrigin(cfg.url, target.url);
    return cfg;
}

function attach(inst: AxiosInstance) {
    inst.interceptors.request.use(onRequest);
    inst.interceptors.response.use(
        (res) => {
            // Noisy: remove this log once you have confirmed which server answers.
            console.log(`[api] ${(res.config as any).__serverId} <- ${res.config.url}`);
            return res;
        },
        async (err: AxiosError<any>) => {
            const cfg: any = err.config;
            if (!cfg || axios.isCancel(err)) throw err;

            const status = err.response?.status;
            const ct = String((err.response?.headers as any)?.['content-type'] ?? '');
            const isJson = ct.includes('application/json');
            const kind = classifyFailure(status, isJson, (err.response?.data as any)?.code);
            if (!kind) throw err; // a normal app error (401, 404, JSON 500 ...): not our business

            if (err.response) cfg.__sawResponse = true;
            const sentId: string = cfg.__serverId ?? getActive().id;
            const next = failoverFrom(sentId, kind); // switches everybody, even if we cannot retry

            if (!canRetry(cfg.method, status)) throw err; // never double-apply a write

            const attempts: number = cfg.__attempts ?? 1;
            if (attempts >= MAX_ATTEMPTS) {
                if (cfg.__sawResponse) {
                    notifyAllDown();
                    throw makeAllDownError(err);
                }
                throw err; // nobody answered at all: plain network error
            }

            cfg.__attempts = attempts + 1;
            cfg.__serverId = next.id;
            cfg.timeout = Math.max(cfg.timeout ?? 0, COLD_START_TIMEOUT_MS);
            // No try/catch: if the retry fails, that failure goes through this handler again.
            return inst.request(cfg);
        }
    );
}

const g: any = globalThis;
if (FAILOVER_ENABLED && !g.__orbitFailoverInstalled) {
    g.__orbitFailoverInstalled = true;

    attach(axios);
    const origCreate = axios.create.bind(axios);
    (axios as any).create = (config?: any) => {
        const inst = origCreate(config);
        attach(inst);
        return inst;
    };

    // ---------------- fetch ----------------
    const origFetch = globalThis.fetch.bind(globalThis);

    const getInputUrl = (value: any): string | undefined => {
        if (typeof value === 'string') return value;
        if (typeof URL !== 'undefined' && value instanceof URL) return value.toString();
        if (value && typeof value.url === 'string') return value.url;
        return undefined;
    };
    const rewriteInput = (value: any, target: string) => {
        const url = getInputUrl(value);
        if (!url) return value;
        const rewritten = rewriteOrigin(url, target);
        if (rewritten === url) return value;
        if (typeof value === 'string') return rewritten;
        if (typeof URL !== 'undefined' && value instanceof URL) return new URL(rewritten);
        if (typeof Request !== 'undefined' && value instanceof Request) return new Request(rewritten, value.clone());
        return value;
    };

    globalThis.fetch = (async (input: any, init?: any) => {
        // Only our own API goes through failover (Google images, Python API etc. pass straight through).
        if (!isApiUrl(getInputUrl(input))) return origFetch(input, init);
        await Promise.race([ready, sleep(5_000)]);
        if (allDownRecently()) {
            return new Response(JSON.stringify({ code: 'ALL_SERVERS_UNAVAILABLE', message: ALL_DOWN_MESSAGE }), {
                status: 503,
                headers: { 'content-type': 'application/json' },
            });
        }

        const method = String(
            init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
        ).toUpperCase();

        let server = getActive();
        let lastRes: Response | undefined;
        let lastErr: any;
        let sawResponse = false;

        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            let res: Response | undefined;
            try {
                res = await origFetch(rewriteInput(input, server.url), init);
            } catch (e: any) {
                if (init?.signal?.aborted || e?.name === 'AbortError') throw e; // user cancelled
                lastErr = e;
            }

            let kind;
            if (res) {
                sawResponse = true;
                const isJson = (res.headers?.get?.('content-type') ?? '').includes('application/json');
                let code: string | undefined;
                if (res.status === 503 && isJson) {
                    code = (await res.clone().json().catch(() => null))?.code;
                }
                kind = classifyFailure(res.status, isJson, code);
                if (!kind) return res; // success or a normal app error
                lastRes = res;
            } else {
                kind = classifyFailure(undefined);
            }

            const next = failoverFrom(server.id, kind!);
            if (!canRetry(method, res?.status)) {
                if (res) return res;
                throw lastErr;
            }
            server = next;
        }

        if (sawResponse) notifyAllDown();
        if (lastRes) return lastRes; // callers see the last 503 and can show an error
        throw lastErr;
    }) as typeof fetch;
}