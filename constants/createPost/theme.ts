/**
 * Design tokens for the composer. Tweak here, everything follows.
 * (Self-contained on purpose: the shared ../ui/neo stays untouched for the rest of the app.)
 */
export const theme = {
  colors: {
    // sheet + glass
    sheetTint: 'rgba(11,13,19,0.74)',
    sheetBorder: 'rgba(255,255,255,0.10)',
    glass: 'rgba(255,255,255,0.045)',
    glassBorder: 'rgba(255,255,255,0.08)',
    glassHighlight: 'rgba(255,255,255,0.15)',
    backdrop: '#000000',

    // neumorphic surfaces
    neo: '#1b1e28',
    neoPressed: '#13151c',
    neoHighlight: 'rgba(255,255,255,0.13)',
    neoShade: 'rgba(0,0,0,0.55)',

    // text
    text: '#F3F5FA',
    textDim: '#A6ACBB',
    muted: '#70778A',

    // accents
    accent: '#9DBBFF',
    danger: '#F87171',

    // Post button (a little lighter than the rest, on purpose)
    postFill: '#E8EBF4',
    postFillPressed: '#D2D7E4',
    postText: '#11131A',
    postDisabledText: 'rgba(255,255,255,0.35)',
  },
  radius: { sm: 12, md: 16, lg: 22, xl: 28, sheet: 34 },
  sheetMaxWidth: 560,
  /** snappy, no wobble */
  spring: { damping: 28, stiffness: 280, mass: 0.85, overshootClamping: true },
  sheetSpring: { damping: 30, stiffness: 240, mass: 1, overshootClamping: true },
} as const;

export type Theme = typeof theme;
