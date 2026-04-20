import React, { useEffect, useState } from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Card, Text, Button, ScrollView, Spinner, Separator } from "@repo/ui";
import { ArrowLeft, Package, AlertTriangle, PackageOpen, Settings } from "@tamagui/lucide-icons";
import { adminGetItems } from "@/components/adminApi";

// Helper to safely extract single string values from Expo Router params
function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

interface ShelfItem {
  id: number;
  name: string;
  barcode?: string | null;
  quantity: number;
}

export default function LocationDetailsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    code?: string | string[];
    row?: string | string[];
    col?: string | string[];
    shelf?: string | string[];
    isActive?: string | string[];
    isXl?: string | string[];
  }>();

  const id = one(params.id);
  const code = one(params.code);
  const row = one(params.row);
  const col = one(params.col);
  const shelf = one(params.shelf);
  const isActive = one(params.isActive) === "1";
  const isXl = one(params.isXl) === "1";

  const [inventory, setInventory] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchShelfInventory = async () => {
      try {
        setLoading(true);
        setError(null);
        const parsedLocationId = Number.parseInt(id, 10);
        if (!Number.isFinite(parsedLocationId)) {
          setInventory([]);
          return;
        }

        const items = await adminGetItems();
        const locationItems = items
          .filter((item) => item.location_id === parsedLocationId)
          .map((item) => ({
            id: item.id,
            name: item.name,
            barcode: item.barcode,
            quantity: item.quantity,
          }));

        setInventory(locationItems);
      } catch {
        setError("Nem sikerült betölteni a polc készletét.");
      } finally {
        setLoading(false);
      }
    };

    fetchShelfInventory();
  }, [id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={Math.max(insets.top, 12)}>

        {/* WMS CONTEXT HEADER */}
        <YStack paddingHorizontal="$4" paddingBottom="$3" backgroundColor="$background">
          <XStack alignItems="center" gap="$3" marginBottom="$2">
            <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
            <YStack flex={1}>
              <XStack alignItems="center" gap="$2">
                <Text fontSize={22} fontWeight="800" color="$color12" letterSpacing={0.5}>
                  {code || "Ismeretlen Lokáció"}
                </Text>
                {!isActive && (
                  <YStack backgroundColor="$red3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                    <Text fontSize={10} fontWeight="700" color="$red11">INAKTÍV</Text>
                  </YStack>
                )}
                {isXl && (
                  <YStack backgroundColor="$orange3" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$2">
                    <Text fontSize={10} fontWeight="700" color="$orange11">XL</Text>
                  </YStack>
                )}
              </XStack>
              <Text fontSize={14} color="$color10" marginTop="$1">
                Sor {row || "-"} • Oszlop {col || "-"} • Polc {shelf || "-"}
              </Text>
            </YStack>
          </XStack>
        </YStack>

        <Separator borderColor="$color4" />

        {/* INVENTORY LIST */}
        <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {loading ? (
            <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$10">
              <Spinner size="large" color="$blue10" />
              <Text marginTop="$4" color="$color10" fontSize={15} fontWeight="500">
                Készlet szinkronizálása...
              </Text>
            </YStack>
          ) : error ? (
            <Card backgroundColor="$red2" borderColor="$red5" borderWidth={1} padding="$4" borderRadius="$4">
              <XStack alignItems="center" gap="$3">
                <AlertTriangle size={24} color="$red10" />
                <YStack flex={1}>
                  <Text color="$red11" fontSize={15} fontWeight="700">Hiba történt</Text>
                  <Text color="$red11" fontSize={14}>{error}</Text>
                </YStack>
              </XStack>
            </Card>
          ) : inventory.length === 0 ? (
            <YStack flex={1} alignItems="center" justifyContent="center" paddingVertical="$10" opacity={0.6}>
              <PackageOpen size={64} color="$color8" strokeWidth={1.5} />
              <Text marginTop="$4" color="$color10" fontSize={16} fontWeight="600">
                A lokáció üres
              </Text>
              <Text marginTop="$2" color="$color9" fontSize={14} textAlign="center">
                Jelenleg nincs egyetlen termék sem regisztrálva ezen a polcon.
              </Text>
            </YStack>
          ) : (
            <YStack gap="$3">
              <Text fontSize={13} fontWeight="600" color="$color10" textTransform="uppercase" paddingLeft="$1" marginBottom="$1">
                Regisztrált tételek ({inventory.length})
              </Text>

              {inventory.map((item) => (
                <Card
                  key={item.id}
                  backgroundColor="$color2"
                  borderColor="$color5"
                  borderWidth={1}
                  borderRadius="$3"
                  padding="$3"
                  pressStyle={{ scale: 0.98, backgroundColor: "$color3" }}
                  animation="quick"
                >
                  <XStack alignItems="center" justifyContent="space-between" gap="$3">
                    <YStack flex={1}>
                      <Text fontSize={16} fontWeight="700" color="$color12" numberOfLines={2} lineHeight={20}>
                        {item.name}
                      </Text>
                      {item.barcode ? (
                        <Text
                          fontSize={13}
                          color="$color10"
                          marginTop="$1.5"
                          fontFamily="monospace"
                          backgroundColor="$color3"
                          alignSelf="flex-start"
                          paddingHorizontal="$1.5"
                          borderRadius="$1"
                          numberOfLines={1}
                        >
                          {item.barcode}
                        </Text>
                      ) : (
                        <Text fontSize={13} color="$color9" marginTop="$1.5" fontStyle="italic">
                          Nincs vonalkód
                        </Text>
                      )}
                    </YStack>

                    <YStack
                      backgroundColor="$blue3"
                      borderColor="$blue5"
                      borderWidth={1}
                      paddingHorizontal="$3"
                      paddingVertical="$2"
                      borderRadius="$3"
                      alignItems="center"
                      minWidth={64}
                    >
                      <Text fontSize={18} fontWeight="800" color="$blue11">
                        {item.quantity}
                      </Text>
                      <Text fontSize={10} fontWeight="600" color="$blue10" textTransform="uppercase" marginTop="$-1">
                        DB
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              ))}
            </YStack>
          )}
        </ScrollView>

        {/* STICKY FOOTER ACTIONS */}
        <YStack
          paddingHorizontal="$4"
          paddingTop="$3"
          paddingBottom={Math.max(insets.bottom, 16)}
          backgroundColor="$background"
          borderTopWidth={1}
          borderColor="$color4"
        >
          <XStack gap="$3">
            <Button
              flex={1}
              size="$4"
              theme="blue"
              icon={Settings}
              onPress={() => router.push({ pathname: "/admin/inventory", params: { locationId: id } })}
              fontWeight="700"
            >
              Készlet korrekció
            </Button>
          </XStack>
        </YStack>

      </YStack>
    </>
  );
}
