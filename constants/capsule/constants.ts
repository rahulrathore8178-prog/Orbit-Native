// Swap COLORS for your shared theme file if you want a single source of truth.
export const COLORS = {
  bg: '#000000',
  surface: '#0D0D0D',
  neoTop: '#262626',
  neoBottom: '#121212',
  border: 'rgba(255,255,255,0.08)',
  glass: 'rgba(16,16,16,0.58)',
  glassBorder: 'rgba(255,255,255,0.10)',
  text: '#F5F5F5',
  dim: '#9A9A9A',
  accent: '#10B981',
  like: '#FF4D6A',
  danger: '#FF5A5F',
} as const;

export const CAPSULE = {
  DURATION_MS: 5000, // time each capsule stays on screen
  TRAY_ITEM_W: 84,
  TRAY_ITEM_H: 140,
  VIEWER_RADIUS: 40, // set to a big number (e.g. 999) for a full pill look
  CROP_ASPECT: 9 / 16, // width / height of the saved image
  OUTPUT_WIDTH: 1080,
  HIDE_THRESHOLD: 14, // px of scroll in one direction before the tray hides/shows
  OPEN_SPRING: { damping: 20, stiffness: 190, mass: 0.9 },
  CLOSE_MS: 260,
} as const;
