/**
 * Theme Configuration
 *
 * This file defines the visual design system for the entire app.
 * All colors, spacing, typography, and shadows are centralized here.
 *
 * HOW TO USE:
 * - Import colors: import { Colors } from '@/constants';
 * - Access in components: const colors = Colors[colorScheme];
 * - Always use theme values instead of hardcoded colors for consistency
 *
 * HOW TO CUSTOMIZE:
 * - Modify color values below to change app appearance
 * - Both light and dark themes must be updated for consistency
 * - Use hex colors with optional opacity (e.g., '#6366F1' or '#6366F115' for 15% opacity)
 */

// Theme colors
export const Colors = {
  light: {
    primary: '#6366F1',
    primaryLight: '#818CF8',
    secondary: '#EC4899',
    background: '#FAFBFC',
    card: '#FFFFFF',
    text: '#131821',
    textSecondary: '#5C6778',
    border: '#D5DAE2',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    accent: '#8B5CF6',
  },
  dark: {
    primary: '#818CF8',
    primaryLight: '#A5B4FC',
    secondary: '#F472B6',
    background: '#0B0D10',
    card: '#161A1F',
    text: '#F5F7FA',
    textSecondary: '#9AA8BA',
    border: '#323A45',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    accent: '#A78BFA',
  },
};

/**
 * Spacing Scale
 *
 * Consistent spacing creates visual harmony. Use these values for:
 * - Padding and margins
 * - Gap between elements
 * - Component dimensions
 *
 * USAGE: style={{ padding: Spacing.md, gap: Spacing.sm }}
 */
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

/**
 * Typography System
 *
 * Defines font sizes and weights for consistent text hierarchy.
 *
 * USAGE:
 * - Font sizes: fontSize: Typography.sizes.lg
 * - Font weights: fontWeight: Typography.weights.bold
 * - Or use the Text component variants: <Text variant="heading" weight="bold">
 */
export const Typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
};

/**
 * Border Radius Scale
 *
 * Consistent border radius for rounded corners.
 * Larger values = more rounded corners.
 *
 * USAGE: borderRadius: BorderRadius.lg
 */
export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 9999,
};

/**
 * Shadow Presets
 *
 * Pre-configured shadows for depth and elevation.
 * Use elevation for Android, shadow properties for iOS.
 *
 * USAGE: style={{ ...Shadows.md }}
 *
 * SIZES:
 * - sm: Subtle shadow for small elements
 * - md: Medium shadow for cards and buttons
 * - lg: Large shadow for modals and dialogs
 */
export const Shadows = {
  sm: {
    shadowColor: '#101418',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  md: {
    shadowColor: '#101418',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  lg: {
    shadowColor: '#101418',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
  },
};
