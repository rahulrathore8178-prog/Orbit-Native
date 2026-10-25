import ShareModal from '@/components/posts/ShareModal';
import type { StoredUser } from '@/components/services/feed/postUtils';
import React, { useCallback, useState } from 'react';
// adjust these two paths to your project
import CommentsSheet from '../comments/CommentsSheet';
import { useShare } from '@/hooks/feed/useHomeFeed'; // wherever the feed's hooks file lives

/**
 * Comments sheet + the SAME share modal the feed uses + live comment counts.
 * Render `sheets` once at the screen root.
 * Pass the logged-in user (useCurrentUser()), not the profile being viewed.
 */
export function usePostSheets(currentUser: StoredUser | null) {
    const share = useShare();
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);
    const [deltas, setDeltas] = useState<Record<string, number>>({});

    const openComments = useCallback((id: string) => setCommentsPostId(id), []);

    const onCountChange = useCallback((postId: string, delta: number) => {
        setDeltas((d) => ({ ...d, [postId]: (d[postId] ?? 0) + delta }));
    }, []);

    const commentsCountFor = useCallback(
        (postId: string, base: number) => Math.max(0, base + (deltas[postId] ?? 0)),
        [deltas],
    );

    /** call after you refetch posts, since fresh counts already include the changes */
    const resetCounts = useCallback(() => setDeltas({}), []);

    const sheets = (
        <>
            {currentUser ? (
                <CommentsSheet
                    visible={commentsPostId !== null}
                    postId={commentsPostId}
                    onClose={() => setCommentsPostId(null)}
                    currentUser={currentUser as any}
                    onCountChange={onCountChange}
                />
            ) : null}
            {/* TODO: copy the exact props from where the feed renders <ShareModal /> */}
            <ShareModal
                visible={share.shareId !== null}
                postId={share.shareId}
                friends={share.friends}
                orbitals={share.orbitals}
                onClose={share.close}
            />
        </>
    );

    return { openComments, openShare: share.open, commentsCountFor, resetCounts, sheets };
}