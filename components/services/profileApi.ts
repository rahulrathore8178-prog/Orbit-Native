import { Friend, FriendRequest, ProfilePost, ProfileUser } from '@/components/profile/profile';
import { API_URL } from '@/lib/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios, { AxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import { resolveUri, toFriend, toFriendRequest, toProfilePost, toProfileUser } from './profileMappers';
import { authStorage } from '@/lib/auth/authStorage';

/* -------------------------------------------------------------------------- */
/*  ROUTES: checked against server/src/routes (auth, social, community).      */
/* -------------------------------------------------------------------------- */
const ENDPOINTS = {
    me: '/api/auth/user/me',
    user: (id: string) => `/api/auth/user/${id}/public`,
    friends: (id: string) => `/api/auth/user/${id}/public`,
    userPosts: (id: string) => `/api/community/users/${id}/posts?page=1&limit=20`,
    updateMe: '/api/auth/user/profile', // PATCH { username?, bio?, profilePic? }
    avatar: '/api/auth/user/profile/image', // PATCH multipart "profilePic"
    deletePost: (id: string) => `/api/community/posts/${id}`, // DELETE
    archivePost: (id: string) => `/api/community/posts/${id}/archive`, // PATCH { isArchived }
    editCaption: (id: string) => `/api/community/posts/${id}/caption`, // PATCH { content }
    friend: (id: string) => `/api/social/friends/${id}`, // DELETE (unfriend)
    friendRequest: (id: string) => `/api/social/friend-request/${id}`, // POST send / DELETE cancel
    friendRequests: '/api/social/friend-requests', // GET incoming
    acceptRequest: (requestId: string) => `/api/social/friend-request/${requestId}/accept`, // POST
    rejectRequest: (requestId: string) => `/api/social/friend-request/${requestId}/reject`, // POST
    block: (id: string) => `/api/social/block/${id}`, // POST
};

/* -------------------------------------------------------------------------- */
/*  HTTP helper                                                               */
/* -------------------------------------------------------------------------- */
async function request<T = any>(config: AxiosRequestConfig): Promise<T> {
    const token = await authStorage.getToken();

    try {
        const res = await axios({
            baseURL: API_URL,
            withCredentials: true,
            ...config,
            headers: {
                Authorization: `Bearer ${token}`,
                ...config.headers,
            },
        });

        return res.data;
    } catch (error: any) {
        console.log('URL:', config.url);
        console.log('STATUS:', error?.response?.status);
        console.log('DATA:', error?.response?.data);

        throw error;
    }
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
        return toProfileUser(data.user ?? data);
    },

    async getPosts(id: string): Promise<ProfilePost[]> {
        const data = await request({ url: ENDPOINTS.userPosts(id) });
        console.log('RAW post keys', Object.keys(data.posts?.[0] ?? {}), 'views:', data.posts?.[0]?.views);
        return (data.posts ?? []).map(toProfilePost);
    },

    async getPostsGuarded(id: string): Promise<{ posts: ProfilePost[]; locked: boolean }> {
        try {
            const data = await request({ url: ENDPOINTS.userPosts(id) });
            return { posts: (data.posts ?? []).map(toProfilePost), locked: false };
        } catch (error: any) {
            const status = error?.response?.status;
            const message = String(error?.response?.data?.message ?? '');
            if (status === 403 && /private/i.test(message)) return { posts: [], locked: true };
            throw error; // anything else is a real error
        }
    },

    /** Your own archived posts (the server only returns them to the owner). */
    async getArchivedPosts(): Promise<{ me: ProfileUser; posts: Array<ProfilePost & { likes: string[] }> }> {
        const me = await profileApi.getMe();
        const posts: Array<ProfilePost & { likes: string[] }> = [];
        for (let page = 1; page <= 10; page++) {
            const data = await request({ url: `/api/community/users/${me.id}/posts?archived=true&page=${page}&limit=20` });
            (data.posts ?? []).forEach((raw: any) =>
                posts.push({ ...toProfilePost(raw), likes: Array.isArray(raw.likes) ? raw.likes.map(String) : [] }),
            );
            if (!data.pagination?.hasMore) break;
        }
        return { me, posts };
    },

    async getFriends(id: string): Promise<Friend[]> {
        const data = await request({ url: ENDPOINTS.friends(id) });
        const list = data.user?.friends ?? data.friends ?? (Array.isArray(data) ? data : []);
        return list.map(toFriend);
    },

    /** Incoming friend requests for the logged-in user. */
    async getFriendRequests(): Promise<FriendRequest[]> {
        const data = await request({ url: ENDPOINTS.friendRequests });
        return (data.requests ?? []).map(toFriendRequest).filter((r: FriendRequest) => r.requestId && r.user.id);
    },

    updateMe: (patch: { username?: string; bio?: string }) =>
        request({ url: ENDPOINTS.updateMe, method: 'PATCH', data: patch }),


    async uploadAvatar(uri: string): Promise<string | undefined> {
        const token = await AsyncStorage.getItem('user');
        const formData = new FormData();
        try {
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
                    withCredentials: true, // cookies only matter in the browser
                    headers: {
                        Authorization: `Bearer ${token}`,
                        // Don't set Content-Type: axios/the browser adds the multipart boundary itself
                    },
                    ...(Platform.OS !== 'web' && { transformRequest: (data: any) => data }),
                }
            );

            const data = response.data;
            return resolveUri(data.profilePic ?? data.user?.profilePic);
        } catch (error: any) {
            console.error('Error uploading avatar:', error);
            console.error('Error details:', error?.response?.data ?? error?.message);
        }
    },

    // the server has no DELETE for the avatar; clearing profilePic through the profile route does the same
    removeAvatar: () => request({ url: ENDPOINTS.updateMe, method: 'PATCH', data: { profilePic: '' } }),
    deletePost: (id: string) => request({ url: ENDPOINTS.deletePost(id), method: 'DELETE' }),
    archivePost: (id: string, isArchived = true) =>
        request({ url: ENDPOINTS.archivePost(id), method: 'PATCH', data: { isArchived } }),
    editCaption: (id: string, content: string) =>
        request({ url: ENDPOINTS.editCaption(id), method: 'PATCH', data: { content } }),

    // friendship
    addFriend: (id: string) => request({ url: ENDPOINTS.friendRequest(id), method: 'POST' }),
    cancelRequest: (id: string) => request({ url: ENDPOINTS.friendRequest(id), method: 'DELETE' }),
    removeFriend: (id: string) => request({ url: ENDPOINTS.friend(id), method: 'DELETE' }),
    acceptRequest: (requestId: string) => request({ url: ENDPOINTS.acceptRequest(requestId), method: 'POST' }),
    rejectRequest: (requestId: string) => request({ url: ENDPOINTS.rejectRequest(requestId), method: 'POST' }),

    blockUser: (id: string) => request({ url: ENDPOINTS.block(id), method: 'POST' }),
};