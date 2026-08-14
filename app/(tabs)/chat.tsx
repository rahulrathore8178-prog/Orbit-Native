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
  content: string
  sender: 'me' | 'them'
  time: string
}

// Chat Prop
interface ChatProp {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
};

// ---------- Message bubble ----------

function MessageBubble({ item, id }: { item: Message }) {
  const isMe = item.sender === 'me'
  return (
    // The only "pop" animation in this screen: bubbles rise + fade in as they mount.
    <Animated.View
      entering={FadeInUp.springify().damping(14).mass(0.5)}
      className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'self-end bg-gray-700' : 'self-start bg-neutral-800'
        }`}
    >
      <Text className="text-gray-100 text-[14.5px] leading-5">{item.content}</Text>
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

function ChatScreen({ contact, onBack, messages }: { contact: Friend; onBack: () => void; messages: Message[] }) {
  // const [messages, setMessages] = useState<Message[]>([]);
  const input = useSelector((state: RootState) => state.chat.input)
  const listRef = useRef<FlatList>(null)
  const dispatch = useAppDispatch()

  // const handleSend = () => {
  //   const trimmed = input.trim()
  //   if (!trimmed) return
  //   const newMessage: Message = {
  //     id: String(Date.now()),
  //     text: trimmed,
  //     sender: 'me',
  //     time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  //   }
  //   setMessages((prev) => [...prev, newMessage])
  //   dispatch({ type: 'chat/setInput', payload: '' })
  // }

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

          <Pressable hitSlop={6} className="p-1.5">
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
  const [messages, setMessages] = useState<Message[]>([]);
  console.log('selected:', selectedContact?._id)

  const getMessages = async (friendId?: string) => {
    try {
      const id = selectedContact?._id
      console.log('selectedContact:', selectedContact)
      console.log('Hit Chats')
      if (!id) return;
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/chat/${id}`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      // handle response as needed
      console.log('chats', response?.data?.messages);
      setMessages(response.data.messages);
      return response.data.messages;
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

  useEffect(() => {
    getMessages();
  }, [selectedContact]);

  useEffect(() => {
    dispatch(fetchFriends())
  }, [])

  const filteredFriends = useMemo(() => {
    if (!query.trim()) return friends
    const q = query.trim().toLowerCase()
    return friends.filter((f: Friend) => f.username.toLowerCase().includes(q))
  }, [friends, query]);
  console.log('messages:', messages)

  return (
    <View style={{ flex: 1 }}>
      {selectedContact ? (
        <ChatScreen messages={messages} contact={selectedContact} onBack={() => setSelectedContact(null)} />
      ) : (
        <ContactsScreen contacts={friends} filteredFriends={filteredFriends} onSelect={setSelectedContact} />
      )}
    </View>
  )
}