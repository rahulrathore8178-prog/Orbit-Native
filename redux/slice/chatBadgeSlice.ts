import { createSlice, PayloadAction } from '@reduxjs/toolkit'

type State = { hasUnread: boolean; openChatId: string | null }

const chatBadgeSlice = createSlice({
    name: 'chatBadge',
    initialState: { hasUnread: false, openChatId: null } as State,
    reducers: {
        setUnread: (s, a: PayloadAction<boolean>) => {
            s.hasUnread = a.payload
        },
        setOpenChatId: (s, a: PayloadAction<string | null>) => {
            s.openChatId = a.payload
        },
    },
})

export const { setUnread, setOpenChatId } = chatBadgeSlice.actions
export default chatBadgeSlice.reducer