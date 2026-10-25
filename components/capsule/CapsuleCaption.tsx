import { Ionicons } from '@expo/vector-icons'
import React, { memo, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

const COLLAPSED_LINES = 2
const MAX_EXPANDED_HEIGHT = 220 // longer captions scroll inside this

type Props = {
    caption?: string | null
    /** true while the full caption is open, so the viewer can pause the story timer */
    onExpandChange?: (expanded: boolean) => void
}

function CapsuleCaption({ caption, onExpandChange }: Props) {
    const text = caption?.trim() ?? ''
    const [expanded, setExpanded] = useState(false)
    const [overflowing, setOverflowing] = useState(false)
    const [ready, setReady] = useState(false) // stays invisible until the line count is known

    useEffect(() => {
        if (!expanded) return
        onExpandChange?.(true)
        return () => onExpandChange?.(false)
    }, [expanded, onExpandChange])

    // safety net: never leave the caption invisible if the measurement doesn't fire
    useEffect(() => {
        const id = setTimeout(() => setReady(true), 300)
        return () => clearTimeout(id)
    }, [])

    if (!text) return null

    const toggle = () => setExpanded((e) => !e)

    return (
        <View pointerEvents="box-none" style={[styles.outer, { opacity: ready ? 1 : 0 }]}>
            <View style={styles.panel}>
                {/* invisible twin at full width: tells us if the caption needs more than 2 lines */}
                <View pointerEvents="none" style={styles.measure}>
                    <Text
                        style={styles.text}
                        onTextLayout={(e) => {
                            setOverflowing(e.nativeEvent.lines.length > COLLAPSED_LINES)
                            setReady(true)
                        }}
                    >
                        {text}
                    </Text>
                </View>

                {expanded ? (
                    <ScrollView
                        style={{ maxHeight: MAX_EXPANDED_HEIGHT }}
                        showsVerticalScrollIndicator={false}
                        nestedScrollEnabled
                    >
                        <Text style={styles.text}>{text}</Text>
                    </ScrollView>
                ) : (
                    <Text
                        style={styles.text}
                        numberOfLines={COLLAPSED_LINES}
                        ellipsizeMode="tail"
                        onPress={overflowing ? toggle : undefined}
                    >
                        {text}
                    </Text>
                )}

                {overflowing && (
                    <Pressable
                        onPress={toggle}
                        hitSlop={10}
                        style={styles.toggle}
                        accessibilityRole="button"
                        accessibilityLabel={expanded ? 'Show less' : 'Show full caption'}
                    >
                        <Text style={styles.toggleText}>{expanded ? 'See less' : 'See more'}</Text>
                        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color="rgba(255,255,255,0.8)" />
                    </Pressable>
                )}
            </View>
        </View>
    )
}

export default memo(CapsuleCaption)

const styles = StyleSheet.create({
    outer: { paddingHorizontal: 0, marginBottom: 3 },
    panel: {
        borderRadius: 20,
        overflow: 'hidden',
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: 'rgba(14,14,18,0.66)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderTopColor: 'rgba(255,255,255,0.18)', // light top edge = glass feel
    },
    measure: { position: 'absolute', left: 16, right: 16, top: 10, opacity: 0 },
    text: { color: '#fff', fontSize: 14, lineHeight: 20, textAlign: 'center' },
    toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 4, marginTop: 4 },
    toggleText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '600' },
})