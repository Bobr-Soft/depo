import { useCallback, useMemo, useState } from "react";
import { router, useFocusEffect } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { RefreshCw, WifiOff, Package, AlertCircle, Clock, Search } from "@tamagui/lucide-icons";
import loadTasks, { refreshTasks } from "@/components/api";
import { TaskComplete } from "@/constants/types";
import { useSyncStatus } from "@/hooks";

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

export default function PickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStatus();

  const orderedTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const status = String(task.status ?? '').toLowerCase();
        return task.assigned_user !== null && status !== 'completed' && status !== 'done' && status !== 'delivered' && status !== 'cancelled';
      })
      .sort((a, b) => {
        const aWorkflowOrder = getTaskWorkflowOrder(a);
        const bWorkflowOrder = getTaskWorkflowOrder(b);
        if (aWorkflowOrder !== bWorkflowOrder) return aWorkflowOrder - bWorkflowOrder;

        const aDeadline = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        const bDeadline = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
        if (aDeadline !== bDeadline) return aDeadline - bDeadline;

        const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER;
        const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) return aPriority - bPriority;

        const aUpdated = a.updated_at ? new Date(a.updated_at).getTime() : 0;
        const bUpdated = b.updated_at ? new Date(b.updated_at).getTime() : 0;
        return bUpdated - aUpdated;
      });
  }, [tasks]);

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

  useFocusEffect(useCallback(() => {
    fetchTasks();
  }, [fetchTasks]));

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack>
            <H2 color="$color12">Komissiózás</H2>
            <Text fontSize={14} color="$color10">Saját aktív feladatok, a kész és törölt elemek nélkül</Text>
          </YStack>

          <XStack gap="$2">
            <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={handleRefresh} disabled={refreshing || !syncStatus.isOnline} />
            <Button size="$3" theme="blue" onPress={() => router.push('/items')}>+ Új</Button>
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
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* MAIN LIST SECTION */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
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
        ) : orderedTasks.length > 0 ? (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$1" paddingHorizontal="$1">
              <Text fontSize={14} fontWeight="600" color="$color11">Aktív komissiók</Text>
              <Text fontSize={12} color="$color9">{orderedTasks.length} db</Text>
            </XStack>

            {orderedTasks.map((task, index) => {
              const workflowLabel = getTaskWorkflowLabel(task);
              const workflowTheme = getTaskWorkflowTheme(task);
              const previousTask = index > 0 ? orderedTasks[index - 1] : null;
              const isNewGroup = !previousTask || getTaskWorkflowOrder(previousTask) !== getTaskWorkflowOrder(task);

              return (
                <YStack key={task.id}>
                  {isNewGroup && (
                    <Text fontSize={12} fontWeight="700" color="$color10" marginTop={index === 0 ? '$0' : '$4'} marginBottom="$2" textTransform="uppercase">
                      {workflowLabel}
                    </Text>
                  )}

                  <Card
                    backgroundColor="$color3"
                    borderRadius="$4"
                    padding="$4"
                    borderWidth={1}
                    borderColor="$color4"
                    onPress={() => router.push({ pathname: "/picking/[id]", params: { id: task.id } })}
                    pressStyle={{ scale: 0.98, backgroundColor: "$color4" }}
                  >
                    <YStack gap="$2">
                      <XStack justifyContent="space-between" alignItems="center">
                        <Text fontWeight="700" fontSize={18} color="$color12">{task.source_id ?? 'Nincs forrás'}</Text>
                        <YStack backgroundColor={workflowTheme.bg} paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3">
                          <Text fontSize={10} fontWeight="700" textTransform="uppercase" color={workflowTheme.text}>
                            {workflowLabel}
                          </Text>
                        </YStack>
                      </XStack>

                      <XStack gap="$4" marginTop="$1">
                        <XStack gap="$1.5" alignItems="center">
                          <Package size={14} color="$color10" />
                          <Text fontSize={14} color="$color11">{task.items.length} tétel</Text>
                        </XStack>
                        <XStack gap="$1.5" alignItems="center">
                          <AlertCircle size={14} color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'} />
                          <Text fontSize={14} fontWeight="600" color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'}>
                            {task.priority === 1 ? 'Kritikus' : task.priority === 2 ? 'Magas' : task.priority === 3 ? 'Normál' : 'Alacsony'}
                          </Text>
                        </XStack>
                      </XStack>

                      <XStack gap="$1.5" alignItems="center" marginTop="$1">
                        <Clock size={14} color="$color10" />
                        <Text fontSize={13} color="$color11">
                          {task.deadline
                            ? `${new Date(task.deadline).toLocaleTimeString()} (${Math.max(0, Math.round((new Date(task.deadline).getTime() - Date.now()) / 60000))}p hátra)`
                            : 'Nincs határidő'}
                        </Text>
                      </XStack>
                    </YStack>
                  </Card>
                </YStack>
              );
            })}
          </YStack>
        ) : (
          <YStack flex={1} gap="$4" justifyContent="center" alignItems="center" paddingVertical="$10">
            <Search size={48} color="$color8" />
            <YStack alignItems="center" gap="$1">
              <Text fontSize={16} fontWeight="600" color="$color11" textAlign="center">
                Nincsenek aktív komissiók
              </Text>
              <Text fontSize={13} color="$color9" textAlign="center">
                A kész és törölt feladatok a &quot;Feladatok&quot; listában maradnak, itt csak a nyitott munkák látszanak.
              </Text>
            </YStack>
            <Button size="$3" theme="blue" marginTop="$2" onPress={() => router.push('/items')}>
              Feladatok böngészése
            </Button>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
