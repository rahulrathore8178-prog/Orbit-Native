import { useMemo } from 'react'
import { Gesture } from 'react-native-gesture-handler'
import { withSpring } from 'react-native-reanimated'
import { DRAWER_SPRING, useDrawer } from '@/components/sideDrawer/DrawerContext'

const FLING = 500 // px/s, same as Home

/** Finger-tracked swipe-right-to-open for the side drawer. Same behaviour as the Home tab. */
export function useDrawerSwipe() {
    const { progress: drawer, drawerW } = useDrawer()

    return useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX(10) // only a rightward drag claims the touch
                .failOffsetX(-10)
                .failOffsetY([-14, 14]) // vertical list scrolling is never stolen
                .onUpdate((e) => {
                    drawer.value = Math.min(1, Math.max(0, e.translationX / drawerW))
                })
                .onEnd((e) => {
                    const vx = e.velocityX
                    const open = vx > FLING || (vx > -FLING && drawer.value > 0.4)
                    drawer.value = withSpring(open ? 1 : 0, { ...DRAWER_SPRING, velocity: vx / drawerW })
                }),
        [drawer, drawerW]
    )
}