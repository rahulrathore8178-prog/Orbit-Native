import React, { createContext, ReactNode, useCallback, useContext, useMemo } from 'react'
import { useWindowDimensions } from 'react-native'
import { SharedValue, useSharedValue, withSpring } from 'react-native-reanimated'

// overshootClamping stops the drawer from sliding past 1 and showing a gap
export const DRAWER_SPRING = { damping: 28, stiffness: 300, mass: 0.9, overshootClamping: true }

type DrawerCtx = {
    progress: SharedValue<number> // 0 closed -> 1 open
    drawerW: number
    open: () => void
    close: () => void
}

const Ctx = createContext<DrawerCtx | null>(null)

export function DrawerProvider({ children }: { children: ReactNode }) {
    const { width } = useWindowDimensions()
    const drawerW = Math.min(width * 0.84, 340)
    const progress = useSharedValue(0)

    const open = useCallback(() => {
        progress.value = withSpring(1, DRAWER_SPRING)
    }, [progress])
    const close = useCallback(() => {
        progress.value = withSpring(0, DRAWER_SPRING)
    }, [progress])

    const value = useMemo(() => ({ progress, drawerW, open, close }), [progress, drawerW, open, close])
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useDrawer() {
    const ctx = useContext(Ctx)
    if (!ctx) throw new Error('useDrawer must be used inside <DrawerProvider>')
    return ctx
}