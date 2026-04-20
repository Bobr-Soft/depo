import React, { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, Boxes, RefreshCw, Trash2, Edit3, AlertCircle, Plus, AlertTriangle } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetItems, adminUpdateItem, adminDeleteItem, adminCreateItem, adminGetCategories, adminGetLocations, type ApiItem, type ApiCategory, type WarehouseLocationApi } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";

export default function AdminInventoryScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [items, setItems] = useState<ApiItem[]>([]);
  const [categories, setCategories] = useState<ApiCategory[]>([]);
  const [locations, setLocations] = useState<WarehouseLocationApi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [allItems, allCats, allLocs] = await Promise.all([
        adminGetItems(),
        adminGetCategories().catch(() => [] as ApiCategory[]),
        adminGetLocations().catch(() => [] as WarehouseLocationApi[]),
      ]);
      setItems(allItems);
      setCategories(allCats);
      setLocations(allLocs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a termékeket.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleCreate = () => {
    Alert.prompt(
      "Megnevezés",
      "Az új termék neve:",
      (name) => {
        if (!name?.trim()) return;
        Alert.prompt(
          "Vonalkód",
          "Vonalkód (hagyja üresen, ha nincs):",
          (barcode) => {
            Alert.prompt(
              "Induló készlet",
              "Mennyiség (szám):",
              (qtyStr) => {
                const qty = parseInt(qtyStr ?? "0", 10);

                // Build category hint
                const catHint = categories.length > 0
                  ? `Elérhető: ${categories.slice(0, 8).map(c => `${c.id}=${c.name}`).join(', ')}`
                  : 'Nincs elérhető kategória';

                Alert.prompt(
                  "Kategória",
                  `Kategória ID (üresen ha nincs):\n${catHint}`,
                  (catIdStr) => {
                    const catId = catIdStr?.trim() ? parseInt(catIdStr.trim(), 10) : null;

                    // Build location hint
                    const locHint = locations.length > 0
                      ? `Elérhető: ${locations.slice(0, 8).map(l => `${l.id}=${l.location_code}`).join(', ')}`
                      : 'Nincs elérhető lokáció';

                    Alert.prompt(
                      "Lokáció",
                      `Lokáció ID (üresen ha nincs):\n${locHint}`,
                      async (locIdStr) => {
                        const locId = locIdStr?.trim() ? parseInt(locIdStr.trim(), 10) : null;
                        try {
                          const created = await adminCreateItem({
                            name: name.trim(),
                            barcode: barcode?.trim() || null,
                            description: null,
                            quantity: isNaN(qty) ? 0 : qty,
                            category_id: catId && !isNaN(catId) ? catId : null,
                            location_id: locId && !isNaN(locId) ? locId : null,
                          });
                          setItems(prev => [created, ...prev]);
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
              },
              "plain-text",
              "0"
            );
          },
          "plain-text",
          ""
        );
      },
      "plain-text",
      ""
    );
  };

  const handleEdit = (item: ApiItem) => {
    Alert.prompt(
      "Készlet módosítása",
      `${item.name}\nAdja meg az új mennyiséget:`,
      async (value) => {
        const qty = parseInt(value ?? "", 10);
        if (isNaN(qty) || qty < 0) return;
        try {
          const updated = await adminUpdateItem(item.id, { quantity: qty });
          setItems(prev => prev.map(i => i.id === updated.id ? updated : i));
        } catch (err) {
          Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült frissíteni.");
        }
      },
      "plain-text",
      String(item.quantity)
    );
  };

  const handleDelete = (item: ApiItem) => {
    Alert.alert(
      "Törlés megerősítése",
      `Biztosan törli ezt a terméket?\n${item.name}`,
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "Törlés",
          style: "destructive",
          onPress: async () => {
            try {
              await adminDeleteItem(item.id);
              setItems(prev => prev.filter(i => i.id !== item.id));
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
            <H2 color="$color12">Katalógus és Készlet</H2>
            <Text fontSize={14} color="$color10">Termékek módosítása, készletkorrekció</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadItems} disabled={loading} />
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
            <Button size="$3" onPress={loadItems}>Újrapróbálkozás</Button>
          </YStack>
        ) : (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$1">
              <Text fontSize={14} fontWeight="600" color="$color11">{items.length} termék</Text>
            </XStack>

            {items.map((item) => (
              <Card
                key={item.id}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={item.quantity === 0 ? "$red5" : "$color4"}
              >
                <XStack alignItems="center" gap="$3">
                  <YStack width={40} height={40} backgroundColor="$orange5" borderRadius="$3" alignItems="center" justifyContent="center">
                    <Boxes size={18} color="$orange10" />
                  </YStack>
                  <YStack flex={1} gap="$0.5">
                    <Text fontSize={14} fontWeight="600" color="$color12">{item.name}</Text>
                    <Text fontSize={12} color="$color10">
                      {item.barcode ?? "—"}{item.category ? ` · ${item.category}` : ""}
                      {item.location ? ` · ${item.location}` : ""}
                    </Text>
                    <Text fontSize={12} color={item.quantity === 0 ? "$red10" : "$green10"} fontWeight="600">
                      Készlet: {item.quantity} db
                    </Text>
                  </YStack>
                  <XStack gap="$2">
                    <Button size="$2" theme="gray" circular icon={Edit3} onPress={() => handleEdit(item)} disabled={!syncStatus.isOnline} />
                    <Button size="$2" theme="red" circular icon={Trash2} onPress={() => handleDelete(item)} disabled={!syncStatus.isOnline} />
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
