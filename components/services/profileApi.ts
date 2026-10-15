import { useCallback } from 'react';
import { Alert, Platform } from 'react-native';
import axios, { AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/app/utils';
import { Friend, ProfilePost, ProfileUser } from '@/components/profile/profile';
import { resolveUri, toFriend, toProfilePost, toProfileUser } from './profileMappers';

/* -------------------------------------------------------------------------- */
/*  ROUTES: the ones marked CHECK are guesses. Compare them with your backend */
/*  routes file (method AND path) and edit only this block.                   */
/* -------------------------------------------------------------------------- */
const ENDPOINTS = {
    me: '/api/auth/user/me',
    user: (id: string) => `/api/auth/user/${id}/public`,
    friends: (id: string) => `/api/auth/user/${id}/public`,
    userPosts: (id: string) => `/api/community/users/${id}/posts?page=1&limit=20`,
    updateMe: '/api/auth/user/me', // CHECK  PATCH { username?, bio? }
    avatar: '/api/auth/user/profile/image', // CHECK  PUT multipart "avatar" / DELETE
    deletePost: (id: string) => `/api/community/posts/${id}`, // CHECK  DELETE
    friend: (id: string) => `/api/community/friends/${id}`, // CHECK  DELETE (unfriend)
    friendRequest: (id: string) => `/api/social/friend-request/${id}`, // CHECK  POST send / DELETE cancel
    block: (id: string) => `/api/community/users/${id}/block`, // CHECK  POST
};

/* -------------------------------------------------------------------------- */
/*  HTTP helper                                                               */
/* -------------------------------------------------------------------------- */
async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const token = await AsyncStorage.getItem('token');
    const res = await axios({
        baseURL: API_URL,
        withCredentials: true,
        ...config,
        headers: { Authorization: `Bearer ${token}`, ...config.headers },
    });
    return res.data;
}

/* -------------------------------------------------------------------------- */
/*  API                                                                       */
/* -------------------------------------------------------------------------- */
export const profileApi = {
    async getMe(): Promise<ProfileUser> {
        const data = await request({ url: ENDPOINTS.me });
        return toProfileUser(data.user);
    },

    async getUser(id: string): Promise<ProfileUser> {
        const data = await request({ url: ENDPOINTS.user(id) });
        // console.log('getUser data', data)
        return toProfileUser(data.user ?? data);
    },

    async getPosts(id: string): Promise<ProfilePost[]> {
        const data = await request({ url: ENDPOINTS.userPosts(id) });
        return (data.posts ?? []).map(toProfilePost);
    },

    async getFriends(id: string): Promise<Friend[]> {
        const data = await request({ url: ENDPOINTS.friends(id) });
        const list = data.user?.friends ?? data.friends ?? (Array.isArray(data) ? data : []);
        return list.map(toFriend);
    },

    updateMe: (patch: { username?: string; bio?: string }) =>
        request({ url: ENDPOINTS.updateMe, method: 'PATCH', data: patch }),


    async uploadAvatar(uri: string): Promise<string | undefined> {
        const token = await AsyncStorage.getItem('token');
        const formData = new FormData();

        if (Platform.OS === 'web') {
            // Browser needs a real Blob/File
            const blob = await (await fetch(uri)).blob();
            const ext = blob.type.split('/')[1] || 'jpg';
            formData.append('profilePic', blob, `avatar.${ext}`);
        } else {
            // React Native needs the { uri, name, type } object
            const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
            const type =
                ext === 'png' ? 'image/png' :
                    ext === 'webp' ? 'image/webp' :
                        'image/jpeg';
            formData.append('profilePic', { uri, name: `avatar.${ext}`, type } as any);
        }

        const response = await axios.patch(
            `${API_URL}${ENDPOINTS.avatar}`,
            formData,
            {
                withCredentials: Platform.OS === 'web', // cookies only matter in the browser
                headers: {
                    Authorization: `Bearer ${token}`,
                    // Don't set Content-Type: axios/the browser adds the multipart boundary itself
                },
                ...(Platform.OS !== 'web' && { transformRequest: (data: any) => data }),
            }
        );

        const data = response.data;
        return resolveUri(data.profilePic ?? data.user?.profilePic);
    },

    removeAvatar: () => request({ url: ENDPOINTS.avatar, method: 'DELETE' }),
    deletePost: (id: string) => request({ url: ENDPOINTS.deletePost(id), method: 'DELETE' }),

    // friendship
    addFriend: (id: string) => request({ url: ENDPOINTS.friendRequest(id), method: 'POST' }),
    cancelRequest: (id: string) => request({ url: ENDPOINTS.friendRequest(id), method: 'DELETE' }),
    removeFriend: (id: string) => request({ url: ENDPOINTS.friend(id), method: 'DELETE' }),

    blockUser: (id: string) => request({ url: ENDPOINTS.block(id), method: 'POST' }),
};