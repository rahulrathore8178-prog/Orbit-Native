import '@/global.css'
import React, { useEffect, useState } from 'react'
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native'
// import { LinearGradient } from 'expo-linear-gradient'
// import * as ImagePicker from 'expo-image-picker'
import { FontAwesome } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
// import { API_URL } from './home'
import { setPosts } from '@/redux/slice/profileSlice'
import { RootState } from '@/redux/store'
import axios from 'axios'
import { router, useLocalSearchParams, useNavigation } from 'expo-router'
import { useDispatch, useSelector } from 'react-redux'
import { API_URL } from './home'
import { Settings } from 'lucide-react-native'
import { fetchFriends } from '@/redux/slice/friends'


// ---------- Sample data — replace with your real backend calls ----------

const SAMPLE_USER = {
  username: 'Vivek Mandal',
  handle: '@vivekmandal',
  bio: '',
  profilePic: '',
  followers: 0,
  following: 0,
}

type Post = {
  id: string
  content: string
  image?: string
  createdAt: string
  likesCount: number
  commentsCount: number
}

const SAMPLE_POSTS: Post[] = [
  {
    id: '1',
    content: 'Just shipped a new feature — small wins add up 🚀',
    image: 'https://picsum.photos/seed/vivek1/600/600',
    createdAt: new Date().toISOString(),
    likesCount: 0,
    commentsCount: 0,
  },
  {
    id: '2',
    content: 'Coffee, code, repeat.',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    likesCount: 0,
    commentsCount: 0,
  },
]

const TABS = ['Posts', 'Media', 'Liked']

// ---------- Screen ----------

export default function Profile() {
  const navigation = useNavigation()
  const { userId: rawUserId } = useLocalSearchParams();
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const dispatch = useDispatch()

  const resolveUri = (uri?: string) =>
    uri
      ? uri.startsWith('http')
        ? uri
        : `${API_URL}${uri.startsWith('/') ? '' : '/'}${uri}`
      : undefined

  const fetchUserPosts = async (token: string, id: string) => {
    try {
      const res = await axios.get(
        `${API_URL}/api/community/users/${id}/posts?page=1&limit=20`,
        {
          withCredentials: true,
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      console.log('res', res?.data);
      dispatch(setPosts(res.data.posts || []));
    } catch (error) {
      console.error('fetching user posts error', error);
    }
  }

  const getUserProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        console.error('No token found in AsyncStorage');
        return;
      }

      const response = await axios.get(`${API_URL}/api/auth/user/me`, {
        withCredentials: true,
        headers: { Authorization: `Bearer ${token}` },
      });

      console.log('User profile response:', response?.data?.user);

      const fetchedUser = response?.data?.user;
      const profileId = fetchedUser?._id ?? fetchedUser?.id ?? null;
      if (profileId) {
        setCurrentUserId(profileId);
      }

      setProfilePic(resolveUri(fetchedUser?.profilePic) ?? '');

      dispatch({
        type: 'profile/updateProfile',
        payload: {
          name: fetchedUser?.username,
          profilePicture: fetchedUser?.profilePic,
        },
      });

      const targetId = userId ?? profileId;
      if (targetId) {
        await fetchUserPosts(token, targetId);
      } else {
        console.warn('Unable to load posts because no user ID is available.');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  useEffect(() => {
    getUserProfile();
  }, [userId]);
  useEffect(() => {
    fetchFriends();
  }, []);

  const updateProfile = useSelector((state: RootState) => state.profile.name)
  const friends = useSelector((state: RootState) => state.friends.friends);
  const posts = useSelector((state: RootState) => state.profile.posts);
  // console.log('UserPosts:', posts)
  // console.log('profile:', updateProfile)
  const isOwnProfile = true // sample — wire this to your real ownership check
  const [username, setUsername] = useState(SAMPLE_USER.username)
  const [editedUsername, setEditedUsername] = useState(username)
  const [isEditingUsername, setIsEditingUsername] = useState(false)

  const [bio, setBio] = useState(SAMPLE_USER.bio)
  const [draftBio, setDraftBio] = useState(bio)
  const [isEditingBio, setIsEditingBio] = useState(false)

  const [profilePic, setProfilePic] = useState(SAMPLE_USER.profilePic)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  const [activeTab, setActiveTab] = useState(TABS[0])

  const handleSaveUsername = () => {
    const trimmed = editedUsername.trim()
    if (trimmed) setUsername(trimmed)
    setIsEditingUsername(false)
  }

  const handleSaveBio = () => {
    setBio(draftBio)
    setIsEditingBio(false)
  }

  const handleAvatarPick = async () => {
    // const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    // if (!permission.granted) return

    setIsUploadingAvatar(true)
    // const result = await ImagePicker.launchImageLibraryAsync({
    //   mediaTypes: ImagePicker.MediaTypeOptions.Images,
    //   quality: 0.8,
    // })
    // if (!result.canceled && result.assets?.[0]) {
    //   setProfilePic(result.assets[0].uri)
    //   // TODO: upload result.assets[0] to your backend and persist the URL
    // }
    setIsUploadingAvatar(false)
  }

  return (
    <>
      <Text className="text-gray-400 px-4 pt-14 bg-black text-xl font-bold text-center">
        Your ORBI8 Profile
      </Text>
      <ScrollView className="flex-1 bg-black" contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Top navy gradient — fades into the ScrollView's own black background,
          so no separate full-page overlay is needed below it. */}
        <View className="relative">
          {/* <LinearGradient
          colors={['#25406b', '#16233d', 'transparent']}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 320 }}
        />

        {/* Header */}
          <View className="px-4 pt-10 pb-2">
            <View className="flex-row items-start gap-4">
              <Pressable
                onPress={isOwnProfile ? handleAvatarPick : undefined}
                disabled={!isOwnProfile || isUploadingAvatar}
                className="relative h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-neutral-200"
              >
                {profilePic ? (
                  <Image source={{ uri: profilePic }} className="h-full w-full rounded-full" resizeMode="cover" />
                ) : (
                  <View className="h-full w-full items-center justify-center rounded-full bg-neutral-300">
                    <Text className="text-black text-3xl font-semibold">
                      {updateProfile}
                    </Text>
                  </View>
                )}

                {isOwnProfile && (
                  <View className="absolute inset-0 items-center justify-center rounded-full bg-black/40">
                    {isUploadingAvatar ? (
                      <Text className="text-white text-[11px]">Uploading…</Text>
                    ) : (
                      <FontAwesome name="camera" size={20} color="white" />
                    )}
                  </View>
                )}
              </Pressable>

              <View className="flex-1 pt-1">
                {isOwnProfile && isEditingUsername ? (
                  <View className="flex-row items-center gap-3">
                    <TextInput
                      value={editedUsername}
                      onChangeText={setEditedUsername}
                      autoFocus
                      maxLength={30}
                      className="flex-1 border-b border-white/20 pb-1 text-xl font-bold text-white"
                    />
                    <Pressable onPress={handleSaveUsername} hitSlop={8}>
                      <FontAwesome name="check" size={16} color="#22d3ee" />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditedUsername(updateProfile)
                        setIsEditingUsername(false)
                      }}
                      hitSlop={8}
                    >
                      <FontAwesome name="close" size={16} color="#9ca3af" />
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => isOwnProfile && setIsEditingUsername(true)}>
                    <Text numberOfLines={1} className="text-xl font-bold text-white">
                      {updateProfile}
                    </Text>
                  </Pressable>
                )}

                <Text className="mt-1 text-xs text-neutral-500">{SAMPLE_USER.handle}</Text>

                {isOwnProfile && isEditingBio ? (
                  <View className="mt-2">
                    <TextInput
                      value={draftBio}
                      onChangeText={setDraftBio}
                      placeholder="Write something about yourself..."
                      placeholderTextColor="#6b7280"
                      multiline
                      maxLength={200}
                      className="text-xs leading-5 text-white"
                    />
                    <View className="mt-2 flex-row items-center justify-between">
                      <Text className="text-[11px] text-neutral-500">{draftBio.length}/200</Text>
                      <View className="flex-row gap-2">
                        <Pressable
                          onPress={() => {
                            setDraftBio(bio)
                            setIsEditingBio(false)
                          }}
                          className="rounded-lg bg-gray-700 px-3 py-1.5"
                        >
                          <Text className="text-xs font-semibold text-white">Cancel</Text>
                        </Pressable>
                        <Pressable onPress={handleSaveBio} className="rounded-lg bg-cyan-700 px-3 py-1.5">
                          <Text className="text-xs font-semibold text-white">Save</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                ) : (
                  <Pressable onPress={() => isOwnProfile && setIsEditingBio(true)} className="mt-2">
                    <Text className="text-xs leading-5 text-gray-300">
                      {bio || (isOwnProfile ? 'No bio yet. Tap to add one.' : 'No bio yet.')}
                    </Text>
                  </Pressable>
                )}

                <View className="mt-4 flex-row items-center gap-2">
                  <Text className="text-xs text-neutral-400">
                    <Text className="font-bold text-white">{posts.length}</Text> Posts
                  </Text>
                  <Text className="text-neutral-600">|</Text>
                  <Pressable onPress={() => router.push('/components/profile/friends')} className="text-xs text-neutral-400">
                    <Text className="text-xs text-neutral-400">
                      <Text className="font-bold text-white">{friends.length}</Text> Friends
                    </Text>
                  </Pressable>
                  <Text className="text-neutral-600">|</Text>
                  <Pressable onPress={() => router.push('/components/profile/settings')}>
                    <Settings className="text-xl font-bold text-white" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="mt-6 flex-row items-center justify-center gap-8 border-b border-white/10 px-4 pb-3">
          {TABS.map((tab) => {
            const active = tab === activeTab
            return (
              <Pressable key={tab} onPress={() => setActiveTab(tab)} className="relative pb-2">
                <Text className={active ? 'text-sm font-bold text-white' : 'text-sm text-neutral-500'}>
                  [ {tab} ]
                </Text>
                {active && <View className="absolute -bottom-[13px] left-0 right-0 h-[2px] bg-white" />}
              </Pressable>
            )
          })}
        </View>

        {/* Content */}
        <View className="mt-6 px-4 gap-4">
          {posts.length === 0 ? (
            <Text className="text-center text-sm text-gray-400">No posts yet.</Text>
          ) : (
            posts.map((post) => (
              <View key={post.id} className="rounded-2xl border border-white/10 bg-[#2B2B2B] p-4">
                <Text className="mb-2 text-xs text-gray-400">
                  {new Date(post.updatedAt).toLocaleDateString()}
                </Text>
                <Text numberOfLines={3} className="mb-3 text-sm text-white">
                  {post.content}
                </Text>
                {resolveUri(post.image) && (
                  <View className="mb-3 aspect-square overflow-hidden rounded-xl">
                    <Image source={{ uri: resolveUri(post.image) }} className="h-full w-full" resizeMode="cover" />
                  </View>
                )}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <FontAwesome name="heart" size={12} color="#9ca3af" />
                    <Text className="text-xs text-gray-400">{post.likesCount} likes</Text>
                    <FontAwesome name="comment" size={12} color="#9ca3af" />
                    <Text className="text-xs text-gray-400">{post.commentsCount} comments</Text>
                  </View>
                  {/* <Text className="text-xs text-gray-400">{post.commentsCount} comments</Text> */}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </>
  )
}