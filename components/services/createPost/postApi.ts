import { TARGETS_BY_DESTINATION } from '@/constants/createPost/constants';
import axios from 'axios';
import { Platform } from 'react-native';
import { ANALYSIS_PROMPT, API_URL, getAuthHeaders } from '../../../constants/createPost/external';
import type { Destination, PickedMedia, PostTarget, SubmitResult, Voice } from '../../../constants/createPost/types';

/* ---------- helpers ---------- */
const AUDIO_EXT = Platform.OS === 'web' ? 'webm' : 'm4a';
const AUDIO_MIME = Platform.OS === 'web' ? 'audio/webm' : 'audio/mp4';

export const getErrorMessage = (e: unknown, fallback: string) =>
  (axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message : undefined) ?? fallback;

/** React Native appends {uri,name,type}; the web needs a real Blob. */
async function appendFile(form: FormData, field: string, file: { uri: string; name: string; type: string }) {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
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

  const headers = { ...(await getAuthHeaders()) };

  const results = await Promise.allSettled(
    jobs.map(async ({ target, url }) => {
      const { data } = await axios.post(url, await buildForm(caption, media, voice), {
        withCredentials: true,
        headers,
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
}

/** Fire-and-forget: sends an image to your VLM describe endpoint. Never blocks or fails the post. */
export async function analyzeImage(img: PickedMedia, postId?: string) {
  try {
    const f = new FormData();
    await appendFile(f, 'file', { uri: img.uri, name: img.name, type: img.mime });
    f.append('type', img.mime);
    f.append('prompt', ANALYSIS_PROMPT);
    if (postId) f.append('post_id', String(postId));
    await axios.post(`${API_URL}/postdata`, f, {
      withCredentials: true,
      headers: { ...(await getAuthHeaders()) },
    });
  } catch (e) {
    console.warn('Image analysis failed', axios.isAxiosError(e) ? e.response?.data : e);
  }
}