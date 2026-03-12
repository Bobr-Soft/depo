import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, ClipboardList, RefreshCw, AlertCircle, Plus, Trash2 } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetTasks, adminCreateTask, adminDeleteTask, adminUpdateTask, type CreateTaskInput } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";
import type { TaskComplete } from "@/constants/types";

const STATUS_LABELS: Record<string, string> = {
  pending: "Várakozik",
  in_progress: "Folyamatban",
  completed: "Kész",
  cancelled: "Törölve",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "$blue10",
  in_progress: "$orange10",
  completed: "$green10",
  cancelled: "$color9",
};

const PRIORITY_LABELS: Record<number, string> = { 1: "Kritikus", 2: "Magas", 3: "Normál", 4: "Alacsony" };
const PRIORITY_COLORS: Record<number, string> = { 1: "$red10", 2: "$yellow10", 3: "$green10", 4: "$color10" };

const TASK_TYPES: { label: string; value: CreateTaskInput["type"] }[] = [
  { label: "Komissiózás", value: "picking" },
  { label: "Bevételezés", value: "inbound" },
  { label: "Áthelyezés", value: "transfer" },
];

export default function AdminTasksScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTasks(await adminGetTasks());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a feladatokat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleCreate = () => {
    Alert.prompt(
      "Feladat neve",
      "Adja meg az új feladat nevét:",
      async (name) => {
        if (!name?.trim()) return;
        // Ask for type
        Alert.alert(
          "Feladat típusa",
          "Válasszon típust:",
          TASK_TYPES.map(t => ({
            text: t.label,
            onPress: async () => {
              // Ask for priority
              Alert.alert(
                "Prioritás",
                "Válasszon prioritást:",
                [
                  { text: "Kritikus (1)", onPress: () => doCreate(name.trim(), t.value, 1) },
                  { text: "Magas (2)", onPress: () => doCreate(name.trim(), t.value, 2) },
                  { text: "Normál (3)", onPress: () => doCreate(name.trim(), t.value, 3) },
                  { text: "Alacsony (4)", onPress: () => doCreate(name.trim(), t.value, 4) },
                  { text: "Mégse", style: "cancel" },
                ]
              );
            },
          }))
        );
      },
      "plain-text",
      ""
    );
  };

  const doCreate = async (name: string, type: CreateTaskInput["type"], priority: number) => {
    try {
      await adminCreateTask({ name, type, priority });
      await loadTasks();
    } catch (err) {
      Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült létrehozni.");
    }
  };

  const handleDelete = (task: TaskComplete) => {
    Alert.alert(
      "Törlés megerősítése",
      `Biztosan törli ezt a feladatot?\n${task.name}`,
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "Törlés",
          style: "destructive",
          onPress: async () => {
            try {
              await adminDeleteTask(task.id);
              setTasks(prev => prev.filter(t => t.id !== task.id));
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült törölni.");
            }
          },
        },
      ]
    );
  };

  const handleChangePriority = (task: TaskComplete) => {
    Alert.alert(
      "Prioritás módosítása",
      `${task.name} — jelenlegi: ${PRIORITY_LABELS[task.priority] ?? String(task.priority)}`,
      [
        { text: "Kritikus (1)", onPress: () => doPriorityUpdate(task, 1) },
        { text: "Magas (2)", onPress: () => doPriorityUpdate(task, 2) },
        { text: "Normál (3)", onPress: () => doPriorityUpdate(task, 3) },
        { text: "Alacsony (4)", onPress: () => doPriorityUpdate(task, 4) },
        { text: "Mégse", style: "cancel" },
      ]
    );
  };

  const doPriorityUpdate = async (task: TaskComplete, priority: number) => {
    try {
      await adminUpdateTask(task.id, { priority });
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, priority } : t));
    } catch (err) {
      Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült frissíteni.");
    }
  };

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Feladatkezelő</H2>
            <Text fontSize={14} color="$color10">Összes feladat áttekintése</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadTasks} disabled={loading} />
          <Button size="$3" theme="green" circular icon={Plus} onPress={handleCreate} />
        </XStack>
      </YStack>

      {!syncStatus.isOnline && (
        <XStack
          backgroundColor="$orange5"
          paddingHorizontal="$4"
          paddingVertical="$2"
          alignItems="center"
          gap="$2"
          marginBottom="$1"
        >
          <AlertCircle size={14} color="$orange10" />
          <Text fontSize={13} color="$orange10" fontWeight="600">
            Offline – módosítások nem elérhetők
          </Text>
        </XStack>
      )}

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
            <AlertCircle size={32} color="$red10" />
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" onPress={loadTasks}>Újrapróbálkozás</Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$1">{tasks.length} feladat</Text>

            {tasks.map((task) => (
              <Card
                key={task.id}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="$color4"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack width={40} height={40} backgroundColor="$green5" borderRadius="$3" alignItems="center" justifyContent="center">
                    <ClipboardList size={18} color="$green10" />
                  </YStack>
                  <YStack flex={1} gap="$0.5">
                    <Text fontSize={14} fontWeight="600" color="$color12">{task.name}</Text>
                    <XStack gap="$2" alignItems="center">
                      <Text fontSize={12} color={STATUS_COLORS[task.status] ?? "$color10"} fontWeight="600">
                        {STATUS_LABELS[task.status] ?? task.status}
                      </Text>
                      <Text fontSize={12} color={PRIORITY_COLORS[task.priority] ?? "$color10"}>
                        {PRIORITY_LABELS[task.priority] ?? "Ismeretlen"}
                      </Text>
                    </XStack>
                    <Text fontSize={12} color="$color10">
                      {task.assigned_user_data?.email ?? "Nincs hozzárendelve"}
                    </Text>
                  </YStack>
                  <XStack gap="$2">
                    <Button
                      size="$2"
                      theme="gray"
                      onPress={() => handleChangePriority(task)}
                      disabled={!syncStatus.isOnline}
                    >
                      P{task.priority}
                    </Button>
                    <Button
                      size="$2"
                      theme="red"
                      circular
                      icon={Trash2}
                      onPress={() => handleDelete(task)}
                      disabled={!syncStatus.isOnline}
                    />
                  </XStack>
                </XStack>
              </Card>
            ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}

