import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import {
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  AlertCircle,
  Users,
  PackageMinus,
  TrendingUp,
} from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetUsers, adminGetTasks } from "@/components/adminApi";

interface ShiftKpi {
  activeWorkers: number;
  urgentTasks: number;
  totalItemsPicked: number;
}

export default function SupervisorScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<ShiftKpi>({ activeWorkers: 0, urgentTasks: 0, totalItemsPicked: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, tasks] = await Promise.all([adminGetUsers(), adminGetTasks()]);
      const activeWorkers = users.filter(
        u => u.role === 'worker' && Boolean(u.is_active ?? (u as any).isActive)
      ).length;
      const urgentTasks = tasks.filter(
        t => t.priority === 1 && (t.status === 'pending' || t.status === 'in_progress')
      ).length;
      const totalItemsPicked = tasks.reduce(
        (sum, t) => sum + t.items.reduce((s, i) => s + (i.picked_quantity ?? 0), 0), 0
      );
      setKpi({ activeWorkers, urgentTasks, totalItemsPicked });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nem sikerült betölteni az adatokat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { handleRefresh(); }, [handleRefresh]);

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>

      {/* FEJLÉC */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Vezetői Panel</H2>
            <Text fontSize={14} color="$color10">Napi operatív irányítás és műszakvezetés</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={handleRefresh} disabled={loading} />
        </XStack>
        {error && <Text fontSize={13} color="$red10">{error}</Text>}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* MŰSZAK ÁLLAPOTA (KPI) */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" textTransform="uppercase">
          Műszak állapota
        </Text>
        <XStack gap="$3" marginBottom="$4">
          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color="$blue10">{kpi.activeWorkers}</Text>}
            <Text fontSize={11} color="$color10" textAlign="center">Aktív dolgozó</Text>
          </Card>

          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor={kpi.urgentTasks > 0 ? "$red2" : "$color3"} alignItems="center" gap="$1" borderWidth={1} borderColor={kpi.urgentTasks > 0 ? "$red5" : "$color4"}>
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color={kpi.urgentTasks > 0 ? "$red10" : "$color12"}>{kpi.urgentTasks}</Text>}
            <Text fontSize={11} color={kpi.urgentTasks > 0 ? "$red10" : "$color10"} textAlign="center">Sürgős feladat</Text>
          </Card>

          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color="$green10">{kpi.totalItemsPicked}</Text>}
            <Text fontSize={11} color="$color10" textAlign="center">Szedett tétel</Text>
          </Card>
        </XStack>

        {/* OPERATÍV MODULOK */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" marginTop="$2" textTransform="uppercase">
          Feladatkezelés
        </Text>
        <YStack gap="$3">

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/supervisor/tasks")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$blue5" borderRadius="$3" alignItems="center" justifyContent="center">
                <ClipboardList size={20} color="$blue10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Feladatok priorizálása</Text>
                <Text fontSize={13} color="$color10">Sorrend módosítása, manuális delegálás</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/supervisor/workers")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$green5" borderRadius="$3" alignItems="center" justifyContent="center">
                <Users size={20} color="$green10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Dolgozói áttekintés</Text>
                <Text fontSize={13} color="$color10">Ki min dolgozik éppen, teljesítmények</Text>
              </YStack>
            </XStack>
          </Card>

        </YStack>

        {/* KIVÉTELEK ÉS PROBLÉMÁK */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" marginTop="$4" textTransform="uppercase">
          Probléma kezelés
        </Text>
        <YStack gap="$3">

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/supervisor/shortages")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$orange5" borderRadius="$3" alignItems="center" justifyContent="center">
                <PackageMinus size={20} color="$orange10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Készlethiányok</Text>
                <Text fontSize={13} color="$color10">Részlegesen teljesített komissiók kezelése</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/supervisor/damages")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$red5" borderRadius="$3" alignItems="center" justifyContent="center">
                <AlertCircle size={20} color="$red10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Sérült áru jelentések</Text>
                <Text fontSize={13} color="$color10">Dolgozók által jelentett selejtek jóváhagyása</Text>
              </YStack>
            </XStack>
          </Card>

        </YStack>

        {/* STATISZTIKA */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" marginTop="$4" textTransform="uppercase">
          Elemzés
        </Text>
        <YStack gap="$3">
          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/supervisor/stats")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$color5" borderRadius="$3" alignItems="center" justifyContent="center">
                <TrendingUp size={20} color="$color11" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Műszak statisztika</Text>
                <Text fontSize={13} color="$color10">Átlagos kiszedési idők, elakadások elemzése</Text>
              </YStack>
            </XStack>
          </Card>
        </YStack>

      </ScrollView>
    </YStack>
  );
}
