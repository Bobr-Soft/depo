import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import { RefreshCw, WifiOff } from '@tamagui/lucide-icons';
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Package, Spinner, CircleChevronDown, CircleChevronUp } from '@repo/ui';
import { useSyncStatus } from '@/hooks';
import { TaskComplete } from '@/constants/types';
import loadTasks, { refreshTasks } from '@/components/api';

export default function ItemsScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortingOpen, setSortingOpen] = useState(false);
  const [menusOpen, setMenusOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'priority' | 'deadline' | 'updated'>('priority');
  const syncStatus = useSyncStatus();

  function getTaskWorkflowOrder(task: TaskComplete): number {
    const status = String(task.status ?? '').toLowerCase();
    const isAssigned = task.assigned_user !== null && task.assigned_user !== undefined;
    const isCompleted = status === 'completed';
    const isAssignable = !isAssigned && status === 'pending';
    const isAssignedPending = isAssigned && status === 'pending';
    const isInProgressOrWaiting = status === 'in_progress' || status === 'pending';

    if (isAssignable) {
      return 0;
    }

    if (isAssignedPending) {
      return 1;
    }

    if (isInProgressOrWaiting) {
      return 2;
    }

    if (isCompleted) {
      return 3;
    }

    return 4;
  }

  function getTaskWorkflowLabel(task: TaskComplete): string {
    const order = getTaskWorkflowOrder(task);

    if (order === 0) {
      return 'Elfogadható';
    }

    if (order === 1) {
      return 'Hozzárendelt';
    }

    if (order === 2) {
      return 'Folyamatban / Várakozó';
    }

    if (order === 3) {
      return 'Kész';
    }

    return 'Egyéb';
  }

  function getTaskWorkflowTheme(task: TaskComplete): { bg: '$blue5' | '$yellow5' | '$orange5' | '$green5' | '$gray5'; text: '$blue10' | '$yellow10' | '$orange10' | '$green10' | '$gray10' } {
    const order = getTaskWorkflowOrder(task);

    if (order === 0) {
      return { bg: '$blue5', text: '$blue10' };
    }

    if (order === 1) {
      return { bg: '$yellow5', text: '$yellow10' };
    }

    if (order === 2) {
      return { bg: '$orange5', text: '$orange10' };
    }

    if (order === 3) {
      return { bg: '$green5', text: '$green10' };
    }

    return { bg: '$gray5', text: '$gray10' };
  }

  const orderedTasks = useMemo(() => {
    const sorted = [...tasks].sort((a, b) => {
      const aWorkflowOrder = getTaskWorkflowOrder(a);
      const bWorkflowOrder = getTaskWorkflowOrder(b);

      if (aWorkflowOrder !== bWorkflowOrder) {
        return aWorkflowOrder - bWorkflowOrder;
      }

      if (sortMode === 'deadline') {
        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDeadline !== bDeadline) {
          return aDeadline - bDeadline;
        }
      }

      if (sortMode === 'updated') {
        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        if (aUpdated !== bUpdated) {
          return bUpdated - aUpdated;
        }
      }

      const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER;
      const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER;
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
      const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
      return bUpdated - aUpdated;
    });

    return sorted;
  }, [sortMode, tasks]);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadTasks();
      setTasks(data);
    } catch {
      setError('Nem sikerült betölteni a feladatokat.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const data = await refreshTasks();
      setTasks(data);
      setError(null);
    } catch {
      setError('Nem sikerült frissíteni a feladatokat.');
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <YStack flex={1}>
            <H2 color="$color12">Feladatok</H2>
            <Text fontSize={14} color="$color10">Kezeld a felvételi feladatokat</Text>
          </YStack>
          {!syncStatus.isOnline && (
            <YStack backgroundColor="$orange5" padding="$2" borderRadius="$3">
              <XStack gap="$2" alignItems="center">
                <WifiOff size={16} color="$orange10" />
                <Text fontSize={12} color="$orange10">Offline</Text>
              </XStack>
            </YStack>
          )}
        </XStack>
        {syncStatus.pendingOperations > 0 && (
          <XStack backgroundColor="$blue5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <Text fontSize={12} color="$blue10">
              {syncStatus.pendingOperations} várakozó módosítás szinkronizálásra
            </Text>
          </XStack>
        )}
      </YStack>

        <Card flex={1}
          minHeight={0}
          padding="$4"
          gap="$3"
          borderRadius="$4"
          shadowColor="$shadow"
          shadowOpacity={0.1}
          shadowRadius={8}
          backgroundColor="$color3">

      {sortingOpen ? (
        <Card
          padding="$4"
          gap="$3"
          borderRadius="$4"
          shadowColor="$shadow"
          shadowOpacity={0.1}
          shadowRadius={8}
        >
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between" onPress={() => setSortingOpen(false)}>
              <Text fontSize={16} fontWeight="600" color="$color12">Feladatok rendezése</Text>
              <CircleChevronUp size={20} />
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button size="$3" theme={sortMode === 'priority' ? 'blue' : 'gray'} onPress={() => setSortMode('priority')}>
                Prioritás
              </Button>
              <Button size="$3" theme={sortMode === 'deadline' ? 'blue' : 'gray'} onPress={() => setSortMode('deadline')}>
                Határidő
              </Button>
              <Button size="$3" theme={sortMode === 'updated' ? 'blue' : 'gray'} onPress={() => setSortMode('updated')}>
                Frissítés
              </Button>
            </XStack>
            <Text fontSize={12} color="$color10">
              Sorrend: elfogadható, hozzárendelt, folyamatban/várakozó, majd kész.
            </Text>
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
          onPress={() => setSortingOpen(true)}
        >
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <Text fontSize={16} fontWeight="600" color="$color12">Feladatok rendezése</Text>
            <CircleChevronDown size={20} />
          </XStack>
        </Card>
      )}

      {menusOpen ? (
        <Card
          padding="$4"
          gap="$3"
          borderRadius="$4"
          shadowColor="$shadow"
          shadowOpacity={0.1}
          shadowRadius={8}
        >
          <YStack gap="$3">
            <XStack gap="$2" alignItems="center" justifyContent="space-between" onPress={() => setMenusOpen(false)}>
              <Text fontSize={16} fontWeight="600" color="$color12">Gyors menük</Text>
              <CircleChevronUp size={20} />
            </XStack>
            <XStack gap="$2" flexWrap="wrap">
              <Button size="$3" theme="blue" onPress={() => router.push('/picking')}>Komissiózás</Button>
              <Button size="$3" theme="blue" onPress={() => router.push('/picking/new')}>Új feladat</Button>
              <Button size="$3" theme="gray" onPress={() => router.push('/scanner')}>Szkenner</Button>
            </XStack>
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
          onPress={() => setMenusOpen(true)}
        >
          <XStack gap="$2" alignItems="center" justifyContent="space-between">
            <Text fontSize={16} fontWeight="600" color="$color12">Gyors menük</Text>
            <CircleChevronDown size={20} />
          </XStack>
        </Card>
      )}

      <Card flex={1} minHeight={0} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <YStack gap="$1">
            <Text fontSize={14} fontWeight="600" color="$color11">Felvételi feladatok</Text>
            <Text fontSize={12} color="$color9">{orderedTasks.length} aktív feladat</Text>
          </YStack>
          <XStack gap="$2">
            <Button
              size="$4"
              theme="gray"
              pressStyle={{ scale: 0.95 }}
              onPress={handleRefresh}
              disabled={refreshing || !syncStatus.isOnline}
            >
              <RefreshCw size={18} color="$color11" />
            </Button>
            <Button size="$4" theme="blue" pressStyle={{ scale: 0.95 }} onPress={() => router.push('/picking/new')}>
              <Text fontWeight="600">+ Új feladat</Text>
            </Button>
          </XStack>
        </XStack>

        <ScrollView flex={1} backgroundColor="$background" contentContainerStyle={{ flexGrow: 1 }}>
          {loading || refreshing ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$6">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
              <Button size="$3" onPress={fetchTasks}>
                <Text>Újra</Text>
              </Button>
            </YStack>
          ) : orderedTasks.length > 0 ? (
            orderedTasks.map((task, index) => {
              const workflowLabel = getTaskWorkflowLabel(task);
              const workflowTheme = getTaskWorkflowTheme(task);
              const previousTask = index > 0 ? orderedTasks[index - 1] : null;
              const isNewGroup = !previousTask || getTaskWorkflowOrder(previousTask) !== getTaskWorkflowOrder(task);

              return (
                <YStack key={task.id}>
                  {isNewGroup && (
                    <XStack marginTop={index === 0 ? '$0' : '$3'} marginBottom="$2">
                      <YStack backgroundColor={workflowTheme.bg} paddingHorizontal="$3" paddingVertical="$2" borderRadius="$4">
                        <Text fontSize={12} fontWeight="700" color={workflowTheme.text}>
                          {workflowLabel}
                        </Text>
                      </YStack>
                    </XStack>
                  )}

                  <Card
                    backgroundColor="$background"
                    marginBottom="$2"
                    onPress={() => router.push({ pathname: '/picking/[id]', params: { id: task.id } })}
                  >
                    <XStack gap="$3" alignItems="center">
                      <YStack flex={1} gap="$1" backgroundColor="$color5" padding="$4" borderRadius="$4">
                        <XStack justifyContent="space-between" alignItems="center" gap="$2">
                          <Text fontWeight="600" fontSize={20}>{task.source_id ?? 'Nincs forrás'}</Text>
                          <YStack backgroundColor={workflowTheme.bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3">
                            <Text fontSize={11} fontWeight="700" color={workflowTheme.text}>
                              {workflowLabel}
                            </Text>
                          </YStack>
                        </XStack>
                        <XStack gap="$1.5" alignItems="center">
                          <Package size={18} color="$color10" />
                          <Text fontSize={16} color="$color10">{task.items.length} tétel</Text>
                        </XStack>
                        <XStack gap="$1.5" alignItems="center">
                          <Text fontSize={16} color="$color11">Prioritás:</Text>
                          <Text
                            fontSize={16}
                            fontWeight="600"
                            color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'}
                          >
                            {task.priority === 1 ? 'Kritikus' : task.priority === 2 ? 'Magas' : task.priority === 3 ? 'Normál' : 'Alacsony'}
                          </Text>
                        </XStack>
                        <Text fontSize={14} color="$color11">Státusz: {task.status}</Text>
                        <Text fontSize={14} color="$color11">
                          Határidő: {task.deadline
                            ? `${new Date(task.deadline).toLocaleString()} (${Math.max(0, Math.round((new Date(task.deadline).getTime() - Date.now()) / 60000))} perc hátra)`
                            : 'N/A'}
                        </Text>
                      </YStack>
                    </XStack>
                  </Card>
                </YStack>
              );
            })
          ) : (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={16} color="$color10" textAlign="center">
                Nincsenek aktív feladatok
              </Text>
              <Text fontSize={12} color="$color9" textAlign="center">
                Új feladat létrehozásához nyomja meg az &ldquo;Új feladat&rdquo; gombot
              </Text>
            </YStack>
          )}
        </ScrollView>
      </Card>
    </Card>
    </YStack>
  );
}
