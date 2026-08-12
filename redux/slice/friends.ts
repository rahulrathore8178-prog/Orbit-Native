import { API_URL } from "@/app/(tabs)/home";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axios from "axios";

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

export const fetchFriends = createAsyncThunk<Friends, void, ThunkConfig>(
    'friends/fetchFriends',
    async (_, thunkAPI) => {
        try {
            const token = await AsyncStorage.getItem('token');
            const response = await axios.get<{ friends: Friends }>(
                `${API_URL}/api/social/friends`,
                {
                    withCredentials: true,
                    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
                }
            );

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
            state.isLoading = false;
            state.error = action.payload ? (action.payload as { message: string }).message : 'Unknown error';
        });
},
}); 

export const { setFriends } = friendsSlice.actions;
export default friendsSlice.reducer;