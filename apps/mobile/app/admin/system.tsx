import React, { useCallback, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, RefreshCw, CheckCircle2, AlertTriangle, Wifi, WifiOff } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminPingApi } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";
import { syncData } from "@/services/sync";

export default function AdminSystemScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unknown" | "ok" | "error">("unknown");
  const [connectionUser, setConnectionUser] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const handleTestConnection = useCallback(async () => {
    setTesting(true);
    setConnectionStatus("unknown");
    setConnectionUser(null);
    try {
      const result = await adminPingApi();
      setConnectionUser(result.email);
      setConnectionStatus("ok");
    } catch {
      setConnectionStatus("error");
    } finally {
      setTesting(false);
    }
  }, []);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncData();
    } finally {
      setSyncing(false);
    }
  }, []);

  const formattedLastSync = syncStatus.lastSyncTime
    ? new Date(syncStatus.lastSyncTime).toLocaleString("hu-HU")
    : "Soha";

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Adatbazis es Szinkron</H2>
            <Text fontSize={14} color="$color10">Offline sor, API kapcsolat ellenorzese</Text>
          </YStack>
        </XStack>
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <YStack gap="$4">
          {/* RENDSZER ALLAPOT */}
          <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1">
            Rendszer allapot
          </Text>
          <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <XStack gap="$2" alignItems="center">
                {syncStatus.isOnline
                  ? <Wifi size={16} color="$green10" />
                  : <WifiOff size={16} color="$red10" />
                }
                <Text fontSize={14} color="$color11">Halozati kapcsolat</Text>
              </XStack>
              <Text fontSize={13} fontWeight="600" color={syncStatus.isOnline ? "$green10" : "$red10"}>
                {syncStatus.isOnline ? "Online" : "Offline"}
              </Text>
            </XStack>
            <Separator borderColor="$color4" />
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={14} color="$color11">Szinkron sor</Text>
              <Text fontSize={13} fontWeight="600" color={(syncStatus.pendingOperations ?? 0) > 0 ? "$orange10" : "$green10"}>
                {syncStatus.pendingOperations ?? 0} varakodo
              </Text>
            </XStack>
            <Separator borderColor="$color4" />
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={14} color="$color11">Utolso szinkron</Text>
              <Text fontSize={13} color="$color10">{formattedLastSync}</Text>
            </XStack>
          </Card>

          {/* KAPCSOLAT TESZT */}
          <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1" marginTop="$2">
            Kapcsolat teszt
          </Text>
          <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="600" color="$color12">API elerhetoseg</Text>
                {connectionStatus !== "unknown" && (
                  <XStack alignItems="center" gap="$1" marginTop="$1">
                    {connectionStatus === "ok"
                      ? <CheckCircle2 size={14} color="$green10" />
                      : <AlertTriangle size={14} color="$red10" />
                    }
                    <Text fontSize={12} color={connectionStatus === "ok" ? "$green10" : "$red10"}>
                      {connectionStatus === "ok"
                        ? `Elerheto${connectionUser ? ` (${connectionUser})` : ""}`
                        : "Kapcsolodasi hiba"
                      }
                    </Text>
                  </XStack>
                )}
              </YStack>
              <Button size="$3" theme="blue" onPress={handleTestConnection} disabled={testing}>
                {testing ? <Spinner size="small" /> : "Teszt"}
              </Button>
            </XStack>
          </Card>

          {/* SZINKRON MUVELETEK */}
          <Text fontSize={14} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$1" marginTop="$2">
            Adatbazis muveletek
          </Text>
          <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="600" color="$color12">Varakodo muveletek kuldese</Text>
                <Text fontSize={12} color="$color10">Offline sor manualis szinkronizalasa</Text>
              </YStack>
              <Button
                size="$3"
                theme="orange"
                icon={syncing ? undefined : RefreshCw}
                onPress={handleSync}
                disabled={syncing || (syncStatus.pendingOperations ?? 0) === 0}
              >
                {syncing ? <Spinner size="small" /> : "Szinkron"}
              </Button>
            </XStack>
          </Card>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
