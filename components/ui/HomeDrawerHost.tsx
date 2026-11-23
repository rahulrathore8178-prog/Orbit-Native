import React, { useCallback, useEffect } from 'react';
import { router, useSegments } from 'expo-router';
import { useSelector } from 'react-redux';
import SideDrawer, { DrawerItemKey } from '../sideDrawer/sideDrawer'; // your path
import { useDrawer } from '@/components/sideDrawer/DrawerContext'; // your path

// tabs that show the drawer (route names from your tab layout)
const DRAWER_TABS = ['home', 'chat'];

export function HomeDrawerHost() {
    const { close } = useDrawer();
    const segments = useSegments();
    const onDrawerTab = DRAWER_TABS.includes(segments[segments.length - 1] as string);

    // TODO: use exactly what your Home screen uses for `currentUser` and `darkMode`
    const currentUser = useSelector((s: any) => s.auth.user);
    const [darkMode, setDarkMode] = React.useState(true);

    // leaving Home or Chat with the drawer open closes it
    useEffect(() => {
        if (!onDrawerTab) close();
    }, [onDrawerTab, close]);

    const handleSelect = useCallback((key: DrawerItemKey) => {
        close();
        // wait for the drawer's slide-out before navigating
        const go = (path: string) => setTimeout(() => router.push(path as any), 260);
        if (key === 'orbitals') go('/orbital');
        else if (key === 'discover') go('/discover/discover');
        else if (key === 'settings') go('/profile/settings');
        else if (key === 'profile') go('/profile');
    }, [close]);

    if (!onDrawerTab) return null;

    return (
        <SideDrawer
            user={currentUser}
            onSelect={handleSelect}
            darkMode={darkMode}
            onToggleDarkMode={setDarkMode}
        />
    );
}