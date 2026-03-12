import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, Tag, RefreshCw, Trash2, Edit3, AlertCircle, Plus, AlertTriangle } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import {
  adminGetCategories,
  adminCreateCategory,
  adminUpdateCategory,
  adminDeleteCategory,
  type ApiCategory,
} from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";

export default function AdminCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCategories(await adminGetCategories());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a kategóriákat.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  const handleCreate = () => {
    Alert.prompt(
      "Kategória neve",
      "Az új kategória neve:",
      async (name) => {
        if (!name?.trim()) return;
        Alert.prompt(
          "Leírás",
          "Leírás vagy méretosztály (opcionális):",
          async (desc) => {
            try {
              const created = await adminCreateCategory(name.trim(), desc?.trim() || undefined);
              setCategories(prev => [...prev, created]);
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült létrehozni.");
            }
          },
          "plain-text",
          ""
        );
      },
      "plain-text",
      ""
    );
  };

  const handleEdit = (cat: ApiCategory) => {
    Alert.prompt(
      "Kategória neve",
      "Új név:",
      (name) => {
        if (!name?.trim()) return;
        Alert.prompt(
          "Leírás",
          "Leírás vagy méretosztály (opcionális):",
          async (desc) => {
            try {
              const updated = await adminUpdateCategory(cat.id, name.trim(), desc?.trim() || undefined);
              setCategories(prev => prev.map(c => c.id === updated.id ? updated : c));
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült frissíteni.");
            }
          },
          "plain-text",
          cat.description ?? cat.size_class ?? ""
        );
      },
      "plain-text",
      cat.name
    );
  };

  const handleDelete = (cat: ApiCategory) => {
    Alert.alert(
      "Törlés megerősítése",
      `Biztosan törli ezt a kategóriát?\n${cat.name}`,
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "Törlés",
          style: "destructive",
          onPress: async () => {
            try {
              await adminDeleteCategory(cat.id);
              setCategories(prev => prev.filter(c => c.id !== cat.id));
            } catch (err) {
              Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült törölni.");
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
            <H2 color="$color12">Kategóriák</H2>
            <Text fontSize={14} color="$color10">Raktározási kategóriák kezelése</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadCategories} disabled={loading} />
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
          <AlertTriangle size={14} color="$orange10" />
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
            <Button size="$3" onPress={loadCategories}>Újrapróbálkozás</Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <Text fontSize={14} fontWeight="600" color="$color11" marginBottom="$1">
              {categories.length} kategória
            </Text>

            {categories.map((cat) => (
              <Card
                key={cat.id}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor="$color4"
              >
                <XStack alignItems="center" gap="$3">
                  <YStack
                    width={40}
                    height={40}
                    backgroundColor="$blue5"
                    borderRadius="$3"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <Tag size={18} color="$blue10" />
                  </YStack>
                  <YStack flex={1} gap="$0.5">
                    <Text fontSize={14} fontWeight="600" color="$color12">{cat.name}</Text>
                    {(cat.description ?? cat.size_class) ? (
                      <Text fontSize={12} color="$color10">{cat.description ?? cat.size_class}</Text>
                    ) : null}
                    {cat.min_stock_level != null && (
                      <Text fontSize={12} color="$color9">Min. készlet: {cat.min_stock_level} db</Text>
                    )}
                  </YStack>
                  <XStack gap="$2">
                    <Button
                      size="$2"
                      theme="gray"
                      circular
                      icon={Edit3}
                      onPress={() => handleEdit(cat)}
                      disabled={!syncStatus.isOnline}
                    />
                    <Button
                      size="$2"
                      theme="red"
                      circular
                      icon={Trash2}
                      onPress={() => handleDelete(cat)}
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
