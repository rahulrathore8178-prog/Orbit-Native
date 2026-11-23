import type { PostcardProps } from '@/components/services/feed/postUtils';

export type FlarePost = PostcardProps & {
    hashtags?: string[];
    music?: { title: string };
};

export type FlareHandlers = {
    onToggleMute: () => void;
    onFollow: (authorId: string, current: boolean) => void;
    onOpenComments: (id: string) => void;
    onShare: (id: string) => void;
    onMore: (post: FlarePost) => void;
    onOpenProfile: (post: FlarePost) => void;
    onHashtag: (tag: string) => void;
};