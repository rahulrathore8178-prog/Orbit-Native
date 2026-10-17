import { RAISED } from "@/components/ui/search/theme";
import { useState } from "react";
import { Image, Text, View } from "react-native";
import type { User } from "../services/search/types";

export function Avatar({ user }: { user: User }) {
    const [failed, setFailed] = useState(false);

    return (
        <View className={`h-11 w-11 overflow-hidden rounded-xl p-[3px] ${RAISED}`}>
            {user.profilePic && !failed ? (
                <Image
                    source={{ uri: user.profilePic }}
                    onError={() => setFailed(true)}
                    className="h-full w-full rounded-[9px]"
                />
            ) : (
                <View className="h-full w-full items-center justify-center rounded-[9px] bg-black/60">
                    <Text className="font-sora-medium text-sm uppercase text-neutral-300">
                        {user.username?.[0] ?? "?"}
                    </Text>
                </View>
            )}
        </View>
    );
}