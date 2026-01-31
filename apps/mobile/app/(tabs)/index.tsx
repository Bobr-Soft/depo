import { StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, Card, Button } from '@/components';
import { Spacing } from '@/constants';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text variant="title">Welcome to Depo</Text>
          <Text variant="body" style={styles.subtitle}>
            Manage your inventory efficiently
          </Text>
        </View>

        <Card>
          <Text variant="heading" style={styles.cardTitle}>
            Quick Actions
          </Text>
          <View style={styles.buttonGroup}>
            <Button title="Add Item" variant="primary" />
            <Button title="Scan Barcode" variant="secondary" />
          </View>
        </Card>

        <Card>
          <Text variant="heading" style={styles.cardTitle}>
            Overview
          </Text>
          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text variant="title" weight="bold">
                0
              </Text>
              <Text variant="caption">Total Items</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="title" weight="bold">
                0
              </Text>
              <Text variant="caption">Categories</Text>
            </View>
            <View style={styles.stat}>
              <Text variant="title" weight="bold">
                0
              </Text>
              <Text variant="caption">Locations</Text>
            </View>
          </View>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: Spacing.lg,
    gap: Spacing.lg,
  },
  header: {
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  subtitle: {
    opacity: 0.6,
    marginTop: Spacing.xs,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statLabel: {
    opacity: 0.7,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  emptyText: {
    opacity: 0.5,
  },
  emptySubtext: {
    opacity: 0.4,
  },
  cardTitle: {
    marginBottom: Spacing.lg,
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  stat: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    gap: Spacing.xs,
  },
});
