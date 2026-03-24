/**
 * Header Styles Configuration
 *
 * Centralized header styling for navigation screens.
 * Provides consistent header appearance across all screens.
 *
 * USAGE:
 * ```tsx
 * import { useHeaderStyles, HeaderColors } from '@/constants/headerStyles';
 *
 * // In a component:
 * const headerStyles = useHeaderStyles();
 *
 * // In Stack.Screen options:
 * <Stack.Screen
 *   name="myscreen"
 *   options={headerStyles}
 * />
 * ```
 */

import { useColorScheme } from '@/hooks/useColorScheme';

/**
 * Header color configuration for light and dark modes
 */
export const HeaderColors = {
  light: {
    background: '#d3eeff',
    text: '#000000',
  },
  dark: {
    background: '#0A2960',
    text: '#ffffff',
  },
};

/**
 * Get header background color based on color scheme
 */
export const getHeaderBackgroundColor = (colorScheme: 'light' | 'dark') => {
  return HeaderColors[colorScheme].background;
};

/**
 * Get header text color based on color scheme
 */
export const getHeaderTextColor = (colorScheme: 'light' | 'dark') => {
  return HeaderColors[colorScheme].text;
};

/**
 * React Hook: Get header styles for current color scheme
 *
 * Returns navigation screen options with proper header styling
 *
 * @returns Header style configuration object
 */
export const useHeaderStyles = () => {
  const colorScheme = useColorScheme();

  return {
    headerStyle: {
      backgroundColor: getHeaderBackgroundColor(colorScheme),
    },
    headerTintColor: getHeaderTextColor(colorScheme),
    headerShadowVisible: false,
  };
};

/**
 * Get header colors for current color scheme
 *
 * @returns Object with background and text colors
 */
export const useHeaderColors = () => {
  const colorScheme = useColorScheme();

  return {
    backgroundColor: getHeaderBackgroundColor(colorScheme),
    textColor: getHeaderTextColor(colorScheme),
  };
};
