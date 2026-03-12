import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert } from "react-native";
import { router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { ArrowLeft, RefreshCw, Layers, Map, AlertTriangle } from "@tamagui/lucide-icons";
import { adminGetLocations, type WarehouseLocationApi } from "@/components/adminApi";

// --- TÍPUSOK ---
export type WarehouseLocation = WarehouseLocationApi;

export default function WarehouseMapScreen() {
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setLocations(await adminGetLocations());
    } catch {
      setError("Hiba történt a raktártérkép betöltésekor.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // --- ADATFELDOLGOZÁS ---
  // A lapos tömböt átalakítjuk hierarchikus struktúrává: Sor -> Oszlop -> Polc
  const mapData = useMemo(() => {
    const rows: Record<number, Record<number, WarehouseLocation[]>> = {};

    for (const loc of locations) {
      if (loc.row_num == null || loc.col_num == null) continue;
      if (!rows[loc.row_num]) {
        rows[loc.row_num] = {};
      }
      if (!rows[loc.row_num][loc.col_num]) {
        rows[loc.row_num][loc.col_num] = [];
      }
      rows[loc.row_num][loc.col_num].push(loc);
    }

    // Sorba rendezés
    const sortedRows = Object.keys(rows)
      .map(Number)
      .sort((a, b) => a - b)
      .map((rowNum) => {
        const colsMap = rows[rowNum];
        const sortedCols = Object.keys(colsMap)
          .map(Number)
          .sort((a, b) => a - b)
          .map((colNum) => {
            // A polcokat csökkenő sorrendbe rakjuk, hogy a 0. szint (padló) a UI-on legalulra kerüljön
            const sortedShelves = [...colsMap[colNum]].sort((a, b) => b.shelf_level - a.shelf_level);
            return { colNum, shelves: sortedShelves };
          });
        return { rowNum, cols: sortedCols };
      });

    return sortedRows;
  }, [locations]);

  // --- INTERAKCIÓ ---
  const handleLocationPress = (loc: WarehouseLocation) => {
    const isActive = Boolean(loc.is_active);
    const isXl = Boolean(loc.is_xl);

    Alert.alert(
      `Lokáció: ${loc.location_code}`,
      `Sor: ${loc.row_num} | Oszlop: ${loc.col_num} | Polc: ${loc.shelf_level}\n` +
      `Típus: ${isXl ? 'XL (Raklap/Földi)' : 'Normál polc'}\n` +
      `Állapot: ${isActive ? 'Aktív' : 'Inaktív (Zárolt)'}`,
      [
        { text: "Bezár", style: "cancel" },
        // Későbbi funkció: { text: "Tételek megtekintése", onPress: () => router.push(`/inventory?location=${loc.location_code}`) }
      ]
    );
  };

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">

      {/* FEJLÉC */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Raktártérkép</H2>
            <Text fontSize={14} color="$color10">Lokációk és polcok áttekintése</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={fetchLocations} disabled={loading} />
        </XStack>
      </YStack>

      {/* JELMAGYARÁZAT */}
      <XStack paddingHorizontal="$4" marginBottom="$2" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor="$blue5" borderWidth={1} borderColor="$blue8" borderRadius={2} />
          <Text fontSize={12} color="$color11">Normál polc</Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor="$orange5" borderWidth={1} borderColor="$orange8" borderRadius={2} />
          <Text fontSize={12} color="$color11">XL (Padló)</Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor="$color3" borderWidth={1} borderColor="$red8" borderRadius={2} />
          <Text fontSize={12} color="$color11">Inaktív</Text>
        </XStack>
      </XStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* TÉRKÉP (Függőlegesen görgethető sorok) */}
      <ScrollView flex={1} contentContainerStyle={{ paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$10">
            <AlertTriangle size={32} color="$red10" />
            <Text fontSize={14} color="$red10">{error}</Text>
          </YStack>
        ) : mapData.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$10">
            <Map size={48} color="$color8" />
            <Text fontSize={15} color="$color10">Nincsenek lokációk az adatbázisban.</Text>
          </YStack>
        ) : (
          <YStack gap="$4" paddingHorizontal="$4">
            {mapData.map((row) => (
              <YStack key={`row-${row.rowNum}`} gap="$2">

                {/* Sor azonosítója */}
                <XStack alignItems="center" gap="$2" paddingHorizontal="$1">
                  <Layers size={18} color="$color11" />
                  <Text fontSize={16} fontWeight="700" color="$color12">
                    {String(row.rowNum).padStart(2, '0')}. Sor
                  </Text>
                </XStack>

                {/* Soron belüli oszlopok (Vízszintesen görgethető) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack gap="$3" paddingBottom="$2" paddingRight="$4">
                    {row.cols.map((col) => (
                      <Card
                        key={`col-${row.rowNum}-${col.colNum}`}
                        backgroundColor="$color2"
                        borderWidth={1}
                        borderColor="$color4"
                        padding="$2"
                        borderRadius="$4"
                        minWidth={100}
                      >
                        {/* Oszlop fejléc */}
                        <Text fontSize={12} fontWeight="600" color="$color10" textAlign="center" marginBottom="$2">
                          {String(col.colNum).padStart(2, '0')}. Oszlop
                        </Text>

                        {/* Oszlopon belüli polcok (Alulról felfelé építve a UI-on: a tömb már csökkenő) */}
                        <YStack gap="$1.5" justifyContent="flex-end" flex={1}>
                          {col.shelves.map((shelf) => {
                            const isActive = Boolean(shelf.is_active);
                            const isXl = Boolean(shelf.is_xl);

                            // Stílusok meghatározása állapot alapján
                            const bgColor = !isActive ? "$color3" : isXl ? "$orange5" : "$blue5";
                            const borderColor = !isActive ? "$red8" : isXl ? "$orange8" : "$blue8";
                            const height = isXl ? 60 : 40; // Az XL helyek vizuálisan magasabbak

                            return (
                              <Button
                                key={`shelf-${shelf.id}`}
                                height={height}
                                backgroundColor={bgColor}
                                borderWidth={1}
                                borderColor={borderColor}
                                borderRadius="$2"
                                padding="$0"
                                justifyContent="center"
                                alignItems="center"
                                onPress={() => handleLocationPress(shelf)}
                                pressStyle={{ opacity: 0.7 }}
                              >
                                <YStack alignItems="center">
                                  <Text fontSize={14} fontWeight="bold" color={!isActive ? "$color9" : "$color12"}>
                                    {shelf.shelf_level}
                                  </Text>
                                </YStack>
                              </Button>
                            );
                          })}
                        </YStack>
                      </Card>
                    ))}
                  </XStack>
                </ScrollView>
              </YStack>
            ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
