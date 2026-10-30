import { ChatScreen } from '@/components/chats/ChatsScreen'
import { useToast } from '@/components/ui/chats/ui'
import { useChat } from '@/hooks/chats/useChat'
import { API_URL } from '@/lib/utils'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import React, { useCallback, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'

export default function ConversationRoute() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const friends = useSelector((state: RootState) => state.friends.friends)
  const { toast, showToast } = useToast()

  const contact = useMemo<Friend | null>(() => friends.find((f: Friend) => f._id === id) ?? null, [friends, id])

  // Only needed if this screen is opened before the friends list was loaded.
  useEffect(() => {
    if (!contact) dispatch(fetchFriends())
  }, [contact, dispatch])

  const handleOffline = useCallback(
    () => showToast('Not connected. Check your internet connection.', 'offline'),
    [showToast]
  )

  const {
    messages, isConnected, hasMore, loadOlder,
    sendMessage, sendMedia, retryMessage, discardMessage,
    editMessage, deleteMessage, clearMessages,
  } = useChat({
    apiUrl: API_URL,
    selectedContact: contact,
    onOffline: handleOffline,
  })

  const goBack = useCallback(() => router.back(), [])

  const openProfile = useCallback((c: Friend) => {
    router.push({ pathname: '/user/[id]', params: { id: c._id } } as any)
  }, [])

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          animation: 'slide_from_right',
          animationDuration: 300,
          gestureEnabled: true,
          fullScreenGestureEnabled: true,
          contentStyle: { backgroundColor: '#000' },
        }}
      />
      {contact ? (
        <ChatScreen
          contact={contact}
          messages={messages}
          isConnected={isConnected}
          toast={toast}
          hasMore={hasMore}
          onBack={goBack}
          onSend={sendMessage}
          onSendMedia={sendMedia}
          onRetry={retryMessage}
          onDiscard={discardMessage}
          onLoadOlder={loadOlder}
          onEditMessage={editMessage}
          onOpenProfile={openProfile}
          onDeleteMessage={deleteMessage}
          onClearChat={clearMessages}
          onNotify={showToast}
        />
      ) : (
        <View className="flex-1 bg-black" />
      )}
    </>
  )
}