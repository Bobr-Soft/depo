import { StyleSheet, ScrollView, View, Text } from 'react-native';
import { Card } from '@/components';
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
            <Text style={styles.avatarText}>
              U
            </Text>
          </View>
          <Text style={styles.heading}>User Name</Text>
          <Text style={styles.email}>
            user@example.com
          </Text>
        </View>

        <Card variant="elevated">
          <Text style={styles.sectionTitle}>
            ⚙️ Settings
          </Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>🌓 Theme</Text>
              </View>
              <Text style={styles.settingValue}>
                System
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>🔔 Notifications</Text>
              </View>
              <Text style={styles.settingValue}>
                Enabled
              </Text>
            </View>
          </View>
        </Card>

        <Card variant="elevated">
          <Text style={styles.sectionTitle}>
            ℹ️ About
          </Text>
          <View style={styles.aboutList}>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>App Name</Text>
              <Text>
                {APP_NAME}
              </Text>
            </View>
            <View style={styles.aboutItem}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text>
                {APP_VERSION}
              </Text>
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
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  heading: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  email: {
    opacity: 0.6,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
});
