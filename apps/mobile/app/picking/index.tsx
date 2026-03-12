import { useMemo, useState, useEffect } from "react";
import { router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { RefreshCw, WifiOff, Package, AlertCircle, Clock, Search } from "@tamagui/lucide-icons";
import loadTasks, { refreshTasks } from "@/components/api";
import { TaskComplete } from "@/constants/types";
import { useSyncStatus } from "@/hooks";

export default function PickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStatus();

  // Show all tasks assigned to the current user that are not finished
  const activeTasks = useMemo(() => {
    return tasks.filter(
      (task) =>
        task.assigned_user !== null &&
        task.status !== 'completed' &&
        task.status !== 'cancelled'
    );
  }, [tasks]);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      setTasks(await loadTasks());
    } catch {
      setError('Nem sikerült betölteni a feladatokat.');
    } finally {
      setLoading(false);
    }
  }

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

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" justifyContent="space-between">
          <YStack>
            <H2 color="$color12">Komissiózás</H2>
            <Text fontSize={14} color="$color10">Saját aktív feladatok</Text>
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
        ) : activeTasks.length > 0 ? (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$1" paddingHorizontal="$1">
              <Text fontSize={14} fontWeight="600" color="$color11">Hozzárendelt feladatok</Text>
              <Text fontSize={12} color="$color9">{activeTasks.length} db</Text>
            </XStack>

            {activeTasks.map((task) => (
              <Card
                key={task.id}
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
                    <YStack
                      backgroundColor={task.status === 'in_progress' ? '$orange5' : '$blue5'}
                      paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3"
                    >
                      <Text
                        fontSize={10} fontWeight="700" textTransform="uppercase"
                        color={task.status === 'in_progress' ? '$orange10' : '$blue10'}
                      >
                        {task.status === 'in_progress' ? 'Folyamatban' : 'Hozzárendelt'}
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
            ))}
          </YStack>
        ) : (
          <YStack flex={1} gap="$4" justifyContent="center" alignItems="center" paddingVertical="$10">
            <Search size={48} color="$color8" />
            <YStack alignItems="center" gap="$1">
              <Text fontSize={16} fontWeight="600" color="$color11" textAlign="center">
                Nincsenek aktív komissiók
              </Text>
              <Text fontSize={13} color="$color9" textAlign="center">
                Válassz egyet a &quot;Feladatok&quot; listából a folytatáshoz.
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
