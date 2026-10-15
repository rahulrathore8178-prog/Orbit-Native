import React from 'react';
import { Platform, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { PlatformPressable } from '@react-navigation/elements';
import type { BottomTabBarButtonProps } from '@react-navigation/bottom-tabs';
import { NeoView } from './neo';

/**
 * Tab button for the floating bar. The selected tab sits in a sunken neumorphic pill;
 * the others are flat. Colours come from tabBarActiveTintColor / tabBarInactiveTintColor.
 */
export default function NeoTabButton(props: BottomTabBarButtonProps) {
    const focused = props.accessibilityState?.selected ?? false;

    return (
        <PlatformPressable
            {...props}
            onPressIn={(event) => {
                if (Platform.OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPressIn?.(event);
            }}
        >
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                {focused ? (
                    <NeoView pressed radius={20} contentStyle={{ paddingHorizontal: 12, paddingVertical: 6 }}>
                        {props.children}
                    </NeoView>
                ) : (
                    props.children
                )}
            </View>
        </PlatformPressable>
    );
}