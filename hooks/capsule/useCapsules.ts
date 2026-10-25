import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { capsuleApi } from '../../components/services/capsule/capsuleApi';
import type { Capsule, CapsuleFeed, CapsuleGroup } from '../../constants/capsule/types';

export function useCapsules(enabled = true) {
  const [feed, setFeed] = useState<CapsuleFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const feedRef = useRef<CapsuleFeed | null>(null);
  feedRef.current = feed;

  
  const load = useCallback(async () => {
    // console.log('[capsules] load start');
    try {
    setError(null);
    const data = await capsuleApi.getFeed();
    // console.log('[capsules] loaded', data.me?.id, data.mine.length, data.groups.length);
    console.log('[capsules] viewers', data.mine[0]?.viewers);
    setFeed(data);
  } catch (e: any) {
    console.log('[capsules] FAILED', e?.message, e?.response?.status, e?.config?.url);
    setError('Could not load capsules.');
  } finally {
    setLoading(false);
  }
}, []);
useEffect(() => {
if (enabled) load();
}, [enabled, load]);

  const patch = useCallback((id: string, fn: (c: Capsule) => Capsule) => {
    setFeed((prev) =>
      prev
        ? {
            ...prev,
            mine: prev.mine.map((c) => (c.id === id ? fn(c) : c)),
            groups: prev.groups.map((g) => ({
              ...g,
              capsules: g.capsules.map((c) => (c.id === id ? fn(c) : c)),
            })),
          }
        : prev,
    );
  }, []);

  const find = (id: string) => {
    const f = feedRef.current;
    if (!f) return undefined;
    return (
      f.mine.find((c) => c.id === id) ??
      f.groups.flatMap((g) => g.capsules).find((c) => c.id === id)
    );
  };

  const toggleLike = useCallback(
    async (id: string) => {
      const c = find(id);
      if (!c) return;
      const next = !c.likedByMe;
      const d = next ? 1 : -1;
      patch(id, (x) => ({ ...x, likedByMe: next, likesCount: x.likesCount + d }));
      try {
        await capsuleApi.setLike(id, next);
      } catch {
        patch(id, (x) => ({ ...x, likedByMe: !next, likesCount: x.likesCount - d }));
      }
    },
    [patch],
  );

  const toggleSave = useCallback(
    async (id: string) => {
      const c = find(id);
      if (!c) return;
      const next = !c.savedByMe;
      patch(id, (x) => ({ ...x, savedByMe: next }));
      try {
        await capsuleApi.setSaved(id, next);
      } catch {
        patch(id, (x) => ({ ...x, savedByMe: !next }));
      }
    },
    [patch],
  );

  const markSeen = useCallback(
    (id: string) => {
      patch(id, (x) => ({ ...x, seen: true }));
      capsuleApi.markViewed(id).catch(() => {});
    },
    [patch],
  );

  const bumpComments = useCallback(
    (id: string) => patch(id, (x) => ({ ...x, commentsCount: x.commentsCount + 1 })),
    [patch],
  );

  // Throws on failure so the UI can show an error.
  const remove = useCallback(async (id: string) => {
    await capsuleApi.remove(id);
    setFeed((prev) =>
      prev
        ? {
            ...prev,
            mine: prev.mine.filter((c) => c.id !== id),
            groups: prev.groups
              .map((g) => ({ ...g, capsules: g.capsules.filter((c) => c.id !== id) }))
              .filter((g) => g.capsules.length > 0),
          }
        : prev,
    );
  }, []);

  // Own group first, then everyone else.
  const groups: CapsuleGroup[] = useMemo(() => {
    if (!feed) return [];
    const own = feed.mine.length ? [{ user: feed.me, capsules: feed.mine }] : [];
    return [...own, ...feed.groups];
  }, [feed]);

  // inside useCapsules, below the other hooks
// useEffect(() => {
//   console.log('capsules state →', { loading, error, me: feed?.me, mine: feed?.mine.length, groups: groups.length });
// }, [loading, error, feed, groups]);

  return {
    me: feed?.me ?? null,
    groups,
    loading,
    error,
    reload: load,
    toggleLike,
    toggleSave,
    markSeen,
    bumpComments,
    remove,
  };
}
