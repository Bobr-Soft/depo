import React, { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Button, Text, H2, Card, ScrollView, Separator, Switch } from "@repo/ui";
import { ScanBarcode, Package, ArrowLeft, RefreshCw, Trash2, Edit3, Save, CheckCircle2, AlertCircle, MapPin, RotateCcw } from "@tamagui/lucide-icons";
import { BarcodeScanner } from "@/components";
import { router, useFocusEffect } from "expo-router";
import { buildApiUrl, getApiUrl, getToken, getScanSoundEnabled, getHapticFeedbackEnabled } from "@/services/secureStorage";
import { isOnline, syncData } from "@/services/sync";
import { enqueueSyncOperation, getSyncQueue, initDatabase, isDatabaseInitialized, saveInboundDraft, loadInboundDraft, clearInboundDraft } from "@/services/database";
import { consumePendingInboundAction } from "@/services/inboundEditStore";

type ScannedInboundItem = {
  code: string;
  type: string;
  timestamp: Date;
  quantity: number;
  isXl: boolean; // ÚJ: XL/Raklapos méret jelölése a lokációkiosztáshoz
  assignedLocation?: string | null; // ÚJ: A backend által kiosztott cél polc
  status: 'pending' | 'allocated' | 'error';
};

type SaveSummary = {
  total: number;
  successful: number;
  failed: number;
  queued: number;
};

type ApiItem = {
  id: number;
  barcode: string | null;
};

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();

export default function InboundScreen() {
  const insets = useSafeAreaInsets();

  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannedItems, setScannedItems] = useState<ScannedInboundItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pendingRetryCount, setPendingRetryCount] = useState(0);
  const [summary, setSummary] = useState<SaveSummary | null>(null);
  const [draftRecovered, setDraftRecovered] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);

  const isProcessing = useRef(false);
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMounted = useRef(false);

  const loadPendingRetryCount = useCallback(async () => {
    try {
      if (!isDatabaseInitialized()) await initDatabase();
      const queue = await getSyncQueue();
      const pendingInboundOps = queue.filter(entry => entry.entity_type === "item" && entry.operation === "UPSERT");
      setPendingRetryCount(pendingInboundOps.length);
    } catch (error) {
      console.error("Failed to load pending inbound retry count:", error);
      setPendingRetryCount(0);
    }
  }, []);

  useEffect(() => { loadPendingRetryCount(); }, [loadPendingRetryCount]);

  useEffect(() => {
    Promise.all([getScanSoundEnabled(), getHapticFeedbackEnabled()]).then(([s, h]) => {
      setSoundEnabled(s);
      setHapticEnabled(h);
    });
  }, []);

  // Load persisted draft on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!isDatabaseInitialized()) await initDatabase();
        const draft = await loadInboundDraft();
        if (active && draft.length > 0) {
          const recovered = (draft as ScannedInboundItem[]).map(item => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }));
          setScannedItems(recovered);
          setDraftRecovered(true);
        }
      } catch (error) {
        console.error('Failed to load inbound draft:', error);
      } finally {
        if (active) hasMounted.current = true;
      }
    })();
    return () => { active = false; };
  }, []);

  // Persist draft on every change (debounced 500ms)
  useEffect(() => {
    if (!hasMounted.current) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      if (scannedItems.length > 0) {
        saveInboundDraft(scannedItems).catch(err => console.error('Draft save failed:', err));
      } else {
        clearInboundDraft().catch(err => console.error('Draft clear failed:', err));
      }
    }, 500);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [scannedItems]);

  // Pick up edits from the edit screen when we come back into focus
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingInboundAction();
      if (!pending) return;
      if (pending.type === "delete") {
        setScannedItems((prev) =>
          prev.filter((item) => normalizeBarcode(item.code) !== normalizeBarcode(pending.code))
        );
      } else {
        setScannedItems((prev) =>
          prev.map((item) =>
            normalizeBarcode(item.code) === normalizeBarcode(pending.code)
              ? { ...item, quantity: pending.quantity, timestamp: new Date() }
              : item
          )
        );
      }
      setSummary(null);
    }, [])
  );

  const handleScan = useCallback((data: string, type: string) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    const timestamp = new Date();
    setScannedItems((prev) => {
      const normalizedData = normalizeBarcode(data);
      const existingIndex = prev.findIndex((item) => normalizeBarcode(item.code) === normalizedData);

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], quantity: updated[existingIndex].quantity + 1, timestamp };
        return updated;
      }
      // Alapértelmezetten a beolvasott tétel pending státuszú és nem XL
      return [{ code: data, type, timestamp, quantity: 1, isXl: false, status: 'pending' }, ...prev];
    });

    Alert.alert(
      "Termék beolvasva",
      `Kód: ${data}\nTípus: ${type}`,
      [
        { text: "Tovább szkennelés", onPress: () => { isProcessing.current = false; setScannerKey(prev => prev + 1); }, style: "default" },
        { text: "Kész", onPress: () => { isProcessing.current = false; setShowScanner(false); setScannerKey(prev => prev + 1); }, style: "cancel" }
      ],
      { cancelable: false, onDismiss: () => { isProcessing.current = false; } }
    );
  }, []);

  const toggleXlStatus = (code: string) => {
    setScannedItems((prev) =>
      prev.map((item) => normalizeBarcode(item.code) === normalizeBarcode(code) ? { ...item, isXl: !item.isXl } : item)
    );
  };

  const fetchItems = useCallback(async (apiUrl: string, token: string): Promise<ApiItem[]> => {
    const response = await fetch(buildApiUrl(apiUrl, '/items'), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Nem sikerült lekérni a termékeket: ${response.status}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }, []);

  const enqueueInboundRetry = useCallback(async (item: ScannedInboundItem) => {
    if (!isDatabaseInitialized()) await initDatabase();
    const idempotencyKey = `inbound-${normalizeBarcode(item.code)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await enqueueSyncOperation("UPSERT", "item", null, {
      barcode: item.code,
      quantityIncrement: item.quantity,
      name: `Beolvasott termék ${item.code}`,
      description: "Inbound scan",
      isXl: item.isXl
    }, idempotencyKey);
  }, []);

  const allocateAndSaveItems = useCallback(async () => {
    if (scannedItems.length === 0 || isSaving) return;

    setIsSaving(true);
    setSummary(null);

    const batchSummary: SaveSummary = { total: scannedItems.length, successful: 0, failed: 0, queued: 0 };
    const updatedItemsList = [...scannedItems]; // Másolat, amiben a státuszokat frissítjük

    try {
      const [apiUrl, token, online] = await Promise.all([getApiUrl(), getToken(), isOnline()]);
      if (!token) throw new Error("Nincs bejelentkezett felhasználó.");

      if (!online) {
        for (const item of scannedItems) {
          await enqueueInboundRetry(item);
          batchSummary.queued += 1;
        }
        setScannedItems([]);
        await clearInboundDraft();
        setSummary(batchSummary);
        await loadPendingRetryCount();
        Alert.alert("Offline mentés", "Nincs internetkapcsolat. A tételek a várólistára kerültek. Amint online leszel, a rendszer megkísérli lefoglalni a lokációkat.",
          [{ text: "Rendben", onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      // Végigmegyünk a listán és meghívjuk az új Putaway végpontot
      const items = await fetchItems(apiUrl, token);
      const itemIdByBarcode = new Map<string, number>();
      for (const knownItem of items) {
        if (knownItem.barcode) {
          itemIdByBarcode.set(normalizeBarcode(knownItem.barcode), knownItem.id);
        }
      }

      for (let i = 0; i < updatedItemsList.length; i++) {
        const item = updatedItemsList[i];
        try {
          const itemId = itemIdByBarcode.get(normalizeBarcode(item.code));
          if (!itemId) {
            throw new Error(`Nincs egyezo termek azonosito a vonalkodhoz: ${item.code}`);
          }

          const response = await fetch(buildApiUrl(apiUrl, '/api/inbound/putaway'), {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              itemId,
              quantity: item.quantity,
              isXl: item.isXl
            }),
          });

          if (!response.ok) {
            const errorText = await response.text().catch(() => "Ismeretlen hiba");
            throw new Error(`Kiosztási hiba: ${response.status} - ${errorText}`);
          }

          const data = await response.json();

          // Ha sikeres, frissítjük az elemet a kapott lokációval
          updatedItemsList[i] = {
            ...item,
            status: 'allocated',
            assignedLocation: data.location_code
          };
          batchSummary.successful += 1;
        } catch (error) {
          console.error(`Failed to allocate location for ${item.code}:`, error);
          updatedItemsList[i] = { ...item, status: 'error' };
          batchSummary.failed += 1;
          await enqueueInboundRetry(item);
          batchSummary.queued += 1;
        }
      }

      setSummary(batchSummary);
      await loadPendingRetryCount();

      if (batchSummary.failed > 0) {
        // Ha van hiba, a listán hagyjuk azokat a tételeket, hogy a felhasználó lássa, mi nem kapott lokációt
        setScannedItems(updatedItemsList);
        Alert.alert("Részleges mentés", `Sikeres kiosztás: ${batchSummary.successful}\nSikertelen (pl. tele a raktár): ${batchSummary.failed}\nVárólistára tett: ${batchSummary.queued}`);
      } else {
        // Ha minden sikeres, navigálunk az elrakás képernyőre
        setScannedItems([]);
        await clearInboundDraft();
        const putawayItems = updatedItemsList
          .filter((i) => i.status === 'allocated' && i.assignedLocation)
          .map((i) => ({ code: i.code, quantity: i.quantity, assignedLocation: i.assignedLocation }));
        router.replace({
          pathname: "/inbound-putaway",
          params: { items: JSON.stringify(putawayItems) },
        });
      }
    } catch (error) {
      console.error("Failed to save and allocate items:", error);
      for (const item of scannedItems) {
        await enqueueInboundRetry(item);
        batchSummary.queued += 1;
      }
      batchSummary.failed = scannedItems.length;
      setScannedItems([]);
      await clearInboundDraft();
      setSummary(batchSummary);
      await loadPendingRetryCount();
      Alert.alert("Mentési hiba", "A hálózati kérés megszakadt, a tételek várólistára kerültek újrapróbáláshoz.");
    } finally {
      setIsSaving(false);
    }
  }, [enqueueInboundRetry, fetchItems, isSaving, loadPendingRetryCount, scannedItems]);

  const retryPendingInbound = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const result = await syncData();
      await loadPendingRetryCount();
      Alert.alert("Újrapróbálás", result.success ? "A várólistás tételek szinkronja lefutott." : (result.error ?? "Hiba történt."));
    } catch (error) {
      console.error("Failed to retry pending inbound operations:", error);
      Alert.alert("Újrapróbálás", "Hiba történt az újrapróbálás során.");
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, loadPendingRetryCount]);

  const clearScannedItems = useCallback(() => {
    if (scannedItems.length === 0) return;
    Alert.alert(
      "Lista törlése",
      `Biztosan törlöd a listát? (${scannedItems.length} db)`,
      [
        { text: "Mégse", style: "cancel" },
        { text: "Törlés", style: "destructive", onPress: () => { setScannedItems([]); setSummary(null); clearInboundDraft().catch(() => {}); } },
      ]
    );
  }, [scannedItems.length]);

  if (showScanner) {
    return (
      <BarcodeScanner
        key={scannerKey}
        onScan={handleScan}
        onClose={() => { isProcessing.current = false; setShowScanner(false); setScannerKey(prev => prev + 1); }}
        title="Termék bevételezés"
        instruction="Szkenneld be az érkező áru vonalkódját"
        autoResetDelay={0}
        enableSound={soundEnabled}
        enableHaptics={hapticEnabled}
      />
    );
  }

  // Ellenőrizzük, hogy van-e még olyan tétel, amihez nem kértek lokációt
  const hasPendingItems = scannedItems.some(item => item.status === 'pending' || item.status === 'error');

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">

      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} disabled={isSaving} />
          <YStack flex={1}>
            <H2 color="$color12">Bevételezés</H2>
            <Text fontSize={14} color="$color10">Áru érkeztetése és lokáció kiosztása</Text>
          </YStack>
        </XStack>

        {/* PRIMARY ACTION BUTTON */}
        <Button size="$5" theme="blue" icon={ScanBarcode} onPress={() => setShowScanner(true)} marginTop="$2">
          <Text fontWeight="600" fontSize={16}>Új termék szkennelése</Text>
        </Button>
      </YStack>

      {/* DYNAMIC ALERTS / STATUSES */}
      <YStack paddingHorizontal="$4" gap="$2" marginBottom="$2">
        {draftRecovered && scannedItems.length > 0 && (
          <Card backgroundColor="$blue2" padding="$3" borderRadius="$4" borderWidth={1} borderColor="$blue5">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1}>
                <Text fontSize={13} fontWeight="600" color="$blue10">Visszaállított piszkozat</Text>
                <Text fontSize={12} color="$blue10">{scannedItems.length} tétel visszatöltve az előző munkamenetből.</Text>
              </YStack>
              <Button size="$3" theme="blue" onPress={() => setDraftRecovered(false)}>
                <RotateCcw size={16} />
              </Button>
            </XStack>
          </Card>
        )}

        {pendingRetryCount > 0 && (
          <Card backgroundColor="$orange2" padding="$3" borderRadius="$4" borderWidth={1} borderColor="$orange5">
            <XStack justifyContent="space-between" alignItems="center">
              <YStack flex={1}>
                <Text fontSize={13} fontWeight="600" color="$orange10">Offline várólista ({pendingRetryCount} tétel)</Text>
                <Text fontSize={12} color="$orange10">Kapcsolat esetén próbáld újra.</Text>
              </YStack>
              <Button size="$3" theme="orange" disabled={isRetrying} onPress={retryPendingInbound}>
                <RefreshCw size={16} />
              </Button>
            </XStack>
          </Card>
        )}

        {summary && (
          <Card backgroundColor={summary.failed > 0 ? "$orange2" : "$green2"} padding="$3" borderRadius="$4" borderWidth={1} borderColor={summary.failed > 0 ? "$orange5" : "$green5"}>
            <XStack alignItems="center" gap="$3">
              {summary.failed > 0 ? <AlertCircle size={24} color="$orange10" /> : <CheckCircle2 size={24} color="$green10" />}
              <YStack flex={1}>
                <Text fontSize={14} fontWeight="600" color={summary.failed > 0 ? "$orange10" : "$green10"}>Mentés eredménye</Text>
                <Text fontSize={12} color={summary.failed > 0 ? "$orange10" : "$green10"}>
                  {summary.successful} lefoglalva, {summary.failed} hiba, {summary.queued} offline.
                </Text>
              </YStack>
            </XStack>
          </Card>
        )}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* SCANNED ITEMS LIST */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: Math.max(100, insets.bottom + 80) }} onScroll={() => { if (pendingRetryCount > 0) loadPendingRetryCount(); }}>

        {scannedItems.length > 0 ? (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$1" marginBottom="$2">
              <Text fontWeight="600" fontSize={14} color="$color11">Beolvasott tételek ({scannedItems.length})</Text>
              <Button size="$2" theme="red" variant="outlined" icon={Trash2} onPress={clearScannedItems}>
                Törlés
              </Button>
            </XStack>

            {scannedItems.map((item, index) => {
              const isAllocated = item.status === 'allocated' && item.assignedLocation;

              return (
                <Card key={`${item.code}-${index}`} backgroundColor="$color3" borderRadius="$4" padding="$3" borderWidth={1} borderColor={isAllocated ? "$green5" : "$color4"}>
                  <XStack gap="$3" alignItems="center">
                    <YStack width={48} height={48} backgroundColor={isAllocated ? "$green5" : "$blue5"} borderRadius="$3" alignItems="center" justifyContent="center">
                      <Package size={24} color={isAllocated ? "$green10" : "$blue10"} />
                    </YStack>

                    <YStack flex={1} gap="$1">
                      <Text fontWeight="700" fontSize={16} color="$color12">{item.code}</Text>
                      <XStack gap="$3">
                        <Text fontSize={13} fontWeight="600" color="$color11">Mennyiség: <Text color="$blue10">{item.quantity} db</Text></Text>
                      </XStack>

                      {/* Cél Lokáció UI (Ha már kiosztották) */}
                      {isAllocated ? (
                        <YStack backgroundColor="$green3" padding="$2" borderRadius="$3" marginTop="$1">
                          <XStack alignItems="center" gap="$2">
                            <MapPin size={16} color="$green10" />
                            <Text fontSize={14} fontWeight="800" color="$green11">Cél polc: {item.assignedLocation}</Text>
                          </XStack>
                        </YStack>
                      ) : (
                        <XStack alignItems="center" justifyContent="space-between" marginTop="$1" backgroundColor="$color2" padding="$2" borderRadius="$3">
                          <Text fontSize={13} color="$color11">XL Méret (Raklapos)?</Text>
                          <Switch
                            size="$2"
                            checked={item.isXl}
                            onCheckedChange={() => toggleXlStatus(item.code)}
                            backgroundColor={item.isXl ? "$orange8" : "$color5"}
                          >
                            <Switch.Thumb animation="quick" />
                          </Switch>
                        </XStack>
                      )}
                    </YStack>

                    {!isAllocated && (
                      <Button
                        size="$3"
                        theme="gray"
                        circular
                        icon={Edit3}
                        onPress={() => router.push({ pathname: "/edit", params: { code: item.code, type: "inbound", quantity: String(item.quantity) } })}
                      />
                    )}
                  </XStack>
                </Card>
              );
            })}
          </YStack>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10" gap="$3">
            <ScanBarcode size={64} color="$color8" opacity={0.5} />
            <Text fontSize={15} color="$color10" textAlign="center" paddingHorizontal="$6">
              Még nincsenek beolvasott tételek. Kezdd el a szkennelést a fenti gombbal.
            </Text>
          </YStack>
        )}
      </ScrollView>

      {/* FLOATING ACTION BOTTOM BAR */}
      {scannedItems.length > 0 && hasPendingItems && (
        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" backgroundColor="$background" borderTopWidth={1} borderColor="$color4">
          <Button size="$5" theme="green" icon={Save} disabled={isSaving} onPress={allocateAndSaveItems}>
            <Text fontWeight="600" fontSize={16}>{isSaving ? "Lefoglalás..." : `Lokációk kiosztása (${scannedItems.filter(i => i.status === 'pending' || i.status === 'error').length})`}</Text>
          </Button>
        </YStack>
      )}

    </YStack>
  );
}
