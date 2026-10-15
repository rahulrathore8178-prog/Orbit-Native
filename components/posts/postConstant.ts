export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/heic', 'image/heif'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov'];
export const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8MB
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB, match your multer limit
export const MAX_RECORDING_SECONDS = 120;
export const MAX_CAPTION = 2000;

export type PostTarget = 'feed' | 'orbital';
export type PostType = PostTarget | 'both';

export const POST_TYPES: { value: PostType; label: string }[] = [
    { value: 'feed', label: 'Feed' },
    { value: 'orbital', label: 'Orbital' },
    { value: 'both', label: 'Both' },
];

const EXT_MIME: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
};

/** Picker assets don't always carry a mimeType, so fall back to the file extension. */
export function resolveMime(uri: string, kind: 'image' | 'video', given?: string | null) {
    if (given) return given;
    const ext = uri.split('?')[0].split('.').pop()?.toLowerCase() ?? '';
    return EXT_MIME[ext] ?? (kind === 'video' ? 'video/mp4' : 'image/jpeg');
}

export const ANALYSIS_PROMPT = `You are the content-understanding engine of a social media recommendation system.
Input: a post's media (image, or frames sampled from a video) plus optional caption,
hashtags, and speech transcript. Analyze what the post is actually about and return
ONE JSON object. Output only JSON: no markdown, no code fences, no commentary.
Also sending post_id along with it, attach it into the schema too.

Schema:
{
  "summary": string,        // 1-2 factual sentences: what is shown, said, and taught
  "language": string,       // ISO 639-1 code of the main spoken/written language, "none" if no language
  "format": string,         // one of: tutorial, demo, meme, skit, news, opinion, vlog, showcase, promo, other
  "topics": { string: number },   // topic -> relevance
  "attributes": { "educational": number, "entertainment": number, "motivational": number, "emotional": number , "technology": number},
  "keywords": [string],     // 5-10 specific lowercase terms (tools, concepts, entities), no generic words
  "safety": { "nsfw": number, "violence": number, "hate": number }
}

Rules:
- All scores are 0.00-1.00 with two decimals. They are independent and need not sum to 1.
  0 = absent, 0.5 = present but secondary, 1 = dominant theme.
- topics: use ONLY these labels: technology, ai, programming, gaming, comedy, education,
  science, business, finance, fitness, health, food, travel, music, sports, fashion, art,
  news, politics, lifestyle, other. Include only topics scoring >= 0.30, at most 5.
- Judge from visible content, on-screen text, transcript, and caption. If media and caption
  disagree, trust the media. Never invent details or identify people from their faces.
- If unsure, lower the score rather than guess.
- The output must parse with json.loads.`;