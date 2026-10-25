import axios from 'axios'
import { useEffect, useState } from 'react'
import { API_URL } from '@/lib/utils'
import { getAuthHeaders } from '../feed/postUtils'

// TODO: confirm this endpoint returns a single post
const POST_URL = (id: string) => `${API_URL}/api/community/posts/${id}`

export type SharedAuthor = { _id?: string; username: string; profilePic?: string }

export type SharedPostData = {
    id: string
    author?: SharedAuthor
    createdAt?: string
    content?: string
    image?: string
    video?: string
    voiceNote?: string
    voiceNoteDuration?: number
    mediaWidth?: number
    mediaHeight?: number
    likesCount?: number
    commentsCount?: number
    likedBy?: string[]
    isLikedByCurrentUser?: boolean
    orbital?: any
}

// An unpopulated author (just an id string) is treated as "missing" so the post gets fetched.
const asAuthor = (a: any): SharedAuthor | undefined =>
    a && typeof a === 'object' && (a.username || a.name)
        ? { _id: a._id ?? a.id, username: a.username ?? a.name, profilePic: a.profilePic }
        : undefined

export const normalizePost = (p: any): SharedPostData => {
    const likes: any[] | undefined = Array.isArray(p?.likes) ? p.likes : undefined
    const comments: any[] | undefined = Array.isArray(p?.comments) ? p.comments : undefined
    return {
        id: String(p?.id ?? p?._id),
        author: asAuthor(p?.author ?? p?.user),
        createdAt: p?.createdAt,
        content: p?.content ?? p?.caption ?? '',
        image: p?.image || undefined,
        video: p?.video || undefined,
        voiceNote: p?.voiceNote || undefined,
        voiceNoteDuration: p?.voiceNoteDuration || undefined,
        mediaWidth: p?.mediaWidth,
        mediaHeight: p?.mediaHeight,
        likesCount: p?.likesCount ?? likes?.length,
        commentsCount:
            p?.commentsCount ??
            comments?.reduce((n, c) => n + 1 + (c?.replies?.length ?? 0), 0),
        likedBy: likes?.map(String),
        isLikedByCurrentUser: p?.isLikedByCurrentUser,
        orbital: p?.orbital,
    }
}

const cache = new Map<string, SharedPostData>()
const done = new Set<string>() // fetched at least once, so we never loop on a post with no author
const inflight = new Map<string, Promise<SharedPostData>>()

function fetchPost(id: string) {
    let p = inflight.get(id)
    if (!p) {
        p = getAuthHeaders()
            .then((headers) => axios.get(POST_URL(id), { withCredentials: true, headers }))
            .then((res) => {
                const post = normalizePost(res.data?.post ?? res.data)
                cache.set(id, post)
                done.add(id)
                return post
            })
            .finally(() => inflight.delete(id))
        inflight.set(id, p)
    }
    return p
}

/**
 * Uses the populated post if the message already has one (and it includes the author),
 * otherwise loads it by id. Pass `enabled = false` to skip the request.
 */
export function useSharedPost(id: string, initial?: SharedPostData, enabled = true) {
    const [post, setPost] = useState<SharedPostData | null>(() => cache.get(id) ?? initial ?? null)
    const [failed, setFailed] = useState(false)

    useEffect(() => {
        if (initial && !cache.get(id)?.author) cache.set(id, initial)
        const have = cache.get(id)
        if (have && have !== post) setPost(have)
        if (!enabled || have?.author || done.has(id)) return

        let alive = true
        fetchPost(id)
            .then((p) => alive && setPost(p))
            .catch(() => alive && setFailed(true))
        return () => {
            alive = false
        }
    }, [id, enabled]) // eslint-disable-line react-hooks/exhaustive-deps

    return { post, failed }
}
