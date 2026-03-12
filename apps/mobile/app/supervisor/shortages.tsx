import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, PackageMinus, RefreshCw, AlertCircle, CheckCircle2, WifiOff } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetTasks, adminAcceptShortage } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";
import type { TaskItemComplete } from "@/constants/types";

interface ShortageEntry {
  taskId: number;
  taskName: string;
  item: TaskItemComplete;
  shortfall: number;
}

export default function SupervisorShortagesScreen() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useSyncStatus();
  const [shortages, setShortages] = useState<ShortageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState<string | null>(null);

  const handleAcceptShortage = (entry: ShortageEntry) => {
    if (!isOnline) return;
    Alert.alert(
      "Hiány elfogadása",
      `Biztosan elfogadja a hiányt?\n${entry.item.item.name} — ${entry.shortfall} db hiány a(z) "${entry.taskName}" feladatból.`,
      [
        { text: "Mégsem", style: "cancel" },
        {
          text: "Elfogadás",
          onPress: async () => {
            const key = `${entry.taskId}-${entry.item.item.id}`;
            setAccepting(key);
            try {
              await adminAcceptShortage(entry.taskId, entry.item.item.id);
              await loadShortages();
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült elfogadni a hiányt.");
            } finally {
              setAccepting(null);
            }
          },
        },
      ]
    );
  };

  const loadShortages = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tasks = await adminGetTasks();
      const entries: ShortageEntry[] = [];
      for (const task of tasks) {
        if (task.status === "completed" || task.status === "cancelled") continue;
        for (const ti of task.items) {
          const shortfall = (ti.requested_quantity ?? 0) - (ti.picked_quantity ?? 0);
          if (shortfall > 0 && ti.status !== "picked") {
            entries.push({ taskId: task.id, taskName: task.name, item: ti, shortfall });
          }
        }
      }
      setShortages(entries);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a hiányokat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadShortages(); }, [loadShortages]);

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Készlethiányok</H2>
            <Text fontSize={14} color="$color10">Részlegesen teljesített komissiók</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadShortages} disabled={loading} />
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
            <Button size="$3" onPress={loadShortages}>Újrapróbálkozás</Button>
          </YStack>
        ) : shortages.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$10">
            <CheckCircle2 size={40} color="$green10" />
            <Text fontSize={16} fontWeight="600" color="$color12">Nincs hiány</Text>
            <Text fontSize={14} color="$color10" textAlign="center">
              Az összes aktív kommissió teljes mértékben teljesíthető.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$1">
              {shortages.length} hiányos tétel
            </Text>

            {shortages.map((entry, idx) => (
              <Card
                key={`${entry.taskId}-${entry.item.id}-${idx}`}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="$orange5"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack width={40} height={40} backgroundColor="$orange5" borderRadius="$3" alignItems="center" justifyContent="center">
                    <PackageMinus size={18} color="$orange10" />
                  </YStack>
                  <YStack flex={1} gap="$0.5">
                    <Text fontSize={14} fontWeight="600" color="$color12">{entry.item.item.name}</Text>
                    <Text fontSize={12} color="$color10" numberOfLines={1}>{entry.taskName}</Text>
                    <XStack gap="$3" alignItems="center" marginTop="$0.5">
                      <Text fontSize={12} color="$color10">
                        Kért: <Text color="$color12" fontWeight="600">{entry.item.requested_quantity} db</Text>
                      </Text>
                      <Text fontSize={12} color="$color10">
                        Szedett: <Text color="$green10" fontWeight="600">{entry.item.picked_quantity} db</Text>
                      </Text>
                      <Text fontSize={12} color="$orange10" fontWeight="600">-{entry.shortfall} db</Text>
                    </XStack>
                    <Button
                      size="$2"
                      theme="green"
                      marginTop="$2"
                      disabled={!isOnline || accepting === `${entry.taskId}-${entry.item.item.id}`}
                      onPress={() => handleAcceptShortage(entry)}
                    >
                      {accepting === `${entry.taskId}-${entry.item.item.id}` ? "Feldolgozás..." : "Hiány elfogadása"}
                    </Button>
                  </YStack>
                </XStack>
              </Card>
            ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
