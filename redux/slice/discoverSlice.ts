import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as Location from "expo-location";
import { MIN_SCAN_MS } from "../../components/discover/constants";
import { DiscoverError, DiscoverState, NearbyUser } from "../../components/discover/types";
import { discoverApi } from "@/components/services/discover/discoverApi";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

type ThunkConfig = { rejectValue: DiscoverError; state: { discover: DiscoverState } };

/**
 * permission -> GPS -> API (+ min radar time). One dispatch does the whole scan.
 * `condition` blocks double-taps while a scan is already running.
 */
export const discoverNearby = createAsyncThunk<NearbyUser[], void, ThunkConfig>(
  "discover/nearby",
  async (_, { rejectWithValue }) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return rejectWithValue({
        code: "PERMISSION_DENIED",
        message: "Allow location access so we can find people within 500 m of you.",
      });
    }

    let pos: Location.LocationObject;
    try {
      pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    } catch {
      return rejectWithValue({
        code: "LOCATION_UNAVAILABLE",
        message: "We couldn't get your location. Check that GPS is on and try again.",
      });
    }

    try {
      const [data] = await Promise.all([
        discoverApi.nearby({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        sleep(MIN_SCAN_MS),
      ]);
      console.log('discover raw response:', JSON.stringify(data).slice(0, 300));
      return data.nearbyUsers;
    } catch {
      return rejectWithValue({
        code: "NETWORK",
        message: "Couldn't reach the server. Check your connection and try again.",
      });
    }
  },
  { condition: (_, { getState }) => getState().discover.status !== "loading" },
);

// Optimistic: UI flips to "pending" instantly (pending case below), rolls back on failure.
export const sendFriendRequest = createAsyncThunk<void, string, { rejectValue: string }>(
  "discover/friendRequest",
  async (userId, { rejectWithValue }) => {
    try {
      await discoverApi.sendFriendRequest(userId);
    } catch {
      return rejectWithValue(userId);
    }
  },
);

const initialState: DiscoverState = {
  users: [],
  status: "idle",
  error: null,
  lastScannedAt: null,
};

const discoverSlice = createSlice({
  name: "discover",
  initialState,
  reducers: {
    resetDiscover: () => initialState, // call on logout
  },
  extraReducers: (builder) => {
    builder
      .addCase(discoverNearby.pending, (s) => {
        s.status = "loading";
        s.error = null;
      })
      .addCase(discoverNearby.fulfilled, (s, a) => {
        s.status = "succeeded";
        s.users = [...a.payload].sort((x, y) => x.distance - y.distance);
        s.lastScannedAt = Date.now();
      })
      .addCase(discoverNearby.rejected, (s, a) => {
        s.status = "failed";
        s.error = a.payload ?? { code: "NETWORK", message: "Something went wrong." };
      })
      .addCase(sendFriendRequest.pending, (s, a) => {
        const u = s.users.find((x) => x._id === a.meta.arg);
        if (u) u.friendStatus = "pending";
      })
      .addCase(sendFriendRequest.rejected, (s, a) => {
        const u = s.users.find((x) => x._id === a.meta.arg);
        if (u) u.friendStatus = "none";
      });
  },
});

export const { resetDiscover } = discoverSlice.actions;
export default discoverSlice.reducer;
