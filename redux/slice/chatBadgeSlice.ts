import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type State = {
    hasUnread: boolean
    unreadChats: number // number of contacts with unread messages (NOT total messages)
    openChatId: string | null
}

const chatBadgeSlice = createSlice({
    name: 'chatBadge',
    initialState: { hasUnread: false, unreadChats: 0, openChatId: null } as State,
    reducers: {
        setUnread: (s, a: PayloadAction<boolean>) => {
            s.hasUnread = a.payload
        },
        setUnreadChats: (s, a: PayloadAction<number>) => {
            const n = Math.max(0, Math.floor(a.payload) || 0)
            s.unreadChats = n
            s.hasUnread = n > 0 // keeps the old flag consistent automatically
        },
        setOpenChatId: (s, a: PayloadAction<string | null>) => {
            s.openChatId = a.payload
        },
    },
})

export const { setUnread, setUnreadChats, setOpenChatId } = chatBadgeSlice.actions
export default chatBadgeSlice.reducer