import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const MAX_ACCOUNTS = 5;

const INDEX_KEY = 'auth.accounts.v1';
const LEGACY_TOKEN_KEY = 'token';
const LEGACY_USER_KEY = 'user';
const isNative = Platform.OS !== 'web';

const safe = (id: string) => id.replace(/[^\w.-]/g, '_');
const accessKey = (id: string) => `auth.at.${safe(id)}`;
const refreshKey = (id: string) => `auth.rt.${safe(id)}`;

const secret = {
    get: (k: string) => (isNative ? SecureStore.getItemAsync(k) : AsyncStorage.getItem(k)),
    set: (k: string, v: string) => (isNative ? SecureStore.setItemAsync(k, v) : AsyncStorage.setItem(k, v)),
    del: (k: string) => (isNative ? SecureStore.deleteItemAsync(k) : AsyncStorage.removeItem(k)),
};

export type StoredUser = { _id?: string; id?: string;[k: string]: unknown };
export type AccountSummary = { id: string; user: StoredUser };
export type AuthSnapshot = { activeAccountId: string | null; user: StoredUser | null; accounts: AccountSummary[] };

// Tokens are NOT in here. Only ids + user objects.
type Index = { activeAccountId: string | null; order: string[]; users: Record<string, StoredUser> };

let index: Index = { activeAccountId: null, order: [], users: {} };
let cachedToken: string | null = null; // token of the ACTIVE account only
let loaded: Promise<void> | null = null;
let chain: Promise<unknown> = Promise.resolve();

// All writes run one at a time so two operations can never interleave.
const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const run = chain.then(() => fn());
    chain = run.catch(() => undefined);
    return run;
};

const idOf = (u: any): string | null => {
    const v = u?._id ?? u?.id;
    return v ? String(v) : null;
};

const persist = () => AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));

const snap = (): AuthSnapshot => {
    const a = index.activeAccountId;
    return {
        activeAccountId: a,
        user: a ? index.users[a] ?? null : null,
        accounts: index.order.filter((id) => index.users[id]).map((id) => ({ id, user: index.users[id] })),
    };
};

async function purge(id: string) {
    await Promise.all([secret.del(accessKey(id)), secret.del(refreshKey(id))]);
    delete index.users[id];
    index.order = index.order.filter((x) => x !== id);
}

/** Removes an account; if it was active, falls back to the next account that still has a token. */
async function removeInternal(id: string) {
    const wasActive = index.activeAccountId === id;
    await purge(id);
    if (wasActive) {
        index.activeAccountId = null;
        cachedToken = null;
        for (const cand of [...index.order]) {
            const t = await secret.get(accessKey(cand));
            if (t) {
                index.activeAccountId = cand;
                cachedToken = t;
                break;
            }
            await purge(cand); // dead entry without a token
        }
    }
    await persist();
}

async function migrateLegacy() {
    const [t, rawUser] = await Promise.all([secret.get(LEGACY_TOKEN_KEY), AsyncStorage.getItem(LEGACY_USER_KEY)]);
    if (t && rawUser) {
        try {
            const u = JSON.parse(rawUser);
            const id = idOf(u);
            if (id) {
                await secret.set(accessKey(id), t);
                index = { activeAccountId: id, order: [id], users: { [id]: u } };
                await persist();
            }
        } catch { /* corrupt legacy data -> user logs in again */ }
    }
    await Promise.all([secret.del(LEGACY_TOKEN_KEY), AsyncStorage.removeItem(LEGACY_USER_KEY)]);
}

async function load() {
    const raw = await AsyncStorage.getItem(INDEX_KEY);
    if (raw) {
        try {
            const p = JSON.parse(raw);
            index = {
                activeAccountId: p.activeAccountId ?? null,
                order: Array.isArray(p.order) ? p.order : [],
                users: p.users ?? {},
            };
        } catch { /* keep empty index */ }
    } else {
        await migrateLegacy();
    }
    cachedToken = index.activeAccountId ? await secret.get(accessKey(index.activeAccountId)) : null;
    if (index.activeAccountId && !cachedToken) await removeInternal(index.activeAccountId); // self-heal
}

const ensureLoaded = () => (loaded ??= load());
const owners = new Map<string, string>();
const remember = () => {
    if (cachedToken && index.activeAccountId) owners.set(cachedToken, index.activeAccountId);
};

export const authStorage = {
    /** Loads accounts from disk. Safe to call many times. */
    init: ensureLoaded,
    ready: ensureLoaded,

    /** Active account's token (sync). Same API as before, so getAuthHeaders keeps working. */
    getTokenSync: (): string | null => {
        remember();
        return cachedToken;
    },
    getActiveIdSync: (): string | null => index.activeAccountId,
    getSessionSync: () => {
        remember();
        return { accountId: index.activeAccountId, token: cachedToken };
    },
    ownerOfToken: (t: string): string | null => owners.get(t) ?? null,

    async getToken(): Promise<string | null> {
        await ensureLoaded();
        remember();
        return cachedToken;
    },

    async getRefreshToken(id?: string): Promise<string | null> {
        await ensureLoaded();
        const target = id ?? index.activeAccountId;
        return target ? secret.get(refreshKey(target)) : null;
    },

    async getUser<T = any>(): Promise<T | null> {
        await ensureLoaded();
        const a = index.activeAccountId;
        return a ? ((index.users[a] as T) ?? null) : null;
    },

    async getSnapshot(): Promise<AuthSnapshot> {
        await ensureLoaded();
        return snap();
    },

    /** Saves a new account and makes it active. If the id already exists its token is simply refreshed. */
    addAccount: (p: { token: string; refreshToken?: string | null; user: StoredUser }) =>
        serial(async () => {
            await ensureLoaded();
            const id = idOf(p.user);
            if (!id) throw new Error('User id missing from server response.');
            if (!p.token) throw new Error('Token missing from server response.');
            if (!index.users[id] && index.order.length >= MAX_ACCOUNTS) {
                throw new Error(`You can add up to ${MAX_ACCOUNTS} accounts on this device.`);
            }
            await secret.set(accessKey(id), p.token);
            if (p.refreshToken) await secret.set(refreshKey(id), p.refreshToken);
            else await secret.del(refreshKey(id));
            index.users[id] = p.user;
            if (!index.order.includes(id)) index.order.push(id);
            index.activeAccountId = id;
            cachedToken = p.token;
            await persist();
            return snap();
        }),

    switchTo: (id: string) =>
        serial(async () => {
            await ensureLoaded();
            if (!index.users[id]) throw new Error('Account not found.');
            if (index.activeAccountId === id) return snap();
            const t = await secret.get(accessKey(id));
            if (!t) {
                await removeInternal(id);
                throw new Error('That session expired. Please log in again.');
            }
            // id + token flip in one synchronous step: no request can see a mixed state.
            index.activeAccountId = id;
            cachedToken = t;
            await persist();
            console.log('active account', index.activeAccountId, 'cached token', cachedToken);
            return snap();
        }),

    removeAccount: (id: string) =>
        serial(async () => {
            await ensureLoaded();
            if (index.users[id]) await removeInternal(id);
            return snap();
        }),

    clearAll: () =>
        serial(async () => {
            await ensureLoaded();
            for (const id of [...index.order]) await purge(id);
            index.activeAccountId = null;
            cachedToken = null;
            await persist();
            return snap();
        }),

    /** Updates the stored user of the ACTIVE account only (ignored if the user id belongs to another account). */
    updateActiveUser: (user: StoredUser) =>
        serial(async () => {
            await ensureLoaded();
            const a = index.activeAccountId;
            if (!a) return;
            const uid = idOf(user) ?? a;
            if (uid !== a) return; // never write one account's data into another
            index.users[a] = user;
            console.log('updated active user', user);
            await persist();
        }),

    // ---- compatibility with old call sites ----
    setUser: (user: unknown) => authStorage.updateActiveUser(user as StoredUser),
    setToken: (token: string) =>
        serial(async () => {
            await ensureLoaded();
            const a = index.activeAccountId;
            if (!a) return;
            await secret.set(accessKey(a), token);
            cachedToken = token;
        }),
    /** Old "clear" = log out the active account only. */
    async clear(): Promise<void> {
        await ensureLoaded();
        const a = index.activeAccountId;
        if (a) await authStorage.removeAccount(a);
    },
};