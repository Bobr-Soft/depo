import { StyleSheet, ScrollView } from 'react-native';
import { View, Text, Card, Button } from '@/components';
import { Spacing, APP_NAME, APP_VERSION, Colors, Shadows, BorderRadius } from '@/constants';
import { useColorScheme } from '@/hooks';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primary, ...Shadows.md }]}>
            <Text variant="title" weight="bold" style={{ color: '#FFFFFF' }}>
              U
            </Text>
          </View>
          <Text variant="heading" weight="bold">User Name</Text>
          <Text variant="body" style={styles.email}>
            user@example.com
          </Text>
        </View>

        <Card variant="elevated">
          <Text variant="heading" weight="bold" style={styles.sectionTitle}>
            ⚙️ Settings
          </Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text variant="body" weight="medium">🌓 Theme</Text>
              </View>
              <Text variant="body" style={styles.settingValue}>
                System
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text variant="body" weight="medium">🔔 Notifications</Text>
              </View>
              <Text variant="body" style={styles.settingValue}>
                Enabled
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="elevated">
          <Text variant="heading" weight="bold" style={styles.sectionTitle}>
            ℹ️ About
          </Text>
          <View style={styles.aboutList}>
            <View style={styles.aboutItem}>
              <Text variant="caption" style={styles.aboutLabel}>App Name</Text>
              <Text variant="body" weight="semibold">
                {APP_NAME}
              </Text>
            </View>
            <View style={styles.aboutItem}>
              <Text variant="caption" style={styles.aboutLabel}>Version</Text>
              <Text variant="body" weight="semibold">
                {APP_VERSION}
              </Text>
            </View>
          </View>
        </Card>

        <Button title="Sign Out" variant="outline" size="lg" style={styles.signOutButton} />
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
