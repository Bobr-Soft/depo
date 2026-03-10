import { H2, Text, YStack, XStack, Button, Card, ScrollView, Package, Spinner } from "@repo/ui";
import loadTasks, { refreshTasks } from "@/components/api";
import { TaskComplete } from "@/constants/types";
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { useSyncStatus } from "@/hooks";
import { RefreshCw, WifiOff } from "@tamagui/lucide-icons";

export default function PickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncStatus = useSyncStatus();

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

  useEffect(() => { fetchTasks(); }, []);

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <YStack flex={1}>
            <H2 color="$color12">Komissiózás (Picking)</H2>
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
      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <YStack gap="$1">
            <Text fontSize={14} fontWeight="600" color="$color11">Felvételi feladatok</Text>
            <Text fontSize={12} color="$color9">{tasks.length} aktív feladat</Text>
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
            <Button size="$4" theme="blue" pressStyle={{ scale: 0.95 }} onPress={() => router.push('/items')}>
              <Text fontWeight="600">Feladatok</Text>
            </Button>
          </XStack>
        </XStack>
        <ScrollView flex={1} backgroundColor="$background">
          {loading || refreshing ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$6">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
              <Button size="$3" onPress={fetchTasks}><Text>Újra</Text></Button>
            </YStack>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              task.status == "in_progress" ?
              <Card key={task.id} backgroundColor="$background" marginBottom="$2" onPress={() => router.push({ pathname: "/picking/[id]", params: { id: task.id } })}>
                <XStack gap="$3" alignItems="center">
                  <YStack flex={1} gap="$1" backgroundColor="$color5" padding="$4" borderRadius="$4">
                    <Text fontWeight="600" fontSize={20}>{task.source_id ?? 'Nincs forrás'}</Text>
                    <XStack gap="$1.5" alignItems="center">
                      <Package size={18} color="$color10" />
                      <Text fontSize={16} color="$color10">{task.items.length} tétel</Text>
                    </XStack>
                    <XStack gap="$1.5" alignItems="center">
                      <Text fontSize={16} color="$color11">Prioritás:</Text>
                      <Text fontSize={16} fontWeight="600" color={task.priority === 1 ? '$red10' : task.priority === 2 ? '$yellow10' : '$green10'}>
                        {task.priority === 1 ? 'Kritikus' : task.priority === 2 ? 'Magas' : task.priority === 3 ? 'Normál' : 'Alacsony'}
                      </Text>
                    </XStack>
                    <Text fontSize={14} color="$color11">Státusz: {task.status}</Text>
                    <Text fontSize={14} color="$color11">
                      Határidő: {task.deadline ? `${new Date(task.deadline).toLocaleString()} (${Math.max(0, Math.round((new Date(task.deadline).getTime() - Date.now()) / 60000))} perc hátra)` : 'N/A'}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
              : null
            ))
          ) : (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={16} color="$color10" textAlign="center">
                Nincsenek aktív feladatok
              </Text>
              <Text fontSize={12} color="$color9" textAlign="center">
                Új feladat felvételéhez nyomja meg az &ldquo;Feladatok&rdquo; gombot
              </Text>
            </YStack>
          )}
        </ScrollView>
      </Card>
    </YStack>
  );
}
