import { StyleSheet, View, Text } from 'react-native';
import { Spacing } from '@/constants';

export default function ItemsScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.emptyState}>
        <Text style={styles.emptyIcon}>📦</Text>
        <Text style={styles.heading}>No Items Yet</Text>
        <Text style={styles.emptyText}>
          Start building your inventory by adding your first item
        </Text>
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
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  emptyText: {
    textAlign: 'center',
    opacity: 0.6,
    maxWidth: 280,
  },
});
