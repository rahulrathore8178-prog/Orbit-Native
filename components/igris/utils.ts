import axios from "axios";
import { Easing } from "react-native-reanimated";
import { authStorage } from "../../lib/auth/authStorage";
import { API_URL } from "../../lib/utils";

/* ---------- API ---------- */
/** Node backend: saved history list. */
export const IGRIS_NODE_URL = `${API_URL}/api/askigris`;
/** Python server: askPrompt, describe_image, remember, history/:userId/:chatId. */
export const PYTHON_API_URL = (process.env.EXPO_PUBLIC_PYTHON_API_URL ?? "").replace(/\/+$/, "");

/** Token lives in SecureStore on native (see authStorage). */
export const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await authStorage.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
};

export const nodeApi = axios.create({ baseURL: IGRIS_NODE_URL, timeout: 20000 });
export const pythonApi = axios.create({ baseURL: PYTHON_API_URL, timeout: 90000 });

// one interceptor adds the bearer token to every request
[nodeApi, pythonApi].forEach((api) =>
    api.interceptors.request.use(async (config) => {
        const token = await authStorage.getToken();
        if (token) config.headers.Authorization = `Bearer ${token}`;
        return config;
    })
);

/** Pull a readable message out of an axios error. */
export const apiError = (e: unknown, fallback: string): string => {
    if (axios.isAxiosError(e)) {
        const d: any = e.response?.data;
        return (typeof d === "object" && (d?.error ?? d?.message)) || fallback;
    }
    return fallback;
};

/* ---------- types ---------- */
export interface Attachment {
    name: string;
    size: number;
    kind: "image" | "pdf";
    type: string;
    preview: string | null;
    uri: string;
}
export interface Message {
    id: string;
    role: "user" | "assistant";
    text: string;
    attachment?: Attachment | null;
    isError?: boolean;
}
export interface Chat {
    _id: string;
    title: string;
    /** true = added optimistically on this device, not confirmed by the server list yet */
    local?: boolean;
}

/* ---------- constants ---------- */
export const GREETINGS = [
    "What's on your mind?", "What can I help with?", "Where should we start?", "What are we figuring out today?",
    "Lawde na bhojyam", "Ready when you are.", "What's the plan?", "What are we working on?", "How can I help today?",
    "What's up?", "Let's get into it.", "What do you need?", "Something on your mind?",
    "How can I be useful?", "What's the task?", "Where do we begin?",
];
export const getRandomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export const SUGGESTIONS = [
    { label: "Explain simply", prompt: "Explain something to me like I'm new to it: " },
    { label: "Plan my day", prompt: "Help me plan my day. Here's what I have to do: " },
    { label: "Brainstorm", prompt: "Brainstorm ideas with me about " },
    { label: "Summarize", prompt: "Summarize this in a few lines: " },
];

export const MAX_TEXTAREA_HEIGHT = 200;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/* ---------- helpers ---------- */
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const formatSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/** White with alpha. Called inside useAnimatedStyle (UI thread), so it MUST be a worklet. */
export const W = (a: number) => {
    "worklet";
    return `rgba(255,255,255,${a})`;
};