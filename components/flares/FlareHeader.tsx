import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Text, View } from 'react-native';
import { useFlareLayout } from '@/hooks/flares/useFlaresLayout';
import { HEADER_HEIGHT } from '@/constants/flares/contants';
import { FlareIcon } from '@/components/ui/flare/FlareIcon';
import { PressableScale } from './PressableScale';

const GREY = 'rgba(255,255,255,0.8)';

type Props = {
    /** Set when the viewer is opened from Home: shows a back button on the left. */
    onBack?: () => void;
    title?: string;
};

export function FlareHeader({ onBack, title = 'Flares' }: Props) {
    const { insets, topChrome } = useFlareLayout();

    return (
        // box-none: the bar itself ignores touches, only the back button receives them
        <View
            pointerEvents="box-none"
            className="absolute inset-x-0 top-0 z-20 items-center"
            style={{ paddingTop: insets.top, height: topChrome }}
        >
            <View pointerEvents="none" className="flex-row items-center justify-center" style={{ height: HEADER_HEIGHT, gap: 8 }}>
                <FlareIcon size={30} color={GREY} />
                <Text className="text-2xl font-bold tracking-widest" style={{ color: GREY }}>
                    {title}
                </Text>
            </View>

            {onBack && (
                <View
                    pointerEvents="box-none"
                    className="absolute left-4 justify-center"
                    style={{ top: insets.top, height: HEADER_HEIGHT }}
                >
                    <PressableScale onPress={onBack} accessibilityLabel="Back">
                        <View className="h-[36px] w-[36px] items-center justify-center rounded-full bg-black/35">
                            <Ionicons name="chevron-back" size={22} color="#fff" />
                        </View>
                    </PressableScale>
                </View>
            )}
        </View>
    );
}