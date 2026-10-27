import * as SecureStore from 'expo-secure-store';

const KEY = 'orbit_call_device_id';
let cached: string | null = null;

// Server accepts /^[\w-]{8,64}$/. This is an identifier, not a secret (auth is the JWT).
const generate = () => {
    const c = (globalThis as any).crypto;
    if (c?.randomUUID) return `dev-${c.randomUUID()}`;
    let id = 'dev-';
    for (let i = 0; i < 32; i++) id += Math.floor(Math.random() * 16).toString(16);
    return id;
};

/** One stable id per app install. Sent on the WS `register` message AND in the REST call requests. */
export async function getDeviceId(): Promise<string> {
    if (cached) return cached;
    try {
        const saved = await SecureStore.getItemAsync(KEY);
        if (saved) {
            cached = saved;
            return saved;
        }
    } catch {
        /* fall through and generate */
    }
    const id = generate();
    cached = id;
    try {
        await SecureStore.setItemAsync(KEY, id);
    } catch {
        /* in-memory id still works for this session */
    }
    return id;
}