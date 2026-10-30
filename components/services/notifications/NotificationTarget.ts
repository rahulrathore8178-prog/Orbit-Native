import type { AppNotification } from '@/components/services/notifications/notificationsApi';

export type NotificationTarget = { href: string | { pathname: string; params?: Record<string, string> } } | { profile: string };

const post = (n: AppNotification, withComments = false): NotificationTarget | null =>
    n.data?.postId
        ? {
            href: {
                pathname: '/profile/savedPosts/[postId]',
                params: {
                    postId: n.data.postId,
                    from: 'notif',
                    ...(withComments ? { comments: '1', ...(n.data.commentId ? { commentId: n.data.commentId } : {}) } : {}),
                },
            },
        }
        : null;

const user = (n: AppNotification): NotificationTarget | null =>
    n.data?.userId ?? n.data?.actorId ? { profile: (n.data?.userId ?? n.data?.actorId)! } : null;

const orbital = (n: AppNotification): NotificationTarget | null =>
    n.data?.orbitalId ? { href: { pathname: '/orbital/[id]', params: { id: n.data.orbitalId } } } : null;

const RESOLVERS: Record<string, (n: AppNotification) => NotificationTarget | null> = {
    like: (n) => post(n),
    comment: (n) => post(n, true),
    reply: (n) => post(n, true),
    comment_like: (n) => post(n, true),
    orbital_post: (n) => post(n),
    friend_request: user,
    friend_accept: user,
    orbital_invite: orbital,
};

/** null = nothing to open (old notifications without data): the tap only marks it read. */
export function resolveNotificationTarget(n: AppNotification): NotificationTarget | null {
    const byType = n.type ? RESOLVERS[n.type]?.(n) : null;
    if (byType) return byType;
    if (n.data?.url) return { href: n.data.url }; // new types work without an app update
    return post(n) ?? orbital(n) ?? null;
}