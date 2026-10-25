export const DISCOVER_RADIUS_M = 500;
export const MIN_SCAN_MS = 900; // keeps the radar visible long enough to avoid a jarring flash

// Card geometry (used by FlatList getItemLayout => no layout measuring => smoother scroll)
export const CARD_HEIGHT = 84;
export const CARD_GAP = 12; // must match `mb-3` on the card wrapper

export const COLORS = {
  bg: "#050505",
  neoSurface: "#141414",
  textDim: "#8a8a8a",
  white: "#ffffff",
};
