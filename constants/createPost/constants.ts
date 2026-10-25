import type { Destination, PostTarget } from './types';

export const DESTINATIONS: { value: Destination; label: string; subtitle: string }[] = [
  { value: 'feed', label: 'Feed', subtitle: 'Posting to the community feed' },
  { value: 'orbital', label: 'Orbital', subtitle: 'Posting to an orbital' },
];

/**
 * Which backend targets each destination posts to.
 * To bring the old "both" option back: add 'both' to `Destination` in types.ts,
 * add it to DESTINATIONS above, and uncomment the line below.
 */
export const TARGETS_BY_DESTINATION: Record<Destination, PostTarget[]> = {
  feed: ['feed'],
  orbital: ['orbital'],
  // both: ['feed', 'orbital'],
};

/** Max length of a camera-recorded video, in seconds. */
export const VIDEO_MAX_SECONDS = 60;

export const COMING_SOON_MESSAGE = 'Voice notes coming soon';
