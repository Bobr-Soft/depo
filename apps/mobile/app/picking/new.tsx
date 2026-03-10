import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { RefreshCw, ArrowLeft, WifiOff, AlertCircle, Clock, Package, CheckCircle2 } from "@tamagui/lucide-icons";
import loadTasks, { refreshTasks, takeTask } from "@/components/api";
import { TaskComplete } from "@/constants/types";
import { useSyncStatus } from "@/hooks";

// --- SEGÉDFÜGGVÉNYEK (Komponensen kívül a felesleges újrarenderelés elkerülésére) ---
const ASSIGNABLE_STATUSES = new Set(["pending", "in_progress"]);

function getPriorityLabel(priority: number): string {
  if (priority === 1) return "Kritikus";
  if (priority === 2) return "Magas";
  if (priority === 3) return "Normál";
  return "Alacsony";
}

function getPriorityColor(priority: number) {
  if (priority === 1) return "$red10";
  if (priority === 2) return "$yellow10";
  if (priority === 3) return "$green10";
  return "$color10";
}

export default function NewPickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const syncStatus = useSyncStatus();

  const unassignedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.assigned_user === null && ASSIGNABLE_STATUSES.has(task.status))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (!a.deadline && !b.deadline) return a.id - b.id;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [tasks]);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      setTasks(await loadTasks());
    } catch {
      setError("Nem sikerült betölteni a hozzárendelhető feladatokat.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      setTasks(await refreshTasks());
    } catch {
      setError("Nem sikerült frissíteni a feladatlistát.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTakeTask(task: TaskComplete) {
    setAssigningTaskId(task.id);
    setError(null);
    setNotice(null);

    try {
      const ok = await takeTask(task.id);
      if (!ok) {
        setError("A feladat felvétele nem sikerült.");
        return;
      }
      setNotice(`Feladat felvéve: ${task.source_id ?? task.name}`);
      setTasks(await refreshTasks());
      router.push({ pathname: "/picking/[id]", params: { id: task.id } });
    } catch {
      setError("A feladat felvétele közben hiba történt.");
    } finally {
      setAssigningTaskId(null);
    }
  }

  useEffect(() => {
    fetchTasks();
  }, []);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      {/* FEJLÉC SZEKCIÓ */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Új feladat</H2>
            <Text fontSize={14} color="$color10">Szabad feladatok felvétele</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={handleRefresh} disabled={refreshing || loading || !syncStatus.isOnline} />
        </XStack>

        {/* ÉRTESÍTÉSEK / VISSZAJELZÉSEK */}
        {!syncStatus.isOnline && (
          <XStack backgroundColor="$orange5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <WifiOff size={16} color="$orange10" />
            <Text fontSize={12} color="$orange10">Offline mód - Felvétel letiltva</Text>
          </XStack>
        )}
        {notice && (
          <XStack backgroundColor="$green5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <CheckCircle2 size={16} color="$green10" />
            <Text fontSize={12} color="$green10">{notice}</Text>
          </XStack>
        )}
        {error && (
          <XStack backgroundColor="$red5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <AlertCircle size={16} color="$red10" />
            <Text fontSize={12} color="$red10">{error}</Text>
          </XStack>
        )}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* FŐ LISTA SZEKCIÓ */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <XStack justifyContent="space-between" alignItems="center" marginBottom="$3" paddingHorizontal="$1">
          <Text fontSize={14} fontWeight="600" color="$color11">Elérhető feladatok</Text>
          <Text fontSize={12} color="$color9">{unassignedTasks.length} db</Text>
        </XStack>

        {loading || refreshing ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : unassignedTasks.length === 0 ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
            <CheckCircle2 size={48} color="$color8" />
            <YStack alignItems="center" gap="$1">
              <Text fontSize={16} fontWeight="600" color="$color11" textAlign="center">Nincs szabad feladat</Text>
              <Text fontSize={13} color="$color9" textAlign="center">Jelenleg minden feladat ki van osztva.</Text>
            </YStack>
          </YStack>
        ) : (
          <YStack gap="$3">
            {unassignedTasks.map((task) => {
              const isAssigning = assigningTaskId === task.id;

              return (
                <Card key={task.id} backgroundColor="$color3" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4">
                  <YStack gap="$2">

                    {/* Kártya Fejléc */}
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1}>
                        <Text fontWeight="700" fontSize={18} color="$color12">{task.source_id ?? task.name}</Text>
                        <Text fontSize={13} color="$color10">{task.name}</Text>
                      </YStack>
                      <YStack backgroundColor="$blue5" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3">
                        <Text fontSize={10} fontWeight="700" color="$blue10" textTransform="uppercase">{task.type}</Text>
                      </YStack>
                    </XStack>

                    {/* Meta adatok hálója */}
                    <XStack gap="$4" marginTop="$1">
                      <XStack gap="$1.5" alignItems="center">
                        <Package size={14} color="$color10" />
                        <Text fontSize={14} color="$color11">{task.items?.length || 0} tétel</Text>
                      </XStack>
                      <XStack gap="$1.5" alignItems="center">
                        <AlertCircle size={14} color={getPriorityColor(task.priority)} />
                        <Text fontSize={14} fontWeight="600" color={getPriorityColor(task.priority)}>
                          {getPriorityLabel(task.priority)}
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

                    {/* Akció gomb */}
                    <Button
                      marginTop="$2"
                      size="$4"
                      theme="blue"
                      disabled={isAssigning || !syncStatus.isOnline}
                      onPress={() => handleTakeTask(task)}
                    >
                      <Text fontWeight="600">
                        {isAssigning ? "Felvétel folyamatban..." : "Felveszem"}
                      </Text>
                    </Button>

                  </YStack>
                </Card>
              );
            })}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
