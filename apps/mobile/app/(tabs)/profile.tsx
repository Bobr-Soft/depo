import { ScrollView, Text, YStack, Button, Avatar, Card, XStack, CircleChevronDown, CircleChevronUp, Separator } from '@repo/ui';
import { useColorScheme, useSyncStatus } from '@/hooks';
import { useEffect, useState, useMemo } from 'react';
import { Linking } from 'react-native';
import { Camera } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import loadTasks from '@/components/api';
import { TaskComplete } from '@/constants/types';
import {
  buildApiUrl,
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
import { Shield, Settings, LifeBuoy, LogOut, Smartphone, Volume2, Vibrate, Activity, HardDrive } from '@tamagui/lucide-icons';

const GITHUB_REPO_URL = 'https://github.com/Bobr-Soft/depo';
const GITHUB_DISCUSSIONS_URL = `${GITHUB_REPO_URL}/discussions`;
const GITHUB_README_URL = `${GITHUB_REPO_URL}#readme`;

// --- HELPER MOVED OUTSIDE TO PREVENT RE-RENDERS ---
function generateIssueUrl(template: 'bug_report.md' | 'feature_request.md', title: string, role: string, email: string, apiUrl: string): string {
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

  const params = new URLSearchParams({ template, title, body });
  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

export default function ProfileScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const syncStatus = useSyncStatus();

  // State
  const [email, setEmail] = useState<string>('');
  const [role, setRole] = useState<string>('');
  const [apiUrl, setApiUrl] = useState<string>('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);

  // UI Toggles
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);

  // Actions State
  const [testingConnection, setTestingConnection] = useState(false);
  const [syncingNow, setSyncingNow] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'ismeretlen' | 'elérhető' | 'hiba'>('ismeretlen');
  const [settingsMessage, setSettingsMessage] = useState<string>('');
  const [supportMessage, setSupportMessage] = useState<string>('');
  const [supportLoading, setSupportLoading] = useState<'bug' | 'feature' | 'discussion' | 'docs' | null>(null);

  // App Data State
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [cameraEnabled, setCameraEnabled] = useState<boolean | null>(null);
  const [scanSoundEnabled, setScanSoundState] = useState(true);
  const [hapticFeedbackEnabled, setHapticFeedbackState] = useState(true);

  // --- INITIAL LOAD ---
  useEffect(() => {
    async function loadProfile() {
      const [storedEmail, storedRole, storedApiUrl, storedPhotoUrl, savedScanSound, savedHaptic, permissions, loadedTasks] = await Promise.all([
        getUserEmail(), getUserRole(), getApiUrl(), getUserPhotoUrl(),
        getScanSoundEnabled(), getHapticFeedbackEnabled(),
        Camera.getCameraPermissionsAsync(), loadTasks(),
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

  // --- MEMOIZED COMPUTATIONS (Prevents lag when toggling menus) ---
  const { displayName, initials } = useMemo(() => {
    const rawEmail = email || '';
    const parts = rawEmail.split('@')[0].split(/[._\-\s]+/);
    const init = parts.slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || 'U';

    let display = parts[0]?.toUpperCase() || 'USER';
    if (parts.length > 1 && parts[1]) {
      display = parts[1][0]?.toUpperCase() + parts[1].slice(1);
    }
    return { displayName: display, initials: init };
  }, [email]);

  const { dailyCompletedTasks, dailyScanCount, dailyAssignedCount, recentActivities } = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const isAssigned = (t: TaskComplete) => !email || t.assigned_user_data?.email?.toLowerCase() === email.toLowerCase();

    const todaysTasks = tasks.filter(t => isAssigned(t) && new Date(t.updated_at).getTime() >= todayStart.getTime());

    const completed = todaysTasks.filter(t => t.status === 'completed').length;
    const scans = todaysTasks.reduce((sum, t) => sum + t.items.reduce((iSum, item) => iSum + Math.max(item.picked_quantity, 0), 0), 0);

    const recent = [...tasks]
      .filter(isAssigned)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
      .slice(0, 3)
      .map(t => {
        const time = new Date(t.updated_at).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
        const action = t.status === 'completed' ? 'Lezárva' : t.status === 'in_progress' ? 'Folyamatban' : t.status === 'cancelled' ? 'Törölve' : 'Frissítve';
        return `${time} - ${t.source_id ?? t.name} (${action})`;
      });

    return { dailyCompletedTasks: completed, dailyScanCount: scans, dailyAssignedCount: todaysTasks.length, recentActivities: recent };
  }, [tasks, email]);

  const formattedLastSync = syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString('hu-HU') : 'Még nem volt szinkronizálva';
  const normalizedPhotoUrl = photoUrl.trim();
  const shouldRenderPhoto = normalizedPhotoUrl.length > 0 && !imageLoadFailed;

  // --- HANDLERS ---
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
      if (!token) return setSettingsMessage('Hiányzó token, jelentkezz be újra.');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      try {
        const res = await fetch(buildApiUrl(currentApiUrl, '/me'), {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
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
      setSettingsMessage(result.success ? 'Szinkronizáció sikeres.' : (result.error ?? 'Szinkronizáció sikertelen.'));
    } finally {
      setSyncingNow(false);
    }
  }

  async function handleToggleScanSound() {
    const next = !scanSoundEnabled;
    setScanSoundState(next);
    await setScanSoundEnabled(next);
  }

  async function handleToggleHapticFeedback() {
    const next = !hapticFeedbackEnabled;
    setHapticFeedbackState(next);
    await setHapticFeedbackEnabled(next);
    if (next) await Haptics.selectionAsync();
  }

  async function openSupportLink(target: 'bug' | 'feature' | 'discussion' | 'docs', url: string, successMessage: string) {
    setSupportLoading(target);
    setSupportMessage('');
    try {
      if (!(await Linking.canOpenURL(url))) throw new Error('Nem sikerült megnyitni a linket.');
      await Linking.openURL(url);
      setSupportMessage(successMessage);
    } catch (error) {
      setSupportMessage(error instanceof Error ? error.message : 'Hiba történt.');
    } finally {
      setSupportLoading(null);
    }
  }

  return (
    <ScrollView flex={1} backgroundColor="$background" contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 16 }}>

      {/* PROFILE HEADER */}
      <Card padding="$6" alignItems="center" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8} backgroundColor="$color2">
        <Avatar circular size="$8">
          {shouldRenderPhoto && <Avatar.Image source={{ uri: normalizedPhotoUrl }} onError={() => setImageLoadFailed(true)} />}
          <Avatar.Fallback backgroundColor="$blue5" delayMs={shouldRenderPhoto ? 600 : 0}>
            <Text color="$blue11" fontWeight="700" fontSize={24}>{initials}</Text>
          </Avatar.Fallback>
        </Avatar>
        <YStack alignItems="center" gap="$1">
          <Text fontSize={20} fontWeight="bold" color={colors.text}>{displayName}</Text>
          <XStack alignItems="center" gap="$2" marginTop="$1">
            <Shield size={14} color={role.toLowerCase() === 'admin' ? '$red10' : colors.textSecondary} />
            <Text color={colors.textSecondary} fontSize={14} textTransform="capitalize">{role}</Text>
          </XStack>
          <Text color={colors.textSecondary} fontSize={14}>{email}</Text>
        </YStack>
      </Card>

      {/* KPI WIDGET */}
      <YStack gap="$2">
        <Text fontSize={14} fontWeight="600" color={colors.textSecondary} marginLeft="$2" textTransform="uppercase">Napi teljesítmény</Text>
        <XStack gap="$3">
          <Card flex={1} padding="$4" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1">
            <Text fontSize={24} fontWeight="800" color="$blue10">{dailyScanCount}</Text>
            <Text fontSize={11} color={colors.textSecondary} textAlign="center">Szkennelés</Text>
          </Card>
          <Card flex={1} padding="$4" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1">
            <Text fontSize={24} fontWeight="800" color="$green10">{dailyCompletedTasks}</Text>
            <Text fontSize={11} color={colors.textSecondary} textAlign="center">Kész</Text>
          </Card>
          <Card flex={1} padding="$4" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1">
            <Text fontSize={24} fontWeight="800" color={colors.text}>{dailyAssignedCount}</Text>
            <Text fontSize={11} color={colors.textSecondary} textAlign="center">Feladat</Text>
          </Card>
        </XStack>
      </YStack>

      {/* ADMIN HORIZONTAL MENU */}
      {role.toLowerCase() === 'admin' && (
        <YStack gap="$2">
          <Text fontSize={14} fontWeight="600" color="$red10" marginLeft="$2" textTransform="uppercase">Menedzsment</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            <Button size="$3" theme="red" variant="outlined" onPress={async () => { setSettingsOpen(true); await handleBackendTest(); }}>
              Rendszerállapot
            </Button>
            <Button size="$3" theme="gray" variant="outlined" onPress={() => router.push('/picking')}>Feladat kiosztás</Button>
            <Button size="$3" theme="gray" variant="outlined" onPress={() => router.push('/inbound')}>Felhasználók</Button>
          </ScrollView>
        </YStack>
      )}

      {/* HARDWARE & PREFERENCES */}
      <Card borderRadius="$4" backgroundColor="$color3" overflow="hidden">
        <YStack padding="$4" gap="$3">
          <XStack alignItems="center" gap="$2" marginBottom="$1">
            <Smartphone size={18} color={colors.textSecondary} />
            <Text fontSize={15} fontWeight="600" color={colors.text}>Eszköz beállítások</Text>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <Text fontSize={14} color={colors.textSecondary}>Kamera / Szkenner</Text>
            <Text fontSize={14} fontWeight="600" color={cameraEnabled ? '$green10' : '$red10'}>{cameraEnabled ? 'Engedélyezve' : 'Letiltva'}</Text>
          </XStack>

          <Separator />

          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <Volume2 size={16} color={colors.textSecondary} />
              <Text fontSize={14} color={colors.textSecondary}>Szkennelés hangja</Text>
            </XStack>
            <Button size="$3" theme={scanSoundEnabled ? 'blue' : 'gray'} onPress={handleToggleScanSound}>{scanSoundEnabled ? 'Be' : 'Ki'}</Button>
          </XStack>

          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2">
              <Vibrate size={16} color={colors.textSecondary} />
              <Text fontSize={14} color={colors.textSecondary}>Haptikus rezgés</Text>
            </XStack>
            <Button size="$3" theme={hapticFeedbackEnabled ? 'blue' : 'gray'} onPress={handleToggleHapticFeedback}>{hapticFeedbackEnabled ? 'Be' : 'Ki'}</Button>
          </XStack>
        </YStack>
      </Card>

      {/* SYSTEM SETTINGS COLLAPSIBLE */}
      <Card borderRadius="$4" backgroundColor="$color3" overflow="hidden">
        <Button
          size="$5"
          backgroundColor="transparent"
          borderWidth={0}
          justifyContent="space-between"
          onPress={() => setSettingsOpen(!settingsOpen)}
        >
          <XStack alignItems="center" gap="$3">
            <HardDrive size={18} color={colors.textSecondary} />
            <Text fontSize={15} fontWeight="600" color={colors.text}>Rendszer és Hálózat</Text>
          </XStack>
          {settingsOpen ? <CircleChevronUp size={20} color={colors.textSecondary} /> : <CircleChevronDown size={20} color={colors.textSecondary} />}
        </Button>

        {settingsOpen && (
          <YStack padding="$4" paddingTop="$0" gap="$3">
            <Separator marginBottom="$2" />
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} color={colors.textSecondary}>Kapcsolat</Text>
              <Text fontSize={13} fontWeight="600" color={syncStatus.isOnline ? '$green10' : '$red10'}>
                {syncStatus.isOnline ? 'Online' : `Offline (${syncStatus.pendingOperations} függő)`}
              </Text>
            </XStack>
            {(syncStatus.pendingOperations > 0 || syncStatus.deadLetterOperations > 0) && (
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={13} color={colors.textSecondary}>Várakozó / Sikertelen</Text>
                <Text fontSize={13} fontWeight="600" color={syncStatus.deadLetterOperations > 0 ? '$red10' : '$orange10'}>
                  {syncStatus.pendingOperations} függő / {syncStatus.deadLetterOperations} sikertelen
                </Text>
              </XStack>
            )}
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} color={colors.textSecondary}>Szinkronizálva</Text>
              <Text fontSize={13} color={colors.text}>{formattedLastSync}</Text>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} color={colors.textSecondary}>Szerver állapot</Text>
              <Text fontSize={13} color={colors.text} textTransform="capitalize">{backendStatus}</Text>
            </XStack>
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$2">
              <Text fontSize={13} color={colors.textSecondary}>App verzió</Text>
              <Text fontSize={13} color={colors.text}>{APP_VERSION}</Text>
            </XStack>

            <XStack gap="$2" marginTop="$2">
              <Button flex={1} size="$3" theme="gray" onPress={handleBackendTest} disabled={testingConnection || syncingNow}>
                {testingConnection ? 'Tesztelés...' : 'Ping Teszt'}
              </Button>
              <Button flex={1} size="$3" theme="blue" onPress={handleSyncNow} disabled={testingConnection || syncingNow || syncStatus.isSyncing}>
                {syncingNow ? 'Szinkron...' : 'Szinkronizálás'}
              </Button>
            </XStack>
            {settingsMessage && <Text color="$blue10" fontSize={12} textAlign="center" marginTop="$1">{settingsMessage}</Text>}
          </YStack>
        )}
      </Card>

      {/* SUPPORT COLLAPSIBLE */}
      <Card borderRadius="$4" backgroundColor="$color3" overflow="hidden">
        <Button
          size="$5"
          backgroundColor="transparent"
          borderWidth={0}
          justifyContent="space-between"
          onPress={() => setSupportOpen(!supportOpen)}
        >
          <XStack alignItems="center" gap="$3">
            <LifeBuoy size={18} color={colors.textSecondary} />
            <Text fontSize={15} fontWeight="600" color={colors.text}>Fejlesztői támogatás</Text>
          </XStack>
          {supportOpen ? <CircleChevronUp size={20} color={colors.textSecondary} /> : <CircleChevronDown size={20} color={colors.textSecondary} />}
        </Button>

        {supportOpen && (
          <YStack padding="$4" paddingTop="$0" gap="$3">
            <Separator marginBottom="$2" />
            <XStack gap="$2">
              <Button flex={1} size="$3" theme="red" variant="outlined" disabled={!!supportLoading} onPress={() => openSupportLink('bug', generateIssueUrl('bug_report.md', '[BUG] Mobile: ', role, email, apiUrl), 'GitHub nyitva.')}>
                {supportLoading === 'bug' ? 'Kérjük várjon...' : 'Hiba bejelentése'}
              </Button>
              <Button flex={1} size="$3" theme="blue" variant="outlined" disabled={!!supportLoading} onPress={() => openSupportLink('feature', generateIssueUrl('feature_request.md', '[FEATURE] Mobile: ', role, email, apiUrl), 'GitHub nyitva.')}>
                Új funkció
              </Button>
            </XStack>
            <XStack gap="$2">
              <Button flex={1} size="$3" theme="gray" disabled={!!supportLoading} onPress={() => openSupportLink('discussion', GITHUB_DISCUSSIONS_URL, 'Discussions nyitva.')}>Fórum</Button>
              <Button flex={1} size="$3" theme="gray" disabled={!!supportLoading} onPress={() => openSupportLink('docs', GITHUB_README_URL, 'Wiki nyitva.')}>Wiki / Docs</Button>
            </XStack>
            {supportMessage && <Text color="$green10" fontSize={12} textAlign="center" marginTop="$1">{supportMessage}</Text>}
          </YStack>
        )}
      </Card>

      {/* RECENT ACTIVITY */}
      <Card padding="$4" borderRadius="$4" backgroundColor="$color3" gap="$3">
        <XStack alignItems="center" gap="$2">
          <Activity size={18} color={colors.textSecondary} />
          <Text fontSize={15} fontWeight="600" color={colors.text}>Utolsó aktivitás</Text>
        </XStack>
        <YStack gap="$2">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => (
              <Text key={`act-${index}`} fontSize={13} color={colors.textSecondary}>{activity}</Text>
            ))
          ) : (
            <Text fontSize={13} color={colors.textSecondary} fontStyle="italic">Még nincs naplózott aktivitás a mai napon.</Text>
          )}
        </YStack>
      </Card>

      {/* LOGOUT BUTTON */}
      <Button
        marginTop="$4"
        size="$4"
        theme="red"
        icon={LogOut}
        onPress={handleLogout}
        disabled={loading}
      >
        Kijelentkezés
      </Button>

    </ScrollView>
  );
}
