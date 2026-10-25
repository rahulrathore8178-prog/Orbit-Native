import '@/global.css'
import { ContactsScreen } from '@/components/chats/ContactsScreen'
import { Toast, useToast } from '@/components/ui/chats/ui'
import { fetchFriends, Friend } from '@/redux/slice/friends'
import { RootState, useAppDispatch } from '@/redux/store'
import { router } from 'expo-router'
import React, { useCallback, useEffect } from 'react'
import { View } from 'react-native'
import { useSelector } from 'react-redux'

// The ONLY screen that lives inside the tabs. Opening a chat pushes /conversation/[id],
// which sits outside (tabs) — so the tab bar is not rendered there.
export default function MessagesTab() {
  const dispatch = useAppDispatch()
  const friends = useSelector((state: RootState) => state.friends.friends)
  const { toast, showToast } = useToast()

  useEffect(() => {
    dispatch(fetchFriends())
  }, [dispatch])

  const openChat = useCallback((c: Friend) => {
    router.push({ pathname: '/chats/[id]', params: { id: c._id } } as any)
  }, [router])

  // TODO: point this at your real profile route.
  const openProfile = useCallback((c: Friend) => {
    router.push(`/profile/${c._id}` as any)
  }, [router])

  return (
    <View className="flex-1 bg-black">
      <ContactsScreen contacts={friends} onSelect={openChat} onOpenProfile={openProfile} onNotify={showToast} />
      {/* lifted above the floating tab bar */}
      <Toast toast={toast} className="bottom-32" />
    </View>
  )
}
