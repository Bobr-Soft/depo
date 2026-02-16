import {
  Box,
  Center,
  Button,
  ButtonText,
  ButtonIcon,
  ButtonGroup,
  Icon,
  AddIcon,
  InfoIcon,
  ButtonSpinner,
  ArrowUpIcon,
  Heading,
  Text,
  HStack,
  VStack,
  ThreeDotsIcon,
  Input,
  InputField,
} from "@repo/ui";
import React from "react";
import { StyleSheet, ScrollView } from "react-native";
import { Card } from "@/components";
import { Spacing } from "@/constants";
export default function HomeScreen() {
  return (
    <Box style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Box style={styles.header}>
          <Heading size="xl">Welcome to Depo</Heading>
          <Text size="md" style={styles.subtitle}>
            Manage your inventory efficiently
          </Text>
        </Box>

        <Card>
          <Heading size="lg" style={styles.cardTitle}>
            Quick Actions
          </Heading>
          <VStack space="sm">
            <Button
              action="primary"
              variant="solid"
              size="lg"
              isDisabled={false}
            >
              <ButtonText>Button</ButtonText>
            </Button>
            <Button variant="solid" size="lg" action="primary">
              <ButtonText>Click me</ButtonText>
            </Button>
          </VStack>
        </Card>

        <Card>
          <Heading size="lg" style={styles.cardTitle}>
            Overview
          </Heading>
          <Box style={styles.stats}>
            <Box style={styles.stat}>
              <Heading size="xl">
                0
              </Heading>
              <Text size="sm">Total Items</Text>
            </Box>
            <Box style={styles.stat}>
              <Heading size="xl">
                0
              </Heading>
              <Text size="sm">Categories</Text>
            </Box>
            <Box style={styles.stat}>
              <Heading size="xl">
                0
              </Heading>
              <Text size="sm">Locations</Text>
            </Box>
          </Box>
        </Card>
      </ScrollView>
    </Box>
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
    flexDirection: "row",
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  statsGrid: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: "center",
    gap: Spacing.xs,
  },
  statLabel: {
    opacity: 0.7,
    textAlign: "center",
  },
  emptyState: {
    alignItems: "center",
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
    flexDirection: "row",
    gap: Spacing.md,
  },
  stats: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  stat: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: "center",
    gap: Spacing.xs,
  },
});
