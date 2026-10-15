import '@/global.css'
import { Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { Feather, Ionicons } from '@expo/vector-icons'
import React, { useRef } from 'react'
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

type Message = {
    id: string
    content: string
    sender: 'me' | 'them'
    time: string
};

function MessageBubble({ item }: { item: Message }) {
    const isMe = item.sender === 'me'
    return (
        <Animated.View
            entering={FadeInUp.springify().damping(14).mass(0.5)}
            style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}
            className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMe ? 'bg-gray-700' : 'bg-neutral-800'}`}
        >
            <Text className="text-gray-100 text-[14.5px] leading-5">{item.content}</Text>
            <Text className="text-gray-400 text-[10px] mt-1 self-end">{item.time}</Text>
        </Animated.View>
    );
};

// ---------- Chat screen ----------
export function ChatScreen({
    contact,
    onBack,
    messages,
    onSend,
}: {
    contact: Friend
    onBack: () => void
    messages: Message[]
    onSend: (text: string) => boolean
}) {
    const input = useSelector<RootState, string>((state: RootState) => state.chat.input)
    const listRef = useRef<FlatList>(null)
    const dispatch = useAppDispatch()

    const handleSend = () => {
        const trimmed = input.trim()
        if (!trimmed) return
        // Only clear the input if the message actually went out, so nothing typed is lost.
        if (onSend(trimmed)) dispatch({ type: 'chat/setInput', payload: '' })
    }

    return (
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
                            onSubmitEditing={handleSend}
                            returnKeyType="send"
                            placeholder="Message..."
                            placeholderTextColor="#9ca3af"
                            className="flex-1 text-white text-[14px]"
                        />
                    </View>

                    <Pressable hitSlop={6} className="p-1.5">
                        <Ionicons name="camera-outline" size={21} color="#9ca3af" />
                    </Pressable>

                    <Pressable hitSlop={6} className="p-1.5" onPress={handleSend}>
                        {input.trim().length > 0 ? (
                            <Ionicons name="send" size={20} color="white" />
                        ) : (
                            <Ionicons name="mic-outline" size={22} color="#9ca3af" />
                        )}
                    </Pressable>
                </View>
            </KeyboardAvoidingView>
        </Animated.View>
    );
};