import type { FlarePost } from '@/constants/flares/types';

let seed: FlarePost | null = null;

export const setFlareSeed = (post: FlarePost) => {
    seed = post;
};

/** Returns the seed only if it is the post the route was opened for. */
export const getFlareSeed = (id?: string): FlarePost | null => (seed && seed.id === id ? seed : null);