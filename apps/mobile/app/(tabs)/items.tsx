import { useCallback, useMemo, useState } from 'react';
import { SectionList } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { RefreshCw, WifiOff, Package, Clock, AlertCircle, ChevronDown, ChevronRight } from '@tamagui/lucide-icons';
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from '@repo/ui';
import { useSyncStatus } from '@/hooks';
import { TaskComplete, CARD } from '@/constants';
import loadTasks, { refreshTasks, releaseTask, takeTask } from '@/components/api';

type TaskSection = { order: number; label: string; theme: { bg: string; text: string }; key: string; data: TaskComplete[] };

const NON_RELEASABLE_STATUSES = new Set(['completed', 'done', 'delivered', 'cancelled']);

// --- HELPER FUNCTIONS MOVED OUTSIDE COMPONENT TO PREVENT RE-RENDERS ---
function getTaskWorkflowOrder(task: TaskComplete): number {
  const status = String(task.status ?? '').toLowerCase();
  const isCompleted = status === 'completed' || status === 'done' || status === 'delivered';
  const isAssigned = task.assigned_user !== null && task.assigned_user !== undefined;
  if (!isAssigned && status === 'pending') return 0;
  if (isAssigned && status === 'pending') return 1;
  if (status === 'in_progress' || status === 'pending') return 2;
  if (isCompleted) return 3;
  return 4;
}

function getTaskWorkflowLabel(task: TaskComplete): string {
  const order = getTaskWorkflowOrder(task);
  if (order === 0) return 'Elfogadható';
  if (order === 1) return 'Hozzárendelt';
  if (order === 2) return 'Folyamatban';
  if (order === 3) return 'Kész';
  return 'Egyéb';
}

function getTaskWorkflowTheme(task: TaskComplete) {
  const order = getTaskWorkflowOrder(task);
  if (order === 0) return { bg: '$blue5', text: '$blue10' };
  if (order === 1) return { bg: '$yellow5', text: '$yellow10' };
  if (order === 2) return { bg: '$orange5', text: '$orange10' };
  if (order === 3) return { bg: '$green5', text: '$green10' };
  return { bg: '$gray5', text: '$gray10' };
}

export default function ItemsScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<'priority' | 'deadline' | 'updated'>('priority');

  // Action loading states
  const [releasingTaskId, setReleasingTaskId] = useState<number | null>(null);
  const [acceptingTaskId, setAcceptingTaskId] = useState<number | null>(null);

  const syncStatus = useSyncStatus();
  const insets = useSafeAreaInsets();

  const [expandedGroups, setExpandedGroups] = useState<Record<number, boolean>>({
    0: false,
    1: true,
    2: true,
    3: false,
    4: true
  });

  const toggleGroup = (order: number) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [order]: !prev[order],
    }));
  };

  const orderedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      const aWorkflowOrder = getTaskWorkflowOrder(a);
      const bWorkflowOrder = getTaskWorkflowOrder(b);
      if (aWorkflowOrder !== bWorkflowOrder) return aWorkflowOrder - bWorkflowOrder;

      if (sortMode === 'deadline') {
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;
      }

      if (sortMode === 'updated') {
        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        if (aUpdated !== bUpdated) return bUpdated - aUpdated;
      }

      const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) return aPriority - bPriority;

      const aUpd = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUpd = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bUpd - aUpd;
    });
  }, [sortMode, tasks]);

  const sections = useMemo((): TaskSection[] => {
    const groups = new Map<number, TaskComplete[]>();
    for (const task of orderedTasks) {
      const order = getTaskWorkflowOrder(task);
      if (!groups.has(order)) groups.set(order, []);
      groups.get(order)!.push(task);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([order, groupTasks]) => ({
        key: String(order),
        order,
        label: getTaskWorkflowLabel(groupTasks[0]),
        theme: getTaskWorkflowTheme(groupTasks[0]),
        data: (expandedGroups[order] ?? true) ? groupTasks : [],
      }));
  }, [orderedTasks, expandedGroups]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await loadTasks());
    } catch {
      setError('Nem sikerült betölteni a feladatokat.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      setTasks(await refreshTasks());
      setError(null);
    } catch {
      setError('Nem sikerült frissíteni a feladatokat.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleRelease(task: TaskComplete) {
    setReleasingTaskId(task.id);
    setError(null);
    try {
      const ok = await releaseTask(task.id);
      if (!ok) {
        setError('A feladat leadása nem sikerült. Csak a saját feladataid adhatod le.');
        return;
      }
      setTasks(await refreshTasks());
    } catch {
      setError('Hiba történt a feladat leadása közben.');
    } finally {
      setReleasingTaskId(null);
    }
  }

  async function handleAccept(task: TaskComplete) {
    setAcceptingTaskId(task.id);
    setError(null);
    try {
      const ok = await takeTask(task.id);
      if (!ok) {
        setError('A feladat felvétele nem sikerült.');
        return;
      }
      setTasks(await refreshTasks());
    } catch {
      setError('Hiba történt a feladat felvétele közben.');
    } finally {
      setAcceptingTaskId(null);
    }
  }

  useFocusEffect(useCallback(() => {
    fetchTasks();
  }, [fetchTasks]));

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack>
            <H2 color="$color12">Feladatok</H2>
            <Text fontSize={14} color="$color10">Kezeld a felvételi feladatokat</Text>
          </YStack>

          <XStack gap="$2">
            <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={handleRefresh} disabled={refreshing || !syncStatus.isOnline} />
            <Button size="$3" theme="blue" onPress={() => router.push('/picking/new')}>+ Új</Button>
          </XStack>
        </XStack>

        {/* ALERTS */}
        {!syncStatus.isOnline && (
          <XStack backgroundColor="$orange5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <WifiOff size={16} color="$orange10" />
            <Text fontSize={12} color="$orange10">Offline mód - nincs kapcsolat</Text>
          </XStack>
        )}
        {syncStatus.pendingOperations > 0 && (
          <XStack backgroundColor="$blue5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <RefreshCw size={14} color="$blue10" />
            <Text fontSize={12} color="$blue10">{syncStatus.pendingOperations} várakozó módosítás</Text>
          </XStack>
        )}
        {syncStatus.deadLetterOperations > 0 && (
          <XStack backgroundColor="$red5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <AlertCircle size={14} color="$red10" />
            <Text fontSize={12} color="$red10">{syncStatus.deadLetterOperations} sikertelen művelet</Text>
          </XStack>
        )}
      </YStack>

      {/* QUICK MENUS & SORTING TOOLBAR */}
      <YStack borderBottomWidth={1} borderColor="$color4" paddingBottom="$3" marginBottom="$2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          <Button size="$3" theme="blue" variant="outlined" onPress={() => router.push('/picking')}>📦 Komissiózás</Button>
          <Button size="$3" theme="gray" variant="outlined" onPress={() => router.push('/scanner')}>📷 Szkenner</Button>
          <Separator vertical marginHorizontal="$2" />
          <Button size="$3" theme={sortMode === 'priority' ? 'blue' : 'gray'} onPress={() => setSortMode('priority')}>Prioritás</Button>
          <Button size="$3" theme={sortMode === 'deadline' ? 'blue' : 'gray'} onPress={() => setSortMode('deadline')}>Határidő</Button>
          <Button size="$3" theme={sortMode === 'updated' ? 'blue' : 'gray'} onPress={() => setSortMode('updated')}>Frissítés</Button>
        </ScrollView>
      </YStack>

      {/* MAIN LIST SECTION */}
      {loading || refreshing ? (
        <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
          <Spinner size="large" />
        </YStack>
      ) : error ? (
        <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
          <AlertCircle size={32} color="$red10" />
          <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
          <Button size="$3" onPress={fetchTasks}>Újrapróbálkozás</Button>
        </YStack>
      ) : (
        <SectionList<TaskComplete, TaskSection>
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: Math.max(40, insets.bottom + 16) }}
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          stickySectionHeadersEnabled={false}
          initialNumToRender={12}
          maxToRenderPerBatch={8}
          windowSize={7}
          removeClippedSubviews={true}
          renderSectionHeader={({ section }) => (
            <XStack
              alignItems="center"
              justifyContent="space-between"
              marginTop="$2"
              marginBottom="$2"
              paddingVertical="$2"
              paddingHorizontal="$3"
              backgroundColor="$color3"
              borderRadius="$3"
              onPress={() => toggleGroup(section.order)}
              pressStyle={{ opacity: 0.7, backgroundColor: '$color4' }}
            >
              <XStack alignItems="center" gap="$2">
                <YStack backgroundColor={section.theme.bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3">
                  <Text fontSize={11} fontWeight="700" color={section.theme.text} textTransform="uppercase">
                    {section.label}
                  </Text>
                </YStack>
              </XStack>
              <Button
                size="$2"
                circular
                chromeless
                icon={(expandedGroups[section.order] ?? true) ? ChevronDown : ChevronRight}
                onPress={() => toggleGroup(section.order)}
              />
            </XStack>
          )}
          renderItem={({ item: task }) => {
            const isAssignable = task.assigned_user == null && String(task.status).toLowerCase() === 'pending';
            return (
              <Card backgroundColor="$color3" marginBottom="$3" borderRadius={CARD.radius} padding={CARD.padding} borderWidth={1} borderColor={CARD.border}>
                <YStack gap="$2">
                  <XStack justifyContent="space-between" alignItems="center">
                    <Text fontWeight="700" fontSize={16} color="$color12" numberOfLines={1} flex={1} marginRight="$2">{task.source_id ?? 'Nincs forrás'}</Text>
                    <Text fontSize={12} color="$color10" textTransform="capitalize">{String(task.status)}</Text>
                  </XStack>
                  <XStack gap="$4" marginTop="$1">
                    <XStack gap="$1.5" alignItems="center">
                      <Package size={14} color="$color10" />
                      <Text fontSize={13} color="$color11">{task.items.length} tétel</Text>
                    </XStack>
                    <XStack gap="$1.5" alignItems="center">
                      <AlertCircle size={14} color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'} />
                      <Text fontSize={13} fontWeight="600" color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'}>
                        {task.priority === 1 ? 'Kritikus' : task.priority === 2 ? 'Magas' : task.priority === 3 ? 'Normál' : 'Alacsony'}
                      </Text>
                    </XStack>
                  </XStack>
                  <XStack gap="$1.5" alignItems="center">
                    <Clock size={14} color="$color10" />
                    <Text fontSize={12} color="$color11" numberOfLines={1}>
                      {task.deadline
                        ? `${new Date(task.deadline).toLocaleTimeString()} (${Math.max(0, Math.round((new Date(task.deadline).getTime() - Date.now()) / 60000))}p hátra)`
                        : 'Nincs határidő'}
                    </Text>
                  </XStack>
                  <XStack marginTop="$2" gap="$2" justifyContent="flex-end">
                    {isAssignable && (
                      <Button
                        size="$3"
                        theme="green"
                        disabled={acceptingTaskId === task.id || !syncStatus.isOnline}
                        onPress={() => handleAccept(task)}
                      >
                        {acceptingTaskId === task.id ? 'Felvétel...' : 'Felveszem'}
                      </Button>
                    )}
                    {task.assigned_user !== null && !NON_RELEASABLE_STATUSES.has(String(task.status)) && (
                      <Button
                        size="$3"
                        theme="orange"
                        variant="outlined"
                        disabled={releasingTaskId === task.id || !syncStatus.isOnline}
                        onPress={() => handleRelease(task)}
                      >
                        {releasingTaskId === task.id ? 'Leadás...' : 'Leadás'}
                      </Button>
                    )}
                    <Button size="$3" theme="blue" onPress={() => router.push({ pathname: '/picking/[id]', params: { id: task.id } })}>
                      Megnyitás
                    </Button>
                  </XStack>
                </YStack>
              </Card>
            );
          }}
          ListEmptyComponent={
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
              <Package size={48} color="$color8" />
              <Text fontSize={16} color="$color10" textAlign="center">Nincsenek aktív feladatok</Text>
            </YStack>
          }
        />
      )}
    </YStack>
  );
}
