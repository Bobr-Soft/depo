import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, Users, RefreshCw, AlertCircle, AlertTriangle, Eye } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetUsers, adminGetTasks, type AdminUserResponse } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";
import type { TaskComplete } from "@/constants/types";
import { CARD } from "@/constants";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Vezető",
  worker: "Dolgozó",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "$red10",
  supervisor: "$orange10",
  worker: "$blue10",
};

function isActive(user: AdminUserResponse): boolean {
  return Boolean(user.is_active ?? (user as any).isActive);
}

function formatLastLogin(date: Date | null | string | undefined): string {
  if (!date) return "Sohasem";
  const d = new Date(date as string);
  if (isNaN(d.getTime())) return "Ismeretlen";
  return d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function SupervisorWorkersScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allUsers, allTasks] = await Promise.all([adminGetUsers(), adminGetTasks()]);
      setUsers(allUsers.filter(u => u.role !== "admin"));
      setTasks(allTasks);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a dolgozókat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const activeCount = users.filter(isActive).length;

  const getActiveTask = (userId: number): TaskComplete | undefined =>
    tasks.find(t =>
      t.assigned_user === userId &&
      (t.status === "in_progress" || t.status === "pending")
    );

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Dolgozói áttekintés</H2>
            <Text fontSize={14} color="$color10">Aktív munkavállalók listája</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadData} disabled={loading} />
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
          <AlertTriangle size={14} color="$orange10" />
          <Text fontSize={13} color="$orange10" fontWeight="600">
            Offline – az adatok esetleg nem naprakészek
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
            <Button size="$3" onPress={loadData}>Újrapróbálkozás</Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <XStack gap="$3" marginBottom="$2">
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={20} fontWeight="800" color="$green10">{activeCount}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Aktív</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={20} fontWeight="800" color="$color12">{users.length}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Összes</Text>
              </Card>
            </XStack>

            {users.map((user) => {
              const activeTask = typeof user.id === "number" ? getActiveTask(user.id) : undefined;
              return (
                <Card
                  key={user.id}
                  backgroundColor="$color2"
                  borderRadius={CARD.radius}
                  padding={CARD.padding}
                  borderWidth={1}
                  borderColor={!isActive(user) ? "$red5" : CARD.border}
                >
                  <XStack alignItems="center" gap="$3">
                    <YStack
                      width={40}
                      height={40}
                      backgroundColor={isActive(user) ? "$green5" : "$color4"}
                      borderRadius={20}
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Users size={18} color={isActive(user) ? "$green10" : "$color9"} />
                    </YStack>
                    <YStack flex={1} gap="$0.5">
                      <Text fontSize={14} fontWeight="600" color="$color12" numberOfLines={1}>{user.email}</Text>
                      <XStack gap="$2" alignItems="center">
                        <Text fontSize={12} color={ROLE_COLORS[user.role?.toLowerCase() ?? ""] ?? "$color10"} fontWeight="600">
                          {ROLE_LABELS[user.role?.toLowerCase() ?? ""] ?? user.role}
                        </Text>
                        <Text fontSize={12} color={isActive(user) ? "$green10" : "$red10"}>
                          {isActive(user) ? "Aktív" : "Inaktív"}
                        </Text>
                      </XStack>
                      {activeTask ? (
                        <Text fontSize={12} color="$orange10" numberOfLines={1}>
                          ▶ {activeTask.name}
                        </Text>
                      ) : (
                        <Text fontSize={12} color="$color9">
                          Utolsó belépés: {formatLastLogin(user.last_login)}
                        </Text>
                      )}
                    </YStack>
                  </XStack>
                  {activeTask && (
                    <XStack gap="$2" marginTop="$2">
                      <Button
                        size="$3"
                        theme="blue"
                        flex={1}
                        icon={Eye}
                        onPress={() => router.push({ pathname: "/picking/[id]", params: { id: activeTask.id } })}
                      >
                        <Text fontSize={12} fontWeight="600">Feladat megtekintése</Text>
                      </Button>
                    </XStack>
                  )}
                </Card>
              );
            })}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
