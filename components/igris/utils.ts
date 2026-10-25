import AsyncStorage from "@react-native-async-storage/async-storage";
import { Easing } from "react-native-reanimated";
import { API_URL } from "../../lib/utils";

/* ---------- API ---------- */
export const IGRIS_API_URL = `${API_URL}/api/askigris`;

export const authHeaders = async (): Promise<Record<string, string>> => {
    const token = await AsyncStorage.getItem("token");
    return token ? { Authorization: `Bearer ${token}` } : {};
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
}

/* ---------- constants ---------- */
export const GREETINGS = [
    "What's on your mind?", "What can I help with?", "Where should we start?", "What are we figuring out today?",
    "Lawde na bhojyam", "Ready when you are.", "What's the plan?", "What are we working on?", "How can I help today?",
    "What's up?", "Let's get into it.", "What do you need?", "Something on your mind?", "What are we building today?",
    "How can I be useful?", "What's the task?", "Where do we begin?",
];
export const getRandomGreeting = () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)];

export const MAX_TEXTAREA_HEIGHT = 200;
export const EASE_OUT = Easing.bezier(0.22, 1, 0.36, 1);

/* ---------- helpers ---------- */
export const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export const formatSize = (b: number) =>
    b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`;

/**
 * White with alpha.
 * IMPORTANT: this is called inside useAnimatedStyle (UI thread), so it MUST be a worklet.
 * Without the "worklet" directive Reanimated throws:
 * "Tried to synchronously call a Remote Function. Called 'W' on the UI Runtime."
 */
export const W = (a: number) => {
    "worklet";
    return `rgba(255,255,255,${a})`;
};
