/** Centered, max-width column used by header, list and search bar */
export const CONTENT = "w-full max-w-2xl self-center px-5";

/** Shared row layout for profile + history rows */
export const ROW = "flex-row items-center gap-3 rounded-2xl p-2.5 pr-3";

export const SEARCH_DEBOUNCE_MS = 250;
export const MAX_HISTORY = 10;

// ── Layout (tune these two to match your floating tab bar) ──
/** Height of the floating bottom tab bar */
export const TAB_BAR_HEIGHT = 72;
/** Extra breathing room between the tab bar and the search bar */
export const TAB_BAR_GAP = 16;

/** Search bar height incl. its top padding (used to pad the list) */
export const SEARCH_BAR_HEIGHT = 84;
/** Gap between the search bar and the keyboard */
export const KEYBOARD_GAP = 12;