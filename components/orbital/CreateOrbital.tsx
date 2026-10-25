import { GlassPanel, NeoView } from '@/components/ui/neo';
import { useCreateOrbital } from '@/hooks/orbital/useCreateOrbital';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import Reanimated, { ZoomIn, ZoomOut } from 'react-native-reanimated';
import CreateOrbitalSheet from './CreateOrbitalSheet';

type Props = {
    /** Show the + button (the screen passes `true` only on the "Mine" tab). */
    showButton: boolean;
    /** Distance from the bottom of the screen to the button. */
    bottomOffset: number;
    /** Called with the server response after an orbital is created, e.g. to refresh the list. */
    onCreated?: (orbital: unknown) => void;
};

/**
 * The floating + button and the full-screen create sheet it opens.
 * Drop it once into the Orbitals screen; the form state lives here.
 */
export default function CreateOrbital({ showButton, bottomOffset, onCreated }: Props) {
    const [open, setOpen] = useState(false);
    const form = useCreateOrbital();

    return (
        <>
            {showButton && (
                // Reanimated components don't take className in this project, so layout is a style.
                // Entering/exiting are one-shot, UI-thread animations.
                <Reanimated.View
                    entering={ZoomIn.duration(220)}
                    exiting={ZoomOut.duration(160)}
                    pointerEvents="box-none"
                    style={{ position: 'absolute', right: 20, bottom: bottomOffset }}
                >
                    <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Create orbital">
                        {({ pressed }) => (
                            <GlassPanel radius={26} style={{ padding: 9 }}>
                                <NeoView radius={20} pressed={pressed} style={{ width: 50, height: 50 }}>
                                    <Plus size={24} color="#e5e5e5" strokeWidth={2.4} />
                                </NeoView>
                                {/* a draft is waiting */}
                                {form.isDirty && (
                                    <View className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-white" />
                                )}
                            </GlassPanel>
                        )}
                    </Pressable>
                </Reanimated.View>
            )}

            <CreateOrbitalSheet visible={open} form={form} onClose={() => setOpen(false)} onCreated={onCreated} />
        </>
    );
}