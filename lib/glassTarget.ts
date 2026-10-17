import { createRef } from 'react';
import type { View } from 'react-native';

/**
 * One shared blur target. The Home screen attaches it to the <BlurTargetView> that wraps the feed,
 * and the header, the capsule tray AND the tab bar all blur that same view (needed on Android).
 */
export const glassTarget = createRef<View>();