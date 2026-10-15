import React from 'react';
import { useLocalSearchParams } from 'expo-router';
import ProfileScreen from '@/components/profile/ProfileScreen';

// Someone else's profile, pushed on top of the tabs like a normal page.
export default function UserProfilePage() {
    const { id } = useLocalSearchParams<{ id: string }>();
    return <ProfileScreen userId={id} />;
}