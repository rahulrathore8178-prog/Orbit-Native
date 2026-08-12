import Postcard from '@/components/ui/postcard';
import '@/global.css';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
// Local override for development; replace with shared config in production
 export const API_URL = 'http://10.36.40.37:5000';
 export const BASE_URL = 'http://10.36.40.37:5000/api/community/posts/image/'

type Post = {
    _id?: string;
    id?: string;
    content?: string;
    image?: string;
    author?: {
        username: string;
        profilePic?: string;
    };
    createdAt?: string;
    likesCount?: number;
    commentsCount?: number;
    isLikedByCurrentUser?: boolean;
};


export default function IndexScreen() {
    const [posts, setPosts] = useState<Post[]>([]);

    const handleLike = async (postId: string, isLiked: boolean) => {
        console.log('handleLike called for', postId, 'isLiked:', isLiked);
        // optimistic update
        setPosts(prev =>
            prev.map(p => {
                const pid = p._id ?? p.id ?? '';
                return pid === postId
                    ? {
                        ...p,
                        isLikedByCurrentUser: !isLiked,
                        likesCount: (p.likesCount ?? 0) + (isLiked ? -1 : 1),
                    }
                    : p;
            })
        );

        try {
            const token = await AsyncStorage.getItem('token');
            const url = `${API_URL}/api/community/posts/${postId}/like`;
            // const method = isLiked ? 'DELETE' : 'POST';
            console.log('postLike sending request', url);
            await axios.post(`${API_URL}/api/community/posts/${postId}/like`, {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
        } catch (error) {
            console.error('postLike error:', error);
            // revert optimistic update on error
            setPosts(prev =>
                prev.map(p => {
                    const pid = p._id ?? p.id ?? '';
                    return pid === postId
                        ? {
                            ...p,
                            isLikedByCurrentUser: isLiked,
                            likesCount: (p.likesCount ?? 0) + (isLiked ? 1 : -1),
                        }
                        : p;
                })
            );
        }
    };

    const getFeed = async () => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get(`${API_URL}/api/community/feed`, {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            });
            const data = response.data?.posts ?? response.data;
            console.log('Fetched feed:', data);
            console.log('userData:', token);
            if (Array.isArray(data)) setPosts(data);
            else console.warn('Unexpected feed shape', response.data);
        } catch (error) {
            console.error('Error fetching feed:', error);
        }
    };

    useEffect(() => {
        getFeed();
    }, []);

    return (
        <>
            <Text className="text-gray-300 px-4 pt-14 pb-2 bg-black text-lg font-semibold text-center p-5">
                ORBI8
            </Text>
            <ScrollView
                className='bg-black px-4 text-white'
                contentContainerStyle={{ paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}>
                {posts.map((p, i) => (
                    <Postcard
                        key={p._id ?? p.id ?? i}
                        id={p._id ?? p.id ?? String(i)}
                        content={p.content ?? ''}
                        image={p.image}
                        author={p.author}
                        createdAt={p.createdAt}
                        likesCount={p.likesCount}
                        commentsCount={p.commentsCount}
                        isLikedByCurrentUser={p.isLikedByCurrentUser}
                        handleLike={handleLike}
                    />
                ))}
            </ScrollView>
        </>
    );
}
