import { StyleSheet, ScrollView } from 'react-native';
import { Card, Button, Text, View } from '@/components';
import { Spacing, APP_NAME, APP_VERSION, Colors, Shadows, BorderRadius } from '@/constants';
import { useColorScheme, useSyncStatus } from '@/hooks';
import { useEffect, useState } from 'react';
import { getApiUrl, getUserEmail, getUserRole } from '@/services/secureStorage';
import { cleanupSyncService } from '@/services/sync';
import { logout } from '@/services/auth';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const syncStatus = useSyncStatus();
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadProfile() {
      const [storedEmail, storedRole, storedApiUrl] = await Promise.all([
        getUserEmail(),
        getUserRole(),
        getApiUrl(),
      ]);

      setEmail(storedEmail ?? '');
      setRole(storedRole ?? '');
      setApiUrl(storedApiUrl ?? '');
    }

    loadProfile();
  }, []);

  async function handleLogout() {
    setLoading(true);
    try {
      await cleanupSyncService();
      await logout();
      router.replace('/login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: colors.primary, ...Shadows.md }]}>
            <Text style={styles.avatarText}>
              {email ? email.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <Text style={styles.heading}>{email || 'User'}</Text>
          <Text style={styles.email}>{email || 'No email available'}</Text>
        </View>

        <Card variant="elevated">
          <Text style={styles.sectionTitle}>⚙️ Account</Text>
          <View style={styles.settingsList}>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>Role</Text>
              </View>
              <Text style={styles.settingValue}>{role || 'Unknown'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>API URL</Text>
              </View>
              <Text style={styles.settingValue}>{apiUrl || 'Not set'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>Online</Text>
              </View>
              <Text style={styles.settingValue}>{syncStatus.isOnline ? 'Yes' : 'No'}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <Text>Last sync</Text>
              </View>
              <Text style={styles.settingValue}>
                {syncStatus.lastSyncTime
                  ? new Date(syncStatus.lastSyncTime).toLocaleString()
                  : 'Never'}
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

        <Card variant="elevated">
          <Text style={styles.sectionTitle}>Session</Text>
          <View style={styles.actions}>
            <Button
              title="Logout"
              variant="outline"
              onPress={handleLogout}
              disabled={loading}
            />
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
    flexShrink: 1,
    textAlign: 'right',
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
  actions: {
    gap: Spacing.md,
  },
});
