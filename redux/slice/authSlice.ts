import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios, { isAxiosError } from 'axios';
import { authStorage, AuthSnapshot, AccountSummary, StoredUser } from '@/lib/auth/authStorage';
import { API_URL } from '@/lib/utils';

const ME_ENDPOINT = `${API_URL}/api/auth/user/me`;

export type AuthUser = StoredUser & { username?: string; email?: string };
// 'switching' = brief state while the app remounts for another account.
type Status = 'loading' | 'signedIn' | 'signedOut' | 'switching';
type AuthState = {
    status: Status;
    user: AuthUser | null;
    activeAccountId: string | null;
    accounts: AccountSummary[]; // ids + user info only, NEVER tokens
    addingAccount: boolean;
};

const initialState: AuthState = {
    status: 'loading',
    user: null,
    activeAccountId: null,
    accounts: [],
    addingAccount: false,
};

// Keep the latest in-memory user (profile edits) in storage before the active account changes.
const persistCurrentUser = async (getState: () => unknown) => {
    const u = (getState() as any).auth?.user;
    if (u) await authStorage.updateActiveUser(u);
};

/** Runs once on app start. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (): Promise<AuthSnapshot> => {
    await authStorage.init();
    const token = await authStorage.getToken();
    if (!token) return authStorage.getSnapshot();

    try {
        const { data } = await axios.get(ME_ENDPOINT, { timeout: 8000 });
        await authStorage.updateActiveUser((data?.user ?? data) as AuthUser);
    } catch (e) {
        // Token rejected -> drop ONLY this account (falls back to another saved one, if any).
        if (isAxiosError(e) && e.response?.status === 401) {
            const { accountId } = authStorage.getSessionSync();
            if (accountId) await authStorage.removeAccount(accountId);
        }
        // Network error / cold start -> trust the saved session.
    }
    return authStorage.getSnapshot();
});

/** Login / signup / Google all call this. Adds the account and makes it active. */
export const signIn = createAsyncThunk<
    AuthSnapshot,
    { token: string; refreshToken?: string | null; user: AuthUser }
>('auth/signIn', async (p, { getState }) => {
    await persistCurrentUser(getState);
    return authStorage.addAccount(p);
});

export const switchAccount = createAsyncThunk<AuthSnapshot, string>('auth/switchAccount', async (id, { getState }) => {
    await persistCurrentUser(getState);
    console.log('switching to account', id);
    console.log('current active account', authStorage.getActiveIdSync());
    console.log('persisted user', (getState() as any).auth?.user);
    return authStorage.switchTo(id);
});

export const removeAccount = createAsyncThunk<AuthSnapshot, string>('auth/removeAccount', (id) =>
    authStorage.removeAccount(id)
);

/** Log out the CURRENT account only (switches to another saved account if one exists). */
export const signOut = createAsyncThunk<AuthSnapshot, void>('auth/signOut', async () => {
    const { accountId } = authStorage.getSessionSync();
    return accountId ? authStorage.removeAccount(accountId) : authStorage.getSnapshot();
});

export const signOutAll = createAsyncThunk<AuthSnapshot, void>('auth/signOutAll', () => authStorage.clearAll());

function settle(s: AuthState, p: AuthSnapshot) {
    const changed = s.activeAccountId !== p.activeAccountId;
    const was = s.status;
    s.activeAccountId = p.activeAccountId;
    s.user = p.user;
    s.accounts = p.accounts;
    s.addingAccount = false;

    if (!p.activeAccountId) s.status = 'signedOut';
    else if (changed && (was === 'signedIn' || was === 'switching')) s.status = 'switching';
    else s.status = was === 'switching' ? 'switching' : 'signedIn';
}

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        userUpdated(s, a: PayloadAction<AuthUser>) {
            s.user = a.payload;
            const i = s.accounts.findIndex((x) => x.id === s.activeAccountId);
            if (i >= 0) s.accounts[i] = { ...s.accounts[i], user: a.payload };
        },
        startAddingAccount(s) {
            s.addingAccount = true;
        },
        cancelAddingAccount(s) {
            s.addingAccount = false;
        },
        switchSettled(s) {
            if (s.status === 'switching') s.status = 'signedIn';
        },
        accountsSynced(s, a: PayloadAction<AuthSnapshot>) {
            s.accounts = a.payload.accounts;
        },
    },
    extraReducers: (b) => {
        b.addCase(bootstrapAuth.fulfilled, (s, a) => settle(s, a.payload))
            .addCase(bootstrapAuth.rejected, (s) => {
                s.user = null;
                s.status = 'signedOut';
            })
            .addCase(signIn.fulfilled, (s, a) => settle(s, a.payload))
            .addCase(switchAccount.fulfilled, (s, a) => settle(s, a.payload))
            .addCase(removeAccount.fulfilled, (s, a) => settle(s, a.payload))
            .addCase(signOut.fulfilled, (s, a) => settle(s, a.payload))
            .addCase(signOutAll.fulfilled, (s, a) => settle(s, a.payload));
    },
});

export const { userUpdated, startAddingAccount, cancelAddingAccount, switchSettled, accountsSynced } = authSlice.actions;
export default authSlice.reducer;