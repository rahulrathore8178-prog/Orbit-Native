import axios from "axios";
import { useCallback, useEffect, useState } from "react";
import { getErrorMessage, searchUsers } from "../../components/services/search/searchApi";
import { SEARCH_DEBOUNCE_MS } from "../../components/search/constants";
import type { User } from "../../components/services/search/types";

type Settled = { term: string; users: User[]; error: string | null };
const EMPTY: Settled = { term: "", users: [], error: null };

/**
 * Debounced user search. Stale requests are aborted.
 * `loading` is derived (term !== the term we last got results for), so there is
 * no one-frame flash of "No users found" when you start typing.
 */
export function useUserSearch(query: string) {
    const term = query.trim();
    const [settled, setSettled] = useState<Settled>(EMPTY);

    useEffect(() => {
        if (!term) {
            setSettled(EMPTY);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            try {
                const users = await searchUsers(term, controller.signal);
                if (!controller.signal.aborted) setSettled({ term, users, error: null });
            } catch (err) {
                if (axios.isCancel(err) || controller.signal.aborted) return;
                setSettled({ term, users: [], error: getErrorMessage(err, "Search failed") });
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [term]);

    const patchUser = useCallback((id: string, changes: Partial<User>) => {
        setSettled((s) => ({ ...s, users: s.users.map((u) => (u._id === id ? { ...u, ...changes } : u)) }));
    }, []);

    const loading = term !== "" && settled.term !== term;

    return {
        users: term ? settled.users : [],
        loading,
        error: loading ? null : settled.error,
        patchUser,
    };
}