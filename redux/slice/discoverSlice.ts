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
const CONSENT_MESSAGE =
  "Explicit location consent is required — or turn on your location to discover people nearby.";

export const discoverNearby = createAsyncThunk<NearbyUser[], void, ThunkConfig>(
  "discover/nearby",
  async (_, { rejectWithValue }) => {
    // 1. permission: asks again on every scan unless the OS has blocked prompting
    let perm = await Location.getForegroundPermissionsAsync();
    if (perm.status !== "granted") perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== "granted") {
      return rejectWithValue({
        code: perm.canAskAgain ? "PERMISSION_DENIED" : "PERMISSION_BLOCKED",
        message: CONSENT_MESSAGE,
      });
    }

    // 2. is location (GPS) switched on? On Android this shows the system "turn on location" dialog
    if (!(await Location.hasServicesEnabledAsync())) {
      try { await Location.enableNetworkProviderAsync(); } catch {}
      if (!(await Location.hasServicesEnabledAsync())) {
        return rejectWithValue({
          code: "LOCATION_OFF",
          message: "Turn on your location to discover people nearby.",
        });
      }
    }

    // 3. position, with a timeout and a last-known fallback so it never hangs
    let pos: Location.LocationObject | null = null;
    try {
      pos = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 10000)),
      ]);
    } catch {
      pos = await Location.getLastKnownPositionAsync();
    }
    if (!pos) {
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
      return data.nearbyUsers;
    } catch (e: any) {
      const status = e.response?.status;
      const serverMsg: string = e.response?.data?.message ?? "";
      if (status === 400 && /consent/i.test(serverMsg)) {
        return rejectWithValue({ code: "CONSENT_REQUIRED", message: CONSENT_MESSAGE });
      }
      return rejectWithValue({
        code: !e.response ? "NETWORK" : status === 400 ? "BAD_REQUEST" : "SERVER",
        message: serverMsg || "Couldn't reach the server. Check your connection and try again.",
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
