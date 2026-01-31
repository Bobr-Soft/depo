/**
 * Text Component
 * 
 * A themed text component that automatically adapts to light/dark mode.
 * Provides variants for consistent typography hierarchy.
 * 
 * PROPS:
 * - variant: 'title' | 'heading' | 'body' | 'caption' - Text size/style
 * - weight: 'regular' | 'medium' | 'semibold' | 'bold' - Font weight
 * - lightColor/darkColor: Override colors for specific themes
 * - All standard React Native Text props
 * 
 * EXAMPLES:
 * <Text variant="title" weight="bold">Hello World</Text>
 * <Text variant="body">Regular paragraph text</Text>
 * <Text variant="caption" style={{ opacity: 0.7 }}>Small caption</Text>
 * 
 * HOW TO ADD A NEW VARIANT:
 * 1. Add variant name to the variant prop type
 * 2. Add style definition in the styles object below
 * 3. Use Typography constants for consistency
 */

import { Text as RNText, TextProps as RNTextProps, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks';
import { Typography } from '@/constants';

export type TextProps = RNTextProps & {
  lightColor?: string;
  darkColor?: string;
  variant?: 'title' | 'heading' | 'body' | 'caption';
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
};

export function Text({
  style,
  lightColor,
  darkColor,
  variant = 'body',
  weight = 'regular',
  ...rest
}: TextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, 'text');

  return (
    <RNText
      style={[
        { color },
        styles[variant],
        { fontWeight: Typography.weights[weight] },
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold,
  },
  heading: {
    fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.semibold,
  },
  body: {
    fontSize: Typography.sizes.md,
  },
  caption: {
    fontSize: Typography.sizes.sm,
  },
});
