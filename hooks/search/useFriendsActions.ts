import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as api from "../../components/services/search/searchApi";
import type { FriendActions, User } from "../../components/services/search/types";

type Patch = (id: string, changes: Partial<User>) => void;

/** Friend-request actions with optimistic UI. A failed request rolls back and shows a banner. */
export function useFriendActions(patchUser: Patch) {
    const [error, setError] = useState<string | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => () => clearTimeout(timer.current), []);

    const showError = useCallback((message: string) => {
        setError(message);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setError(null), 3000);
    }, []);

    const run = useCallback(
        async (user: User, changes: Partial<User>, call: () => Promise<unknown>, fallback: string) => {
            const previous = {
                isFriend: user.isFriend,
                requestSent: user.requestSent,
                hasPendingRequest: user.hasPendingRequest,
            };
            patchUser(user._id, changes);
            try {
                await call();
            } catch (err) {
                patchUser(user._id, previous);
                showError(api.getErrorMessage(err, fallback));
            }
        },
        [patchUser, showError],
    );

    const actions = useMemo<FriendActions>(
        () => ({
            addFriend: (u) =>
                run(u, { requestSent: true }, () => api.sendFriendRequest(u._id), "Failed to send friend request"),
            cancelRequest: (u) =>
                run(u, { requestSent: false }, () => api.cancelFriendRequest(u._id), "Failed to cancel request"),
            acceptRequest: (u) =>
                run(u, { isFriend: true, hasPendingRequest: false }, () => api.acceptFriendRequest(u._id), "Failed to accept request"),
            rejectRequest: (u) =>
                run(u, { hasPendingRequest: false }, () => api.rejectFriendRequest(u._id), "Failed to decline request"),
        }),
        [run],
    );

    return { actions, error };
}