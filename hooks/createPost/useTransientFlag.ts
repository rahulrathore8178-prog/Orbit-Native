import { useCallback, useEffect, useRef, useState } from 'react';

/** `[on, trigger]`: `on` turns true when you call `trigger()` and falls back to false after `duration` ms. */
export function useTransientFlag(duration = 1800) {
  const [on, setOn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    setOn(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOn(false), duration);
  }, [duration]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [on, trigger] as const;
}
