/**
 * Button Component
 * 
 * A versatile button component with multiple variants and sizes.
 * Automatically themed and supports loading states.
 * 
 * PROPS:
 * - title: Button text (required)
 * - variant: 'primary' | 'secondary' | 'outline' | 'ghost' - Button style
 * - size: 'sm' | 'md' | 'lg' - Button size
 * - loading: boolean - Shows spinner instead of text
 * - disabled: boolean - Disables button interaction
 * - All TouchableOpacity props (onPress, style, etc.)
 * 
 * EXAMPLES:
 * <Button title="Save" variant="primary" onPress={handleSave} />
 * <Button title="Cancel" variant="ghost" size="sm" />
 * <Button title="Loading..." loading={isLoading} />
 * 
 * VARIANT STYLES:
 * - primary: Filled with primary color, white text
 * - secondary: Filled with secondary color, white text
 * - outline: Transparent with colored border
 * - ghost: Transparent with colored text, no border
 * 
 * HOW TO ADD A NEW VARIANT:
 * 1. Add variant name to the ButtonProps type
 * 2. Update getBackgroundColor() function
 * 3. Update getTextColor() function
 * 4. Apply any additional styling in the button style array
 */

import {
  TouchableOpacity,
  TouchableOpacityProps,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Text } from './Text';
import { BorderRadius, Colors, Spacing, Shadows } from '@/constants';
import { useColorScheme } from '@/hooks';

export type ButtonProps = TouchableOpacityProps & {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  style,
  disabled,
  ...rest
}: ButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  const getBackgroundColor = () => {
    if (disabled) return colors.border;
    if (variant === 'primary') return colors.primary;
    if (variant === 'secondary') return colors.secondary;
    if (variant === 'outline') return 'transparent';
    if (variant === 'ghost') return 'transparent';
    return colors.primary;
  };

  const getTextColor = () => {
    if (disabled) return colors.textSecondary;
    if (variant === 'primary' || variant === 'secondary') return '#FFFFFF';
    if (variant === 'outline') return colors.primary;
    if (variant === 'ghost') return colors.text;
    return '#FFFFFF';
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        styles[size],
        variant === 'primary' && { ...Shadows.sm },
        {
          backgroundColor: getBackgroundColor(),
          borderColor: variant === 'outline' ? colors.primary : 'transparent',
          borderWidth: variant === 'outline' ? 2 : 0,
        },
        style,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.7}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <Text
          weight="semibold"
          style={[styles.text, { color: getTextColor() }]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  sm: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: 36,
  },
  md: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    minHeight: 56,
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
  },
});
