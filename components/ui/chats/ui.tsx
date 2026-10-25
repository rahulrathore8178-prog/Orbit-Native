import { Ionicons } from '@expo/vector-icons'
import { LinearGradient } from 'expo-linear-gradient'
import React, { ComponentProps, memo, ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { Image, Modal, Platform, Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInDown, FadeOutDown, SlideInDown } from 'react-native-reanimated'
import { captureScreen } from 'react-native-view-shot'

export type IconName = ComponentProps<typeof Ionicons>['name']

// ---------- Glass panel (custom frosted glass, no native blur needed) ----------
// Add your own border/radius via className, e.g. "rounded-2xl border border-white/10".
// `intensity` (0-100) controls how opaque/frosted the panel is.

export function Glass({
  children,
  className = '',
  intensity = 40,
  style,
}: {
  children?: ReactNode
  className?: string
  intensity?: number
  style?: StyleProp<ViewStyle>
}) {
  // 40 -> ~0.72 alpha. Higher intensity = more frosted/opaque.
  const alpha = Math.min(0.92, 0.55 + (intensity / 100) * 0.42)

  const webBlur =
    Platform.OS === 'web'
      ? ({ backdropFilter: `blur(${intensity / 2}px) saturate(140%)`, WebkitBackdropFilter: `blur(${intensity / 2}px) saturate(140%)` } as any)
      : null

  return (
    <View
      className={`overflow-hidden ${className}`}
      style={[{ backgroundColor: `rgba(28,28,32,${alpha})` }, webBlur, style]}
    >
      {/* diagonal light sheen: bright top-left, dark middle, soft bounce at the bottom */}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.16)', 'rgba(255,255,255,0.03)', 'rgba(255,255,255,0.07)']}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* top specular edge */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 12,
          right: 12,
          height: StyleSheet.hairlineWidth * 2,
          backgroundColor: 'rgba(255,255,255,0.28)',
        }}
      />
      {children}
    </View>
  )
}

// ---------- Neumorphic round icon button ----------

export const IconButton = memo(function IconButton({
  name,
  onPress,
  color = '#e5e5e5',
  size = 20,
  compact = false,
  solid = false,
}: {
  name: IconName
  onPress?: () => void
  color?: string
  size?: number
  compact?: boolean
  /** filled blue style (used for the send button) */
  solid?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      className={`items-center justify-center rounded-full border shadow-lg shadow-black ${compact ? 'h-9 w-9' : 'h-10 w-10'
        } ${solid
          ? 'border-blue-400/30 bg-blue-600 active:bg-blue-700'
          : 'border-white/5 border-t-white/15 bg-neutral-900 active:bg-neutral-800'
        }`}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  )
})

// ---------- Avatar (falls back to the first letter if there is no picture or it fails to load) ----------

export const Avatar = memo(function Avatar({
  uri,
  name,
  className = 'h-12 w-12',
}: {
  uri?: string
  name?: string
  className?: string
}) {
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [uri])

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        onError={() => setFailed(true)}
        className={`rounded-full border border-white/10 bg-neutral-800 ${className}`}
      />
    )
  }
  return (
    <View className={`items-center justify-center rounded-full border border-white/10 bg-neutral-800 ${className}`}>
      <Text className="text-base font-semibold text-gray-300">{name?.[0]?.toUpperCase() ?? '?'}</Text>
    </View>
  )
})

// ---------- Bottom action sheet (long-press menus, attachments, ...) ----------

export type SheetOption = {
  label: string
  icon: IconName
  destructive?: boolean
  onPress: () => void
}

/**
 * Open the sheet with this hook so a screenshot is taken BEFORE the modal appears.
 * That screenshot is blurred and used as the real blurred backdrop.
 *
 *   const sheet = useActionSheet()
 *   <Pressable onLongPress={sheet.open} />
 *   <ActionSheet visible={sheet.visible} backdrop={sheet.backdrop} onClose={sheet.close} options={...} />
 */
export function useActionSheet() {
  const [state, setState] = useState<{ visible: boolean; backdrop?: string }>({ visible: false })

  const open = useCallback(async () => {
    let backdrop: string | undefined
    try {
      backdrop = await captureScreen({ format: 'jpg', quality: 0.5, result: 'tmpfile' })
    } catch {
      // web / capture failed -> sheet still works with the frosted fallback
    }
    setState({ visible: true, backdrop })
  }, [])

  const close = useCallback(() => setState((s) => ({ ...s, visible: false })), [])

  return { visible: state.visible, backdrop: state.backdrop, open, close }
}

export function ActionSheet({
  visible,
  title,
  options,
  onClose,
  backdrop,
}: {
  visible: boolean
  title?: string
  options: SheetOption[]
  onClose: () => void
  /** screenshot uri from useActionSheet(); blurred and shown behind the sheet */
  backdrop?: string
}) {
  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Animated.View entering={FadeIn.duration(180)} style={StyleSheet.absoluteFill}>
          {!!backdrop && (
            <Image
              source={{ uri: backdrop }}
              blurRadius={Platform.OS === 'android' ? 18 : 25}
              resizeMode="cover"
              style={StyleSheet.absoluteFill}
            />
          )}
          <View
            style={[StyleSheet.absoluteFill, { backgroundColor: backdrop ? 'rgba(0,0,0,0.45)' : 'rgba(0,0,0,0.65)' }]}
          />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View entering={SlideInDown.duration(260)} className="gap-2 px-3 pb-8">
          <Glass intensity={backdrop ? 30 : 60} className="rounded-3xl border border-white/15">
            {!!title && (
              <Text numberOfLines={2} className="px-5 pb-1 pt-4 text-center text-[13px] text-gray-400">
                {title}
              </Text>
            )}
            {options.map((o, i) => (
              <Pressable
                key={o.label}
                onPress={() => {
                  onClose()
                  o.onPress()
                }}
                className={`flex-row items-center gap-3 px-5 py-4 active:bg-white/10 ${i > 0 || title ? 'border-t border-white/10' : ''
                  }`}
              >
                <Ionicons name={o.icon} size={20} color={o.destructive ? '#f87171' : '#e5e5e5'} />
                <Text className={`text-[15px] font-medium ${o.destructive ? 'text-red-400' : 'text-gray-100'}`}>
                  {o.label}
                </Text>
              </Pressable>
            ))}
          </Glass>

          <Pressable
            onPress={onClose}
            className="items-center rounded-2xl border border-white/5 border-t-white/15 bg-neutral-900 py-4 shadow-lg shadow-black active:bg-neutral-800"
          >
            <Text className="text-[15px] font-semibold text-gray-100">Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}

export async function captureBackdrop(): Promise<string | undefined> {
  try {
    return await captureScreen({ format: 'jpg', quality: 0.5, result: 'tmpfile' })
  } catch {
    return undefined // web or capture failed -> sheet falls back to the frosted panel
  }
}
// ---------- Toast ----------

export type ToastVariant = 'info' | 'offline'
export type ToastData = { id: number; text: string; variant: ToastVariant }

/** State + auto-hide timer (2s) for the toast. */
export function useToast(duration = 2000) {
  const [toast, setToast] = useState<ToastData | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback(
    (text: string, variant: ToastVariant = 'info') => {
      if (timer.current) clearTimeout(timer.current)
      setToast({ id: Date.now(), text, variant })
      timer.current = setTimeout(() => setToast(null), duration)
    },
    [duration]
  )

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return { toast, showToast }
}

/** Absolutely positioned inside its parent. Pass e.g. className="bottom-32" to lift it above a tab bar. */
export function Toast({ toast, className = 'bottom-4' }: { toast: ToastData | null; className?: string }) {
  if (!toast) return null
  const offline = toast.variant === 'offline'
  return (
    <Animated.View
      key={toast.id}
      entering={FadeInDown.duration(220)}
      exiting={FadeOutDown.duration(220)}
      pointerEvents="none"
      className={`absolute inset-x-0 items-center px-6 ${className}`}
    >
      <Glass intensity={70} className="flex-row items-center gap-2 rounded-full border border-white/15 px-4 py-2.5">
        <Ionicons
          name={offline ? 'cloud-offline-outline' : 'information-circle-outline'}
          size={16}
          color={offline ? '#f87171' : '#d4d4d4'}
        />
        <Text className="shrink text-[13px] text-gray-100">{toast.text}</Text>
      </Glass>
    </Animated.View>
  )
}