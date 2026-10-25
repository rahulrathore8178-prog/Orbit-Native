import { useCallback, useState } from "react";
import { MAX_HISTORY } from "../../components/search/constants";

export function useSearchHistory() {
    const [history, setHistory] = useState<string[]>([]);

    const add = useCallback((term: string) => {
        const value = term.trim();
        if (!value) return;
        setHistory((h) =>
            [value, ...h.filter((x) => x.toLowerCase() !== value.toLowerCase())].slice(0, MAX_HISTORY),
        );
    }, []);

    const remove = useCallback((term: string) => setHistory((h) => h.filter((x) => x !== term)), []);
    const clear = useCallback(() => setHistory([]), []);

    return { history, add, remove, clear };
}