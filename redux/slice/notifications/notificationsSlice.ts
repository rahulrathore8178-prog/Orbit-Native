import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { notificationsApi, type AppNotification } from '@/components/services/notifications/notificationsApi';
import type { RootState } from '@/redux/store';

const SEEN_KEY = 'notifications:lastSeenAt';
const ts = (iso: string) => new Date(iso).getTime() || 0;

/**
 * Two separate ideas, like Instagram:
 *  - read   : per notification (isRead from the server). Tapping a row or "Mark all read".
 *  - seen   : the bell's red mark. Cleared the moment you open the notifications page,
 *             and it comes back only when something newer arrives.
 */
interface State {
    items: AppNotification[];
    status: 'idle' | 'loading' | 'ready' | 'error';
    lastSeenAt: number;
    hydrated: boolean;
    rollbackIds: string[];
}

const initialState: State = { items: [], status: 'idle', lastSeenAt: 0, hydrated: false, rollbackIds: [] };

/* ───────────── Thunks ───────────── */
export const fetchNotifications = createAsyncThunk<AppNotification[], { silent?: boolean } | void>(
    'notifications/fetch',
    () => notificationsApi.list(),
);

export const markRead = createAsyncThunk<void, string>('notifications/markRead', async (id) => {
    await notificationsApi.markRead(id);
});

export const markAllRead = createAsyncThunk<void, void>('notifications/markAllRead', async () => {
    await notificationsApi.markAllRead();
});

export const hydrateSeen = createAsyncThunk<number>('notifications/hydrateSeen', async () => {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return Number(raw) || 0;
});

/** Clears the bell mark: everything up to the newest notification counts as seen. */
export const markSeen = createAsyncThunk<void, void, { state: RootState }>(
    'notifications/markSeen',
    async (_, { getState, dispatch }) => {
        const { items, lastSeenAt } = getState().notifications;
        const newest = items.reduce((m, n) => Math.max(m, ts(n.createdAt)), 0);
        if (!newest || newest <= lastSeenAt) return;
        dispatch(seenAt(newest)); // instant, so the red mark disappears with no wait
        await AsyncStorage.setItem(SEEN_KEY, String(newest)).catch(() => { });
    },
);

/* ───────────── Slice ───────────── */
const slice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        seenAt(state, { payload }: PayloadAction<number>) {
            state.lastSeenAt = Math.max(state.lastSeenAt, payload);
        },
        /** For a socket / push listener: dispatch(notificationReceived(item)). */
        notificationReceived(state, { payload }: PayloadAction<AppNotification>) {
            if (!state.items.some((n) => n._id === payload._id)) state.items.unshift(payload);
        },
    },
    extraReducers: (b) => {
        b.addCase(fetchNotifications.pending, (s, { meta }) => {
            if (!meta.arg?.silent && s.items.length === 0) s.status = 'loading';
        })
            .addCase(fetchNotifications.fulfilled, (s, { payload }) => {
                s.items = payload;
                s.status = 'ready';
            })
            .addCase(fetchNotifications.rejected, (s) => {
                if (s.items.length === 0) s.status = 'error';
            })
            // optimistic: mark one read, roll back if the request fails
            .addCase(markRead.pending, (s, { meta }) => {
                const n = s.items.find((x) => x._id === meta.arg);
                if (n) n.isRead = true;
            })
            .addCase(markRead.rejected, (s, { meta }) => {
                const n = s.items.find((x) => x._id === meta.arg);
                if (n) n.isRead = false;
            })
            // optimistic: mark all read, remember which were unread for the rollback
            .addCase(markAllRead.pending, (s) => {
                s.rollbackIds = s.items.filter((n) => !n.isRead).map((n) => n._id);
                s.items.forEach((n) => (n.isRead = true));
            })
            .addCase(markAllRead.rejected, (s) => {
                s.items.forEach((n) => {
                    if (s.rollbackIds.includes(n._id)) n.isRead = false;
                });
                s.rollbackIds = [];
            })
            .addCase(markAllRead.fulfilled, (s) => {
                s.rollbackIds = [];
            })
            .addCase(hydrateSeen.fulfilled, (s, { payload }) => {
                s.lastSeenAt = Math.max(s.lastSeenAt, payload);
                s.hydrated = true;
            })
            .addCase(hydrateSeen.rejected, (s) => {
                s.hydrated = true;
            });
    },
});

export const { seenAt, notificationReceived } = slice.actions;
export default slice.reducer;

/* ───────────── Selectors ───────────── */
export const selectNotifications = (s: RootState) => s.notifications.items;
export const selectNotificationsStatus = (s: RootState) => s.notifications.status;
export const selectUnreadCount = createSelector(selectNotifications, (items) => items.filter((n) => !n.isRead).length);
/** Drives the red mark on the bell. */
export const selectHasUnseen = (s: RootState) =>
    s.notifications.hydrated &&
    s.notifications.items.some((n) => !n.isRead && ts(n.createdAt) > s.notifications.lastSeenAt);
