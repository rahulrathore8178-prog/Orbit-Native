import { MediaDraft, Message } from '@/hooks/chats/useChat'
import { QuickChats } from '@/components/chats/QuickChats'
import { VoiceNotePreview } from '@/components/posts/PostMedia'
import { Ionicons } from '@expo/vector-icons'
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio'
import * as Haptics from 'expo-haptics'
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PanResponder, Pressable, Text, TextInput, View } from 'react-native'
import { useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller'
import Animated, {
    FadeInDown, FadeInUp, FadeOut, LinearTransition, ZoomIn, ZoomOut, cancelAnimation, interpolate,
    useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated'

const ICON = '#d4d8e1'
const MAX_VOICE_SECONDS = 300
const HOLD_MS = 100 // how long you must hold before recording starts (try 1500 for slower)
const VOICE_PRESET = { ...RecordingPresets.HIGH_QUALITY, sampleRate: 22050, numberOfChannels: 1, bitRate: 32000 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const haptic = (style = Haptics.ImpactFeedbackStyle.Light) => Haptics.impactAsync(style).catch(() => { })

type Phase = 'idle' | 'recording' | 'locked' | 'review'

export const Composer = memo(function Composer({
    safeBottom, contactId, onSend, onAttach, onCamera, onSendVoice, editing, onCancelEdit, onSubmitEdit,
}: {
    safeBottom: number
    contactId: string
    onSend: (text: string) => boolean | Promise<boolean>
    onAttach: () => void
    onCamera: () => void
    onSendVoice: (d: MediaDraft) => void
    onHint?: (t: string) => void
    editing: Message | null
    onCancelEdit: () => void
    onSubmitEdit: (text: string) => Promise<boolean>
}) {
    const [text, setText] = useState('')
    const [phase, setPhase] = useState<Phase>('idle')
    const [pending, setPending] = useState<{ uri: string; duration: number } | null>(null)
    const inputRef = useRef<TextInput>(null)
    const wasEditing = useRef(false)
    const hasText = text.trim().length > 0

    // subtle hint pill right above the input
    const [hintText, setHintText] = useState<string | null>(null)
    const hintTimer = useRef<any>(null)
    const onHint = useCallback((t: string) => {
        setHintText(t)
        clearTimeout(hintTimer.current)
        hintTimer.current = setTimeout(() => setHintText(null), 1800)
    }, [])
    useEffect(() => () => clearTimeout(hintTimer.current), [])

    useEffect(() => {
        if (editing) {
            wasEditing.current = true
            setText(editing.content)
            setTimeout(() => inputRef.current?.focus(), 60)
        } else if (wasEditing.current) {
            wasEditing.current = false
            setText('')
        }
    }, [editing?.id]) // eslint-disable-line react-hooks/exhaustive-deps

    const { progress } = useReanimatedKeyboardAnimation()
    const restBottom = Math.max(safeBottom, 12)
    const wrapStyle = useAnimatedStyle(() => ({ paddingBottom: interpolate(progress.value, [0, 1], [restBottom, 12]) }))

    /* ---------- voice: hold = record, slide left = cancel, slide up = lock ---------- */
    const recorder = useAudioRecorder(VOICE_PRESET)
    const rs = useAudioRecorderState(recorder, 200)
    const secs = Math.floor(rs.durationMillis / 1000)
    const durRef = useRef(0)
    durRef.current = rs.durationMillis

    const dx = useSharedValue(0)
    const dy = useSharedValue(0)
    const pulse = useSharedValue(1)
    const holdP = useSharedValue(0) // 0..1 while you hold, before recording starts
    const held = useRef(false)
    const started = useRef(false)
    const released = useRef(false)
    const locked = useRef(false)
    const cancelled = useRef(false)
    const timer = useRef<any>(null)

    useEffect(() => {
        if (phase === 'recording' || phase === 'locked') {
            pulse.value = withRepeat(withSequence(withTiming(0.25, { duration: 600 }), withTiming(1, { duration: 600 })), -1)
        } else {
            cancelAnimation(pulse)
            pulse.value = 1
        }
    }, [phase, pulse])
    const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }))
    const slideStyle = useAnimatedStyle(() => ({
        opacity: interpolate(dx.value, [-110, 0], [0.15, 1], 'clamp'),
        transform: [{ translateX: interpolate(dx.value, [-110, 0], [-30, 0], 'clamp') }],
    }))
    const lockStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: interpolate(dy.value, [-80, 0], [-34, 0], 'clamp') }, { scale: interpolate(dy.value, [-80, 0], [1.12, 1], 'clamp') }],
    }))

    const micS = useSharedValue(1)
    useEffect(() => {
        micS.value = withSpring(phase === 'recording' ? 1.35 : 1, { damping: 14, stiffness: 220 })
    }, [phase, micS])
    // while holding, the mic slowly swells so you can see the hold registering
    const micScale = useAnimatedStyle(() => ({
        transform: [{ scale: micS.value * (1 + 0.15 * holdP.value) }],
    }))

    const startRec = async () => {
        try {
            const perm = await AudioModule.requestRecordingPermissionsAsync()
            if (!perm.granted) { held.current = false; return onHint('Microphone permission denied') }
            await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })
            await recorder.prepareToRecordAsync()
            // let go or slid to cancel before it was ready: don't start
            if (released.current || cancelled.current) {
                held.current = false
                return released.current ? onHint('Hold to record a voice note') : undefined
            }
            recorder.record()
            started.current = true
            haptic(Haptics.ImpactFeedbackStyle.Medium)
            // if they already swiped up while it was starting, go straight to locked
            setPhase(locked.current ? 'locked' : 'recording')
        } catch {
            held.current = false
            onHint('Could not access the microphone')
        }
    }

    const finish = async (mode: 'send' | 'discard' | 'review') => {
        if (!started.current) return
        started.current = false
        const seconds = Math.max(0, Math.round(durRef.current / 1000))
        try {
            await recorder.stop()
            await sleep(250) // let the file finish writing
            await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true })
        } catch { /* ignore */ }
        const uri = recorder.uri
        if (mode === 'discard' || !uri) return setPhase('idle')
        if (seconds < 1) { setPhase('idle'); return onHint('Hold to record a voice note') }
        if (mode === 'review') { setPending({ uri, duration: seconds }); return setPhase('review') }
        setPhase('idle')
        onSendVoice({ kind: 'voice', uri, duration: seconds })
    }

    const api = useRef({ startRec, finish, onHint })
    api.current = { startRec, finish, onHint }

    const pan = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onPanResponderTerminationRequest: () => false,
                onPanResponderGrant: () => {
                    held.current = false; released.current = false; locked.current = false; cancelled.current = false
                    dx.value = 0; dy.value = 0
                    holdP.value = 0
                    holdP.value = withTiming(1, { duration: HOLD_MS })
                    timer.current = setTimeout(() => {
                        held.current = true
                        holdP.value = withTiming(0, { duration: 100 })
                        api.current.startRec()
                    }, HOLD_MS)
                },
                onPanResponderMove: (_, g) => {
                    if (!held.current || locked.current || cancelled.current) return
                    dx.value = g.dx; dy.value = g.dy
                    if (g.dy < -70 && Math.abs(g.dy) > Math.abs(g.dx)) {
                        locked.current = true
                        dx.value = 0; dy.value = 0
                        haptic(Haptics.ImpactFeedbackStyle.Medium)
                        setPhase('locked')
                    } else if (g.dx < -100) {
                        cancelled.current = true
                        haptic()
                        api.current.finish('discard')
                    }
                },
                onPanResponderRelease: () => {
                    clearTimeout(timer.current)
                    dx.value = 0; dy.value = 0
                    if (!held.current) {
                        // let go too early: nothing recorded
                        holdP.value = withTiming(0, { duration: 120 })
                        return api.current.onHint('Keep holding to record')
                    }
                    if (cancelled.current || locked.current) return
                    if (started.current) api.current.finish('send')
                    else released.current = true
                },
                onPanResponderTerminate: () => {
                    clearTimeout(timer.current)
                    holdP.value = withTiming(0, { duration: 120 })
                    dx.value = 0; dy.value = 0
                    if (held.current && !locked.current && !cancelled.current && started.current) api.current.finish('discard')
                },
            }),
        [dx, dy, holdP]
    )

    useEffect(() => () => clearTimeout(timer.current), [])

    useEffect(() => {
        if ((phase === 'recording' || phase === 'locked') && secs >= MAX_VOICE_SECONDS) finish('send')
    }, [secs, phase]) // eslint-disable-line react-hooks/exhaustive-deps

    /* ---------- text ---------- */
    const submit = async () => {
        const trimmed = text.trim()
        if (!trimmed) return
        haptic()
        if (editing) {
            if (trimmed === editing.content.trim()) return onCancelEdit()
            await onSubmitEdit(trimmed)
            return
        }
        setText('')
        const ok = await onSend(trimmed)
        if (!ok) setText((cur) => cur || trimmed)
    }

    const btn = 'h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.07] active:opacity-70'

    // Mic is defined once so it stays mounted while locked (the finger is still on it until release).
    // The wrapper has the same 44px box as every other button so they all line up.
    const mic = (
        <View
            key="m"
            {...pan.panHandlers}
            className="h-11 w-11 items-center justify-center"
            style={phase === 'locked' ? { position: 'absolute', right: 0, bottom: 0, opacity: 0 } : undefined}
        >
            <Animated.View
                style={micScale}
                className={`h-11 w-11 items-center justify-center rounded-full border ${phase === 'recording' ? 'border-red-400 bg-red-500' : 'border-white/10 bg-white/[0.07]'}`}
            >
                <Ionicons name="mic" size={20} color={phase === 'recording' ? '#fff' : ICON} />
            </Animated.View>
            {phase === 'recording' && (
                <Animated.View style={lockStyle} pointerEvents="none" className="absolute -top-28 left-0 h-[88px] w-11 items-center justify-start rounded-full border border-white/10 bg-neutral-900 pt-3">
                    <Ionicons name="lock-closed" size={16} color="#e5e5e5" />
                    <Ionicons name="chevron-up" size={14} color="#737373" style={{ marginTop: 4 }} />
                </Animated.View>
            )}
        </View>
    )

    /* ---------- left part ---------- */
    let left: React.ReactNode
    if (phase === 'recording') {
        left = (
            <Animated.View entering={FadeInUp.duration(150)} className="h-11 flex-1 flex-row items-center gap-3 rounded-full border border-red-400/20 bg-red-500/10 px-4">
                <Animated.View style={dotStyle} className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <Text className="text-[15px] font-semibold text-white">{clock(secs)}</Text>
                <Animated.View style={slideStyle} className="flex-1 flex-row items-center justify-center gap-1">
                    <Ionicons name="chevron-back" size={14} color="#a3a3a3" />
                    <Text className="text-[13px] text-neutral-400">Slide to cancel</Text>
                </Animated.View>
            </Animated.View>
        )
    } else if (phase === 'locked') {
        left = (
            <Animated.View entering={FadeInUp.duration(150)} className="h-11 flex-1 flex-row items-center gap-3 rounded-full border border-red-400/20 bg-red-500/10 pl-1.5 pr-3">
                <Pressable onPress={() => { haptic(); finish('discard') }} hitSlop={8} accessibilityLabel="Delete recording" className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                    <Ionicons name="trash-outline" size={18} color="#f87171" />
                </Pressable>
                <Animated.View style={dotStyle} className="h-2.5 w-2.5 rounded-full bg-red-500" />
                <Text className="flex-1 text-[15px] font-semibold text-white">{clock(secs)}</Text>
                <Pressable onPress={() => finish('review')} hitSlop={8} accessibilityLabel="Stop and review" className="h-9 w-9 items-center justify-center rounded-full bg-white/10 active:opacity-70">
                    <Ionicons name="stop" size={16} color="#fff" />
                </Pressable>
            </Animated.View>
        )
    } else if (phase === 'review' && pending) {
        left = (
            <Animated.View entering={FadeInUp.duration(150)} className="flex-1">
                <VoiceNotePreview uri={pending.uri} duration={pending.duration} onRemove={() => { setPending(null); setPhase('idle') }} />
            </Animated.View>
        )
    } else {
        left = (
            <>
                {!editing && (
                    <Pressable onPress={onAttach} accessibilityLabel="Attach" className={btn}>
                        <Ionicons name="add" size={24} color={ICON} />
                    </Pressable>
                )}
                <Animated.View
                    layout={LinearTransition.springify().damping(18)}
                    className="min-h-[44px] flex-1 flex-row items-end rounded-[24px] border border-white/10 bg-white/[0.06] pl-4 pr-1.5"
                >
                    <TextInput
                        ref={inputRef}
                        value={text}
                        onChangeText={setText}
                        multiline
                        placeholder="Message..."
                        placeholderTextColor="#737373"
                        textAlignVertical="center"
                        selectionColor="#38bdf8"
                        className="max-h-28 min-h-[44px] flex-1 py-2.5 text-[15px] text-gray-100"
                    />
                    {!hasText && !editing && (
                        <Animated.View entering={ZoomIn.duration(140)} exiting={ZoomOut.duration(120)}>
                            <Pressable onPress={onCamera} hitSlop={6} accessibilityLabel="Camera" className="mb-[3px] h-[38px] w-[38px] items-center justify-center rounded-full active:bg-white/10">
                                <Ionicons name="camera-outline" size={22} color={ICON} />
                            </Pressable>
                        </Animated.View>
                    )}
                </Animated.View>
            </>
        )
    }

    /* ---------- right part ---------- */
    const sendBtn = (onPress: () => void, icon: any, key: string) => (
        <Animated.View key={key} entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(100)}>
            <Pressable onPress={onPress} accessibilityLabel="Send" className="h-11 w-11 items-center justify-center rounded-full bg-sky-500 active:opacity-80">
                <Ionicons name={icon} size={19} color="#fff" style={icon === 'send' ? { marginLeft: 2 } : undefined} />
            </Pressable>
        </Animated.View>
    )

    let right: React.ReactNode
    if (phase === 'review' && pending) {
        right = sendBtn(() => { onSendVoice({ kind: 'voice', uri: pending.uri, duration: pending.duration }); setPending(null); setPhase('idle') }, 'send', 'rs')
    } else if (phase === 'locked') {
        right = [mic, sendBtn(() => finish('send'), 'send', 'ls')]
    } else if (hasText) {
        right = sendBtn(submit, editing ? 'checkmark' : 'send', 'ts')
    } else if (editing) {
        right = (
            <Pressable key="ce" onPress={onCancelEdit} className={btn}><Ionicons name="close" size={20} color={ICON} /></Pressable>
        )
    } else {
        right = [
            phase === 'idle' ? (
                <Animated.View key="q" entering={ZoomIn.duration(150)} exiting={ZoomOut.duration(100)} className="h-11 items-center justify-center">
                    <QuickChats currentId={contactId} onHint={onHint} />
                </Animated.View>
            ) : null,
            mic,
        ]
    }

    return (
        <Animated.View className="border-t border-white/10 bg-neutral-950/95 px-3 pt-2.5" style={wrapStyle}>
            {hintText && (
                <Animated.View
                    entering={FadeInDown.duration(160)}
                    exiting={FadeOut.duration(140)}
                    pointerEvents="none"
                    style={{ position: 'absolute', top: -40, right: 12, zIndex: 60 }}
                    className="rounded-full border border-white/10 bg-neutral-800/95 px-3.5 py-2"
                >
                    <Text className="text-[12.5px] font-medium text-gray-200">{hintText}</Text>
                </Animated.View>
            )}
            {editing && (
                <Animated.View entering={FadeInUp.duration(160)} className="mb-2 flex-row items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2">
                    <Ionicons name="pencil" size={14} color="#38bdf8" />
                    <View className="flex-1">
                        <Text className="text-[11px] font-semibold text-sky-400">Editing message</Text>
                        <Text numberOfLines={1} className="text-[12px] text-gray-400">{editing.content}</Text>
                    </View>
                    <Pressable onPress={onCancelEdit} hitSlop={10} accessibilityLabel="Cancel edit">
                        <Ionicons name="close" size={18} color="#a3a3a3" />
                    </Pressable>
                </Animated.View>
            )}
            <View className="flex-row items-end gap-2">
                {left}
                {right}
            </View>
        </Animated.View>
    )
})