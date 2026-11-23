import CommentsSheet from '@/components/comments/CommentsSheet';
import { FlarePager, type FlarePagerHandle } from '@/components/flares/FlarePager';
import ShareModal from '@/components/posts/ShareModal';
import OrbitLoader from '@/components/ui/OrbitLoader';
import { useCurrentUser, useShare } from '@/hooks/feed/useHomeFeed';
import { bumpComments } from '@/hooks/feed/usePostActions';
import { getFlareSeed } from '@/hooks/flares/flareSeed';
import { useFlaresFeed } from '@/hooks/flares/useFlaresFeed';
import { getDisplayImageUrl } from '@/lib/utils';
import { useIsFocused, useNavigation } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';

type Props = {
    /** Viewer mode: open on this post, then continue with the normal flares feed. */
    startPostId?: string;
    /** Set by the stack route. Shows the back button and drops the tab-bar spacing. */
    onBack?: () => void;
};

export default function FlaresScreen({ startPostId, onBack }: Props) {
    const standalone = !!onBack;
    const feed = useFlaresFeed();
    const currentUser = useCurrentUser();
    const share = useShare();
    const focused = useIsFocused();
    const navigation = useNavigation();
    const pagerRef = useRef<FlarePagerHandle>(null);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

    // tapping the Flares tab while already on it: back to the first flare + reload
    useEffect(() => {
        if (standalone) return;
        const unsubscribe = (navigation as any).addListener('tabPress', () => {
            if (navigation.isFocused()) pagerRef.current?.refreshFromTop();
        });
        return unsubscribe;
    }, [navigation, standalone]);

    const seed = useMemo(() => getFlareSeed(startPostId), [startPostId]);

    // tapped post first, then the ranked flares feed (without a duplicate of the tapped post)
    const posts = useMemo(() => {
        if (!startPostId) return feed.posts;
        const head = seed ?? feed.posts.find((p) => p.id === startPostId);
        return head ? [head, ...feed.posts.filter((p) => p.id !== head.id)] : feed.posts;
    }, [startPostId, seed, feed.posts]);

    const currentUserProps = {
        id: currentUser?.id,
        username: currentUser?.username,
        profilePic: getDisplayImageUrl(currentUser?.profilePic),
    };

    return (
        <View className="flex-1 bg-black">
            <FlarePager
                ref={pagerRef}
                posts={posts}
                enabled={focused}
                hasTabBar={!standalone}
                title="Flares"
                onBack={onBack}
                // the very first load has its own full-screen loader, so only report later reloads
                refreshing={feed.refreshing && !feed.loading}
                onRefresh={feed.refresh}
                onEndReached={() => {
                    if (!feed.loading && !feed.loadingMore) feed.loadMore();
                }}
                viewsPaused={commentsPostId !== null || share.shareId !== null}
                onOpenComments={setCommentsPostId}
                onShare={share.open}
            />

            {!feed.loading && posts.length === 0 && (
                <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
                    <Text className="text-white/60">No flares yet.</Text>
                </View>
            )}

            <CommentsSheet
                visible={commentsPostId !== null}
                postId={commentsPostId}
                onClose={() => setCommentsPostId(null)}
                currentUser={currentUserProps}
                onCountChange={(id: string, delta?: number) => bumpComments(id, typeof delta === 'number' ? delta : 1)}
            />

            <ShareModal
                visible={share.shareId !== null}
                postId={share.shareId}
                friends={share.friends}
                orbitals={share.orbitals}
                onClose={share.close}
            />

            {/* in viewer mode the tapped post is already on screen, so don't cover it with the loader */}
            {!seed && <OrbitLoader visible={feed.loading} />}
        </View>
    );
}