import { TARGETS_BY_DESTINATION } from '@/constants/createPost/constants';
import axios from 'axios';
import { Platform } from 'react-native';
// [VLM DISABLED] ANALYSIS_PROMPT is only needed by analyzeImage
import { /* ANALYSIS_PROMPT, */ API_URL, getAuthHeaders } from '../../../constants/createPost/external';
import type { Destination, PickedMedia, PostTarget, SubmitResult, Voice } from '../../../constants/createPost/types';
// [VLM DISABLED] prepareImage is only needed by analyzeImage
import { /* prepareImage, */ prepareMedia } from './compressMedia';

/* ---------- helpers ---------- */
const AUDIO_EXT = Platform.OS === 'web' ? 'webm' : 'm4a';
const AUDIO_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';
const UPLOAD_TIMEOUT_MS = 120_000;

export const getErrorMessage = (e: unknown, fallback: string) =>
  (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ?? fallback;

/** Web: read each local uri once, even when posting to several orbitals. */
const blobCache = new Map<string, Promise<Blob>>();
const getBlob = (uri: string) => {
  let p = blobCache.get(uri);
  if (!p) {
    p = fetch(uri).then((r) => r.blob());
    blobCache.set(uri, p);
  }
  return p;
};

/** React Native appends {uri,name,type}; the web needs a real Blob. */
async function appendFile(form: FormData, field: string, file: { uri: string; name: string; type: string }) {
  if (Platform.OS === 'web') {
    form.append(field, await getBlob(file.uri), file.name);
  } else {
    form.append(field, file as any);
  }
}

async function buildForm(caption: string, media: PickedMedia | null, voice: Voice | null) {
  const form = new FormData();
  if (caption) form.append('content', caption);
  if (voice) {
    // [VOICE-NOTES] dormant: `voice` is always null until the feature is enabled
    await appendFile(form, 'media', { uri: voice.uri, name: `voice-note.${AUDIO_EXT}`, type: AUDIO_MIME });
    form.append('voiceNoteDuration', String(voice.duration));
  } else if (media) {
    await appendFile(form, 'media', { uri: media.uri, name: media.name, type: media.mime });
  }
  return form;
}

/* ---------- public API ---------- */
type SendArgs = {
  destination: Destination;
  caption: string;
  media: PickedMedia | null;
  voice: Voice | null;
  orbitalIds: string[];
};

type Job = { target: PostTarget; url: string };

/** One job per feed target, plus one per selected orbital. */
function buildJobs(destination: Destination, orbitalIds: string[]): Job[] {
  const uniqueOrbitals = [...new Set(orbitalIds)];
  return TARGETS_BY_DESTINATION[destination].flatMap((target): Job[] =>
    target === 'feed'
      ? [{ target, url: `${API_URL}/api/community/posts` }]
      : uniqueOrbitals.map((id) => ({ target, url: `${API_URL}/api/orbital/${id}/posts` })),
  );
}

/** Posts to every selected destination in parallel. Throws only if ALL of them failed. */
export async function sendPost({ destination, caption, media, voice, orbitalIds }: SendArgs): Promise<SubmitResult> {
  const jobs = buildJobs(destination, orbitalIds);
  if (!jobs.length) throw new Error('Select at least one orbital');

  // Compress ONCE (not per destination) before anything is uploaded.
  const [headers, prepared] = await Promise.all([
    Promise.resolve(getAuthHeaders()).then((h) => ({ ...h })),
    voice ? Promise.resolve(media) : prepareMedia(media),
  ]);

  try {
    const results = await Promise.allSettled(
      jobs.map(async ({ target, url }) => {
        const { data } = await axios.post(url, await buildForm(caption, prepared, voice), {
          withCredentials: true,
          headers,
          timeout: UPLOAD_TIMEOUT_MS,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
        return { target, post: data?.post };
      }),
    );

    const created = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
    const failed = results.flatMap((r, i) =>
      r.status === 'rejected' ? [{ target: jobs[i].target, message: getErrorMessage(r.reason, 'Post failed') }] : [],
    );

    if (!created.length) throw new Error(failed[0]?.message ?? 'Post failed');
    return { created, failed };
  } finally {
    blobCache.clear();
  }
}

/**
 * [VLM DISABLED] Image analysis is switched off. Kept as a no-op export so existing imports/calls
 * (CreatePost.tsx) keep working. To re-enable: restore the body below and the two imports at the top.
 */
export async function analyzeImage(_img: PickedMedia, _postId?: string) {
  return;
  // try {
  //   const small = await prepareImage(_img, 'analysis'); // reuses cache for repeat calls (one per orbital)
  //   const f = new FormData();
  //   await appendFile(f, 'file', { uri: small.uri, name: small.name, type: small.mime });
  //   f.append('type', small.mime);
  //   f.append('prompt', ANALYSIS_PROMPT);
  //   if (_postId) f.append('post_id', String(_postId));
  //   await axios.post(`${API_URL}/postdata`, f, {
  //     withCredentials: true,
  //     headers: { ...(await getAuthHeaders()) },
  //     timeout: 60_000,
  //   });
  // } catch (e) {
  //   console.warn('Image analysis failed', axios.isAxiosError(e) ? e.response?.data : e);
  // }
}