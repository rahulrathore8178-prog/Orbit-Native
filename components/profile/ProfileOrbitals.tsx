import React from 'react';
import { Text, View } from 'react-native';
import { router } from 'expo-router';
import OrbitalCard from '@/components/orbital/orbitals';
import { ProfileOrbital } from '@/components/profile/profile';

type Props = {
    orbitals: ProfileOrbital[];
};

/**
 * Orbitals a user belongs to, using the same card as the Orbitals screen.
 * Tapping opens the orbital page exactly like the orbital list does (no Message here: that is profile-only).
 */
export default function ProfileOrbitals({ orbitals }: Props) {
    if (orbitals.length === 0) {
        return <Text className="mt-4 text-center text-sm text-neutral-500">No orbitals yet.</Text>;
    }

    return (
        <View className="gap-3">
            {orbitals.map((orbital) => (
                <OrbitalCard
                    key={orbital._id}
                    orbital={orbital}
                    onPress={(item) =>
                        router.push({
                            pathname: '/orbital/[id]',
                            params: { id: item._id, data: JSON.stringify(item) },
                        })
                    }
                />
            ))}
        </View>
    );
}