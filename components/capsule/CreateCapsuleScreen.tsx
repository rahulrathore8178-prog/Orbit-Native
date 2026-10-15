import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
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

export default function CreateCapsuleScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const me = useCurrentUser();
  const cropRef = useRef<CropEditorHandle>(null);

  const [asset, setAsset] = useState<Picked | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // frame that matches the saved aspect ratio
  const HEADER = 64;
  const FOOTER = 124;
  const availH = H - insets.top - insets.bottom - HEADER - FOOTER - 8;
  const availW = W - 40;
  const frameH = Math.min(availH, availW / CAPSULE.CROP_ASPECT);
  const frameW = frameH * CAPSULE.CROP_ASPECT;

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
    setBusy(true);
    setProgress(0);
    try {
      const crop = cropRef.current.getCrop();
      const ctx = ImageManipulator.manipulate(asset.uri);
      ctx.crop(crop);
      if (crop.width > CAPSULE.OUTPUT_WIDTH) ctx.resize({ width: CAPSULE.OUTPUT_WIDTH });
      const rendered = await ctx.renderAsync();
      const out = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });

      await capsuleApi.create({ uri: out.uri }, setProgress);
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
        {/* header */}
        <View className="flex-row items-center justify-between px-5" style={{ height: HEADER }}>
          <NeoButton
            icon={asset ? 'arrow-back' : 'close'}
            size={40}
            onPress={() => (asset && !busy ? setAsset(null) : router.back())}
            accessibilityLabel={asset ? 'Choose another photo' : 'Close'}
          />
          <Text className="text-[16px] font-semibold text-white">New capsule</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* body */}
        <View className="flex-1 items-center justify-center">
          {asset ? (
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

        {/* footer — only while cropping */}
        <View style={{ height: FOOTER + insets.bottom, paddingBottom: insets.bottom }}>
          {asset ? (
            <View className="flex-1 flex-row items-center justify-between px-6">
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
          ) : (
            <Text className="px-10 pt-4 text-center text-[12px] text-neutral-600">
              You&apos;ll be able to crop and position your photo next.
            </Text>
          )}
        </View>
      </View>
    </GestureHandlerRootView>
  );
}
