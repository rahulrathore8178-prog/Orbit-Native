import { MAX_ACCOUNTS, authStorage } from '@/lib/auth/authStorage';
import { getDisplayImageUrl } from '@/lib/utils';
import { accountsSynced, removeAccount, startAddingAccount, switchAccount } from '@/redux/slice/authSlice';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { Check, Plus, User as UserIcon } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, DeviceEventEmitter, Image, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const OPEN_EVENT = 'accounts:open';

/** Call this from the top-left avatar's onLongPress. */
export const openAccountSwitcher = () => DeviceEventEmitter.emit(OPEN_EVENT);

export function AccountSwitcherHost() {
    const dispatch = useAppDispatch();
    const insets = useSafeAreaInsets();
    const accounts = useAppSelector((s) => s.auth.accounts);
    const activeId = useAppSelector((s) => s.auth.activeAccountId);
    const [visible, setVisible] = useState(false);
    const busy = useRef(false);

    useEffect(() => {
        const sub = DeviceEventEmitter.addListener(OPEN_EVENT, () => setVisible(true));
        return () => sub.remove();
    }, []);

    const close = () => setVisible(false);

    const onSwitch = async (id: string) => {
        if (id === activeId) return close();
        if (busy.current) return;
        busy.current = true;
        close();
        await new Promise((r) => setTimeout(r, 260));
        try {
            console.log('switching to account', id);
            console.log('current active account', authStorage.getActiveIdSync());
            await dispatch(switchAccount(id)).unwrap();
        } catch (e: any) {
            // switchTo may have deleted a dead account from storage; resync the list shown in the UI.
            dispatch(accountsSynced(await authStorage.getSnapshot()));
            Alert.alert('Could not switch', e?.message ?? 'Please try again.');
        } finally {
            busy.current = false;
        }
    };

    const onAdd = () => {
        close();
        if (accounts.length >= MAX_ACCOUNTS) {
            Alert.alert('Account limit', `You can add up to ${MAX_ACCOUNTS} accounts on this device.`);
            return;
        }
        // AuthGate (_layout) reacts to this flag: opens the login screen in add mode.
        dispatch(startAddingAccount());
    };

    const onRemove = (id: string, name: string) => {
        close();
        Alert.alert(`Remove ${name}?`, 'This only removes the account from this device. You can log in again anytime.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => dispatch(removeAccount(id)) },
        ]);
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
            <View className="flex-1 justify-end">
                <Pressable className="absolute inset-0 bg-black/60" onPress={close} accessibilityLabel="Close" />

                <View
                    className="rounded-t-[28px] border-t border-white/10 bg-[#0F1218] px-4 pt-3"
                    style={{ paddingBottom: insets.bottom + 16 }}
                >
                    <View className="mb-3 h-1 w-10 self-center rounded-full bg-white/25" />
                    <Text className="mb-2 px-2 text-xs font-semibold tracking-widest text-white/50">ACCOUNTS</Text>

                    {accounts.map((a) => {
                        const u: any = a.user;
                        const name: string = u?.username ?? 'Account';
                        const isActive = a.id === activeId;
                        return (
                            <Pressable
                                key={a.id}
                                onPress={() => onSwitch(a.id)}
                                onLongPress={() => onRemove(a.id, name)}
                                delayLongPress={450}
                                className="flex-row items-center gap-3 rounded-2xl px-2 py-2.5 active:bg-white/5"
                            >
                                <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white/10">
                                    {u?.profilePic ? (
                                        <Image source={{ uri: getDisplayImageUrl(u.profilePic) }} className="h-12 w-12" />
                                    ) : (
                                        <UserIcon size={22} color="#fff" />
                                    )}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-base font-bold text-white" numberOfLines={1}>{name}</Text>
                                    {u?.email ? (
                                        <Text className="text-xs text-white/50" numberOfLines={1}>{u.email}</Text>
                                    ) : null}
                                </View>
                                {isActive ? (
                                    <View className="h-6 w-6 items-center justify-center rounded-full bg-[#1D9BF0]">
                                        <Check size={14} color="#fff" strokeWidth={3} />
                                    </View>
                                ) : null}
                            </Pressable>
                        );
                    })}

                    <Pressable onPress={onAdd} className="mt-1 flex-row items-center gap-3 rounded-2xl px-2 py-2.5 active:bg-white/5">
                        <View className="h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/5">
                            <Plus size={22} color="#fff" />
                        </View>
                        <Text className="text-base font-bold text-white">Add account</Text>
                    </Pressable>

                    <Text className="mt-3 px-2 text-center text-[11px] text-white/35">Hold an account to remove it from this device</Text>
                </View>
            </View>
        </Modal>
    );
}