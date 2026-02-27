import { ScrollView, Text, YStack, Button, Avatar, Card, XStack, CircleChevronDown, CircleChevronUp } from '@repo/ui';
import { useColorScheme, useSyncStatus } from '@/hooks';
import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import loadTasks from '@/components/api';
import { TaskComplete } from '@/constants/types';
import {
  getApiUrl,
  getToken,
  getUserEmail,
  getUserRole,
  getUserPhotoUrl,
  getScanSoundEnabled,
  getHapticFeedbackEnabled,
  setScanSoundEnabled,
  setHapticFeedbackEnabled,
} from '@/services/secureStorage';
import { cleanupSyncService, forceRefresh } from '@/services/sync';
import { logout } from '@/services/auth';
import { router } from 'expo-router';
import { Colors } from '@/constants';
import { APP_VERSION } from '@/constants/config';

const GITHUB_REPO_URL = 'https://github.com/Bobr-Soft/depo';
const GITHUB_DISCUSSIONS_URL = `${GITHUB_REPO_URL}/discussions`;
const GITHUB_README_URL = `${GITHUB_REPO_URL}#readme`;

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const syncStatus = useSyncStatus();
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'ismeretlen' | 'elérhető' | 'hiba'>('ismeretlen');
  const [settingsMessage, setSettingsMessage] = useState<string>('');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [supportLoading, setSupportLoading] = useState<
    'bug' | 'feature' | 'discussion' | 'docs' | null
  >(null);
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState<boolean | null>(null);
  const [scanSoundEnabled, setScanSoundState] = useState(true);
  const [hapticFeedbackEnabled, setHapticFeedbackState] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      const [storedEmail, storedRole, storedApiUrl, storedPhotoUrl, savedScanSound, savedHaptic, permissions, loadedTasks] = await Promise.all([
        getUserEmail(),
        getUserRole(),
        getApiUrl(),
        getUserPhotoUrl(),
        getScanSoundEnabled(),
        getHapticFeedbackEnabled(),
        Camera.getCameraPermissionsAsync(),
        loadTasks(),
      ]);

      setEmail(storedEmail ?? '');
      setRole(storedRole ?? '');
      setApiUrl(storedApiUrl ?? '');
      setPhotoUrl(storedPhotoUrl ?? '');
      setScanSoundState(savedScanSound);
      setHapticFeedbackState(savedHaptic);
      setCameraEnabled(permissions.granted);
      setTasks(loadedTasks);
    }

    loadProfile();
  }, []);

  useEffect(() => {
    setImageLoadFailed(false);
  }, [photoUrl]);

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

  async function handleBackendTest() {
    setTestingConnection(true);
    setSettingsMessage('');

    try {
      const [token, currentApiUrl] = await Promise.all([getToken(), getApiUrl()]);

      if (!token) {
        setBackendStatus('hiba');
        setSettingsMessage('Hiányzó token, jelentkezz be újra.');
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(`${currentApiUrl}/me`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });

        if (!response.ok) {
          setBackendStatus('hiba');
          setSettingsMessage(`Backend hiba: HTTP ${response.status}`);
          return;
        }

        setBackendStatus('elérhető');
        setSettingsMessage('Backend kapcsolat rendben.');
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      setBackendStatus('hiba');
      setSettingsMessage(error instanceof Error ? error.message : 'Kapcsolati hiba');
    } finally {
      setTestingConnection(false);
    }
  }

  async function handleSyncNow() {
    setSyncingNow(true);
    setSettingsMessage('');

    try {
      const result = await forceRefresh();
      if (result.success) {
        setSettingsMessage('Szinkron sikeres.');
      } else {
        setSettingsMessage(result.error ?? 'Szinkron sikertelen.');
      }
    } finally {
      setSyncingNow(false);
    }
  }

  async function handleToggleScanSound() {
    const next = !scanSoundEnabled;
    setScanSoundState(next);
    await setScanSoundEnabled(next);
    setSettingsMessage(`Szkennelés hangjelzése: ${next ? 'Be' : 'Ki'}`);
  }

  async function handleToggleHapticFeedback() {
    const next = !hapticFeedbackEnabled;
    setHapticFeedbackState(next);
    await setHapticFeedbackEnabled(next);
    if (next) {
      await Haptics.selectionAsync();
    }
    setSettingsMessage(`Rezgéses visszajelzés: ${next ? 'Be' : 'Ki'}`);
  }

  function buildIssueUrl(template: 'bug_report.md' | 'feature_request.md', title: string): string {
    const body = [
      '## App/Package Affected',
      '- [x] 📱 Mobile (`apps/mobile`)',
      '',
      '## Environment',
      `- **App Version:** ${APP_VERSION}`,
      `- **User Role:** ${role || 'unknown'}`,
      '',
      '## Additional Context',
      `- **User Email:** ${email || 'unknown'}`,
      `- **API URL:** ${apiUrl || 'unknown'}`,
    ].join('\n');

    const params = new URLSearchParams({
      template,
      title,
      body,
    });

    return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
  }

  async function openSupportLink(
    target: 'bug' | 'feature' | 'discussion' | 'docs',
    url: string,
    successMessage: string
  ) {
    setSupportLoading(target);
    setSupportMessage('');

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        throw new Error('Nem sikerült megnyitni a GitHub linket ezen az eszközön.');
      }

      await Linking.openURL(url);
      setSupportMessage(successMessage);
    } catch (error) {
      setSupportMessage(error instanceof Error ? error.message : 'Hiba történt a link megnyitásakor.');
    } finally {
      setSupportLoading(null);
    }
  }

  const formattedLastSync = syncStatus.lastSyncTime
    ? new Date(syncStatus.lastSyncTime).toLocaleString('hu-HU')
    : 'Még nem történt szinkronizáció';

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const isAssignedToCurrentUser = (task: TaskComplete): boolean => {
    if (!email) {
      return true;
    }

    const assignedEmail = task.assigned_user_data?.email;
    if (!assignedEmail) {
      return true;
    }

    return assignedEmail.toLowerCase() === email.toLowerCase();
  };

  const todaysAssignedTasks = tasks.filter((task) => {
    if (!isAssignedToCurrentUser(task)) {
      return false;
    }
    return new Date(task.updated_at).getTime() >= todayStart.getTime();
  });

  const dailyCompletedTasks = todaysAssignedTasks.filter((task) => task.status === 'completed').length;
  const dailyScanCount = todaysAssignedTasks.reduce((sum, task) => {
    const taskScanCount = task.items.reduce((itemSum, taskItem) => itemSum + Math.max(taskItem.picked_quantity, 0), 0);
    return sum + taskScanCount;
  }, 0);
  const dailyAssignedCount = todaysAssignedTasks.length;

  const recentActivities = [...tasks]
    .filter(isAssignedToCurrentUser)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3)
    .map((task) => {
      const timeLabel = new Date(task.updated_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
      const actionLabel = task.status === 'completed'
        ? 'Lezárva'
        : task.status === 'in_progress'
          ? 'Folyamatban'
          : task.status === 'cancelled'
            ? 'Törölve'
            : 'Frissítve';

      return `${timeLabel} - ${task.source_id ?? task.name} (${actionLabel})`;
    });

  const normalizedPhotoUrl = photoUrl.trim();
  const shouldRenderPhoto = normalizedPhotoUrl.length > 0 && !imageLoadFailed;
  const initials = email
    .split('@')[0]
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'U';

  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack flex={1} backgroundColor="$background" padding="$4" gap="$4">
        <Card padding="$6" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8} backgroundColor="$color2">
          <YStack gap="$4" alignItems="center">
            <Avatar circular size="$8">
              {shouldRenderPhoto ? (
                <Avatar.Image
                  source={normalizedPhotoUrl}
                  onError={() => setImageLoadFailed(true)}
                />
              ) : null}
              <Avatar.Fallback backgroundColor="$gray8" delayMs={shouldRenderPhoto ? 600 : 0}>
                <Text color="$gray1" fontWeight="700">
                  {initials}
                </Text>
              </Avatar.Fallback>
            </Avatar>
            <YStack gap="$2" alignItems="center">
              <Text fontSize={18} fontWeight="bold" color={colors.text}>
                {((email.split('@')[0]).split('.')[1]?.[0]?.toUpperCase() ?? '') + ((email.split('@')[0]).split('.')[1]?.slice(1) ?? '')}
              </Text>
              <Text color={colors.textSecondary} fontSize={14}>
                Szerep: {role}
              </Text>
              <Text color={colors.textSecondary} fontSize={14}>
                Email: {email}
              </Text>
            </YStack>
          </YStack>
        </Card>

        <Card padding="$4"
            gap="$3"
            borderRadius="$4"
            shadowColor="$shadow"
            shadowOpacity={0.1}
            shadowRadius={8}
            backgroundColor="$color2">

        <YStack gap="$3">
          <Text fontSize={15} fontWeight="600" color={colors.text}>Napi teljesítmény</Text>
          <XStack gap="$2">
            <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3">
              <Text fontSize={12} color={colors.textSecondary}>Napi szkennelések</Text>
              <Text fontSize={20} fontWeight="700" color={colors.text}>{dailyScanCount}</Text>
            </Card>
            <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3">
              <Text fontSize={12} color={colors.textSecondary}>Lezárt feladatok</Text>
              <Text fontSize={20} fontWeight="700" color={colors.text}>{dailyCompletedTasks}</Text>
            </Card>
            <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3">
              <Text fontSize={12} color={colors.textSecondary}>Mai feladataim</Text>
              <Text fontSize={20} fontWeight="700" color={colors.text}>{dailyAssignedCount}</Text>
            </Card>
          </XStack>
        </YStack>

        <Card padding="$4" borderRadius="$4" backgroundColor="$color3" gap="$2">
          <Text fontSize={15} fontWeight="600" color={colors.text}>Hardver és szinkron</Text>
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={colors.textSecondary}>Hálózat</Text>
            <Text fontSize={13} fontWeight="600" color={syncStatus.isOnline ? '$green10' : '$red10'}>
              {syncStatus.isOnline ? 'Online' : `Offline (${syncStatus.pendingOperations} várakozó)`}
            </Text>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={colors.textSecondary}>Utolsó szinkron</Text>
            <Text fontSize={13} color={colors.text}>{formattedLastSync}</Text>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={13} color={colors.textSecondary}>Kamera/Szkenner</Text>
            <Text fontSize={13} fontWeight="600" color={cameraEnabled ? '$green10' : '$red10'}>
              {cameraEnabled ? 'Engedélyezve' : 'Letiltva'}
            </Text>
          </XStack>
        </Card>

        <Card padding="$4" borderRadius="$4" backgroundColor="$color3" gap="$2">
          <Text fontSize={15} fontWeight="600" color={colors.text}>Gyorsbeállítások</Text>
          <XStack justifyContent="space-between" alignItems="center" gap="$2">
            <Text flex={1} fontSize={13} color={colors.textSecondary}>Szkennelés hangjelzése</Text>
            <Button size="$3" theme={scanSoundEnabled ? 'green' : 'gray'} onPress={handleToggleScanSound}>
              {scanSoundEnabled ? 'Be' : 'Ki'}
            </Button>
          </XStack>
          <XStack justifyContent="space-between" alignItems="center" gap="$2">
            <Text flex={1} fontSize={13} color={colors.textSecondary}>Rezgéses visszajelzés</Text>
            <Button size="$3" theme={hapticFeedbackEnabled ? 'green' : 'gray'} onPress={handleToggleHapticFeedback}>
              {hapticFeedbackEnabled ? 'Be' : 'Ki'}
            </Button>
          </XStack>
        </Card>

        {role.toLowerCase() === 'admin' ? (
          <Card padding="$4" borderRadius="$4" backgroundColor="$color3" gap="$2">
            <Text fontSize={15} fontWeight="600" color={colors.text}>Admin gyorsgombok</Text>
            <XStack gap="$2" flexWrap="wrap">
              <Button
                size="$3"
                theme="blue"
                onPress={async () => {
                  setSettingsOpen(true);
                  await handleBackendTest();
                }}
              >
                Rendszerállapot
              </Button>
              <Button size="$3" theme="gray" onPress={() => router.push('/picking')}>
                Feladat kiosztás
              </Button>
              <Button size="$3" theme="gray" onPress={() => router.push('/inbound')}>
                Felhasználók kezelése
              </Button>
            </XStack>
          </Card>
        ) : null}

        {settingsOpen ? (
          <Card
            padding="$6"
            gap="$3"
            borderRadius="$4"
            shadowColor="$shadow"
            shadowOpacity={0.1}
            shadowRadius={8}
            backgroundColor="$color3"
          >
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center" justifyContent="space-between" onPress={() => setSettingsOpen(false)}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Beállítások
                </Text>
                 <Button size="$3" theme="gray" onPress={() => setSettingsOpen(false)} hitSlop={10} borderWidth={0}>
                   <CircleChevronUp size={20} />
                </Button>
              </XStack>
              <YStack gap="$2">
                <Text color={colors.textSecondary} fontSize={13}>
                  API URL: {apiUrl}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  Backend állapot: {backendStatus}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  Szinkronizáció folyamatban: {syncStatus.isSyncing ? 'Igen' : 'Nem'}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  Hálózati kapcsolat: {syncStatus.isOnline ? 'Online' : 'Offline'}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  Függő műveletek: {syncStatus.pendingOperations}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  Utolsó szinkron: {formattedLastSync}
                </Text>
                <Text color={colors.textSecondary} fontSize={13}>
                  App verzió: {APP_VERSION}
                </Text>
              </YStack>
              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="$3"
                  theme="gray"
                  onPress={handleBackendTest}
                  disabled={testingConnection || syncingNow}
                >
                  {testingConnection ? 'Kapcsolat teszt...' : 'Backend teszt'}
                </Button>
                <Button
                  size="$3"
                  theme="blue"
                  onPress={handleSyncNow}
                  disabled={testingConnection || syncingNow || syncStatus.isSyncing}
                >
                  {syncingNow ? 'Szinkron...' : 'Szinkron most'}
                </Button>
              </XStack>
              {settingsMessage ? (
                <Text color={colors.textSecondary} fontSize={12}>
                  {settingsMessage}
                </Text>
              ) : null}
            </YStack>
          </Card>
        ) : (
          <Card
            padding="$4"
            gap="$2"
            borderRadius="$4"
            shadowColor="$shadow"
            shadowOpacity={0.1}
            shadowRadius={8}
            onPress={() => setSettingsOpen(true)}
            backgroundColor="$color3"
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Beállítások
                </Text>
                <CircleChevronDown size={20} />
              </XStack>
            </YStack>
          </Card>
        )}

        {supportOpen ? (
          <Card
            padding="$6"
            gap="$3"
            borderRadius="$4"
            shadowColor="$shadow"
            shadowOpacity={0.1}
            shadowRadius={8}
            backgroundColor="$color3">
            <YStack gap="$3">
              <XStack gap="$2" alignItems="center" justifyContent="space-between" onPress={() => setSupportOpen(false)}>
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Támogatás
                </Text>
                <CircleChevronUp size={20} />
              </XStack>

              <Text color={colors.textSecondary} fontSize={13}>
                Közvetlen GitHub jegy nyitás a projekt sablonjai alapján.
              </Text>

              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="$3"
                  theme="blue"
                  onPress={() =>
                    openSupportLink(
                      'bug',
                      buildIssueUrl('bug_report.md', '[BUG] Mobile: '),
                      'Bug report sablon megnyitva GitHubon.'
                    )
                  }
                  disabled={supportLoading !== null}
                >
                  {supportLoading === 'bug' ? 'Megnyitás...' : 'Hibajegy nyitása'}
                </Button>
                <Button
                  size="$3"
                  theme="gray"
                  onPress={() =>
                    openSupportLink(
                      'feature',
                      buildIssueUrl('feature_request.md', '[FEATURE] Mobile: '),
                      'Feature request sablon megnyitva GitHubon.'
                    )
                  }
                  disabled={supportLoading !== null}
                >
                  {supportLoading === 'feature' ? 'Megnyitás...' : 'Feature kérés'}
                </Button>
              </XStack>

              <XStack gap="$2" flexWrap="wrap">
                <Button
                  size="$3"
                  theme="gray"
                  onPress={() =>
                    openSupportLink('discussion', GITHUB_DISCUSSIONS_URL, 'Discussions megnyitva GitHubon.')
                  }
                  disabled={supportLoading !== null}
                >
                  {supportLoading === 'discussion' ? 'Megnyitás...' : 'Discussions'}
                </Button>
                <Button
                  size="$3"
                  theme="gray"
                  onPress={() =>
                    openSupportLink('docs', GITHUB_README_URL, 'README megnyitva GitHubon.')
                  }
                  disabled={supportLoading !== null}
                >
                  {supportLoading === 'docs' ? 'Megnyitás...' : 'Dokumentáció'}
                </Button>
              </XStack>

              {supportMessage ? (
                <Text color={colors.textSecondary} fontSize={12}>
                  {supportMessage}
                </Text>
              ) : null}
            </YStack>
          </Card>
        ) : (
          <Card
            padding="$4"
            gap="$2"
            borderRadius="$4"
            shadowColor="$shadow"
            shadowOpacity={0.1}
            shadowRadius={8}
            onPress={() => setSupportOpen(true)}
            backgroundColor="$color3"
          >
            <YStack gap="$2">
              <XStack gap="$2" alignItems="center" justifyContent="space-between">
                <Text fontSize={16} fontWeight="600" color={colors.text}>
                  Támogatás
                </Text>
                <CircleChevronDown size={20} />
              </XStack>
            </YStack>
          </Card>
        )}

        <Card padding="$4" borderRadius="$4" backgroundColor="$color3" gap="$2">
          <Text fontSize={15} fontWeight="600" color={colors.text}>Utolsó aktivitás</Text>
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => (
              <Text key={`${activity}-${index}`} fontSize={13} color={colors.textSecondary}>
                {activity}
              </Text>
            ))
          ) : (
            <Text fontSize={13} color={colors.textSecondary}>Még nincs naplózott aktivitás.</Text>
          )}
        </Card>

        <Button theme="red" onPress={handleLogout} disabled={loading}>
          Kijelentkezés
        </Button>
      </Card>
      </YStack>
    </ScrollView>
  );
}

