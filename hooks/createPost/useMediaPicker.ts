import * as ImagePicker from 'expo-image-picker';
import { useCallback } from 'react';
import {
    ALLOWED_IMAGE_TYPES,
    ALLOWED_VIDEO_TYPES,
    MAX_IMAGE_SIZE,
    MAX_VIDEO_SIZE,
    resolveMime,
} from '../../constants/createPost/external';
import { VIDEO_MAX_SECONDS } from '../../constants/createPost/constants';
import { setError, setMedia } from '../../redux/slice/createPost/createPostSlice';
import { useCreatePostDispatch } from '@/redux/slice/createPost/hooks';

const mb = (bytes: number) => Math.round(bytes / (1024 * 1024));

/**
 * Gallery, camera photo and camera video, with permission + size/type validation.
 * Results go straight into redux (`setMedia` / `setError`).
 * `voiceActive` blocks attaching media while a voice note exists (dormant until voice is enabled).
 */
export function useMediaPicker(voiceActive = false) {
  const dispatch = useCreatePostDispatch();

  const accept = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      if (voiceActive) return dispatch(setError('Remove your voice note before attaching an image or video'));

      const kind: 'image' | 'video' = asset.type === 'video' ? 'video' : 'image';
      const mime = resolveMime(asset.uri, kind, asset.mimeType);
      const allowed = kind === 'video' ? ALLOWED_VIDEO_TYPES : ALLOWED_IMAGE_TYPES;
      if (!allowed.includes(mime)) return dispatch(setError(`Unsupported type: ${mime}`));

      const max = kind === 'video' ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
      if (asset.fileSize && asset.fileSize > max) {
        return dispatch(setError(`${kind === 'video' ? 'Video' : 'Image'} must be under ${mb(max)}MB`));
      }

      dispatch(
        setMedia({
          uri: asset.uri,
          kind,
          mime,
          name: asset.fileName ?? `upload.${mime.split('/')[1] ?? 'jpg'}`,
        }),
      );
    },
    [dispatch, voiceActive],
  );

  const pickFromGallery = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (!res.canceled && res.assets[0]) accept(res.assets[0]);
  }, [accept]);

  const capture = useCallback(
    async (mode: 'photo' | 'video') => {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return dispatch(setError('Camera permission denied'));
      const res = await ImagePicker.launchCameraAsync(
        mode === 'video'
          ? { mediaTypes: ['videos'], videoMaxDuration: VIDEO_MAX_SECONDS, quality: 0.9 }
          : { mediaTypes: ['images'], quality: 0.9 },
      );
      if (!res.canceled && res.assets[0]) accept(res.assets[0]);
    },
    [accept, dispatch],
  );

  const takePhoto = useCallback(() => capture('photo'), [capture]);
  const recordVideo = useCallback(() => capture('video'), [capture]);

  return { pickFromGallery, takePhoto, recordVideo };
}
