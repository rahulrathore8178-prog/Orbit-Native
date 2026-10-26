import '@/global.css'
import { ContactsScreen } from '@/components/chats/ContactsScreen'
import { Toast, useToast } from '@/components/ui/chats/ui'
import { useConversations } from '@/hooks/chats/useConversation'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { router } from 'expo-router'
import React, { useCallback, useEffect } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'

// The ONLY chat screen inside the tabs. Opening a chat pushes /chats/[id], which sits outside (tabs),
// so the tab bar is not rendered there.
export default function MessagesTab() {
  const dispatch = useAppDispatch()
  const friends = useSelector((state: RootState) => state.friends.friends)
  const { toast, showToast } = useToast()
  const { conversations, refreshing, refresh, markOpened } = useConversations()

  useEffect(() => {
    dispatch(fetchFriends())
  }, [dispatch])

  const openChat = useCallback(
    (c: Friend) => {
      markOpened(c._id) // the highlight clears instantly; the server marks it read when the chat opens
      router.push({ pathname: '/chats/[id]', params: { id: c._id } } as any)
    },
    [markOpened]
  )

  const openProfile = useCallback((c: Friend) => {
    router.push({ pathname: '/user/[id]', params: { id: c._id } } as any)
  }, [])

  return (
    <View className="flex-1 bg-black">
      <ContactsScreen
        contacts={friends}
        conversations={conversations}
        refreshing={refreshing}
        onRefresh={refresh}
        onSelect={openChat}
        onOpenProfile={openProfile}
        onNotify={showToast}
      />
      {/* above the search dock and the floating tab bar */}
      <Toast toast={toast} className="bottom-52" />
    </View>
  )
}