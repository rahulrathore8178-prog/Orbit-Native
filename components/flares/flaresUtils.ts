import { formatPostTime, formatTimeAgo, withHost } from '@/components/services/feed/postUtils';
import { API_URL, getDisplayImageUrl } from '@/lib/utils';
import type { FlarePost } from '../../constants/flares/types';

export type FlareMediaInfo = { type: 'video' | 'image'; uri: string; ratio: number | null };

/** Only posts with a video, or an image (and no voice note), can open as a flare. */
export const isFlareEligible = (p: FlarePost) =>
    Boolean(p.video) || (Boolean(p.image) && !p.voiceNote);

export function resolveMedia(p: FlarePost): FlareMediaInfo | null {
    const ratio = p.mediaWidth && p.mediaHeight ? p.mediaWidth / p.mediaHeight : null;
    if (p.video) {
        const uri = withHost(p.video);
        return uri ? { type: 'video', uri, ratio } : null;
    }
    if (p.image && !p.voiceNote) {
        const uri = p.image.startsWith('/') ? `${API_URL}${p.image}` : getDisplayImageUrl(p.image);
        return uri ? { type: 'image', uri, ratio } : null;
    }
    return null;
}

const TAG = /#[^\s#]+/g;

/** Caption without the #tags, plus the tags (from the hashtags field, or parsed from the text). */
export function splitCaption(p: FlarePost) {
    const text = p.content ?? '';
    const tags = p.hashtags?.length ? p.hashtags : (text.match(TAG) ?? []).map((t) => t.slice(1));
    const caption = text.replace(TAG, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    return { caption, tags: tags.slice(0, 8) };
}

// export const flareTimeAgo = (p: FlarePost) => `${formatTimeAgo(p.createdAt)} ago`;

export const flareTimeAgo = (p: FlarePost) => formatPostTime(p.createdAt);