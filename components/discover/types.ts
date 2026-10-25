export type FriendStatus = "none" | "pending" | "incoming" | "friends";

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface NearbyUser {
  _id: string;
  username: string;
  profilePicture?: string;
  distance: number; // meters (rounded server-side)
  friendStatus: FriendStatus;
}

export interface DiscoverResponse {
  nearbyUsers: NearbyUser[];
}

export type DiscoverStatus = "idle" | "loading" | "succeeded" | "failed";
export type DiscoverErrorCode = "PERMISSION_DENIED" | "LOCATION_UNAVAILABLE" | "NETWORK";

export interface DiscoverError {
  code: DiscoverErrorCode;
  message: string;
}

export interface DiscoverState {
  users: NearbyUser[];
  status: DiscoverStatus;
  error: DiscoverError | null;
  lastScannedAt: number | null;
}
