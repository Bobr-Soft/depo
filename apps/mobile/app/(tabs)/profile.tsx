import { StyleSheet, ScrollView } from 'react-native';
import { Box, Center, Text, Heading, Button, ButtonText, VStack } from '@repo/ui';
import { Card } from '@/components';
import { Spacing, APP_NAME, APP_VERSION, Colors, Shadows, BorderRadius } from '@/constants';
import { useColorScheme } from '@/hooks';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <Box style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Box style={styles.header}>
          <Center style={[styles.avatar, { backgroundColor: colors.primary, ...Shadows.md }]}>
            <Heading size="2xl" style={{ color: '#FFFFFF' }}>
              U
            </Heading>
          </Center>
          <Heading size="xl">User Name</Heading>
          <Text size="md" style={styles.email}>
            user@example.com
          </Text>
        </Box>

        <Card variant="elevated">
          <Heading size="lg" style={styles.sectionTitle}>
            ⚙️ Settings
          </Heading>
          <Box style={styles.settingsList}>
            <Box style={styles.settingItem}>
              <Box style={styles.settingLeft}>
                <Text size="md">🌓 Theme</Text>
              </Box>
              <Text size="md" style={styles.settingValue}>
                System
              </Text>
            </Box>
            <Box style={styles.divider} />
            <Box style={styles.settingItem}>
              <Box style={styles.settingLeft}>
                <Text size="md">🔔 Notifications</Text>
              </Box>
              <Text size="md" style={styles.settingValue}>
                Enabled
              </Text>
            </Box>
          </Box>
        </Card>

        <Card variant="elevated">
          <Heading size="lg" style={styles.sectionTitle}>
            ℹ️ About
          </Heading>
          <Box style={styles.aboutList}>
            <Box style={styles.aboutItem}>
              <Text size="sm" style={styles.aboutLabel}>App Name</Text>
              <Text size="md">
                {APP_NAME}
              </Text>
            </Box>
            <Box style={styles.aboutItem}>
              <Text size="sm" style={styles.aboutLabel}>Version</Text>
              <Text size="md">
                {APP_VERSION}
              </Text>
            </Box>
          </Box>
        </Card>

        <Button variant="outline" action="primary" size="lg" style={styles.signOutButton}>
          <ButtonText>Sign Out</ButtonText>
        </Button>
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
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  email: {
    opacity: 0.6,
  },
  sectionTitle: {
    marginBottom: Spacing.lg,
  },
  settingsList: {
    gap: 0,
    borderRadius: BorderRadius.md,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.md
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  settingValue: {
    opacity: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: '#00000010',
  },
  aboutList: {
    gap: Spacing.lg,
  },
  aboutItem: {
    gap: Spacing.xs,
  },
  aboutLabel: {
    opacity: 0.5,
    textTransform: 'uppercase',
    fontSize: 11,
  },
  signOutButton: {
    marginTop: Spacing.md,
  },
});
