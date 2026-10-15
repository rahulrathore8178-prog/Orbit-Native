import React from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, MoreHorizontal, Settings } from 'lucide-react-native';
import IconButton from '@/components/options/IconButton';

type Props = {
    handle: string;
    isOwn: boolean;
    showBack: boolean;
    onBack: () => void;
    onSettings: () => void;
    onMore: () => void;
};

export default function ProfileTopBar({ handle, isOwn, showBack, onBack, onSettings, onMore }: Props) {
    const insets = useSafeAreaInsets();

    return (
        <View className="flex-row items-center justify-between px-4 pb-2" style={{ paddingTop: insets.top + 8 }}>
            <View className="w-11">{showBack && <IconButton Icon={ArrowLeft} label="Go back" onPress={onBack} />}</View>

            <Text className="flex-1 px-2 text-center text-[15px] font-medium text-neutral-400" numberOfLines={1}>
                {handle}
            </Text>

            {isOwn ? (
                <IconButton Icon={Settings} label="Settings" onPress={onSettings} />
            ) : (
                <IconButton Icon={MoreHorizontal} label="More options" onPress={onMore} />
            )}
        </View>
    );
}