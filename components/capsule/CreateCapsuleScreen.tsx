import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { capsuleApi } from '../services/capsule/capsuleApi';
import { CropEditor, CropEditorHandle } from './CropEditor';
import { Avatar } from '../ui/capsule/Avatar';
import { GlassPanel } from '../ui/capsule/GlassPanel';
import { NeoButton } from '../ui/capsule/NeoButton';
import { CAPSULE, COLORS } from '../../constants/capsule/constants';
import { useCurrentUser } from '../../hooks/capsule/useCurrentUser';

interface Picked {
  uri: string;
  width: number;
  height: number;
}

const CAPTION_MAX = 300; // match your backend/schema limit if it has one

export default function CreateCapsuleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const me = useCurrentUser();
  const cropRef = useRef<CropEditorHandle>(null);

  const [asset, setAsset] = useState<Picked | null>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [bodyH, setBodyH] = useState(0);

  // keyboard visibility (drops the bottom inset while the keyboard is up)
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const h = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      s.remove();
      h.remove();
    };
  }, []);

  // frame that matches the saved aspect ratio
  const HEADER = 64;
  const CAPTION_H = 52;
  const BUTTONS_H = 84;
  const FOOTER = CAPTION_H + BUTTONS_H;
  const availH = H - insets.top - insets.bottom - HEADER - FOOTER - 8;
  const availW = W - 40;
  const frameH = Math.min(availH, availW / CAPSULE.CROP_ASPECT);
  const frameW = frameH * CAPSULE.CROP_ASPECT;

  // when the keyboard squeezes the body, shrink the frame visually instead of clipping it
  const bodyScale = bodyH > 0 ? Math.min(1, (bodyH - 8) / frameH) : 1;

  const accept = (res: ImagePicker.ImagePickerResult) => {
    if (res.canceled || !res.assets?.[0]) return;
    const a = res.assets[0];
    setAsset({ uri: a.uri, width: a.width, height: a.height });
  };

  const pickCamera = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Camera access needed', 'Allow camera access in Settings to take a capsule.');
      return;
    }
    accept(await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1 }));
  };

  const pickGallery = async () => {
    accept(await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 }));
  };

  const rotate = async () => {
    if (!asset || busy) return;
    setBusy(true);
    try {
      const ctx = ImageManipulator.manipulate(asset.uri);
      ctx.rotate(90);
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 1 });
      setAsset({ uri: out.uri, width: out.width, height: out.height });
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!asset || busy || !cropRef.current) return;
    Keyboard.dismiss();
    setBusy(true);
    setProgress(0);
    try {
      const crop = cropRef.current.getCrop();
      const ctx = ImageManipulator.manipulate(asset.uri);
      ctx.crop(crop);
      if (crop.width > CAPSULE.OUTPUT_WIDTH) ctx.resize({ width: CAPSULE.OUTPUT_WIDTH });
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

      await capsuleApi.create({ uri: out.uri, caption: caption.trim() }, setProgress);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back(); // the feed refetches on focus
    } catch {
      Alert.alert('Could not post your capsule', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <View style={{ flex: 1, paddingTop: insets.top }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          {/* header */}
          <View className="flex-row items-center justify-between px-5" style={{ height: HEADER }}>
            <NeoButton
              icon={asset ? 'arrow-back' : 'close'}
              size={40}
              onPress={() => {
                Keyboard.dismiss();
                if (asset && !busy) {
                  setAsset(null);
                  setCaption('');
                } else {
                  router.back();
                }
              }}
              accessibilityLabel={asset ? 'Choose another photo' : 'Close'}
            />
            <Text className="text-[16px] font-semibold text-white">New capsule</Text>
            <View style={{ width: 40 }} />
          </View>

          {/* body */}
          <View
            className="flex-1 items-center justify-center"
            onLayout={(e) => setBodyH(e.nativeEvent.layout.height)}
          >
            {asset ? (
              <View style={{ transform: [{ scale: bodyScale }] }}>
                <CropEditor
                  key={asset.uri}
                  ref={cropRef}
                  uri={asset.uri}
                  imageWidth={asset.width}
                  imageHeight={asset.height}
                  frameWidth={frameW}
                  frameHeight={frameH}
                  radius={CAPSULE.VIEWER_RADIUS}
                />
              </View>
            ) : (
              <GlassPanel
                intensity={30}
                style={{ width: frameW, height: frameH, borderRadius: frameW / 2, alignItems: 'center' }}
              >
                <View className="items-center pt-7">
                  <Avatar uri={me?.avatar} size={46} />
                  <Text className="mt-2 text-[13px] font-semibold text-neutral-300">
                    @{me?.username ?? ''}
                  </Text>
                </View>
                <View className="flex-1 items-center justify-center">
                  <NeoButton
                    icon="camera-outline"
                    size={72}
                    onPress={pickCamera}
                    accessibilityLabel="Open camera"
                  />
                  <Text className="mt-5 text-[16px] text-white">Share something with us…</Text>
                  <Pressable
                    onPress={pickGallery}
                    accessibilityRole="button"
                    className="mt-5 flex-row items-center rounded-full px-5 py-2.5"
                    style={{ backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: COLORS.glassBorder }}
                  >
                    <Ionicons name="images-outline" size={16} color={COLORS.text} />
                    <Text className="ml-2 text-[14px] text-neutral-200">Choose from gallery</Text>
                  </Pressable>
                </View>
                <View style={{ height: 40 }} />
              </GlassPanel>
            )}
          </View>

          {/* footer */}
          <View
            style={{
              minHeight: FOOTER,
              paddingBottom: keyboardOpen ? 10 : insets.bottom,
            }}
          >
            {asset ? (
              <>
                {/* caption */}
                <View className="px-5" style={{ height: CAPTION_H, justifyContent: 'center' }}>
                  <View
                    className="flex-row items-center rounded-full px-4"
                    style={{
                      minHeight: 44,
                      backgroundColor: 'rgba(255,255,255,0.06)',
                      borderWidth: 1,
                      borderColor: COLORS.glassBorder,
                    }}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={17} color={COLORS.text} />
                    <TextInput
                      value={caption}
                      onChangeText={setCaption}
                      editable={!busy}
                      placeholder="Add a caption…"
                      placeholderTextColor="#737373"
                      maxLength={CAPTION_MAX}
                      multiline
                      returnKeyType="done"
                      submitBehavior="blurAndSubmit"
                      selectionColor={COLORS.accent}
                      className="ml-2.5 flex-1 text-[14px] text-white"
                      style={{ maxHeight: 72, paddingVertical: Platform.OS === 'ios' ? 10 : 6 }}
                    />
                    {caption.length > CAPTION_MAX - 60 && (
                      <Text className="ml-2 text-[11px] text-neutral-500">
                        {CAPTION_MAX - caption.length}
                      </Text>
                    )}
                  </View>
                </View>

                {/* actions */}
                <View
                  className="flex-row items-center justify-between px-6"
                  style={{ height: BUTTONS_H }}
                >
                  <View className="flex-row" style={{ gap: 14 }}>
                    <NeoButton
                      icon="contract-outline"
                      onPress={() => cropRef.current?.reset()}
                      disabled={busy}
                      accessibilityLabel="Reset crop"
                    />
                    <NeoButton
                      icon="refresh-outline"
                      onPress={rotate}
                      disabled={busy}
                      accessibilityLabel="Rotate 90 degrees"
                    />
                  </View>

                  <Pressable
                    onPress={submit}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Set capsule"
                    style={{
                      height: 52,
                      minWidth: 168,
                      borderRadius: 26,
                      shadowColor: '#000',
                      shadowOffset: { width: 4, height: 4 },
                      shadowOpacity: 0.9,
                      shadowRadius: 8,
                      elevation: 8,
                      backgroundColor: COLORS.neoBottom,
                    }}
                  >
                    <LinearGradient
                      colors={[COLORS.neoTop, COLORS.neoBottom]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{
                        flex: 1,
                        borderRadius: 26,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 1,
                        borderColor: 'rgba(255,255,255,0.09)',
                      }}
                    >
                      {busy ? (
                        <>
                          <ActivityIndicator color={COLORS.text} />
                          <Text className="ml-2 text-[15px] font-semibold text-white">
                            {progress > 0 ? `${progress}%` : 'Posting…'}
                          </Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="checkmark" size={20} color={COLORS.accent} />
                          <Text className="ml-2 text-[15px] font-semibold text-white">Set capsule</Text>
                        </>
                      )}
                    </LinearGradient>
                  </Pressable>
                </View>
              </>
            ) : (
              <Text className="px-10 pt-4 text-center text-[12px] text-neutral-600">
                You&apos;ll be able to crop and position your photo next.
              </Text>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </GestureHandlerRootView>
  );
}