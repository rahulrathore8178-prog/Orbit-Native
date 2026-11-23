import * as ImageManipulator from 'expo-image-manipulator';
import { Image as RNImage, Platform } from 'react-native';
import type { PickedMedia } from '../../../constants/createPost/types';

/**
 * Client-side compression so the raw file never hits your server.
 *
 * Image presets:
 *  - post:     the backend runs sharp().resize(800x800 inside).webp(85) anyway, so anything
 *              bigger than 800px is pure wasted bandwidth. We send 800px at JPEG q0.92 so the
 *              server's re-encode starts from a near-lossless source (no visible quality loss).
 *  - analysis: smaller/lighter copy for the VLM describe endpoint.
 */
const PRESETS = {
    post: { edge: 800, quality: 0.92 },
    analysis: { edge: 768, quality: 0.8 },
} as const;
export type ImagePreset = keyof typeof PRESETS;

const cache = new Map<string, Promise<PickedMedia>>();

const getSize = (uri: string) =>
    new Promise<{ width: number; height: number }>((resolve, reject) =>
        RNImage.getSize(uri, (width, height) => resolve({ width, height }), reject),
    );

const swapExt = (name: string, ext: string) =>
    `${name.replace(/\.[^./\\]+$/, '') || 'media'}.${ext}`;

/** Resize (longest edge) + re-encode to JPEG. Also converts HEIC/PNG/WebP and strips EXIF/GPS. */
export function prepareImage(img: PickedMedia, preset: ImagePreset = 'post'): Promise<PickedMedia> {
    const key = `img:${preset}:${img.uri}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const job = (async () => {
        try {
            const { edge, quality } = PRESETS[preset];
            const anyImg = img as any;
            const { width, height } =
                anyImg.width && anyImg.height ? { width: anyImg.width, height: anyImg.height } : await getSize(img.uri);

            const actions: ImageManipulator.Action[] = [];
            if (Math.max(width, height) > edge) {
                actions.push({ resize: width >= height ? { width: edge } : { height: edge } });
            }

            const out = await ImageManipulator.manipulateAsync(img.uri, actions, {
                compress: quality,
                format: ImageManipulator.SaveFormat.JPEG,
            });
            return { ...img, uri: out.uri, name: swapExt(img.name, 'jpg'), mime: 'image/jpeg' } as PickedMedia;
        } catch (e) {
            console.warn('Image compression failed, sending original', e);
            return img;
        }
    })();

    cache.set(key, job);
    return job;
}

/** Native only (react-native-compressor has no web implementation). Output is H.264 MP4. */
export function prepareVideo(video: PickedMedia, onProgress?: (p: number) => void): Promise<PickedMedia> {
    if (Platform.OS === 'web') return Promise.resolve(video);

    const key = `vid:${video.uri}`;
    const hit = cache.get(key);
    if (hit) return hit;

    const job = (async () => {
        try {
            const { Video } = require('react-native-compressor');
            const uri: string = await Video.compress(
                video.uri,
                { compressionMethod: 'auto', maxSize: 1280, minimumFileSizeForCompress: 3 },
                onProgress,
            );
            return { ...video, uri, name: swapExt(video.name, 'mp4'), mime: 'video/mp4' } as PickedMedia;
        } catch (e) {
            console.warn('Video compression failed, sending original', e);
            return video;
        }
    })();

    cache.set(key, job);
    return job;
}

/** Picks the right compressor for the media kind. Voice notes are already AAC/Opus, left alone. */
export async function prepareMedia(media: PickedMedia | null, onProgress?: (p: number) => void) {
    if (!media) return null;
    if (media.kind === 'image') return prepareImage(media, 'post');
    if (media.kind === 'video') return prepareVideo(media, onProgress);
    return media;
}

/** Call after a post is finished so cached temp results don't pile up in memory. */
export const clearMediaCache = () => cache.clear();