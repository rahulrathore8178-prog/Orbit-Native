import { API_URL } from "@/lib/utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { DISCOVER_RADIUS_M } from "../../discover/constants";
import { Coordinates, DiscoverResponse } from "../../discover/types";
import { authStorage } from "@/lib/auth/authStorage";

// One axios instance for the feature. Token is read from AsyncStorage ("user") like before.
const client = axios.create({
  baseURL: `${API_URL}/api/community`,
  timeout: 15000,
  withCredentials: true,
});

client.interceptors.request.use(async (config) => {
  const token = await authStorage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const discoverApi = {
  // Saves my position AND returns people within the radius (server clamps radius to 500 m)
  nearby: async (coords: Coordinates): Promise<DiscoverResponse> => {
      const payload = { ...coords, radius: DISCOVER_RADIUS_M };
    try {
    const { data } = await client.post<DiscoverResponse>("/discover/nearby", {
      ...coords,
      radius: DISCOVER_RADIUS_M,
      consent: true, // server will convert to lat/lng if not already
    });
    console.log("DISCOVER RESPONSE:", JSON.stringify(data, null, 2));
    return data;
  } catch (error: any) {
    console.log("[DISCOVER 400] sent:", JSON.stringify(payload));
    console.log("[DISCOVER 400] status:", error.response?.status);
    console.log("[DISCOVER 400] server said:", JSON.stringify(error.response?.data));
    throw error;
  }
  },

  sendFriendRequest: async (userId: string): Promise<void> => {
    await client.post(`/friends/request/${userId}`);
  },
};
