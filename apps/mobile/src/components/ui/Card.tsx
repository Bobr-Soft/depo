/**
 * Card Component
 * 
 * A container component that groups related content with consistent styling.
 * Provides elevation through shadows for visual hierarchy.
 * 
 * PROPS:
 * - children: React nodes to render inside the card
 * - variant: 'default' | 'elevated' | 'outlined' - Card style
 * 
 * EXAMPLES:
 * <Card>
 *   <Text variant="heading">Title</Text>
 *   <Text variant="body">Content goes here</Text>
 * </Card>
 * 
 * <Card variant="outlined">
 *   <Text>Card with border instead of shadow</Text>
 * </Card>
 * 
 * VARIANT STYLES:
 * - default: Basic card with no shadow or border
 * - elevated: Card with shadow for depth (recommended for most cases)
 * - outlined: Card with border, no shadow
 * 
 * HOW TO CUSTOMIZE:
 * - Adjust padding in styles.card
 * - Modify Shadows.md for different shadow intensity
 * - Change BorderRadius.xl for corner roundness
 */

import { StyleSheet } from 'react-native';
import { View } from './View';
import { BorderRadius, Spacing, Shadows } from '@/constants';
import { useThemeColor } from '@/hooks';

export type CardProps = {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
};

export function Card({ children, variant = 'elevated' }: CardProps) {
  const backgroundColor = useThemeColor({}, 'card');
  const borderColor = useThemeColor({}, 'border');

  return (
    <View
      style={[
        styles.card,
        variant === 'elevated' && { ...Shadows.md },
        variant === 'outlined' && {
          borderWidth: 1,
          borderColor,
        },
        {
          backgroundColor,
        },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
});
