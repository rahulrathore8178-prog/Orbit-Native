import { API_URL } from "@/lib/utils";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";
import { authStorage } from "@/lib/auth/authStorage";

export interface Friend {
    _id: string;
    username: string;
    profilePic: string;
}

interface FriendsState {
    friends: Friend[];
    isLoading: boolean;
    error: string | null;
}

type Friends = Friend[];

interface ThunkConfig {
    rejectValue: { message: string };
}

export const fetchFriends = createAsyncThunk<Friends, string | undefined, ThunkConfig>(
    'friends/fetchFriends',
    async (requestedAccountId, thunkAPI) => {
        try {
            const accountId = requestedAccountId ?? authStorage.getActiveIdSync();
            const token = await authStorage.getToken();
            if (accountId !== authStorage.getActiveIdSync()) {
                return thunkAPI.rejectWithValue({ message: 'Account changed.' });
            }
            const response = await axios.get<{ friends: Friends }>(
                `${API_URL}/api/social/friends`,
                {
                    withCredentials: true,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }
            );

            if (accountId !== authStorage.getActiveIdSync()) {
                return thunkAPI.rejectWithValue({ message: 'Account changed.' });
            }
            console.log('friends', response.data?.friends);
            return response.data.friends ?? [];
        } catch (error: any) {
            console.error('Error fetching friends:', error);
            return thunkAPI.rejectWithValue({
                message:
                    error?.response?.data?.message ||
                    error?.message ||
                    'Failed to fetch friends',
            });
        }
    }
);

const initialState: FriendsState = {
    friends: [],
    isLoading: false,
    error: null
}

const friendsSlice = createSlice({
    name: 'friends',
    initialState,
    reducers: {
        setFriends: (state, action) => {
            state.friends = action.payload;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(fetchFriends.pending, (state) => {
            state.isLoading = true;
            state.error = null;
        })
      .addCase(fetchFriends.fulfilled, (state, action) => {
            state.isLoading = false;
            state.friends = action.payload; // ✅ API response stored here
        })
        .addCase(fetchFriends.rejected, (state, action) => {
            if (action.payload?.message === 'Account changed.') return;
            state.isLoading = false;
            state.error = action.payload ? (action.payload as { message: string }).message : 'Unknown error';
        });
},
}); 

export const { setFriends } = friendsSlice.actions;
export default friendsSlice.reducer;