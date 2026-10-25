import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import axios, { isAxiosError } from 'axios';
import { authStorage } from '@/lib/auth/authStorage';
import { API_URL } from '@/lib/utils';

// Add this route on the backend (see backend/authMiddleware.js).
const ME_ENDPOINT = `${API_URL}/api/auth/user/me`;

export type AuthUser = { _id?: string; id?: string; username?: string; email?: string;[key: string]: unknown };
type Status = 'loading' | 'signedIn' | 'signedOut';
type AuthState = { status: Status; user: AuthUser | null };

const initialState: AuthState = { status: 'loading', user: null };

/** Runs once on app start: decides signedIn / signedOut. */
export const bootstrapAuth = createAsyncThunk('auth/bootstrap', async (): Promise<AuthUser | null> => {
    const token = await authStorage.getToken();
    if (!token) return null;

    try {
        const { data } = await axios.get(ME_ENDPOINT, { timeout: 8000 });
        const user = (data?.user ?? data) as AuthUser;
        await authStorage.setUser(user);
        return user;
    } catch (e) {
        // Token rejected by the server -> really signed out.
        if (isAxiosError(e) && e.response?.status === 401) {
            await authStorage.clear();
            return null;
        }
        // Network error, Render cold start, missing /me route -> trust the saved session.
        // If it's actually invalid, the first real request returns 401 and the interceptor logs out.
        const cached = await authStorage.getUser<AuthUser>();
        if (!cached) await authStorage.clear();
        return cached;
    }
});

/** Saves the session BEFORE flipping to signedIn, so the first requests already have the token. */
export const signIn = createAsyncThunk(
    'auth/signIn',
    async ({ token, user }: { token: string; user: AuthUser }) => {
        await authStorage.setToken(token);
        console.log(
            'TOKEN AFTER SAVE:',
            await authStorage.getToken()
        );
        await authStorage.setUser(user);
        return user;
    }
);

export const signOut = createAsyncThunk('auth/signOut', async () => {
    await authStorage.clear();
});

const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        userUpdated(state, action: PayloadAction<AuthUser>) {
            state.user = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(bootstrapAuth.fulfilled, (s, a) => {
                s.user = a.payload;
                s.status = a.payload ? 'signedIn' : 'signedOut';
            })
            .addCase(bootstrapAuth.rejected, (s) => {
                s.user = null;
                s.status = 'signedOut';
            })
            .addCase(signIn.fulfilled, (s, a) => {
                s.user = a.payload;
                s.status = 'signedIn';
            })
            .addCase(signOut.fulfilled, (s) => {
                s.user = null;
                s.status = 'signedOut';
            });
    },
});

export const { userUpdated } = authSlice.actions;
export default authSlice.reducer;