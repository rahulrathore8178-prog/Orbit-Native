const KEY = process.env.EXPO_PUBLIC_GIPHY_KEY;

export type Gif = { id: string; thumb: string; url: string };
export const hasGiphyKey = !!KEY;

async function request(path: string, params: Record<string, string>): Promise<Gif[]> {
    const qs = Object.entries({ api_key: KEY ?? '', limit: '30', rating: 'pg-13', ...params })
        .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
        .join('&');
    const res = await fetch(`https://api.giphy.com/v1/gifs/${path}?${qs}`);
    if (!res.ok) throw new Error('GIF request failed');
    const json = await res.json();
    return (json.data ?? [])
        .map((g: any) => ({
            id: String(g.id),
            thumb: g.images?.fixed_width_small?.url ?? g.images?.fixed_width?.url,
            url: g.images?.fixed_width?.url ?? g.images?.original?.url,
        }))
        .filter((g: Gif) => g.thumb && g.url);
}

export const trendingGifs = () => request('trending', {});
export const searchGifs = (q: string) => request('search', { q });