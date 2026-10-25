import { useCallback, useMemo, useState } from 'react'
import { useWindowDimensions } from 'react-native'
import { Gesture } from 'react-native-gesture-handler'
import { runOnJS, useSharedValue, withSpring } from 'react-native-reanimated'
import { DRAWER_SPRING, useDrawer } from '@/components/sideDrawer/DrawerContext'

export const FEED_TABS = ['Your feed', 'Orbitals'] as const
export type FeedTab = 0 | 1

const TAB_SPRING = { damping: 26, stiffness: 260, mass: 0.9, overshootClamping: true }
const SWITCH_RATIO = 0.2 // fraction of screen width to commit a tab switch
const FLING = 500 // px/s

/**
 * Single pan gesture, finger-tracked:
 *  - tab 0 + drag right -> the drawer follows your finger
 *  - tab 0 + drag left  -> pager follows your finger to tab 1
 *  - tab 1 + drag right -> pager follows your finger back to tab 0
 * Wrap your pager in <GestureDetector gesture={tabs.gesture}>.
 */
export function useFeedTabs() {
    const { width } = useWindowDimensions()
    const { progress: drawer, drawerW } = useDrawer()
    const position = useSharedValue(0) // 0 = Your feed, 1 = Orbitals
    const startTab = useSharedValue(0)
    const [tab, setTab] = useState<FeedTab>(0)

    const goTo = useCallback(
        (next: number) => {
            const n = (next ? 1 : 0) as FeedTab
            setTab(n)
            position.value = withSpring(n, TAB_SPRING)
        },
        [position]
    )

    const gesture = useMemo(
        () =>
            Gesture.Pan()
                .activeOffsetX([-10, 10])
                .failOffsetY([-14, 14])
                .onStart(() => {
                    startTab.value = Math.round(position.value)
                })
                .onUpdate((e) => {
                    const dx = e.translationX
                    if (startTab.value === 0 && dx > 0) {
                        drawer.value = Math.min(1, dx / drawerW)
                        position.value = 0
                    } else {
                        drawer.value = 0
                        position.value = Math.min(1, Math.max(0, startTab.value - dx / width))
                    }
                })
                .onEnd((e) => {
                    const dx = e.translationX
                    const vx = e.velocityX

                    if (startTab.value === 0 && dx > 0) {
                        const open = vx > FLING || (vx > -FLING && drawer.value > 0.4)
                        drawer.value = withSpring(open ? 1 : 0, { ...DRAWER_SPRING, velocity: vx / drawerW })
                        return
                    }

                    const t = startTab.value
                    const commit =
                        t === 0 ? dx < -width * SWITCH_RATIO || vx < -FLING : dx > width * SWITCH_RATIO || vx > FLING
                    const target = commit ? 1 - t : t
                    position.value = withSpring(target, { ...TAB_SPRING, velocity: -vx / width })
                    runOnJS(setTab)(target as FeedTab)
                }),
        [drawer, drawerW, position, startTab, width]
    )

    return { tab, position, gesture, goTo }
}