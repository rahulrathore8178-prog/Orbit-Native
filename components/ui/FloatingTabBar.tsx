import React, { useEffect, useState } from 'react';
import { View, Pressable, Text, Animated, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const BAR_HEIGHT = 70;
const BORDER = 1;
const PILL_WIDTH = 70;
const PILL_HEIGHT = 50;

export function FloatingTabBar(props: any) {
  const { state, descriptors, navigation } = props;
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();

    const BAR_WIDTH = Math.min(width - 40, 400);
    // absolute children are positioned inside the border, so use the inner width
    const innerWidth = BAR_WIDTH - BORDER * 2;
    const innerHeight = BAR_HEIGHT - BORDER * 2;
    const tabWidth = innerWidth / state.routes.length;

    const getX = (index: number) => index * tabWidth + (tabWidth - PILL_WIDTH) / 2;

    const [translateX] = useState(() => new Animated.Value(getX(state.index)));

    useEffect(() => {
        Animated.spring(translateX, {
            toValue: getX(state.index),
            useNativeDriver: true,
            damping: 16,
            stiffness: 180,
            mass: 0.8,
        }).start();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.index, tabWidth]);

    return (
        <View
            pointerEvents="box-none"
            style={{
                position: 'absolute',
                left: 0,
                right: 0,
                bottom: Math.max(insets.bottom, 18),
                alignItems: 'center',
            }}
        >
            <View
                style={{
                    width: BAR_WIDTH,
                    height: BAR_HEIGHT,
                    borderRadius: BAR_HEIGHT / 2,
                    flexDirection: 'row',
                    borderWidth: BORDER,
                    backgroundColor: 'rgba(16,16,20,0.95)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 12 },
                    shadowOpacity: 0.35,
                    shadowRadius: 24,
                    elevation: 20,
                    overflow: 'hidden',
                }}
            >
                {/* single sliding indicator, rendered once behind the tabs */}
                <Animated.View
                    pointerEvents="none"
                    style={{
                        position: 'absolute',
                        top: (innerHeight - PILL_HEIGHT) / 2,
                        left: 0,
                        width: PILL_WIDTH,
                        height: PILL_HEIGHT,
                        borderRadius: 23,
                        backgroundColor: 'rgba(255,255,255,0.10)',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.12)',
                        transform: [{ translateX }],
                    }}
                />

                {state.routes.map((route, index) => {
                    const { options } = descriptors[route.key];
                    const focused = state.index === index;
                    const color = focused ? '#ffffff' : 'rgba(255,255,255,0.45)';

                    const onPress = () => {
                        const event = navigation.emit({
                            type: 'tabPress',
                            target: route.key,
                            canPreventDefault: true,
                        });
                        if (!focused && !event.defaultPrevented) {
                            navigation.navigate(route.name, route.params);
                        }
                    };

                    return (
                        <Pressable
                            key={route.key}
                            onPress={onPress}
                            style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
                        >
                            {options.tabBarIcon?.({ focused, color, size: 24 })}
                            <Text style={{ color, fontSize: 11, marginTop: 2 }}>
                                {typeof options.title === 'string' ? options.title : route.name}
                            </Text>
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}