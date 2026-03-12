import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, RefreshCw, AlertCircle, WifiOff } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetTasks, adminGetUsers, type AdminUserResponse } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";

interface ShiftStats {
  totalTasks: number;
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  urgentTasks: number;
  totalItems: number;
  pickedItems: number;
  totalWorkers: number;
  activeWorkers: number;
}

function isActive(user: AdminUserResponse): boolean {
  return Boolean(user.is_active ?? (user as any).isActive);
}

export default function SupervisorStatsScreen() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useSyncStatus();
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tasks, users] = await Promise.all([adminGetTasks(), adminGetUsers()]);
      const workers = users.filter(u => u.role !== "admin");
      const totalItems = tasks.reduce((sum, t) => sum + t.items.reduce((s, i) => s + (i.requested_quantity ?? 0), 0), 0);
      const pickedItems = tasks.reduce((sum, t) => sum + t.items.reduce((s, i) => s + (i.picked_quantity ?? 0), 0), 0);
      setStats({
        totalTasks: tasks.length,
        pendingTasks: tasks.filter(t => t.status === "pending").length,
        inProgressTasks: tasks.filter(t => t.status === "in_progress").length,
        completedTasks: tasks.filter(t => t.status === "completed").length,
        urgentTasks: tasks.filter(t => t.priority === 1 && (t.status === "pending" || t.status === "in_progress")).length,
        totalItems,
        pickedItems,
        totalWorkers: workers.length,
        activeWorkers: workers.filter(isActive).length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a statisztikákat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  const fulfillPct = stats && stats.totalItems > 0
    ? Math.round((stats.pickedItems / stats.totalItems) * 100)
    : 0;

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Műszak statisztika</H2>
            <Text fontSize={14} color="$color10">Teljesítmény és feladat áttekintés</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadStats} disabled={loading} />
        </XStack>
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {!isOnline && (
        <XStack backgroundColor="$orange3" paddingHorizontal="$4" paddingVertical="$2" gap="$2" alignItems="center">
          <WifiOff size={14} color="$orange10" />
          <Text fontSize={12} color="$orange10">Offline mód – adatok frissítése nem elérhető</Text>
        </XStack>
      )}

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
            <AlertCircle size={32} color="$red10" />
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" onPress={loadStats}>Újrapróbálkozás</Button>
          </YStack>
        ) : stats ? (
          <YStack gap="$4">
            {/* Dolgozók */}
            <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1">
              Dolgozók
            </Text>
            <XStack gap="$3">
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={22} fontWeight="800" color="$green10">{stats.activeWorkers}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Aktív</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={22} fontWeight="800" color="$color12">{stats.totalWorkers}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Összes</Text>
              </Card>
            </XStack>

            {/* Feladatok */}
            <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1" marginTop="$2">
              Feladatok
            </Text>
            <XStack gap="$3">
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={20} fontWeight="800" color="$blue10">{stats.pendingTasks}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Vár</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={20} fontWeight="800" color="$orange10">{stats.inProgressTasks}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Folyamatban</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={20} fontWeight="800" color="$green10">{stats.completedTasks}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Kész</Text>
              </Card>
            </XStack>

            {stats.urgentTasks > 0 && (
              <Card backgroundColor="$red2" borderRadius="$4" padding="$3" borderWidth={1} borderColor="$red5">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={14} color="$red10">Sürgős feladatok</Text>
                  <Text fontSize={18} fontWeight="800" color="$red10">{stats.urgentTasks}</Text>
                </XStack>
              </Card>
            )}

            {/* Kommissió teljesítés */}
            <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1" marginTop="$2">
              Kommissió teljesítés
            </Text>
            <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={14} color="$color11">Szedett tételek</Text>
                <Text fontSize={16} fontWeight="700" color="$color12">
                  {stats.pickedItems} / {stats.totalItems} db
                </Text>
              </XStack>
              <Separator borderColor="$color4" />
              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={14} color="$color11">Teljesítési arány</Text>
                <Text
                  fontSize={16}
                  fontWeight="700"
                  color={fulfillPct >= 80 ? "$green10" : fulfillPct >= 50 ? "$orange10" : "$red10"}
                >
                  {fulfillPct}%
                </Text>
              </XStack>
            </Card>
          </YStack>
        ) : null}
      </ScrollView>
    </YStack>
  );
}
