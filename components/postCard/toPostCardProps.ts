import type { PostAuthor, PostcardProps } from '../services/feed/postUtils';
import type { ProfilePost } from '@/components/profile/profile';

/**
 * Maps a profile post to the props the shared <Postcard /> expects.
 * Video / voice note are only rendered if your profile API actually returns them,
 * so check the field names below against your ProfilePost type and response.
 */
export function toPostcardProps(
    post: ProfilePost & Record<string, any>,
    author: PostAuthor,
): Pick<
    PostcardProps,
    | 'id'
    | 'author'
    | 'createdAt'
    | 'content'
    | 'image'
    | 'video'
    | 'voiceNote'
    | 'voiceNoteDuration'
    | 'mediaWidth'
    | 'mediaHeight'
    | 'likesCount'
    | 'commentsCount'
    | 'isLikedByCurrentUser'
    | 'isSaved'
> {
    return {
        id: post.id ?? post._id,
        author,
        createdAt: post.createdAt ?? post.updatedAt,
        content: post.content,
        image: post.image,
        video: post.video ?? post.videoUrl,
        voiceNote: post.voiceNote ?? post.voiceNoteUrl,
        voiceNoteDuration: post.voiceNoteDuration,
        mediaWidth: post.mediaWidth,
        mediaHeight: post.mediaHeight,
        likesCount: post.likesCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
        isLikedByCurrentUser: Boolean(post.isLikedByCurrentUser ?? post.isLiked),
        isSaved: Boolean(post.isSaved),
    };
}