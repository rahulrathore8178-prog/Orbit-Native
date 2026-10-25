import { RootState, useAppDispatch } from "@/redux/store";
import { useCallback, useEffect, useState } from "react";
import { AppState, Linking } from "react-native";
import { useSelector } from "react-redux";
import { discoverNearby, sendFriendRequest } from "../../redux/slice/discoverSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";

/** Everything the screen needs. The screen never touches Redux/API directly. */
const RESCAN_CODES = ["PERMISSION_DENIED", "PERMISSION_BLOCKED", "LOCATION_OFF"];

export function useDiscover() {
  const dispatch = useAppDispatch();
  const { users, status, error } = useSelector((s: RootState) => s.discover);

  const scan = useCallback(() => { dispatch(discoverNearby()); }, [dispatch]);
  const addFriend = useCallback((id: string) => { dispatch(sendFriendRequest(id)); }, [dispatch]);

  const [consented, setConsented] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem("discoverConsent").then((v) => setConsented(v === "true"));
  }, []);
  useEffect(() => { if (consented) scan(); }, [consented, scan]);

  const grantConsent = useCallback(async () => {
    await AsyncStorage.setItem("discoverConsent", "true");
    setConsented(true);
  }, []);

  // back from Settings after fixing permission/GPS -> scan again automatically
  const errorCode = error?.code;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active" && errorCode && RESCAN_CODES.includes(errorCode)) scan();
    });
    return () => sub.remove();
  }, [errorCode, scan]);

  // button on the error state: Settings if the OS blocked the prompt, otherwise ask again
  const needsSettings = errorCode === "PERMISSION_BLOCKED";
  const retry = useCallback(() => {
    if (needsSettings) Linking.openSettings();
    else scan();
  }, [needsSettings, scan]);

  return {
    users, error, consented, grantConsent, scan, addFriend, retry,
    retryLabel: needsSettings ? "Open settings" : "Try again",
    isScanning: status === "loading",
  };
}
