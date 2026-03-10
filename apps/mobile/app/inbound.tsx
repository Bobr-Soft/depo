import React, { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
import { YStack, XStack, Button, Text, H2, Card, ScrollView, Separator } from "@repo/ui";
import { ScanBarcode, Package, ArrowLeft, RefreshCw, Trash2, Edit3, Save, CloudOff, CheckCircle2, AlertCircle } from "@tamagui/lucide-icons";
import { BarcodeScanner } from "@/components";
import { router, useLocalSearchParams } from "expo-router";
import { buildApiUrl, getApiUrl, getToken } from "@/services/secureStorage";
import { isOnline, syncData } from "@/services/sync";
import { enqueueSyncOperation, getSyncQueue, initDatabase, isDatabaseInitialized } from "@/services/database";

type ScannedInboundItem = {
  code: string;
  type: string;
  timestamp: Date;
  quantity: number;
};

type SaveSummary = {
  total: number;
  successful: number;
  failed: number;
  queued: number;
};

type ApiItem = {
  id: number;
  name: string;
  barcode: string | null;
  description: string | null;
  quantity: number;
  category_id?: number | null;
  location_id?: number | null;
};

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, "").toLowerCase();
let inboundDraftCache: ScannedInboundItem[] = [];

export default function InboundScreen() {
  const { action, code: editedCode, quantity: editedQuantity, nonce } = useLocalSearchParams<{
    action?: string | string[];
    code?: string | string[];
    quantity?: string | string[];
    nonce?: string | string[];
  }>();

  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannedItems, setScannedItems] = useState<ScannedInboundItem[]>(() => [...inboundDraftCache]);
  const [isSaving, setIsSaving] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [pendingRetryCount, setPendingRetryCount] = useState(0);
  const [summary, setSummary] = useState<SaveSummary | null>(null);

  const isProcessing = useRef(false);
  const lastHandledEditNonce = useRef<string | null>(null);

  const getSingleParam = (value: string | string[] | undefined): string | undefined => Array.isArray(value) ? value[0] : value;

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
  useEffect(() => { inboundDraftCache = scannedItems; }, [scannedItems]);

  useEffect(() => {
    const actionValue = getSingleParam(action);
    const codeValue = getSingleParam(editedCode);
    const quantityValue = getSingleParam(editedQuantity);
    const nonceValue = getSingleParam(nonce);

    if (!nonceValue || lastHandledEditNonce.current === nonceValue) return;
    if (!codeValue || (actionValue !== "update" && actionValue !== "delete")) {
      lastHandledEditNonce.current = nonceValue;
      return;
    }

    const normalizedCode = normalizeBarcode(codeValue);
    if (!normalizedCode) {
      lastHandledEditNonce.current = nonceValue;
      return;
    }

    if (actionValue === "delete") {
      setScannedItems((prev) => prev.filter((item) => normalizeBarcode(item.code) !== normalizedCode));
    } else {
      const nextQuantity = Math.max(1, Number.parseInt(quantityValue ?? "1", 10) || 1);
      setScannedItems((prev) =>
        prev.map((item) => normalizeBarcode(item.code) === normalizedCode ? { ...item, quantity: nextQuantity, timestamp: new Date() } : item)
      );
    }

    setSummary(null);
    lastHandledEditNonce.current = nonceValue;
  }, [action, editedCode, editedQuantity, nonce]);

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
      return [{ code: data, type, timestamp, quantity: 1 }, ...prev];
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

  const fetchItems = useCallback(async (apiUrl: string, token: string): Promise<ApiItem[]> => {
    const response = await fetch(buildApiUrl(apiUrl, '/items'), {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!response.ok) throw new Error(`Nem sikerült lekérni a termékeket: ${response.status}`);
    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }, []);

  const enqueueInboundRetry = useCallback(async (item: ScannedInboundItem) => {
    if (!isDatabaseInitialized()) await initDatabase();
    await enqueueSyncOperation("UPSERT", "item", null, {
      barcode: item.code,
      quantityIncrement: item.quantity,
      name: `Beolvasott termék ${item.code}`,
      description: "Inbound scan",
    });
  }, []);

  const saveScannedItems = useCallback(async () => {
    if (scannedItems.length === 0 || isSaving) return;

    setIsSaving(true);
    setSummary(null);

    const batchSummary: SaveSummary = { total: scannedItems.length, successful: 0, failed: 0, queued: 0 };

    try {
      const [apiUrl, token, online] = await Promise.all([getApiUrl(), getToken(), isOnline()]);
      if (!token) throw new Error("Nincs bejelentkezett felhasználó.");

      if (!online) {
        for (const item of scannedItems) {
          await enqueueInboundRetry(item);
          batchSummary.queued += 1;
        }
        setScannedItems([]);
        setSummary(batchSummary);
        await loadPendingRetryCount();
        Alert.alert("Offline mentés", "A tételek várólistára kerültek, és online állapotban szinkronizálódnak.");
        return;
      }

      const items = await fetchItems(apiUrl, token);
      const itemByBarcode = new Map<string, ApiItem>();
      for (const item of items) if (item.barcode) itemByBarcode.set(normalizeBarcode(item.barcode), item);

      for (const scannedItem of scannedItems) {
        const normalizedBarcode = normalizeBarcode(scannedItem.code);
        const existingItem = itemByBarcode.get(normalizedBarcode);

        try {
          if (existingItem) {
            const updateResponse = await fetch(buildApiUrl(apiUrl, `/items/${existingItem.id}`), {
              method: "PUT",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                name: existingItem.name,
                barcode: existingItem.barcode ?? scannedItem.code,
                description: existingItem.description,
                quantity: Math.max(0, Number(existingItem.quantity || 0)) + scannedItem.quantity,
                category_id: existingItem.category_id ?? null,
                location_id: existingItem.location_id ?? null,
              }),
            });
            if (!updateResponse.ok) throw new Error(`Update hiba: ${updateResponse.status}`);
            itemByBarcode.set(normalizedBarcode, await updateResponse.json());
          } else {
            const createResponse = await fetch(buildApiUrl(apiUrl, '/items'), {
              method: "POST",
              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `Beolvasott termék ${scannedItem.code}`,
                barcode: scannedItem.code,
                description: "Inbound scan",
                quantity: scannedItem.quantity,
                category_id: null,
                location_id: null,
              }),
            });
            if (!createResponse.ok) throw new Error(`Create hiba: ${createResponse.status}`);
            itemByBarcode.set(normalizedBarcode, await createResponse.json());
          }
          batchSummary.successful += 1;
        } catch (error) {
          console.error(`Failed to persist scanned barcode ${scannedItem.code}:`, error);
          batchSummary.failed += 1;
          await enqueueInboundRetry(scannedItem);
          batchSummary.queued += 1;
        }
      }

      setScannedItems([]);
      setSummary(batchSummary);
      await loadPendingRetryCount();

      if (batchSummary.failed > 0) {
        Alert.alert("Részleges mentés", `Sikeres: ${batchSummary.successful}\nSikertelen: ${batchSummary.failed}\nVárólistára tett: ${batchSummary.queued}`);
      } else {
        Alert.alert("Mentés sikeres", `${batchSummary.successful} tétel mentve.`);
        router.replace("/");
      }
    } catch (error) {
      console.error("Failed to save inbound scanned items:", error);
      for (const item of scannedItems) {
        await enqueueInboundRetry(item);
        batchSummary.queued += 1;
      }
      batchSummary.failed = scannedItems.length;
      setScannedItems([]);
      setSummary(batchSummary);
      await loadPendingRetryCount();
      Alert.alert("Mentési hiba", "A mentés nem sikerült, a tételek várólistára kerültek újrapróbáláshoz.");
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
      `Biztosan törlöd az összes beolvasott tételt? (${scannedItems.length} db)`,
      [
        { text: "Mégse", style: "cancel" },
        { text: "Törlés", style: "destructive", onPress: () => { setScannedItems([]); setSummary(null); } },
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
      />
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">

      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} disabled={isSaving} />
          <YStack flex={1}>
            <H2 color="$color12">Bevételezés</H2>
            <Text fontSize={14} color="$color10">Áru érkeztetése a raktárba</Text>
          </YStack>
        </XStack>

        {/* PRIMARY ACTION BUTTON */}
        <Button size="$5" theme="blue" icon={ScanBarcode} onPress={() => setShowScanner(true)} marginTop="$2">
          <Text fontWeight="600" fontSize={16}>Termék szkennelése</Text>
        </Button>
      </YStack>

      {/* DYNAMIC ALERTS / STATUSES */}
      <YStack paddingHorizontal="$4" gap="$2" marginBottom="$2">
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
                  {summary.successful} sikeres, {summary.failed} hiba, {summary.queued} várólistán.
                </Text>
              </YStack>
            </XStack>
          </Card>
        )}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* SCANNED ITEMS LIST */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 100 }} onScroll={() => { if (pendingRetryCount > 0) loadPendingRetryCount(); }}>

        {scannedItems.length > 0 ? (
          <YStack gap="$3">
            <XStack justifyContent="space-between" alignItems="center" paddingHorizontal="$1" marginBottom="$2">
              <Text fontWeight="600" fontSize={14} color="$color11">Beolvasott tételek ({scannedItems.length})</Text>
              <Button size="$2" theme="red" variant="outlined" icon={Trash2} onPress={clearScannedItems}>
                Törlés
              </Button>
            </XStack>

            {scannedItems.map((item, index) => (
              <Card key={`${item.code}-${index}`} backgroundColor="$color3" borderRadius="$4" padding="$3" borderWidth={1} borderColor="$color4">
                <XStack gap="$3" alignItems="center">
                  <YStack width={48} height={48} backgroundColor="$blue5" borderRadius="$3" alignItems="center" justifyContent="center">
                    <Package size={24} color="$blue10" />
                  </YStack>

                  <YStack flex={1} gap="$1">
                    <Text fontWeight="700" fontSize={16} color="$color12">{item.code}</Text>
                    <XStack gap="$3">
                      <Text fontSize={13} fontWeight="600" color="$color11">Mennyiség: <Text color="$blue10">{item.quantity} db</Text></Text>
                      <Text fontSize={13} color="$color10">Típus: {item.type}</Text>
                    </XStack>
                    <Text fontSize={12} color="$color9">{item.timestamp.toLocaleTimeString('hu-HU')}</Text>
                  </YStack>

                  <Button
                    size="$3"
                    theme="gray"
                    circular
                    icon={Edit3}
                    onPress={() => router.push({ pathname: "/edit", params: { code: item.code, type: "inbound", quantity: String(item.quantity) } })}
                  />
                </XStack>
              </Card>
            ))}
          </YStack>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10" gap="$3">
            <ScanBarcode size={64} color="$color8" opacity={0.5} />
            <Text fontSize={15} color="$color10" textAlign="center" paddingHorizontal="$6">
              Még nincsenek beolvasott tételek. Kezdd el a szkennelést a fenti kék gombbal.
            </Text>
          </YStack>
        )}
      </ScrollView>

      {/* FLOATING ACTION BOTTOM BAR */}
      {scannedItems.length > 0 && (
        <YStack position="absolute" bottom={0} left={0} right={0} padding="$4" backgroundColor="$background" borderTopWidth={1} borderColor="$color4">
          <Button size="$5" theme="green" icon={Save} disabled={isSaving} onPress={saveScannedItems}>
            <Text fontWeight="600" fontSize={16}>{isSaving ? "Mentés folyamatban..." : `Tételek mentése (${scannedItems.length})`}</Text>
          </Button>
        </YStack>
      )}

    </YStack>
  );
}
