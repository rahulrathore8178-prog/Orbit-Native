import { useEffect, useState } from 'react'
import * as VideoThumbnails from 'expo-video-thumbnails'

// Session cache: survives list recycling so frames are never generated twice.
const cache = new Map<string, string>()

/** First-frame preview for a video. Returns undefined until ready (or if it fails). */
export function useVideoThumb(id: string, uri?: string) {
    const [thumb, setThumb] = useState<string | undefined>(cache.get(id))

    useEffect(() => {
        if (!uri || cache.has(id)) return
        let alive = true
        VideoThumbnails.getThumbnailAsync(uri, { time: 500, quality: 0.6 })
            .then(({ uri: t }) => {
                cache.set(id, t)
                if (alive) setThumb(t)
            })
            .catch(() => { })
        return () => {
            alive = false
        }
    }, [id, uri])

    return thumb
}
