// app/discover.tsx
import { RootState, useAppDispatch } from "@/redux/store";
import React from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator } from "react-native";
import { useSelector } from "react-redux";
import { API_URL } from "../../utils";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
// import { AppDispatch, RootState } from "../store/store";
// import { discoverNearbyUsers } from "../store/discoverSlice";
// import { NearbyUser } from "../types/discover";

// types/discover.ts
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyUser {
  _id: string;
  username: string;
  profilePicture: string;
  distance: number; // meters
}

export interface DiscoverResponse {
  nearbyUsers: NearbyUser[];
}

export interface DiscoverState {
  nearbyUsers: NearbyUser[];
  loading: boolean;
  error: string | null;
}

export default function DiscoverScreen() {
  const dispatch = useAppDispatch;
  const { nearbyUsers, loading, error } = useSelector(
    (state: RootState) => state.discover
  );

  async function fetchNearbyUsers(
    coords: Coordinates,
  ): Promise<DiscoverResponse> {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/chat/${coords}`, {
        withCredentials: true,
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      return response;
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  }

  const handleDiscover = () => {
    dispatch(fetchNearbyUsers());
  };

  const renderUser = ({ item }: { item: NearbyUser }) => (
    <View className="flex-row items-center p-3 border-b border-gray-800">
      <Text className="text-white font-semibold flex-1">{item.username}</Text>
      <Text className="text-gray-400">{item.distance}m away</Text>
    </View>
  );

  return (
    <View className="flex-1 bg-black px-4 pt-6">
      <Pressable
        onPress={handleDiscover}
        className="bg-white rounded-full py-3 items-center mb-4"
      >
        <Text className="font-bold">Discover Nearby</Text>
      </Pressable>

      {loading && <ActivityIndicator size="large" />}
      {error && <Text className="text-red-500">{error}</Text>}

      <FlatList
        data={nearbyUsers}
        keyExtractor={(item) => item._id}
        renderItem={renderUser}
        ListEmptyComponent={
          !loading ? (
            <Text className="text-gray-500 text-center mt-10">
              No one nearby. Tap discover to search.
            </Text>
          ) : null
        }
      />
    </View>
  );
}