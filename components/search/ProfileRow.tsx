import { GlassRow } from "@/components/ui/search/GlassRow";
import { CheckIcon, ClockIcon, CloseIcon, MessageIcon, UserPlusIcon } from "@/components/ui/search/icons";
import { colors } from "@/components/ui/search/theme";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";
import { ROW } from "./constants";
import type { FriendActions, User } from "../services/search/types";
import { ActionButton } from "./ActionButton";
import { Avatar } from "./Avatar";

type Props = {
    user: User;
    actions: FriendActions;
    onSelect: (user: User) => void;
    onMessage: (user: User) => void;
};

/** The button(s) on the right, depending on the relationship with this user. */
function RowActions({ user, actions, onMessage }: Omit<Props, "onSelect">) {
    const { username } = user;

    if (user.isFriend) {
        return (
            <ActionButton label={`Message ${username}`} onPress={() => onMessage(user)}>
                <MessageIcon size={18} />
            </ActionButton>
        );
    }
    if (user.hasPendingRequest) {
        // they sent me a request
        return (
            <View className="flex-row items-center gap-2">
                <ActionButton label={`Accept request from ${username}`} onPress={() => actions.acceptRequest(user)}>
                    <CheckIcon size={18} color="#fff" />
                </ActionButton>
                <ActionButton plain label={`Decline request from ${username}`} onPress={() => actions.rejectRequest(user)}>
                    <CloseIcon size={18} color={colors.n400} />
                </ActionButton>
            </View>
        );
    }
    if (user.requestSent) {
        // I sent them a request
        return (
            <ActionButton plain label={`Cancel request to ${username}`} onPress={() => actions.cancelRequest(user)}>
                <ClockIcon size={18} color={colors.n400} />
            </ActionButton>
        );
    }
    return (
        <ActionButton label={`Add ${username} as a friend`} onPress={() => actions.addFriend(user)}>
            <UserPlusIcon size={18} />
        </ActionButton>
    );
}

export const ProfileRow = memo(function ProfileRow({ user, actions, onSelect, onMessage }: Props) {
    return (
        <GlassRow className={ROW}>
            <Avatar user={user} />
            <Pressable onPress={() => onSelect(user)} className="min-w-0 flex-1">
                <Text numberOfLines={1} className="font-sora text-[15px] text-neutral-100">
                    {user.username}
                </Text>
            </Pressable>
            <RowActions user={user} actions={actions} onMessage={onMessage} />
        </GlassRow>
    );
});