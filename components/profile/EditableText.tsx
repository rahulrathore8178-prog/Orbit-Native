import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { GlassPanel, NeoView } from '@/components/ui/neo';

type Props = {
    value: string;
    editable: boolean;
    onSave: (next: string) => void | Promise<void>;
    textClassName: string;
    placeholder?: string;
    maxLength?: number;
    multiline?: boolean;
    allowEmpty?: boolean;
};

/** Tap the text to edit it in place, then Save or Cancel. Read-only when `editable` is false. */
export default function EditableText({
    value,
    editable,
    onSave,
    textClassName,
    placeholder,
    maxLength,
    multiline = false,
    allowEmpty = false,
}: Props) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(value);

    useEffect(() => {
        if (!editing) setDraft(value);
    }, [value, editing]);

    const cancel = () => {
        setDraft(value);
        setEditing(false);
    };

    const save = async () => {
        const next = draft.trim();
        setEditing(false);
        if (next === value || (!next && !allowEmpty)) return setDraft(value);
        await onSave(next);
    };

    if (!editing) {
        if (!value && !editable) return null;
        return (
            <Pressable onPress={() => editable && setEditing(true)} disabled={!editable} accessibilityRole="button">
                <Text className={value ? textClassName : 'text-center text-sm text-neutral-500'} numberOfLines={multiline ? 4 : 1}>
                    {value || placeholder}
                </Text>
            </Pressable>
        );
    }

    return (
        <Animated.View entering={FadeIn.duration(180)} style={{ width: '100%' }}>
            <GlassPanel radius={20} style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
                <TextInput
                    value={draft}
                    onChangeText={setDraft}
                    autoFocus
                    multiline={multiline}
                    maxLength={maxLength}
                    placeholder={placeholder}
                    placeholderTextColor="#6b7280"
                    selectionColor="#ffffff"
                    className={`p-0 ${textClassName}`}
                />
            </GlassPanel>

            <View className="mt-3 flex-row items-center justify-end gap-2">
                {maxLength ? <Text className="mr-auto text-[11px] text-neutral-500">{draft.length}/{maxLength}</Text> : null}
                <Pressable onPress={cancel} accessibilityRole="button">
                    {({ pressed }) => (
                        <NeoView radius={16} pressed={pressed} contentStyle={{ paddingHorizontal: 16, paddingVertical: 8 }}>
                            <Text className="text-[13px] font-semibold text-neutral-300">Cancel</Text>
                        </NeoView>
                    )}
                </Pressable>
                <Pressable onPress={save} accessibilityRole="button">
                    {({ pressed }) => (
                        <NeoView accent radius={16} pressed={pressed} contentStyle={{ paddingHorizontal: 18, paddingVertical: 8 }}>
                            <Text className="text-[13px] font-semibold text-white">Save</Text>
                        </NeoView>
                    )}
                </Pressable>
            </View>
        </Animated.View>
    );
}