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
    const { data } = await client.post<DiscoverResponse>("/discover/nearby", {
      ...coords,
      radius: DISCOVER_RADIUS_M,
    });
    return data;
  },

  sendFriendRequest: async (userId: string): Promise<void> => {
    await client.post(`/friends/request/${userId}`);
  },
};
