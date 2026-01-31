/**
 * View Component
 * 
 * A themed container component that automatically applies background colors
 * based on the current color scheme (light/dark).
 * 
 * This is the foundation component for all screens and containers.
 * Always use this instead of React Native's View for consistent theming.
 * 
 * PROPS:
 * - lightColor: Override background color in light mode
 * - darkColor: Override background color in dark mode
 * - All standard React Native View props (style, children, etc.)
 * 
 * EXAMPLES:
 * <View style={{ flex: 1 }}>
 *   <Text>Content automatically themed</Text>
 * </View>
 * 
 * <View lightColor="#FFFFFF" darkColor="#000000" style={{ padding: 16 }}>
 *   <Text>Custom background colors</Text>
 * </View>
 * 
 * WHY USE THIS:
 * - Automatic light/dark mode support
 * - Consistent background colors across the app
 * - Reduces code duplication
 */

import { View as RNView, ViewProps as RNViewProps } from 'react-native';
import { useThemeColor } from '@/hooks';

export type ViewProps = RNViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function View({ style, lightColor, darkColor, ...rest }: ViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor },
    'background'
  );

  return <RNView style={[{ backgroundColor }, style]} {...rest} />;
}
