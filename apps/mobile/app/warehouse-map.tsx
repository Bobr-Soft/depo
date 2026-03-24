import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator, Input, AnimatePresence } from "@repo/ui";
import { ArrowLeft, RefreshCw, Layers, Map, AlertTriangle, Search, Eye, EyeOff, Boxes, X, Package, Settings } from "@tamagui/lucide-icons";
import { adminGetLocations, type WarehouseLocationApi } from "@/components/adminApi";
import { buildMapRows, filterLocations, summarizeLocations, isTruthy } from "@/components/warehouse-map/mapModel";
import {
  warehouseMapTokens,
  getWarehouseMapModeLabel,
  getWarehouseMapShelfVisual,
  type WarehouseMapMode,
} from "@/constants/warehouseMapTheme";

// --- TÍPUSOK ---
export type WarehouseLocation = WarehouseLocationApi;

export default function WarehouseMapScreen() {
  const insets = useSafeAreaInsets();
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hideInactive, setHideInactive] = useState(false);
  const [xlOnly, setXlOnly] = useState(false);
  const [mode, setMode] = useState<WarehouseMapMode>("status");
  const [selectedLocation, setSelectedLocation] = useState<WarehouseLocation | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);

  const fetchLocations = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const fetchedLocations = await adminGetLocations();
      setLocations(fetchedLocations);
      setLastUpdatedAt(new Date().toLocaleTimeString("hu-HU", { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setError("Hiba történt a raktártérkép betöltésekor.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const filteredLocations = useMemo(() => {
    return filterLocations(locations, { query, hideInactive, xlOnly });
  }, [locations, query, hideInactive, xlOnly]);

  const summary = useMemo(() => {
    return summarizeLocations(locations);
  }, [locations]);

  // --- ADATFELDOLGOZÁS ---
  // A lapos tömböt átalakítjuk hierarchikus struktúrává: Sor -> Oszlop -> Polc
  const mapData = useMemo(() => {
    return buildMapRows(filteredLocations);
  }, [filteredLocations]);

  useEffect(() => {
    if (!selectedLocation) return;
    const stillVisible = filteredLocations.some((loc) => loc.id === selectedLocation.id);
    if (!stillVisible) {
      setSelectedLocation(null);
    }
  }, [filteredLocations, selectedLocation]);

  const modeLabel = getWarehouseMapModeLabel(mode);

  const toLocationRouteParams = (location: WarehouseLocation) => ({
    id: String(location.id ?? ""),
    code: String(location.location_code ?? ""),
    row: String(location.row_num ?? ""),
    col: String(location.col_num ?? ""),
    shelf: String(location.shelf_level ?? ""),
    isActive: isTruthy(location.is_active) ? "1" : "0",
    isXl: isTruthy(location.is_xl) ? "1" : "0",
  });

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$3">

      {/* FEJLÉC */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Raktártérkép</H2>
            <Text fontSize={14} color="$color10">
              Operatív nézet lokációkhoz • Mód: {modeLabel}
            </Text>
          </YStack>
          <Button
            size="$3"
            theme="gray"
            circular
            icon={RefreshCw}
            onPress={() => fetchLocations(true)}
            disabled={loading || refreshing}
          />
        </XStack>

        {/* METRIKÁK */}
        <XStack gap="$2" flexWrap="wrap">
          <Card flex={1} minWidth={98} backgroundColor="$green2" borderColor="$green6" borderWidth={1} padding="$2.5">
            <Text fontSize={11} color="$green10" fontWeight="600">AKTÍV</Text>
            <Text fontSize={17} color="$color12" fontWeight="700">{summary.active}</Text>
          </Card>
          <Card flex={1} minWidth={98} backgroundColor="$red2" borderColor="$red6" borderWidth={1} padding="$2.5">
            <Text fontSize={11} color="$red10" fontWeight="600">INAKTÍV</Text>
            <Text fontSize={17} color="$color12" fontWeight="700">{summary.inactive}</Text>
          </Card>
          <Card flex={1} minWidth={98} backgroundColor="$orange2" borderColor="$orange6" borderWidth={1} padding="$2.5">
            <Text fontSize={11} color="$orange10" fontWeight="600">XL HELYEK</Text>
            <Text fontSize={17} color="$color12" fontWeight="700">{summary.xl}</Text>
          </Card>
        </XStack>

        {/* KERESŐ ÉS SZŰRŐK */}
        <XStack alignItems="center" gap="$2">
          <YStack flex={1} position="relative" justifyContent="center">
            <Input
              value={query}
              onChangeText={setQuery}
              placeholder="Keresés lokációra (pl. A-01-02)"
              size="$3"
              backgroundColor="$color2"
              borderColor="$color6"
              borderWidth={1}
              paddingLeft="$8"
              paddingRight="$8"
            />
            <XStack position="absolute" left="$3" pointerEvents="none">
              <Search size={16} color="$color10" />
            </XStack>
            {query.length > 0 && (
              <XStack position="absolute" right="$2">
                <Button size="$2" circular chromeless icon={X} onPress={() => setQuery("")} />
              </XStack>
            )}
          </YStack>
        </XStack>

        <XStack gap="$2" flexWrap="wrap">
          <Button size="$2" theme={mode === "status" ? "green" : "gray"} onPress={() => setMode("status")} pressStyle={{ scale: 0.97 }}>Állapot</Button>
          <Button size="$2" theme={mode === "type" ? "orange" : "gray"} onPress={() => setMode("type")} pressStyle={{ scale: 0.97 }}>Típus</Button>
          <Button size="$2" theme={mode === "structure" ? "blue" : "gray"} onPress={() => setMode("structure")} pressStyle={{ scale: 0.97 }}>Szerkezet</Button>
          <Separator vertical marginHorizontal="$1" />
          <Button size="$2" theme={hideInactive ? "red" : "gray"} icon={hideInactive ? EyeOff : Eye} onPress={() => setHideInactive((prev) => !prev)}>
            {hideInactive ? "Inaktív rejtve" : "Inaktív látszik"}
          </Button>
          <Button size="$2" theme={xlOnly ? "orange" : "gray"} icon={Boxes} onPress={() => setXlOnly((prev) => !prev)}>
            {xlOnly ? "Csak XL" : "Összes"}
          </Button>
        </XStack>

        <Text fontSize={12} color="$color10">
          {filteredLocations.length} / {summary.total} lokáció látható
          {lastUpdatedAt ? ` • Frissítve: ${lastUpdatedAt}` : ""}
        </Text>
      </YStack>

      {/* JELMAGYARÁZAT */}
      <XStack paddingHorizontal="$4" marginBottom="$2" gap="$3" flexWrap="wrap">
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor={mode === "status" ? "$green5" : mode === "type" ? "$blue5" : "$color4"} borderWidth={1} borderColor={mode === "status" ? "$green8" : mode === "type" ? "$blue8" : "$color8"} borderRadius={2} />
          <Text fontSize={12} color="$color11">{mode === "status" ? "Aktív" : "Normál polc"}</Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor="$orange5" borderWidth={1} borderColor="$orange8" borderRadius={2} />
          <Text fontSize={12} color="$color11">XL (Padló/Raklap)</Text>
        </XStack>
        <XStack alignItems="center" gap="$1.5">
          <YStack width={12} height={12} backgroundColor="$color3" borderWidth={1} borderColor="$red8" borderRadius={2} />
          <Text fontSize={12} color="$color11">{mode === "structure" ? "Semleges nézet" : "Inaktív"}</Text>
        </XStack>
      </XStack>

      <Separator borderColor="$color4" marginBottom="$0" />

      {/* TÉRKÉP (Függőlegesen görgethető sorok) */}
      <ScrollView
        flex={1}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLocations(true)} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }} // Extra padding a lebegő panel miatt
      >
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
            <Text fontSize={15} color="$color10">
              {query || hideInactive || xlOnly ? "A szűrők mellett nincs megjeleníthető lokáció." : "Nincsenek lokációk az adatbázisban."}
            </Text>
            {(query || hideInactive || xlOnly) && (
              <Button size="$3" theme="gray" onPress={() => { setQuery(""); setHideInactive(false); setXlOnly(false); }}>
                Szűrők törlése
              </Button>
            )}
          </YStack>
        ) : (
          <YStack gap="$4" paddingHorizontal="$4" paddingTop="$4">
            {mapData.map((row) => (
              <YStack key={`row-${row.rowNum}`} gap="$2" animation="quick" enterStyle={{ opacity: 0, y: 6 }}>

                {/* Sor azonosítója */}
                <XStack alignItems="center" gap="$2" paddingHorizontal="$2" paddingVertical="$1.5" backgroundColor={warehouseMapTokens.rowHeaderSurface} borderColor={warehouseMapTokens.rowHeaderBorder} borderWidth={1} borderRadius="$3">
                  <Layers size={18} color="$color11" />
                  <Text fontSize={16} fontWeight="700" color="$color12">{String(row.rowNum).padStart(2, '0')}. Sor</Text>
                </XStack>

                {/* Soron belüli oszlopok (Vízszintesen görgethető) */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <XStack gap="$3" paddingBottom="$2" paddingRight="$4">
                    {row.cols.map((col) => (
                      <Card key={`col-${row.rowNum}-${col.colNum}`} backgroundColor={warehouseMapTokens.surface} borderWidth={1} borderColor={warehouseMapTokens.borderMuted} padding="$2" borderRadius="$4" minWidth={100}>
                        <Text fontSize={12} fontWeight="600" color="$color10" textAlign="center" marginBottom="$2">
                          {String(col.colNum).padStart(2, '0')}. Oszlop
                        </Text>
                        <YStack gap="$1.5" justifyContent="flex-end" flex={1}>
                          {col.shelves.map((shelf) => {
                            const isActive = isTruthy(shelf.is_active);
                            const isXl = isTruthy(shelf.is_xl);
                            const isSelected = selectedLocation?.id === shelf.id;
                            const shelfStyle = getWarehouseMapShelfVisual(mode, isActive, isXl);
                            const height = isXl ? 60 : 40;

                            return (
                              <Button
                                key={`shelf-${shelf.id}`}
                                height={height}
                                backgroundColor={isSelected ? warehouseMapTokens.selectedGlow : shelfStyle.backgroundColor}
                                borderWidth={isSelected ? 2 : 1}
                                borderColor={isSelected ? warehouseMapTokens.selectedBorder : shelfStyle.borderColor}
                                borderRadius="$2"
                                padding="$0"
                                justifyContent="center"
                                alignItems="center"
                                onPress={() => setSelectedLocation(shelf)}
                                animation="quick"
                                pressStyle={{ opacity: 0.84, scale: 0.97 }}
                              >
                                <YStack alignItems="center">
                                  <Text fontSize={14} fontWeight="bold" color={shelfStyle.textColor}>{shelf.shelf_level}</Text>
                                  <Text fontSize={10} color={shelfStyle.badgeColor}>{isXl ? "XL" : "N"}</Text>
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

      {/* KIVÁLASZTOTT LOKÁCIÓ (Lebegő panel) */}
      <AnimatePresence>
        {selectedLocation && (
          <YStack
            position="absolute"
            bottom={0}
            left={0}
            right={0}
            padding="$4"
            paddingBottom={Math.max(insets.bottom, 16)}
            pointerEvents="box-none"
            zIndex={100}
          >
            <Card
              padding="$3"
              borderWidth={1}
              borderColor={warehouseMapTokens.borderStrong}
              backgroundColor={warehouseMapTokens.elevatedSurface}
              elevation="$4"
              shadowColor="$shadowColor"
              shadowOpacity={0.2}
              shadowRadius={8}
              shadowOffset={{ width: 0, height: -2 }}
              animation="quick"
              enterStyle={{ opacity: 0, y: 20 }}
              exitStyle={{ opacity: 0, y: 20 }}
              pointerEvents="auto"
            >
              <XStack justifyContent="space-between" alignItems="center" marginBottom="$3">
                <YStack>
                  <Text fontSize={18} fontWeight="800" color={warehouseMapTokens.heroText}>
                    {selectedLocation.location_code}
                  </Text>
                  <Text fontSize={13} color={warehouseMapTokens.heroSubtleText}>
                    Sor {selectedLocation.row_num} • Oszlop {selectedLocation.col_num} • Polc {selectedLocation.shelf_level}
                  </Text>
                </YStack>
                <Button size="$2" circular chromeless icon={X} onPress={() => setSelectedLocation(null)} />
              </XStack>

              <XStack gap="$2" flexWrap="wrap" marginBottom="$3">
                <YStack paddingHorizontal="$2.5" paddingVertical="$1" backgroundColor={isTruthy(selectedLocation.is_active) ? "$green3" : "$red3"} borderRadius="$2">
                  <Text fontSize={11} fontWeight="600" color={isTruthy(selectedLocation.is_active) ? "$green11" : "$red11"}>
                    {isTruthy(selectedLocation.is_active) ? "AKTÍV" : "INAKTÍV"}
                  </Text>
                </YStack>
                <YStack paddingHorizontal="$2.5" paddingVertical="$1" backgroundColor={isTruthy(selectedLocation.is_xl) ? "$orange3" : "$blue3"} borderRadius="$2">
                  <Text fontSize={11} fontWeight="600" color={isTruthy(selectedLocation.is_xl) ? "$orange11" : "$blue11"}>
                    {isTruthy(selectedLocation.is_xl) ? "XL KAPACITÁS" : "NORMÁL KAPACITÁS"}
                  </Text>
                </YStack>
              </XStack>

              <XStack gap="$2">
                <Button
                  flex={1}
                  theme="blue"
                  size="$3"
                  icon={Package}
                  onPress={() =>
                    router.push({
                      pathname: "/location-details",
                      params: toLocationRouteParams(selectedLocation),
                    })
                  }
                >
                  Készlet
                </Button>
                <Button
                  flex={1}
                  theme="gray"
                  size="$3"
                  icon={Settings}
                  variant="outlined"
                  onPress={() =>
                    router.push({
                      pathname: "/location-others",
                      params: toLocationRouteParams(selectedLocation),
                    })
                  }
                >
                  Részletek
                </Button>
              </XStack>
            </Card>
          </YStack>
        )}
      </AnimatePresence>
    </YStack>
  );
}
