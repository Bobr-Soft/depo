import { StyleSheet } from 'react-native';
import { Box, Center, Text, Heading, Button, ButtonText } from '@repo/ui';
import { Spacing } from '@/constants';

export default function ItemsScreen() {
  return (
    <Box style={styles.container}>
      <Center style={styles.emptyState}>
        <Text size="6xl" style={styles.emptyIcon}>📦</Text>
        <Heading size="xl">No Items Yet</Heading>
        <Text size="md" style={styles.emptyText}>
          Start building your inventory by adding your first item
        </Text>
        <Button
          variant="solid"
          action="primary"
          size="lg"
          style={styles.button}
        >
          <ButtonText>➕ Add Your First Item</ButtonText>
        </Button>
      </Center>
    </Box>
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
