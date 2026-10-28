import type { ImagePickerAsset } from 'expo-image-picker';
import type { Attachment } from '@/components/services/comments/commentsApi';

const MAX_EDGE = 1080;

/**
 * Resizes to 1080px and re-encodes as JPEG (usually 150-300KB) before upload.
 * Falls back to the original if expo-image-manipulator is not in this build yet;
 * the server shrinks it again either way.
 */
export async function prepareImage(asset: ImagePickerAsset): Promise<Extract<Attachment, { kind: 'image' }>> {
    let uri = asset.uri;
    let width = asset.width;
    let height = asset.height;
    let mime = asset.mimeType ?? 'image/jpeg';
    let name = asset.fileName ?? 'comment.jpg';

    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const M = require('expo-image-manipulator');
        const resize = Math.max(width, height) > MAX_EDGE ? (width >= height ? { width: MAX_EDGE } : { height: MAX_EDGE }) : null;

        let out: { uri: string; width: number; height: number };
        if (M.ImageManipulator?.manipulate) {
            const ctx = M.ImageManipulator.manipulate(uri);
            if (resize) ctx.resize(resize);
            const img = await ctx.renderAsync();
            out = await img.saveAsync({ format: M.SaveFormat.JPEG, compress: 0.75 });
        } else {
            out = await M.manipulateAsync(uri, resize ? [{ resize }] : [], { format: M.SaveFormat.JPEG, compress: 0.75 });
        }
        uri = out.uri;
        width = out.width;
        height = out.height;
        mime = 'image/jpeg';
        name = 'comment.jpg';
    } catch {
        /* native module not in this build yet */
    }
    return { kind: 'image', uri, mime, name, width, height };
}