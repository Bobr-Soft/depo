import { useEffect, useMemo, useState } from "react";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner } from "@repo/ui";
import { router } from "expo-router";
import { RefreshCw } from "@tamagui/lucide-icons";
import loadTasks, { refreshTasks, takeTask } from "@/components/api";
import { TaskComplete } from "@/constants/types";

const ASSIGNABLE_STATUSES = new Set(["pending", "in_progress"]);

function getPriorityLabel(priority: number): string {
  if (priority === 1) return "Kritikus";
  if (priority === 2) return "Magas";
  if (priority === 3) return "Normál";
  return "Alacsony";
}

export default function NewPickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unassignedTasks = useMemo(
    () =>
      tasks
        .filter((task) => task.assigned_user === null && ASSIGNABLE_STATUSES.has(task.status))
        .sort((a, b) => {
          if (a.priority !== b.priority) {
            return a.priority - b.priority;
          }

          if (!a.deadline && !b.deadline) {
            return a.id - b.id;
          }

          if (!a.deadline) return 1;
          if (!b.deadline) return -1;
          return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        }),
    [tasks]
  );

  async function fetchTasks() {
    setLoading(true);
    setError(null);

    try {
      const data = await loadTasks();
      setTasks(data);
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
      const data = await refreshTasks();
      setTasks(data);
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
      const data = await refreshTasks();
      setTasks(data);
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
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <XStack gap="$3" alignItems="center">
            <Button size="$3" onPress={() => router.back()}>
              <Text>← Vissza</Text>
            </Button>
            <H2 color="$color12">Feladat hozzárendelés</H2>
          </XStack>
          <Button size="$3" theme="gray" onPress={handleRefresh} disabled={refreshing || loading}>
            <RefreshCw size={16} color="$color11" />
          </Button>
        </XStack>
        <Text fontSize={14} color="$color10">Nem hozzárendelt feladatok felvétele</Text>
        {notice ? <Text fontSize={13} color="$green10">{notice}</Text> : null}
        {error ? <Text fontSize={13} color="$red10">{error}</Text> : null}
      </YStack>

      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize={16} fontWeight="600">Szabad feladatok</Text>
          <Text fontSize={12} color="$color10">{unassignedTasks.length} db</Text>
        </XStack>

        <ScrollView flex={1}>
          {loading || refreshing ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$6">
              <Spinner size="large" />
            </YStack>
          ) : unassignedTasks.length === 0 ? (
            <YStack flex={1} justifyContent="center" alignItems="center" gap="$2" paddingVertical="$8">
              <Text fontSize={16} color="$color10" textAlign="center">Nincs szabad feladat</Text>
              <Text fontSize={12} color="$color9" textAlign="center">
                Minden feladat már hozzá van rendelve, vagy nincs aktív feladat.
              </Text>
            </YStack>
          ) : (
            <YStack gap="$3">
              {unassignedTasks.map((task) => {
                const isAssigning = assigningTaskId === task.id;

                return (
                  <Card key={task.id} backgroundColor="$color2" padding="$4" borderRadius="$4" gap="$3">
                    <YStack gap="$1">
                      <Text fontSize={17} fontWeight="700" color="$color12">{task.source_id ?? task.name}</Text>
                      <Text fontSize={13} color="$color10">{task.name}</Text>
                    </YStack>

                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$color11">Típus: {task.type}</Text>
                      <Text fontSize={12} color="$color11">Státusz: {task.status}</Text>
                    </XStack>

                    <XStack justifyContent="space-between" alignItems="center">
                      <Text fontSize={12} color="$color11">Prioritás: {getPriorityLabel(task.priority)}</Text>
                      <Text fontSize={12} color="$color11">
                        Határidő: {task.deadline ? new Date(task.deadline).toLocaleString() : "N/A"}
                      </Text>
                    </XStack>

                    <Button
                      size="$4"
                      theme="blue"
                      disabled={isAssigning}
                      onPress={() => handleTakeTask(task)}
                    >
                      <Text fontWeight="600">
                        {isAssigning ? "Felvétel folyamatban..." : "Felveszem"}
                      </Text>
                    </Button>
                  </Card>
                );
              })}
            </YStack>
          )}
        </ScrollView>
      </Card>
    </YStack>
  );
}
