import type { CapsuleComment, RawCapsuleComment } from '../../constants/capsule/types';

/** Backend shape ({ id, author, content, createdAt }) → UI shape ({ id, user, text, createdAt }). */
export function normalizeComment(c: RawCapsuleComment): CapsuleComment {
    // author is a populated object normally, but a bare ObjectId string when the feed query doesn't populate it
    const raw: any = c.author;
    const a: any = raw && typeof raw === 'object' ? raw : { id: raw };
    return {
        id: String(c.id ?? c._id ?? ''),
        text: c.content ?? '',
        createdAt: c.createdAt,
        user: {
            id: String(a.id ?? a._id ?? ''),
            username: a.username ?? 'user',
            avatar: a.profilePic || undefined,
        },
    };
}