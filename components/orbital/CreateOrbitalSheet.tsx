import { NeoView } from '@/components/ui/neo';
import { CreateOrbitalForm, DESC_MAX, NAME_MAX, VISIBILITY } from '@/hooks/orbital/useCreateOrbital';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Globe, Lock, X } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { RefObject, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    View,
} from 'react-native';
import Reanimated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Centered column: full width on phones, capped on tablets
const COLUMN = 'w-full max-w-xl self-center px-5';
const LABEL = 'text-[13px] font-semibold uppercase tracking-wider text-neutral-400';

const haptic = (fn: () => Promise<void>) => {
    if (Platform.OS !== 'web') fn().catch(() => { });
};

/* ------------------------------- small parts ------------------------------- */

type InputProps = TextInputProps & { inputRef?: RefObject<TextInput | null>; invalid?: boolean };

/** Dark glass text field: border brightens on focus, turns red when invalid. */
function GlassInput({ inputRef, invalid, multiline, onFocus, onBlur, ...rest }: InputProps) {
    const [focused, setFocused] = useState(false);
    return (
        <TextInput
            ref={inputRef}
            {...rest}
            multiline={multiline}
            onFocus={(e) => {
                setFocused(true);
                onFocus?.(e);
            }}
            onBlur={(e) => {
                setFocused(false);
                onBlur?.(e);
            }}
            placeholderTextColor="#525252"
            selectionColor="#e5e5e5"
            // Android: multiline text starts centered unless told otherwise
            style={multiline ? { textAlignVertical: 'top' } : undefined}
            className={`rounded-2xl border bg-black/40 px-4 py-3.5 text-[15px] text-neutral-100 ${multiline ? 'min-h-[112px]' : ''
                } ${invalid ? 'border-red-400/50' : focused ? 'border-white/30' : 'border-white/10'}`}
        />
    );
}

type OptionProps = { active: boolean; title: string; text: string; icon: LucideIcon; onPress: () => void };

/** Neo radio card: raised when idle, pressed-in when selected. */
function VisibilityOption({ active, title, text, icon: IconComponent, onPress }: OptionProps) {
    return (
        <Pressable onPress={onPress} accessibilityRole="radio" accessibilityState={{ checked: active }}>
            <NeoView radius={20} pressed={active}>
                <View className="flex-row items-center gap-3.5 p-4">
                    <IconComponent size={20} color={active ? '#ffffff' : '#737373'} strokeWidth={1.8} />
                    <View className="flex-1">
                        <Text className="text-[15px] font-semibold text-neutral-100">{title}</Text>
                        <Text className="mt-0.5 text-xs text-neutral-500">{text}</Text>
                    </View>
                    <View className={`h-2.5 w-2.5 rounded-full ${active ? 'bg-white' : 'bg-neutral-700'}`} />
                </View>
            </NeoView>
        </Pressable>
    );
}

/* ---------------------------------- sheet ---------------------------------- */

type Props = {
    visible: boolean;
    form: CreateOrbitalForm;
    onClose: () => void;
    onCreated?: (orbital: unknown) => void;
};

/**
 * Full-screen "create orbital" sheet. It's a native Modal sliding up from the bottom:
 * the OS animates it, so it's smooth and costs almost no battery. There are no looping animations.
 */
export default function CreateOrbitalSheet({ visible, form, onClose, onCreated }: Props) {
    const insets = useSafeAreaInsets();
    const keyboardOpen = useKeyboardVisible();
    const nameInput = useRef<TextInput>(null);

    // one-shot shake when the name is missing
    const shake = useSharedValue(0);
    const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.get() }] }));

    const isPrivate = form.visibility === VISIBILITY.PRIVATE;
    const initials = form.name.trim().slice(0, 2).toUpperCase();

    const handleClose = () => {
        if (!form.submitting) onClose(); // the draft is kept, nothing is lost
    };

    const confirmClear = () => {
        Alert.alert('Clear draft?', 'Your name, description and picture will be removed.', [
            { text: 'Keep', style: 'cancel' },
            { text: 'Clear', style: 'destructive', onPress: form.reset },
        ]);
    };

    const chooseVisibility = (value: typeof form.visibility) => {
        if (value === form.visibility) return;
        haptic(() => Haptics.selectionAsync());
        form.setVisibility(value);
    };

    const handleSubmit = async () => {
        Keyboard.dismiss();
        const result = await form.submit();

        if (result.status === 'invalid') {
            haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
            shake.set(
                withSequence(
                    withTiming(-8, { duration: 50 }),
                    withTiming(8, { duration: 50 }),
                    withTiming(-5, { duration: 50 }),
                    withTiming(0, { duration: 50 })
                )
            );
            nameInput.current?.focus();
        } else if (result.status === 'ok') {
            haptic(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
            onCreated?.(result.orbital);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <View className="flex-1 bg-black">
                {/* soft top glow, the only decoration (static, so it costs nothing) */}
                <LinearGradient
                    pointerEvents="none"
                    colors={['rgba(255,255,255,0.07)', 'transparent']}
                    locations={[0, 0.4]}
                    style={StyleSheet.absoluteFill}
                />

                <KeyboardAvoidingView behavior="padding" className="flex-1">
                    {/* Header */}
                    <View className={`${COLUMN} flex-row items-start justify-between pb-4`} style={{ paddingTop: insets.top + 12 }}>
                        <View className="flex-1 pr-4">
                            <Text className="text-[26px] font-extrabold tracking-tight text-[#E8EAF0]">New orbital</Text>
                            <Text className="mt-1 text-sm text-neutral-500">A space for people who share your gravity.</Text>
                        </View>

                        <View className="flex-row items-center gap-4 pt-1">
                            {form.isDirty && (
                                <Pressable onPress={confirmClear} hitSlop={8} accessibilityRole="button">
                                    <Text className="text-xs font-medium text-neutral-500">Clear</Text>
                                </Pressable>
                            )}
                            <Pressable onPress={handleClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                                {({ pressed }) => (
                                    <NeoView radius={20} pressed={pressed} style={{ width: 40, height: 40 }}>
                                        <X size={20} color="#e5e5e5" strokeWidth={2.2} />
                                    </NeoView>
                                )}
                            </Pressable>
                        </View>
                    </View>

                    <ScrollView
                        className="flex-1"
                        contentContainerClassName={`${COLUMN} pb-6`}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                    >
                        {/* The "planet": tap to add a picture. Rings are static. */}
                        <View className="h-56 items-center justify-center overflow-hidden">
                            <View className="absolute h-40 w-40 rounded-full border border-white/[0.07]" />
                            <View className="absolute h-56 w-56 rounded-full border border-white/[0.07]" />
                            <View className="absolute h-72 w-72 rounded-full border border-white/5" />

                            <Pressable
                                onPress={form.pickImage}
                                accessibilityRole="button"
                                accessibilityLabel={form.image ? 'Change orbital picture' : 'Add orbital picture'}
                            >
                                {({ pressed }) => (
                                    <View>
                                        <NeoView radius={56} pressed={pressed} style={{ width: 112, height: 112 }}>
                                            <View className="h-full w-full items-center justify-center overflow-hidden rounded-full">
                                                {form.image ? (
                                                    <Image source={{ uri: form.image.uri }} className="h-full w-full" />
                                                ) : initials ? (
                                                    <Text className="text-3xl font-semibold text-neutral-300">{initials}</Text>
                                                ) : (
                                                    <Camera size={30} color="#737373" strokeWidth={1.7} />
                                                )}
                                            </View>
                                        </NeoView>
                                        <View className="absolute bottom-0 right-0 h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#17181b]">
                                            <Camera size={16} color="#d4d4d4" strokeWidth={1.8} />
                                        </View>
                                    </View>
                                )}
                            </Pressable>
                        </View>

                        {/* live preview under the planet */}
                        <View className="items-center pb-7">
                            <Text
                                numberOfLines={1}
                                className={`text-xl font-semibold ${form.name.trim() ? 'text-white' : 'text-neutral-600'}`}
                            >
                                {form.name.trim() || 'Your orbital name'}
                            </Text>
                            <View className="mt-2 flex-row items-center gap-1.5">
                                {isPrivate ? (
                                    <Lock size={13} color="#a3a3a3" strokeWidth={1.8} />
                                ) : (
                                    <Globe size={13} color="#a3a3a3" strokeWidth={1.8} />
                                )}
                                <Text className="text-xs text-neutral-400">{isPrivate ? 'Private' : 'Open to all'}</Text>
                            </View>
                            {form.image ? (
                                <Pressable onPress={form.removeImage} hitSlop={8} className="mt-2">
                                    <Text className="text-xs text-neutral-500 underline">Remove picture</Text>
                                </Pressable>
                            ) : (
                                <Text className="mt-2 text-xs text-neutral-600">Tap the planet to add a picture (optional)</Text>
                            )}
                            {form.imageError && <Text className="mt-2 text-xs text-red-300/90">{form.imageError}</Text>}
                        </View>

                        {/* Name */}
                        <View className="mb-6">
                            <View className="mb-2 flex-row items-baseline justify-between">
                                <Text className={LABEL}>Name</Text>
                                <Text className="text-xs text-neutral-600">
                                    {form.name.length}/{NAME_MAX}
                                </Text>
                            </View>
                            <Reanimated.View style={shakeStyle}>
                                <GlassInput
                                    inputRef={nameInput}
                                    value={form.name}
                                    onChangeText={form.changeName}
                                    maxLength={NAME_MAX}
                                    placeholder="Night owls, Indie devs, Film club…"
                                    invalid={!!form.nameError}
                                    returnKeyType="next"
                                />
                            </Reanimated.View>
                            {form.nameError && <Text className="mt-2 text-xs text-red-300/90">{form.nameError}</Text>}
                        </View>

                        {/* Description */}
                        <View className="mb-6">
                            <View className="mb-2 flex-row items-baseline justify-between">
                                <Text className={LABEL}>
                                    Description <Text className="font-normal normal-case text-neutral-600">(optional)</Text>
                                </Text>
                                <Text className="text-xs text-neutral-600">
                                    {form.description.length}/{DESC_MAX}
                                </Text>
                            </View>
                            <GlassInput
                                value={form.description}
                                onChangeText={form.setDescription}
                                maxLength={DESC_MAX}
                                multiline
                                placeholder="What is this orbital about and who is it for?"
                            />
                        </View>

                        {/* Visibility */}
                        <View className="mb-6">
                            <Text className={`${LABEL} mb-2`}>Who can join</Text>
                            <View className="gap-3" accessibilityRole="radiogroup">
                                <VisibilityOption
                                    active={!isPrivate}
                                    title="Open to all"
                                    text="Anyone can find and join."
                                    icon={Globe}
                                    onPress={() => chooseVisibility(VISIBILITY.OPEN)}
                                />
                                <VisibilityOption
                                    active={isPrivate}
                                    title="Private"
                                    text="People send a request and you approve them."
                                    icon={Lock}
                                    onPress={() => chooseVisibility(VISIBILITY.PRIVATE)}
                                />
                            </View>
                        </View>

                        {form.serverError && (
                            <View accessibilityRole="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 px-4 py-3">
                                <Text className="text-sm text-red-200">{form.serverError}</Text>
                            </View>
                        )}
                    </ScrollView>

                    {/* Footer: stays above the keyboard */}
                    <View
                        className="border-t border-white/10 bg-black/70"
                        style={{ paddingBottom: keyboardOpen ? 12 : Math.max(insets.bottom, 16) }}
                    >
                        <View className={`${COLUMN} pt-3`}>
                            <Pressable
                                onPress={handleSubmit}
                                disabled={form.submitting}
                                accessibilityRole="button"
                                accessibilityLabel="Create orbital"
                                accessibilityState={{ disabled: form.submitting, busy: form.submitting }}
                            >
                                {({ pressed }) => (
                                    <NeoView radius={20} pressed={pressed || form.submitting} style={{ height: 54 }}>
                                        <View className="h-full flex-row items-center justify-center gap-2.5">
                                            {form.submitting && <ActivityIndicator size="small" color="#e5e5e5" />}
                                            <Text className="text-[15px] font-semibold text-white">
                                                {form.submitting ? 'Creating…' : 'Create orbital'}
                                            </Text>
                                        </View>
                                    </NeoView>
                                )}
                            </Pressable>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}