import Postcard from '@/components/ui/postcard';
import '@/global.css';
import { useAppDispatch } from '@/redux/store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import axios from 'axios';
import { useNavigation } from 'expo-router';
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
        try {
            const token = await AsyncStorage.getItem('token');
            const url = `${API_URL}/api/community/posts/${postId}/like`;
            console.log('postLike sending request', url);
            const response = await axios.post(url, null, {
                withCredentials: true,
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            });

            // Prefer updating the single post from the server response when available.
            // If the server returns the updated post object, merge it; otherwise refresh the feed.
            const updatedPost = response?.data?.post ?? response?.data;
            if (updatedPost && (updatedPost._id || updatedPost.id)) {
                setPosts(prev =>
                    prev.map(p => {
                        const pid = p._id ?? p.id ?? '';
                        const updatedId = updatedPost._id ?? updatedPost.id ?? '';
                        return pid === updatedId ? { ...p, ...updatedPost } : p;
                    })
                );
            } else {
                await getFeed();
            }
        } catch (error) {
            console.error('postLike error:', error);
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

    const navigation = useNavigation<BottomTabNavigationProp<any>>();

    useEffect(() => {
        const parent = navigation.getParent<BottomTabNavigationProp<any>>() ?? navigation;

        const unsubscribe = parent.addListener('tabPress', () => {
            if (navigation.isFocused()) {
                // refresh the feed when the tab is pressed while focused
                getFeed();
            }
        });

        return unsubscribe;
    }, [navigation]);

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