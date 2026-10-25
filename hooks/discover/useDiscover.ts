import { RootState, useAppDispatch } from "@/redux/store";
import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useSelector } from "react-redux";
import { discoverNearby, sendFriendRequest } from "../../redux/slice/discoverSlice";

/** Everything the screen needs. The screen never touches Redux/API directly. */
export function useDiscover() {
  const dispatch = useAppDispatch();
  const { users, status, error } = useSelector((s: RootState) => s.discover);
  const raw = useSelector((s: RootState) => s.discover);
  console.log('discover state:', JSON.stringify(raw));

  const scan = useCallback(() => {
    dispatch(discoverNearby());
  }, [dispatch]);

  const addFriend = useCallback(
    (userId: string) => {
      dispatch(sendFriendRequest(userId));
    },
    [dispatch],
  );

  // auto-scan once when the page opens
  useEffect(() => {
    scan();
  }, [scan]);

  // user came back from Settings after enabling location -> scan again automatically
  const errorCode = error?.code;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && errorCode === "PERMISSION_DENIED") scan();
    });
    return () => sub.remove();
  }, [errorCode, scan]);

  return {
    users,
    error,
    isScanning: status === "idle" || status === "loading",
    scan,
    addFriend,
  };
}
