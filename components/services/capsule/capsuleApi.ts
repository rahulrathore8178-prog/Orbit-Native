import { API_URL } from '@/lib/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import type { Capsule, CapsuleComment, CapsuleFeed, CapsuleGroup, CapsuleUser } from '../../../constants/capsule/types';
import { authStorage } from '@/lib/auth/authStorage';
import { normalizeComment } from '@/components/capsule/normalizeComment';

// Each function returns the path for that call. Left empty on purpose.
// e.g. like: (id) => `/capsules/${id}/like`
export const ENDPOINTS = {
  feed: '/api/capsule/feed', // GET  -> CapsuleFeed
  create: '/api/capsule/capsulepost', // POST multipart (field "image")
  remove: (_id: string) => `/api/capsule/${_id}`, // DELETE
  like: (_id: string) => `/api/capsule/${_id}/like`, // POST = like, DELETE = unlike
  save: (_id: string) => `/api/capsule/${_id}/preserve`, // POST = save, DELETE = unsave
  view: (_id: string) => `/api/capsule/${_id}/view`, // POST mark as viewed
  likes: (_id: string) => `/api/capsule/${_id}/likes`, // GET -> CapsuleUser[]
  comments: (_id: string) => `/api/capsule/${_id}/capsulecomment`, // GET -> CapsuleComment[], POST { text }
  send: (_id: string) => `/api/capsule/${_id}/send`, // POST { userIds: string[] }
} as const;
// ─────────────────────────────────────────────────────────────────

const http = axios.create({ baseURL: API_URL, timeout: 60000 });

http.interceptors.request.use(async (config) => {
  const token = await authStorage.getToken()

  console.log('[CAPSULE TOKEN]', token);
  console.log('[CAPSULE URL]', config.url);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // console.log('[CAPSULE HEADERS]', config.headers);

  return config;
});

// ── helpers (these were missing) ─────────────────────────────────
const idOf = (v: any): string =>
  String(v && typeof v === 'object' ? (v._id ?? v.id ?? v.user?._id ?? v.user) : v);

async function getMe(): Promise<CapsuleUser> {
  const raw = await AsyncStorage.getItem('user');
  const u = raw ? JSON.parse(raw) : {};
  // console.log('[capsules] getMe', u);
  // console.log('[capsules raw]', raw);
  return {
    id: String(u.id ?? u._id ?? ''),
    username: u.username ?? '',
    avatar: u.profilePic ?? u.avatar,
  };
}

function toCapsule(r: any, meId: string): Capsule {
  const likedBy: any[] = r.likedBy ?? [];
  const viewers: any[] = r.viewers ?? [];
  return {
    id: String(r._id),
    mediaUrl: r.mediaUrl,
    createdAt: r.createdAt,
    likesCount: likedBy.length,
    comments: r.comments ?? [],
    commentsCount: (r.comments ?? []).length,
    likedByMe: likedBy.some((x) => idOf(x) === meId),
    savedByMe: false,
    seen: viewers.some((x) => idOf(x) === meId),
    caption: r.caption ?? '',
    viewers: viewers.map((viewer) => ({
      id: String(viewer._id),
      username: viewer.username,
      profilePic: viewer.profilePic,
    })),
  };
}

export const capsuleApi = {
  async getFeed(): Promise<CapsuleFeed> {
    const res = await http.get(ENDPOINTS.feed);
    console.log('[1] feed', res.data);

    const me = await getMe();
    console.log('[3] me', me);

    const body = res.data;
    const raw: any[] = Array.isArray(body) ? body : (body?.capsules ?? body?.data ?? []);

    const mine: Capsule[] = [];
    const byUser = new Map<string, CapsuleGroup>();

    for (const r of raw) {
      const uid = idOf(r.user);
      const cap = toCapsule(r, me.id);
      if (uid === me.id) {
        mine.push(cap);
        continue;
      }
      const g = byUser.get(uid) ?? {
        user: { id: uid, username: r.user.username, avatar: r.user.profilePic },
        capsules: [],
      };
      g.capsules.push(cap);
      byUser.set(uid, g);
    }

    const byTime = (a: Capsule, b: Capsule) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    mine.sort(byTime);
    const groups = [...byUser.values()];
    groups.forEach((g) => g.capsules.sort(byTime));
    groups.sort((a, b) => {
      const ua = a.capsules.some((c) => !c.seen) ? 1 : 0;
      const ub = b.capsules.some((c) => !c.seen) ? 1 : 0;
      if (ua !== ub) return ub - ua;
      return (
        new Date(b.capsules[b.capsules.length - 1].createdAt).getTime() -
        new Date(a.capsules[a.capsules.length - 1].createdAt).getTime()
      );
    });

    console.log('[4] grouped', mine.length, groups.length);
    return { me, mine, groups };
  },


async create(
  file: { uri: string; caption?: string },
  onProgress?: (pct: number) => void,
) {
  try {
    const form = new FormData();

    // text field first, then the file (multer reads req.body.caption)
    const caption = file.caption?.trim();
    if (caption) form.append('caption', caption);

    form.append('media', {
      uri: file.uri,
      name: 'capsule.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);

    const { data } = await http.post(ENDPOINTS.create, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      withCredentials: true,
      onUploadProgress: (e) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data;
  } catch (error) {
    console.error('Error creating capsule:', error);
    throw error; // ← important, see below
  }
},

  async remove(id: string) {
    await http.delete(ENDPOINTS.remove(id));
  },

  async setLike(id: string, liked: boolean) {
    if (liked) await http.post(ENDPOINTS.like(id));
    else await http.delete(ENDPOINTS.like(id));
  },

  async setSaved(id: string, saved: boolean) {
    if (saved) await http.post(ENDPOINTS.save(id));
    else await http.delete(ENDPOINTS.save(id));
  },

  async markViewed(id: string) {
    await http.post(ENDPOINTS.view(id));
  },

  async getLikes(id: string): Promise<CapsuleUser[]> {
    const { data } = await http.get(ENDPOINTS.likes(id));
    return data;
  },

  async getComments(id: string): Promise<CapsuleComment[]> {
    const { data } = await http.get(ENDPOINTS.comments(id));
    return data;
  },

  async addComment(id: string, content: string): Promise<CapsuleComment> {
    try {
      const { data } = await http.post(ENDPOINTS.comments(id), { content });
      return normalizeComment(data.comment);
    } catch (error) {
      console.error('Error adding comment:', error);
      throw error;
    }
  },

  async send(id: string, userIds: string[]) {
    await http.post(ENDPOINTS.send(id), { userIds });
  },
};
