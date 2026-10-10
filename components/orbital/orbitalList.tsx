import { router } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    FlatList,
    LayoutChangeEvent,
    Pressable,
    RefreshControl,
    StyleProp,
    Text,
    View,
    ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, GlassPanel, NeoView } from '../sideDrawer/neo';
import OrbitIcon from './orbitIcon';
import { MyOrbital, Orbital, useOrbitals } from './orbitalData';
import OrbitalCard from './orbitals';
import { ChevronLeft } from 'lucide-react-native';
import { useNavigation } from 'expo-router';
import { interpolate, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const TABS = ['Joined orbitals', 'My orbitals'] as const;
const PAD = 6;

type Item = Orbital | MyOrbital;

/* ---------------- Tabs ---------------- */

function TabLabel({
    label,
    tabIndex,
    progress,
}: {
    label: string;
    tabIndex: 0 | 1;
    progress: Animated.Value;
}) {
    const active = progress.interpolate({
        inputRange: [0, 1],
        outputRange: tabIndex === 0 ? [1, 0] : [0, 1],
    });
    const inactive = progress.interpolate({
        inputRange: [0, 1],
        outputRange: tabIndex === 0 ? [0, 1] : [1, 0],
    });

    return (
        <View className="flex-1 items-center justify-center">
            <Animated.Text
                style={{ color: COLORS.muted, fontSize: 14, fontWeight: '700', opacity: inactive }}
            >
                {label}
            </Animated.Text>
            <Animated.Text
                style={{
                    position: 'absolute',
                    color: COLORS.text,
                    fontSize: 14,
                    fontWeight: '800',
                    opacity: active,
                }}
            >
                {label}
            </Animated.Text>
        </View>
    );
}

function SegmentedTabs({
    index,
    progress,
    onChange,
}: {
    index: number;
    progress: Animated.Value;
    onChange: (i: number) => void;
}) {
    const [w, setW] = useState(0);
    const tabW = w > 0 ? (w - PAD * 2) / 2 : 0;

    const translateX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, tabW],
    });

    return (
        <GlassPanel radius={22} style={{ height: 58 }}>
            <View style={{ flex: 1 }} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
                {tabW > 0 && (
                    <Animated.View
                        pointerEvents="none"
                        style={{
                            position: 'absolute',
                            left: PAD,
                            top: PAD,
                            bottom: PAD,
                            width: tabW,
                            transform: [{ translateX }],
                        }}
                    >
                        <NeoView radius={16} style={{ flex: 1 }} />
                    </Animated.View>
                )}

                <View style={{ flex: 1, flexDirection: 'row', padding: PAD }}>
                    {TABS.map((label, i) => (
                        <Pressable
                            key={label}
                            className="flex-1"
                            onPress={() => onChange(i)}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: index === i }}
                        >
                            <TabLabel label={label} tabIndex={i as 0 | 1} progress={progress} />
                        </Pressable>
                    ))}
                </View>
            </View>
        </GlassPanel>
    );
}

/* ---------------- List page ---------------- */

const Separator = () => <View style={{ height: 12 }} />;

function OrbitalList({
    data,
    loading,
    error,
    refreshing,
    emptyText,
    bottomPad,
    onRefresh,
    onRetry,
    // onPressItem,
}: {
    data: Item[];
    loading: boolean;
    error: string | null;
    refreshing: boolean;
    emptyText: string;
    bottomPad: number;
    onRefresh: () => void;
    onRetry: () => void;
    // onPressItem: (item: Item) => void;
}) {

    // hooks first, before any early return
    const handlePressItem = useCallback(
        (item: Item) => {
            router.push({
                pathname: '/orbital/[id]',
                params: { id: item._id, data: JSON.stringify(item) },
            });
        },
        [router]
    );
    if (loading && data.length === 0) {
        return (
            <View className="flex-1 items-center justify-center">
                <ActivityIndicator color={COLORS.accent} />
            </View>
        );
    };

    console.log('Rendering OrbitalList with data:', data, 'loading:', loading, 'error:', error, 'refreshing:', refreshing);

    // const handlePressItem = useCallback(
    //     (item: Item) => {
    //         // router.push('/components/orbital/orbitals');
    //     },
    //     [router]
    // );

    if (error && data.length === 0) {
        return (
            <View className="flex-1 justify-center px-4">
                <GlassPanel radius={24} style={{ padding: 20, alignItems: 'center' }}>
                    <Text className="mb-4 text-center text-[14px] text-[#7C8494]">{error}</Text>
                    <Pressable onPress={onRetry}>
                        {({ pressed }) => (
                            <NeoView
                                radius={16}
                                pressed={pressed}
                                contentStyle={{ paddingHorizontal: 22, paddingVertical: 10 }}
                            >
                                <Text className="text-[14px] font-bold text-[#E8EAF0]">Retry</Text>
                            </NeoView>
                        )}
                    </Pressable>
                </GlassPanel>
            </View>
        );
    };

    return (
        <FlatList
            data={data}
            keyExtractor={(o) => o._id}
            renderItem={({ item }) => <OrbitalCard orbital={item} onPress={handlePressItem} />}
            ItemSeparatorComponent={Separator}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: bottomPad }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#fff"
                    colors={[COLORS.accent]}
                    progressBackgroundColor={COLORS.surface}
                />
            }
            ListEmptyComponent={
                <GlassPanel radius={24} style={{ padding: 24, marginTop: 8 }}>
                    <Text className="text-center text-[14px] text-[#7C8494]">{emptyText}</Text>
                </GlassPanel>
            }
        />
    );
}

interface BackButtonProps {
    /** Screen to open if there is no previous page (e.g. deep link / app opened on this screen). */
    fallbackRoute?: string;
    size?: number;
    color?: string;
    style?: StyleProp<ViewStyle>;
    onPress?: () => void; // optional extra callback before navigating back
}

/* ---------------- Screen ---------------- */

export default function OrbitalsScreen({ fallbackRoute = "home", size = 40, color = "#e5e5e5", style, onPress }: BackButtonProps) {
    const insets = useSafeAreaInsets();
    const { joined, mine, loading, refreshing, error, refresh, retry } = useOrbitals();

    const [index, setIndex] = useState(0);
    const [pageW, setPageW] = useState(0);
    const progress = useRef(new Animated.Value(0)).current; // 0 = joined, 1 = mine
    const navigation = useNavigation<any>();
    const p = useSharedValue(0);

    const animated = useAnimatedStyle(() => ({
        transform: [{ scale: interpolate(p.value, [0, 1], [1, 0.92]) }],
        shadowOpacity: interpolate(p.value, [0, 1], [0.85, 0.15]),
        backgroundColor: p.value > 0.5 ? "#0b0b0d" : "#18181c",
    }));

    const handleBack = () => {
        onPress?.();
        if (navigation.canGoBack()) navigation.goBack(); // immediate previous page
        else navigation.navigate(fallbackRoute);
    };

    const goTo = useCallback(
        (i: number) => {
            setIndex(i);
            Animated.timing(progress, {
                toValue: i,
                duration: 320,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
        },
        [progress]
    );

    const handlePressItem = useCallback((item: Item) => {
        // TODO: navigate to the orbital page, e.g. router.push(`/orbital/${item._id}`)
    }, []);

    const pagerX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, -pageW] });
    const joinedOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.25] });
    const mineOpacity = progress.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] });

    const bottomPad = insets.bottom + 96; // room for your tab bar, adjust if needed

    return (
        <View className="flex-1 bg-black" style={{ paddingTop: insets.top }}>
            {/* Header */}
            <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={8}
                onPress={handleBack}
                onPressIn={() => { p.value = withTiming(1, { duration: 110 }); }}
                onPressOut={() => { p.value = withTiming(0, { duration: 260, easing: Easing.bezier(0.22, 1, 0.36, 1) }); }}
            >
                <Animated.View
                    style={[
                        {
                            width: size, height: size, borderRadius: size / 2, alignItems: "center", justifyContent: "center",
                            borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", borderTopColor: "rgba(255,255,255,0.14)",
                            shadowColor: "#000", shadowOffset: { width: 3, height: 4 }, shadowRadius: 8, elevation: 5,
                        },
                        animated,
                        style,
                    ]}
                >
                    <ChevronLeft size={size * 0.55} color={color} strokeWidth={2.2} />
                </Animated.View>
            </Pressable>
            <View className="flex-row items-center justify-center gap-3 pt-3">
                <OrbitIcon size={48} />
                <Text className="text-[28px] font-extrabold tracking-wide text-[#E8EAF0]">Orbitals</Text>
            </View>

            {/* Tabs */}
            <View className="mt-4 px-4">
                <SegmentedTabs index={index} progress={progress} onChange={goTo} />
            </View>

            {/* Sliding pages */}
            <View
                className="mt-3 flex-1 overflow-hidden"
                onLayout={(e: LayoutChangeEvent) => setPageW(e.nativeEvent.layout.width)}
            >
                {pageW > 0 && (
                    <Animated.View
                        style={{
                            flex: 1,
                            flexDirection: 'row',
                            width: pageW * 2,
                            transform: [{ translateX: pagerX }],
                        }}
                    >
                        <Animated.View style={{ width: pageW, opacity: joinedOpacity }}>
                            <OrbitalList
                                data={joined}
                                loading={loading}
                                error={error}
                                refreshing={refreshing}
                                emptyText="You haven't joined any orbitals yet."
                                bottomPad={bottomPad}
                                onRefresh={refresh}
                                onRetry={retry}
                                onPressItem={handlePressItem}
                            />
                        </Animated.View>

                        <Animated.View style={{ width: pageW, opacity: mineOpacity }}>
                            <OrbitalList
                                data={mine}
                                loading={loading}
                                error={error}
                                refreshing={refreshing}
                                emptyText="You haven't created any orbitals yet."
                                bottomPad={bottomPad}
                                onRefresh={refresh}
                                onRetry={retry}
                                onPressItem={handlePressItem}
                            />
                        </Animated.View>
                    </Animated.View>
                )}
            </View>
        </View>
    );
}