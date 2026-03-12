import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import {
  ArrowLeft,
  Users,
  Boxes,
  ClipboardList,
  Database,
  AlertTriangle,
  RefreshCw,
  Tag,
} from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetUsers, adminGetTasks } from "@/components/adminApi";

interface AdminStats {
  activeUsers: number;
  pendingTasks: number;
  totalUsers: number;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats>({ activeUsers: 0, pendingTasks: 0, totalUsers: 0 });

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [users, tasks] = await Promise.all([adminGetUsers(), adminGetTasks()]);
      const activeUsers = users.filter(u => u.is_active || (u as any).isActive).length;
      const pendingTasks = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress').length;
      setStats({ activeUsers, pendingTasks, totalUsers: users.length });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nem sikerült betölteni az adatokat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>

      {/* FEJLÉC */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Admin Panel</H2>
            <Text fontSize={14} color="$color10">Rendszer és felhasználók kezelése</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={fetchStats} disabled={loading} />
        </XStack>
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>

        {/* GYORS METRIKÁK (KPI) */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" textTransform="uppercase">
          Rendszerállapot
        </Text>
        {error ? (
          <XStack backgroundColor="$red5" padding="$3" borderRadius="$3" alignItems="center" gap="$2" marginBottom="$4">
            <AlertTriangle size={16} color="$red10" />
            <Text fontSize={13} color="$red10" flex={1}>{error}</Text>
          </XStack>
        ) : null}
        <XStack gap="$3" marginBottom="$4">
          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color="$blue10">{stats.activeUsers}</Text>}
            <Text fontSize={11} color="$color10" textAlign="center">Aktív felhasználó</Text>
          </Card>
          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color="$green10">{stats.pendingTasks}</Text>}
            <Text fontSize={11} color="$color10" textAlign="center">Nyitott feladat</Text>
          </Card>
          <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
            {loading ? <Spinner size="small" /> : <Text fontSize={24} fontWeight="800" color="$color12">{stats.totalUsers}</Text>}
            <Text fontSize={11} color="$color10" textAlign="center">Felhasználók</Text>
          </Card>
        </XStack>

        {/* MENEDZSMENT MODULOK */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" marginTop="$2" textTransform="uppercase">
          Modulok
        </Text>
        <YStack gap="$3">

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/users")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$blue5" borderRadius="$3" alignItems="center" justifyContent="center">
                <Users size={20} color="$blue10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Felhasználók kezelése</Text>
                <Text fontSize={13} color="$color10">Új fiók, jelszó visszaállítás, jogosultságok</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/inventory")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$orange5" borderRadius="$3" alignItems="center" justifyContent="center">
                <Boxes size={20} color="$orange10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Katalógus és Készlet</Text>
                <Text fontSize={13} color="$color10">Termékek módosítása, készletkorrekció</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/tasks")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$green5" borderRadius="$3" alignItems="center" justifyContent="center">
                <ClipboardList size={20} color="$green10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Feladatkezelő</Text>
                <Text fontSize={13} color="$color10">Minden feladat áttekintése, manuális kiosztás</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/categories")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$purple5" borderRadius="$3" alignItems="center" justifyContent="center">
                <Tag size={20} color="$purple10" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Kategóriák</Text>
                <Text fontSize={13} color="$color10">Raktározási kategóriák kezelése</Text>
              </YStack>
            </XStack>
          </Card>

        </YStack>

        {/* RENDSZER BEÁLLÍTÁSOK */}
        <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$2" marginTop="$4" textTransform="uppercase">
          Rendszer
        </Text>
        <YStack gap="$3">

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/system")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$color5" borderRadius="$3" alignItems="center" justifyContent="center">
                <Database size={20} color="$color11" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Adatbázis és Szinkron</Text>
                <Text fontSize={13} color="$color10">Offline sor ellenőrzése, API kapcsolat</Text>
              </YStack>
            </XStack>
          </Card>

          <Card
            backgroundColor="$color2"
            borderRadius="$4"
            padding="$4"
            borderWidth={1}
            borderColor="$color4"
            onPress={() => router.push("/admin/reports")}
            pressStyle={{ opacity: 0.8, backgroundColor: "$color3" }}
          >
            <XStack alignItems="center" gap="$3">
              <YStack width={40} height={40} backgroundColor="$color5" borderRadius="$3" alignItems="center" justifyContent="center">
                <AlertTriangle size={20} color="$color11" />
              </YStack>
              <YStack flex={1}>
                <Text fontSize={16} fontWeight="700" color="$color12">Hibajelentések</Text>
                <Text fontSize={13} color="$color10">Sérült áru és dolgozói bejelentések</Text>
              </YStack>
            </XStack>
          </Card>

        </YStack>

      </ScrollView>
    </YStack>
  );
}
