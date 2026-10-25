import { API_URL, getAuthHeaders } from "@/lib/utils";
import axios from "axios";
import type { User } from "../../services/search/types";

const request = () => ({ withCredentials: true, headers: getAuthHeaders() });

export const getErrorMessage = (err: unknown, fallback: string): string =>
    (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

export async function searchUsers(q: string, signal: AbortSignal): Promise<User[]> {
    const { data } = await axios.get(`${API_URL}/api/social/search`, {
        params: { q },
        signal,
        ...request(),
    });
    return data.users ?? [];
}

export const sendFriendRequest = (id: string) =>
    axios.post(`${API_URL}/api/social/friend-request/${id}`, {}, request());

// ⚠️ The three endpoints below are ASSUMED — match them to your backend routes.
export const cancelFriendRequest = (id: string) =>
    axios.delete(`${API_URL}/api/social/friend-request/${id}`, request());

export const acceptFriendRequest = (id: string) =>
    axios.post(`${API_URL}/api/social/friend-request/${id}/accept`, {}, request());

export const rejectFriendRequest = (id: string) =>
    axios.post(`${API_URL}/api/social/friend-request/${id}/reject`, {}, request());