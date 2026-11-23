import '@/global.css'
import { ContactsScreen } from '@/components/chats/ContactsScreen'
import { useDrawer } from '@/components/sideDrawer/DrawerContext'
import { Toast, useToast } from '@/components/ui/chats/ui'
import { useConversations } from '@/hooks/chats/useConversation'
import { useDrawerSwipe } from '@/hooks/chats/userDrawerSwipe'
import { useCurrentUser } from '@/hooks/feed/useHomeFeed'
import { setUnreadChats } from '@/redux/slice/chatBadgeSlice'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { router } from 'expo-router'
import React, { useCallback, useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { GestureDetector } from 'react-native-gesture-handler'
import { useSelector } from 'react-redux'

// The ONLY chat screen inside the tabs. Opening a chat pushes /chats/[id], which sits outside (tabs),
// so the tab bar is not rendered there.
export default function MessagesTab() {
  const dispatch = useAppDispatch()
  const friends = useSelector((state: RootState) => state.friends.friends)
  const activeAccountId = useSelector((state: RootState) => state.auth.activeAccountId)
  const { toast, showToast } = useToast()
  const { conversations, refreshing, refresh, markOpened } = useConversations()
  const { open } = useDrawer()
  const currentUser = useCurrentUser()
  const drawerSwipe = useDrawerSwipe()

  const unreadChats = useMemo(() => {
    const ids = new Set(friends.map((f) => f._id))
    return Object.entries(conversations).filter(([id, c]) => ids.has(id) && (c.unread ?? 0) > 0).length
  }, [friends, conversations])

  useEffect(() => {
    dispatch(fetchFriends(activeAccountId ?? undefined))
  }, [dispatch, activeAccountId])

  useEffect(() => {
    dispatch(setUnreadChats(unreadChats))
  }, [dispatch, unreadChats])

  useEffect(() => () => { dispatch(setUnreadChats(0)) }, [dispatch])

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
    <GestureDetector gesture={drawerSwipe}>
      <View className="flex-1 bg-black">
        <ContactsScreen
          contacts={friends}
          conversations={conversations}
          refreshing={refreshing}
          onRefresh={refresh}
          onSelect={openChat}
          onOpenProfile={openProfile}
          onNotify={showToast}
          profilePic={currentUser?.profilePic}
          onOpenMenu={open}
        />
        {/* above the search dock and the floating tab bar */}
        <Toast toast={toast} className="bottom-52" />
      </View>
    </GestureDetector>
  )
}