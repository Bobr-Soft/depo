import { StyleSheet } from 'react-native';
import { View, Text, Button } from '@/components';
import { Spacing } from '@/constants';

export default function ItemsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text variant="heading" weight="bold">No Items Yet</Text>
        <Text variant="body" style={styles.emptyText}>
          Start building your inventory by adding your first item
        </Text>
        <Button
          title="➕ Add Your First Item"
          variant="primary"
          size="lg"
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    maxWidth: 280,
  },
  button: {
    marginTop: Spacing.lg,
    minWidth: 240,
  },
});
