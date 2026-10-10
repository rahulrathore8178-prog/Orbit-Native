import { fetchFriends, type Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { useRouter } from 'expo-router'
import { ChevronLeft, MessageCircle, Search, UserX } from 'lucide-react-native'
import React, { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSelector } from 'react-redux'

const Friends = () => {
  const dispatch = useAppDispatch()
  const router = useRouter()
  const friends = useSelector((state: RootState) => state.friends.friends)
  const isLoading = useSelector((state: RootState) => state.friends.isLoading)
  const error = useSelector((state: RootState) => state.friends.error)

  const [query, setQuery] = useState('')

  useEffect(() => {
    dispatch(fetchFriends())
  }, [dispatch])

  const filteredFriends = useMemo(() => {
    if (!query.trim()) return friends
    const q = query.trim().toLowerCase()
    return friends.filter((f: Friend) => f.username.toLowerCase().includes(q))
  }, [friends, query])

  const handleUnfriend = (friend: Friend) => {
    Alert.alert('Unfriend', `Remove ${friend.username} from your friends?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unfriend',
        style: 'destructive',
        onPress: () => {
          // TODO: dispatch(unfriendUser(friend._id)) once that thunk exists in the friends slice
        },
      },
    ])
  }

  const handleMessage = (friend: Friend) => {
    // TODO: router.push(`/chat/${friend._id}`)
  }

  const handleOpenProfile = (friend: Friend) => {
    // TODO: router.push(`/profile/${friend._id}`)
  }

  const renderItem = ({ item }: { item: Friend }) => (
    <Pressable
      onPress={() => handleOpenProfile(item)}
      className="mb-3 flex-row items-center rounded-2xl bg-white/5 p-3 active:bg-white/10"
    >
      <Image
        source={{ uri: item.profilePic }}
        className="h-12 w-12 rounded-full bg-white/10"
      />

      <View className="ml-3 flex-1">
        <Text className="text-sm font-semibold text-white">{item.username}</Text>
      </View>

      <View className="flex-row items-center gap-2">
        <Pressable
          onPress={() => handleMessage(item)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:bg-white/20"
        >
          <MessageCircle size={16} color="#e5e7eb" />
        </Pressable>

        <Pressable
          onPress={() => handleUnfriend(item)}
          hitSlop={8}
          className="h-9 w-9 items-center justify-center rounded-full bg-red-500/10 active:bg-red-500/20"
        >
          <UserX size={16} color="#f87171" />
        </Pressable>
      </View>
    </Pressable>
  )

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <Pressable
            onPress={() => router.push('/(tabs)/profile')}
            hitSlop={8}
            className="h-9 w-9 items-center justify-center rounded-full bg-white/5 active:bg-white/10"
          >
            <ChevronLeft size={20} color="#ffffff" />
          </Pressable>

          <Text className="flex-1 text-center text-lg font-bold text-white">
            Friends
          </Text>

          {/* Spacer to balance the back button so the title stays centered */}
          <View className="h-9 w-9" />
        </View>

        {/* List */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-gray-400">Loading friends…</Text>
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-sm text-red-400">{error}</Text>
          </View>
        ) : filteredFriends.length === 0 ? (
          <View className="flex-1 items-center justify-center px-6">
            <Text className="text-center text-sm text-gray-400">
              {query ? 'No friends match your search.' : 'You have no friends yet.'}
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredFriends}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* Search bar — sits at the bottom, rides up with the keyboard */}
        <View className="border-t border-white/10 bg-black px-4 py-3">
          <View className="flex-row items-center rounded-2xl bg-white/5 px-3 py-2.5">
            <Search size={16} color="#9ca3af" />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search friends"
              placeholderTextColor="#6b7280"
              className="ml-2 flex-1 text-sm text-white"
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

export default Friends