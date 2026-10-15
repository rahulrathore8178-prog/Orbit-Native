import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useDispatch } from 'react-redux';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { profileApi } from '@/components/services/profileApi';
import { ProfileState } from './useProfile';
import { FriendStatus } from '@/components/profile/profile';

/** All profile mutations. UI updates instantly, then rolls back if the server refuses. */
export function useProfileActions({ user, posts, patchUser, setPosts }: ProfileState) {
    const dispatch = useDispatch();
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    const optimistic = useCallback(
        async (apply: () => void, request: () => Promise<unknown>, rollback: () => void, message: string) => {
            apply();
            try {
                await request();
            } catch (error) {
                console.error(message, error);
                rollback();
                Alert.alert('Something went wrong', message);
            }
        },
        []
    );

    const syncGlobalProfile = useCallback(
        (name?: string, profilePicture?: string) =>
            dispatch({ type: 'profile/updateProfile', payload: { name, profilePicture } }),
        [dispatch]
    );

    const saveUsername = useCallback(
        (next: string) => {
            if (!user) return;
            const prev = user.username;
            return optimistic(
                () => patchUser({ username: next }),
                async () => {
                    await profileApi.updateMe({ username: next });
                    syncGlobalProfile(next, user.profilePic);
                },
                () => patchUser({ username: prev }),
                "Couldn't update your name."
            );
        },
        [user, optimistic, patchUser, syncGlobalProfile]
    );

    const saveBio = useCallback(
        (next: string) => {
            if (!user) return;
            const prev = user.bio;
            return optimistic(
                () => patchUser({ bio: next }),
                () => profileApi.updateMe({ bio: next }),
                () => patchUser({ bio: prev }),
                "Couldn't update your bio."
            );
        },
        [user, optimistic, patchUser]
    );

    const changeAvatar = useCallback(async () => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('Photo access needed', 'Allow photo access in Settings to change your picture.');
            return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
        });
        if (result.canceled || !result.assets[0]) return;

        setIsUploadingAvatar(true);
        try {
            const localUri = result.assets[0].uri;
            const remoteUri = await profileApi.uploadAvatar(localUri);
            patchUser({ profilePic: remoteUri ?? localUri });
            syncGlobalProfile(user?.username, remoteUri ?? localUri);
        } catch (error) {
            console.error('Avatar upload failed', error);
            Alert.alert('Something went wrong', "Couldn't upload your photo.");
        } finally {
            setIsUploadingAvatar(false);
        }
    }, [user, patchUser, syncGlobalProfile]);

    const removeAvatar = useCallback(() => {
        if (!user) return;
        const prev = user.profilePic;
        return optimistic(
            () => patchUser({ profilePic: undefined }),
            () => profileApi.removeAvatar(),
            () => patchUser({ profilePic: prev }),
            "Couldn't remove your photo."
        );
    }, [user, optimistic, patchUser]);

    const deletePost = useCallback(
        (id: string) => {
            const prev = posts;
            return optimistic(
                () => setPosts((list) => list.filter((post) => post.id !== id)),
                () => profileApi.deletePost(id),
                () => setPosts(prev),
                "Couldn't delete that post."
            );
        },
        [posts, optimistic, setPosts]
    );

    const toggleFriend = useCallback(() => {
        if (!user) return;

        const previous = (user.friendStatus ?? 'none') as FriendStatus;
        // Nothing to toggle on your own profile; incoming requests need an accept flow.
        if (previous === 'self' || previous === 'request_received') return;

        const undoing = previous === 'friends' || previous === 'request_sent';

        return optimistic(
            () => patchUser({ friendStatus: undoing ? 'none' : 'request_sent' }),
            () => {
                if (!undoing) return profileApi.addFriend(user.id);
                if (previous === 'friends') return profileApi.removeFriend(user.id);
                return profileApi.cancelRequest(user.id);
            },
            () => patchUser({ friendStatus: previous }),
            "Couldn't update your friendship."
        );
    }, [user, optimistic, patchUser]);

    const blockUser = useCallback(async () => {
        if (!user) return;
        try {
            await profileApi.blockUser(user.id);
            if (router.canGoBack()) router.back();
            else router.replace('/');
        } catch (error) {
            console.error('Block failed', error);
            Alert.alert('Something went wrong', "Couldn't block this user.");
        }
    }, [user]);

    return {
        isUploadingAvatar,
        saveUsername,
        saveBio,
        changeAvatar,
        removeAvatar,
        deletePost,
        toggleFriend,
        blockUser,
    };
}