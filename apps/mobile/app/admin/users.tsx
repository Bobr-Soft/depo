import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, Users, RefreshCw, Trash2, Edit3, AlertCircle, UserPlus, WifiOff } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetUsers, adminCreateUser, adminUpdateUser, adminDeleteUser, type AdminUserResponse } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";

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

const ROLES: { value: string; label: string }[] = [
  { value: "worker", label: "Dolgozó" },
  { value: "supervisor", label: "Vezető" },
  { value: "admin", label: "Admin" },
];

function isActive(user: AdminUserResponse): boolean {
  return Boolean(user.is_active ?? (user as any).isActive);
}

export default function AdminUsersScreen() {
  const insets = useSafeAreaInsets();
  const { isOnline } = useSyncStatus();
  const [users, setUsers] = useState<AdminUserResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setUsers(await adminGetUsers());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a felhasználókat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const handleCreate = () => {
    Alert.prompt(
      "Új felhasználó",
      "Adja meg az e-mail címét:",
      async (email) => {
        if (!email?.trim()) return;
        try {
          const created = await adminCreateUser(email.trim(), "worker", true);
          setUsers(prev => [...prev, created]);
        } catch (err) {
          Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült létrehozni a felhasználót.");
        }
      },
      "plain-text"
    );
  };

  const handleEdit = (user: AdminUserResponse) => {
    const roleOptions = ROLES.map(r => ({
      text: `${r.label}${user.role === r.value ? " \u2713" : ""}`,
      onPress: async () => {
        Alert.alert(
          "Szerkesztés",
          `Felhasználó: ${user.email}\nSzerep: ${ROLE_LABELS[r.value] ?? r.value}`,
          [
            { text: "Mégse", style: "cancel" },
            {
              text: isActive(user) ? "Mentés (aktív marad)" : "Mentés (inaktív marad)",
              onPress: async () => {
                try {
                  const updated = await adminUpdateUser(user.id, user.email, r.value, isActive(user));
                  setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                } catch (err) {
                  Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült frissíteni.");
                }
              },
            },
            {
              text: isActive(user) ? "Mentés + Letiltás" : "Mentés + Aktiválás",
              onPress: async () => {
                try {
                  const updated = await adminUpdateUser(user.id, user.email, r.value, !isActive(user));
                  setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                } catch (err) {
                  Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült frissíteni.");
                }
              },
            },
          ]
        );
      },
    }));

    Alert.alert(
      "Szerepkör módosítása",
      `${user.email} - válasszon új szerepkört:`,
      [...roleOptions, { text: "Mégse", style: "cancel" as const }]
    );
  };

  const handleDelete = (user: AdminUserResponse) => {
    Alert.alert(
      "Törlés megerősítése",
      `Biztosan törli ezt a felhasználót?\n${user.email}`,
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "Törlés",
          style: "destructive",
          onPress: async () => {
            try {
              await adminDeleteUser(user.id);
              setUsers(prev => prev.filter(u => u.id !== user.id));
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült törölni a felhasználót.");
            }
          },
        },
      ]
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Felhasználók</H2>
            <Text fontSize={14} color="$color10">Fiókkezelés és jogosultságok</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadUsers} disabled={loading} />
        </XStack>
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {!isOnline && (
        <XStack backgroundColor="$orange5" paddingHorizontal="$4" paddingVertical="$2" gap="$2" alignItems="center">
          <WifiOff size={14} color="$orange10" />
          <Text fontSize={12} color="$orange10">Offline mód – módosítások nem menthetők</Text>
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
            <Button size="$3" onPress={loadUsers}>Újrapróbálkozás</Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$1">
              <Text fontSize={14} fontWeight="600" color="$color11">{users.length} felhasználó</Text>
              <Button size="$2" theme="blue" icon={UserPlus} onPress={handleCreate}>Új</Button>
            </XStack>

            {users.map((user) => (
              <Card
                key={user.id}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={!isActive(user) ? "$red5" : "$color4"}
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={40}
                    height={40}
                    backgroundColor={isActive(user) ? "$blue5" : "$color4"}
                    borderRadius={20}
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Users size={18} color={isActive(user) ? "$blue10" : "$color9"} />
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
                  </YStack>
                  <XStack gap="$2">
                    <Button size="$2" theme="gray" circular icon={Edit3} onPress={() => handleEdit(user)} disabled={!isOnline} />
                    <Button size="$2" theme="red" circular icon={Trash2} onPress={() => handleDelete(user)} disabled={!isOnline} />
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
