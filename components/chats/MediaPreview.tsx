import { MediaDraft } from '@/hooks/chats/useChat'
import { Ionicons } from '@expo/vector-icons'
import { Image } from 'expo-image'
import { useVideoPlayer, VideoView } from 'expo-video'
import React, { useEffect, useState } from 'react'
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

function PreviewVideo({ uri }: { uri: string }) {
    const player = useVideoPlayer(uri, (p) => { p.loop = true })
    return <VideoView player={player} nativeControls contentFit="contain" style={{ flex: 1 }} />
}

/** Review screen: look at the photo/video, add a caption, then send. */
export function MediaPreview({ draft, onCancel, onSend }: {
    draft: MediaDraft | null
    onCancel: () => void
    onSend: (d: MediaDraft) => void
}) {
    const insets = useSafeAreaInsets()
    const [caption, setCaption] = useState('')
    useEffect(() => setCaption(''), [draft?.uri])

    return (
        <Modal visible={!!draft} animationType="slide" statusBarTranslucent onRequestClose={onCancel}>
            <KeyboardAvoidingView behavior="padding" className="flex-1 bg-black">
                <View className="flex-1">
                    {draft?.kind === 'video' && draft.uri ? (
                        <PreviewVideo uri={draft.uri} />
                    ) : draft?.uri ? (
                        <Image source={{ uri: draft.uri }} contentFit="contain" style={{ flex: 1 }} />
                    ) : null}
                    <Pressable
                        onPress={onCancel}
                        hitSlop={10}
                        accessibilityLabel="Cancel"
                        style={{ top: insets.top + 10 }}
                        className="absolute left-4 h-11 w-11 items-center justify-center rounded-full bg-black/60"
                    >
                        <Ionicons name="close" size={22} color="#fff" />
                    </Pressable>
                </View>

                <View className="flex-row items-end gap-2 bg-black/90 px-3 pt-2.5" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
                    <View className="min-h-[46px] flex-1 justify-center rounded-3xl border border-white/10 bg-white/[0.07] px-4">
                        <TextInput
                            value={caption}
                            onChangeText={setCaption}
                            placeholder="Add a caption…"
                            placeholderTextColor="#8a8a8e"
                            multiline
                            maxLength={1000}
                            className="max-h-28 py-2.5 text-[15px] text-gray-100"
                        />
                    </View>
                    <Pressable
                        onPress={() => draft && onSend({ ...draft, text: caption.trim() })}
                        accessibilityLabel="Send"
                        className="h-[46px] w-[46px] items-center justify-center rounded-full bg-sky-500 active:opacity-80"
                    >
                        <Ionicons name="send" size={19} color="#fff" style={{ marginLeft: 2 }} />
                    </Pressable>
                </View>
                {draft?.kind === 'video' && !!draft.duration && (
                    <Text className="absolute right-4 text-xs font-semibold text-white/80" style={{ top: insets.top + 24 }}>
                        {Math.floor(draft.duration / 60)}:{String(Math.floor(draft.duration % 60)).padStart(2, '0')}
                    </Text>
                )}
            </KeyboardAvoidingView>
        </Modal>
    )
}