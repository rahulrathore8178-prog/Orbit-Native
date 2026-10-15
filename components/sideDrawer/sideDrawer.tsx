import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    BadgeCheck,
    Bookmark,
    Bot,
    LifeBuoy,
    LucideIcon,
    Moon,
    Orbit,
    Settings,
    Sun,
    User
} from 'lucide-react-native';
import React, { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import {
    Animated,
    Easing,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Reanimated, {
    Easing as REasing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, GlassPanel, NeoView } from '../ui/neo';

export type DrawerItemKey =
    | 'profile'
    | 'premium'
    | 'orbitals'
    | 'bookmarks'
    | 'lists'
    | 'spaces'
    | 'creator-studio'
    | 'automate'
    | 'settings'
    | 'help';

export type DrawerUser = {
    username: string;
    profilePic?: string;
    // following: number;
    // followers: number;
};

type MenuItem = {
    key: DrawerItemKey;
    label: string;
    Icon: LucideIcon;
    badge?: string;
};

const MAIN_ITEMS: MenuItem[] = [
    { key: 'profile', label: 'Profile', Icon: User },
    { key: 'premium', label: 'Premium', Icon: BadgeCheck, badge: '50% off' },
    { key: 'orbitals', label: 'Orbitals', Icon: Orbit },
    // { key: 'communities', label: 'Communities', Icon: Users },
    { key: 'bookmarks', label: 'Bookmarks', Icon: Bookmark },
    // { key: 'lists', label: 'Lists', Icon: FileText },
    // { key: 'spaces', label: 'Spaces', Icon: Mic },
    // { key: 'creator-studio', label: 'Creator Studio', Icon: Rocket },
];

const FOOTER_ITEMS: MenuItem[] = [
    { key: 'automate', label: 'Automate work', Icon: Bot, badge: 'New' },
    { key: 'settings', label: 'Settings and privacy', Icon: Settings },
    { key: 'help', label: 'Help Centre', Icon: LifeBuoy },
];

type Props = {
    visible: boolean;
    onClose: () => void;
    user: DrawerUser | null;
    onSelect: (key: DrawerItemKey) => void;
    darkMode: boolean;
    onToggleDarkMode: (next: boolean) => void;
    onPressMore?: () => void;
};

const OPEN_EASING = REasing.bezier(0.22, 1, 0.36, 1); // fast start, long soft landing
const CLOSE_EASING = REasing.bezier(0.4, 0, 1, 1);

function SideDrawer({
    visible,
    onClose,
    user,
    onSelect,
    darkMode,
    onToggleDarkMode,
    onPressMore,
}: Props) {
    const { width } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const drawerW = Math.min(width * 0.84, 340);

    const progress = useSharedValue(0); // 0 closed, 1 open
    const startProgress = useSharedValue(0);

    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;
    const requestClose = useCallback(() => onCloseRef.current(), []);

    // open / close: one shared value change, nothing mounts or unmounts
    useEffect(() => {
        progress.value = visible
            ? withTiming(1, { duration: 320, easing: OPEN_EASING })
            : withTiming(0, { duration: 240, easing: CLOSE_EASING });
    }, [visible, progress]);

    // swipe left to close, fully on the UI thread
    const pan = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-12, 12])
                .failOffsetY([-14, 14])
                .onStart(() => {
                    startProgress.value = progress.value;
                })
                .onUpdate((e) => {
                    const next = startProgress.value + e.translationX / drawerW;
                    progress.value = Math.min(1, Math.max(0, next));
                })
                .onEnd((e) => {
                    if (e.velocityX < -500 || progress.value < 0.65) {
                        progress.value = withTiming(
                            0,
                            { duration: 200, easing: CLOSE_EASING },
                            (finished) => {
                                if (finished) runOnJS(requestClose)();
                            }
                        );
                    } else {
                        progress.value = withSpring(1, { damping: 28, stiffness: 320 });
                    }
                }),
        [drawerW, progress, startProgress, requestClose]
    );

    const drawerStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: (progress.value - 1) * (drawerW + 4) }],
    }));
    const backdropStyle = useAnimatedStyle(() => ({
        opacity: progress.value * 0.6,
    }));
    // console.log('SideDrawer rendered', user.avatar);
    // console.log('drawer user:', user)
    // console.log('drawer pic ->', resolveImg(user?.profilePic))

    return (
        <View style={styles.root} pointerEvents={visible ? 'auto' : 'none'}>
            {/* Backdrop */}
            <Reanimated.View style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onClose}
                    accessibilityLabel="Close menu"
                />
            </Reanimated.View>

            {/* Drawer */}
            <GestureDetector gesture={pan}>
                <Reanimated.View style={[styles.drawer, { width: drawerW }, drawerStyle]}>
                    {/* iOS: real blur. Android: a solid layer, because re-blurring a moving view
                        every frame is the biggest cause of drawer lag on Android. */}
                    {Platform.OS === 'ios' ? (
                        <BlurView intensity={55} tint="dark" style={StyleSheet.absoluteFill} />
                    ) : (
                        <View
                            pointerEvents="none"
                            style={[StyleSheet.absoluteFill]}
                            className="bg-black/5 backdrop-blur-sm"
                        />
                    )}
                    <LinearGradient
                        pointerEvents="none"
                        colors={['rgba(29,155,240,0.14)', 'rgba(10,12,18,0.82)', 'rgba(10,12,18,0.92)']}
                        locations={[0, 0.45, 1]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={StyleSheet.absoluteFill}
                    />

                    {/* Scrollable top part */}
                    <ScrollView
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{
                            paddingTop: insets.top + 16,
                            paddingHorizontal: 16,
                            paddingBottom: 16,
                        }}
                    >
                        {/* Header */}
                        <GlassPanel radius={26} style={{ padding: 16 }}>
                            <View style={styles.headerTop}>
                                <NeoView radius={36} style={{ width: 68, height: 68 }}>
                                    {user?.profilePic && (
                                    //     <Image source={{ uri: resolveImg(user?.profilePic) }} style={styles.avatar} />
                                    // ) : (
                                    //     <Text style={styles.avatarFallback}>
                                    //         {user?.username?.charAt(0).toUpperCase()}
                                    //     </Text>
                                    <User color='white' />
                                    )}
                                </NeoView>

                                <Pressable
                                    onPress={onPressMore}
                                    hitSlop={8}
                                    accessibilityLabel="More options"
                                >
                                    {({ pressed }) => (
                                        <NeoView radius={20} pressed={pressed} style={{ width: 40, height: 40 }}>
                                            <View style={{ gap: 3 }}>
                                                <View style={styles.dot} />
                                                <View style={styles.dot} />
                                                <View style={styles.dot} />
                                            </View>
                                        </NeoView>
                                    )}
                                </Pressable>
                            </View>

                            <Text style={styles.name} numberOfLines={1}>
                                {user?.username}
                            </Text>
                            {/* <Text style={styles.handle} numberOfLines={1}>
                                @{user.handle}
                            </Text> */}

                            {/* <View style={styles.stats}>
                                <Text style={styles.statText}>
                                    <Text style={styles.statNum}>{user.following}</Text> Following
                                </Text>
                                <Text style={styles.statText}>
                                    <Text style={styles.statNum}>{user.followers}</Text> Followers
                                </Text>
                            </View> */}
                        </GlassPanel>

                        {/* Main menu */}
                        <GlassPanel radius={26} style={{ marginTop: 16, padding: 8 }}>
                            {MAIN_ITEMS.map((item) => (
                                <MenuRow key={item.key} item={item} onPress={onSelect} />
                            ))}
                        </GlassPanel>
                    </ScrollView>

                    {/* Pinned footer */}
                    <View
                        style={{
                            paddingHorizontal: 16,
                            paddingBottom: insets.bottom + 12,
                            gap: 12,
                        }}
                    >
                        <GlassPanel radius={26} style={{ padding: 8 }}>
                            {FOOTER_ITEMS.map((item) => (
                                <MenuRow key={item.key} item={item} onPress={onSelect} compact />
                            ))}
                        </GlassPanel>

                        <GlassPanel radius={22} style={styles.themeRow}>
                            <View style={styles.themeLeft}>
                                <NeoView radius={12} style={{ width: 38, height: 38 }}>
                                    {darkMode ? (
                                        <Moon size={18} color={COLORS.accent} />
                                    ) : (
                                        <Sun size={18} color="#F5B942" />
                                    )}
                                </NeoView>
                                <Text style={styles.themeLabel}>Dark mode</Text>
                            </View>
                            <NeoSwitch value={darkMode} onValueChange={onToggleDarkMode} />
                        </GlassPanel>
                    </View>
                </Reanimated.View>
            </GestureDetector>
        </View>
    );
}

export default memo(SideDrawer);

/* ---------- Row ---------- */

const MenuRow = memo(function MenuRow({
    item,
    onPress,
    compact = false,
}: {
    item: MenuItem;
    onPress: (key: DrawerItemKey) => void;
    compact?: boolean;
}) {
    const { Icon } = item;
    const box = compact ? 38 : 44;

    return (
        <Pressable onPress={() => onPress(item.key)} accessibilityRole="button">
            {({ pressed }) => (
                <View style={[styles.row, pressed && styles.rowPressed]}>
                    <NeoView
                        radius={compact ? 12 : 14}
                        pressed={pressed}
                        style={{ width: box, height: box }}
                    >
                        <Icon
                            size={compact ? 18 : 20}
                            color={pressed ? COLORS.accent : COLORS.text}
                            strokeWidth={2}
                        />
                    </NeoView>

                    <Text
                        style={[styles.rowLabel, compact && { fontSize: 15, fontWeight: '600' }]}
                        numberOfLines={1}
                    >
                        {item.label}
                    </Text>

                    {item.badge ? (
                        <NeoView
                            accent
                            radius={999}
                            contentStyle={{ paddingHorizontal: 10, paddingVertical: 4 }}
                        >
                            <Text style={styles.badgeText}>{item.badge}</Text>
                        </NeoView>
                    ) : null}
                </View>
            )}
        </Pressable>
    );
});

/* ---------- Neumorphic switch ---------- */

const TRACK_W = 68;
const TRACK_H = 36;
const KNOB = 26;
const TRAVEL = TRACK_W - 2 - KNOB - 8; // 2 = border, 8 = 4px padding each side

function NeoSwitch({
    value,
    onValueChange,
}: {
    value: boolean;
    onValueChange: (next: boolean) => void;
}) {
    const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

    useEffect(() => {
        Animated.timing(anim, {
            toValue: value ? 1 : 0,
            duration: 220,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [value, anim]);

    const x = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TRAVEL] });

    return (
        <Pressable
            onPress={() => onValueChange(!value)}
            hitSlop={8}
            accessibilityRole="switch"
            accessibilityState={{ checked: value }}
            accessibilityLabel="Dark mode"
        >
            <NeoView pressed radius={TRACK_H / 2} style={{ width: TRACK_W, height: TRACK_H }}>
                <Animated.View
                    style={{
                        position: 'absolute',
                        left: 4,
                        top: 4,
                        transform: [{ translateX: x }],
                    }}
                >
                    <NeoView accent={value} radius={KNOB / 2} style={{ width: KNOB, height: KNOB }}>
                        {value ? (
                            <Moon size={14} color="#fff" />
                        ) : (
                            <Sun size={14} color="#F5B942" />
                        )}
                    </NeoView>
                </Animated.View>
            </NeoView>
        </Pressable>
    );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
    root: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        elevation: 1000, // Android z-order
    },
    backdrop: { backgroundColor: '#000' },
    drawer: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
        borderTopRightRadius: 32,
        borderBottomRightRadius: 32,
        borderRightWidth: 1,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: COLORS.glassBorder,
        backgroundColor: 'rgba(10,12,18,0.6)',
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    avatar: { width: 60, height: 60, borderRadius: 30 },
    avatarFallback: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS.text },
    name: {
        marginTop: 14,
        color: COLORS.text,
        fontSize: 22,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    handle: { marginTop: 2, color: COLORS.muted, fontSize: 14 },
    stats: { flexDirection: 'row', gap: 18, marginTop: 12 },
    statText: { color: COLORS.muted, fontSize: 14 },
    statNum: { color: COLORS.text, fontWeight: '700' },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 18,
    },
    rowPressed: { backgroundColor: 'rgba(255,255,255,0.05)' },
    rowLabel: { flex: 1, color: COLORS.text, fontSize: 17, fontWeight: '700' },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    themeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    themeLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    themeLabel: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
});