import '@/global.css'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { Feather, Ionicons } from '@expo/vector-icons'
import AsyncStorage from '@react-native-async-storage/async-storage'
import axios from 'axios'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import Animated, { FadeInUp, SlideInRight } from 'react-native-reanimated'
import { useSelector } from 'react-redux'
import { API_URL } from './home'

// ---------- Sample data ----------

// type Contact = {
//   id: string
//   name: string
//   avatar: string
//   lastMessage: string
//   time: string
//   online?: boolean
// }

type Message = {
  id: string
  text: string
  sender: 'me' | 'them'
  time: string
}

// const CONTACTS: Contact[] = [
//   { id: '1', name: 'Ava Martinez', avatar: 'https://i.pravatar.cc/150?img=32', lastMessage: 'See you tomorrow!', time: '09:41', online: true },
//   { id: '2', name: 'Liam Chen', avatar: 'https://i.pravatar.cc/150?img=12', lastMessage: 'Sent the files 📎', time: '08:20', online: true },
//   { id: '3', name: 'Sofia Ricci', avatar: 'https://i.pravatar.cc/150?img=47', lastMessage: 'Haha that\u2019s wild', time: 'Yesterday' },
//   { id: '4', name: 'Noah Bennett', avatar: 'https://i.pravatar.cc/150?img=15', lastMessage: 'Call me when free', time: 'Yesterday', online: true },
//   { id: '5', name: 'Maya Patel', avatar: 'https://i.pravatar.cc/150?img=25', lastMessage: 'Loved the post 🔥', time: 'Mon' },
//   { id: '6', name: 'Ethan Brooks', avatar: 'https://i.pravatar.cc/150?img=8', lastMessage: 'Sounds good', time: 'Mon' },
// ]

// function getInitialMessages(contact: Contact): Message[] {
//   return [
//     { id: '1', text: `Hey! Are we still on for tomorrow?`, sender: 'them', time: '09:12' },
//     { id: '2', text: `Yes, looking forward to it 🙌`, sender: 'me', time: '09:14' },
//     { id: '3', text: `Perfect, I'll bring the documents.`, sender: 'them', time: '09:15' },
//     { id: '4', text: `Sounds good, see you then!`, sender: 'me', time: '09:16' },
//     { id: '5', text: `Also — did you see what ${contact.name.split(' ')[0]} posted earlier?`, sender: 'them', time: '09:17' },
//   ]
// };

// Chat Prop
interface ChatProp {
  id: string;
  sender: string;
  text: string;
  time: string;
};

// ---------- Message bubble ----------

function MessageBubble({ item }: { item: Message }) {
  const isMe = item.sender === 'me'
  return (
    // The only "pop" animation in this screen: bubbles rise + fade in as they mount.
    <Animated.View
      entering={FadeInUp.springify().damping(14).mass(0.5)}
      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'self-end bg-gray-700' : 'self-start bg-neutral-800'
        }`}
    >
      <Text className="text-gray-100 text-[14.5px] leading-5">{item.text}</Text>
      <Text className="text-gray-400 text-[10px] mt-1 self-end">{item.time}</Text>
    </Animated.View>
  )
}

// ---------- Contacts list screen ----------

function ContactsScreen({
  contacts,
  filteredFriends,
  onSelect,
}: {
  contacts?: Friend[]
  filteredFriends?: Friend[]
  onSelect: (contact: Friend) => void
}) {
  const data = filteredFriends ?? contacts ?? []

  return (
    <View style={{ flex: 1 }} className="flex-1 bg-black pt-14">
      <Text className="text-white text-2xl font-bold px-5 pb-4">Messages</Text>
      <FlatList
        data={data}
        keyExtractor={(c) => c._id}
        ItemSeparatorComponent={() => <View className="h-px bg-neutral-900 ml-[88px]" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onSelect(item)}
            className="flex-row items-center gap-3 px-5 py-3 active:bg-neutral-900"
          >
            <View className="relative">
              <Image source={{ uri: item.profilePic }} className="h-14 w-14 rounded-full" />
              {/* {item.online && (
                <View className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-black" />
              )} */}
            </View>
            <View className="flex-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-white text-[15px] font-semibold">{item.username}</Text>
                {/* <Text className="text-gray-500 text-[11px]">{item.time}</Text> */}
              </View>
              {/* <Text numberOfLines={1} className="text-gray-400 text-[13px] mt-0.5">
                {item.lastMessage}
              </Text> */}
            </View>
          </Pressable>
        )}
      />
    </View>
  )
}

// ---------- Chat screen ----------

function ChatScreen({ contact, onBack }: { contact: Friend; onBack: () => void }) {
  const [messages, setMessages] = useState<ChatProp[]>([]);
  const input = useSelector((state: RootState) => state.chat.input)
  const listRef = useRef<FlatList>(null)
  const dispatch = useAppDispatch()

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed) return
    const newMessage: Message = {
      id: String(Date.now()),
      text: trimmed,
      sender: 'me',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages((prev) => [...prev, newMessage])
    dispatch({ type: 'chat/setInput', payload: '' })
  }

  return (
    // The only other animation in this screen: the chat slides/fades in on open.
    <Animated.View entering={SlideInRight.duration(220)} style={{ flex: 1 }} className="bg-black">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} className="flex-1">
        {/* Header — static */}
        <View className="flex-row items-center gap-3 px-3 pt-14 pb-3 bg-neutral-950 border-b border-neutral-800">
          <Pressable onPress={onBack} hitSlop={8} className="p-1">
            <Ionicons name="chevron-back" size={24} color="white" />
          </Pressable>

          <Image source={{ uri: contact.profilePic }} className="h-10 w-10 rounded-full" />

          <View className="flex-1">
            <Text className="text-white text-[15px] font-semibold">{contact.username}</Text>
            {/* <Text className="text-gray-400 text-[11px]">{contact.online ? 'Online' : 'Offline'}</Text> */}
          </View>

          <Pressable hitSlop={8} className="p-1.5">
            <Ionicons name="information-circle-outline" size={22} color="white" />
          </Pressable>
          <Pressable hitSlop={8} className="p-1.5">
            <Feather name="phone" size={19} color="white" />
          </Pressable>
          <Pressable hitSlop={8} className="p-1.5">
            <Ionicons name="videocam-outline" size={23} color="white" />
          </Pressable>
        </View>

        {/* Chat — only this part scrolls */}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          className="flex-1 bg-black"
          // contentContainerStyle kept as a plain style object rather than
          // contentContainerClassName, since that prop only exists on
          // NativeWind v4 — this stays safe regardless of your version.
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 16, gap: 10 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        />

        {/* Input — static */}
        <View className="flex-row items-center gap-2 px-3 py-2.5 bg-neutral-900 border-t border-neutral-800">
          <Pressable hitSlop={6} className="p-1.5">
            <Feather name="paperclip" size={20} color="#9ca3af" />
          </Pressable>

          <View className="flex-1 flex-row items-center bg-neutral-700 rounded-full px-3 py-1.5">
            <Pressable hitSlop={6} className="pr-2">
              <Ionicons name="happy-outline" size={19} color="#9ca3af" />
            </Pressable>
            <TextInput
              value={input}
              onChangeText={(text) => dispatch({ type: 'chat/setInput', payload: text })}
              placeholder="Message..."
              placeholderTextColor="#9ca3af"
              className="flex-1 text-white text-[14px]"
            />
          </View>

          <Pressable hitSlop={6} className="p-1.5">
            <Ionicons name="camera-outline" size={21} color="#9ca3af" />
          </Pressable>

          <Pressable onPress={handleSend} hitSlop={6} className="p-1.5">
            {input.trim().length > 0 ? (
              <Ionicons name="send" size={20} color="white" />
            ) : (
              <Ionicons name="mic-outline" size={22} color="#9ca3af" />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  )
}

// ---------- Root ----------

export default function MessagesApp() {
  const dispatch = useAppDispatch()
  const [selectedContact, setSelectedContact] = useState<Friend | null>(null)
  const friends = useSelector((state: RootState) => state.friends.friends)
  const isLoading = useSelector((state: RootState) => state.friends.isLoading)
  const error = useSelector((state: RootState) => state.friends.error)
  const [query, setQuery] = useState('');

  const testFriends = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get<{ friends: Friend }>(
        `${API_URL}/api/social/friends`,
        {
          withCredentials: true,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }
      );

      console.log('friends', response.data?.friends);
      return response.data.friends ?? [];
    } catch (error: any) {
      console.error('Error fetching friends:', error);
      // return thunkAPI.rejectWithValue({
      //   message:
      //     error?.response?.data?.message ||
      //     error?.message ||
      //     'Failed to fetch friends',
      // });
    }
  }

  useEffect(() => {
    dispatch(fetchFriends())
    testFriends()
  }, [])

  const filteredFriends = useMemo(() => {
    if (!query.trim()) return friends
    const q = query.trim().toLowerCase()
    return friends.filter((f: Friend) => f.username.toLowerCase().includes(q))
  }, [friends, query]);

  console.log('filteredFriends:', filteredFriends)
  console.log('friends:', friends)

  return (
    <View style={{ flex: 1 }}>
      {selectedContact ? (
        <ChatScreen contact={selectedContact} onBack={() => setSelectedContact(null)} />
      ) : (
        <ContactsScreen contacts={friends} filteredFriends={filteredFriends} onSelect={setSelectedContact} />
      )}
    </View>
  )
}