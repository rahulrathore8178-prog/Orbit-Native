import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { RootState } from '@/redux/store';
import { fetchFriends } from '@/redux/slice/friends';
import { profileApi } from '@/components/services/profileApi';
import { toFriend } from '@/components/services/profileMappers';
import { Friend, ProfilePost, ProfileUser } from '@/components/profile/profile';

/**
 * Loads one profile. Data lives in local state (not the shared redux slice) so the
 * profile tab and a pushed /user/[id] page can never overwrite each other.
 */
export function useProfile(userId?: string) {
    const [user, setUser] = useState<ProfileUser | null>(null);
    const [posts, setPosts] = useState<ProfilePost[]>([]);
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
            // console.log('target', target?.friends);

            const [nextPosts, nextFriends] = await Promise.all([
                profileApi.getPosts(target.id),
                isSelf ? Promise.resolve<Friend[]>([]) : profileApi.getFriends(target.id),
            ]);

            setUser(target);
            setPosts(nextPosts);
            setOtherFriends(target?.friends);
        } catch (error) {
            console.error('Error loading profile:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [userId]);

    useEffect(() => {
        setLoading(true);
        load();
    }, [load]);

    useEffect(() => {
        // own friends still come from redux; if fetchFriends is a createAsyncThunk, use dispatch(fetchFriends())
        if (!userId) fetchFriends();
    }, [userId]);

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

    return { user, posts, friends, isOwn, loading, refreshing, refresh, patchUser, setPosts };
}

export type ProfileState = ReturnType<typeof useProfile>;