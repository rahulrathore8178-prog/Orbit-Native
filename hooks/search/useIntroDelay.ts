import { useEffect, useRef } from "react";

/** Returns `delay` during the opening sequence, then 0 so later list changes feel instant. */
export function useIntroDelay(delay: number, introMs = 1800) {
    const done = useRef(false);
    useEffect(() => {
        const t = setTimeout(() => {
            done.current = true;
        }, introMs);
        return () => clearTimeout(t);
    }, [introMs]);
    return done.current ? 0 : delay;
}