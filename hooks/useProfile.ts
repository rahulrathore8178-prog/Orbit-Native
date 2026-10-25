import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/redux/store';
import { fetchFriends } from '@/redux/slice/friends';
import { profileApi } from '@/components/services/profileApi';
import { toFriend } from '@/components/services/profileMappers';
import { Friend, FriendRequest, ProfilePost, ProfileUser } from '@/components/profile/profile';

/**
 * Loads one profile. Data lives in local state (not the shared redux slice) so the
 * profile tab and a pushed /user/[id] page can never overwrite each other.
 */
export function useProfile(userId?: string) {
    const dispatch = useDispatch<AppDispatch>();
    const [user, setUser] = useState<ProfileUser | null>(null);
    const [posts, setPosts] = useState<ProfilePost[]>([]);
    const [requests, setRequests] = useState<FriendRequest[]>([]);
    const [postsLocked, setPostsLocked] = useState(false); // private profile and not friends
    const [otherFriends, setOtherFriends] = useState<Friend[]>([]);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const ownFriends = useSelector((state: RootState) => state.friends.friends);
    const isOwn = !userId || userId === currentUserId;

    const load = useCallback(async () => {
        try {
            const me = await profileApi.getMe();
            setCurrentUserId(me.id);

            const target = userId && userId !== me.id ? await profileApi.getUser(userId) : me;
            const isSelf = target.id === me.id;

            // A private profile answers 403. That is handled inside getPostsGuarded,
            // so the header still loads and we just show the "private" notice.
            const { posts: nextPosts, locked } = await profileApi.getPostsGuarded(target.id);

            // Incoming friend requests only exist for your own private profile.
            // They are an extra: if they fail, the rest of the profile must still show.
            const nextRequests =
                isSelf && target.isPrivate
                    ? await profileApi.getFriendRequests().catch((e) => {
                        console.error('Error loading friend requests:', e);
                        return [] as FriendRequest[];
                    })
                    : [];

            setUser(target);
            setPostsLocked(!isSelf && locked);
            setPosts(
                nextPosts.map((p) => ({
                    ...p,
                    isLikedByCurrentUser: p.isLikedByCurrentUser ?? !!p.likedBy?.includes(me.id),
                })),
            );
            setRequests(nextRequests);
            setOtherFriends(isSelf || locked ? [] : target.friends ?? []);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        setLoading(true);
        setPostsLocked(false);
        load();
    }, [load]);

    // Once a friend request is accepted/you become friends, unlock without a manual refresh.
    const friendStatus = user?.friendStatus;
    useEffect(() => {
        if (postsLocked && friendStatus === 'friends') load();
    }, [friendStatus, postsLocked, load]);

    useEffect(() => {
        // own friends come from redux
        if (!userId) dispatch(fetchFriends());
    }, [userId, dispatch]);

    const friends = useMemo(
        () => (isOwn ? ownFriends.map(toFriend) : otherFriends),
        [isOwn, ownFriends, otherFriends]
    );

    const patchUser = useCallback(
        (patch: Partial<ProfileUser>) => setUser((prev) => (prev ? { ...prev, ...patch } : prev)),
        []
    );

    const refresh = useCallback(() => {
        setRefreshing(true);
        load();
    }, [load]);

    return {
        user,
        posts,
        requests,
        postsLocked,
        friends,
        isOwn,
        loading,
        refreshing,
        refresh,
        patchUser,
        setPosts,
        setRequests,
    };
}

export type ProfileState = ReturnType<typeof useProfile>;