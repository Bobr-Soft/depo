/**
 * Inbound Screen
 *
 * Example integration of BarcodeScanner component for scanning products.
 * Shows how to use the scanner as an embedded modal within a screen.
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Alert } from "react-native";
import { YStack, XStack, Button, Text, H2, Card, ScrollView } from "@repo/ui";
import { ScanBarcode, Package } from "@tamagui/lucide-icons";
import { BarcodeScanner } from "@/components";
import { router, useLocalSearchParams } from "expo-router";
import { buildApiUrl, getApiUrl, getToken } from "@/services/secureStorage";
import { isOnline, syncData } from "@/services/sync";
import {
  enqueueSyncOperation,
  getSyncQueue,
  initDatabase,
  isDatabaseInitialized,
} from "@/services/database";

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

  const getSingleParam = (value: string | string[] | undefined): string | undefined => {
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  const loadPendingRetryCount = useCallback(async () => {
    try {
      if (!isDatabaseInitialized()) {
        await initDatabase();
      }

      const queue = await getSyncQueue();
      const pendingInboundOps = queue.filter(
        (entry) => entry.entity_type === "item" && entry.operation === "UPSERT"
      );
      setPendingRetryCount(pendingInboundOps.length);
    } catch (error) {
      console.error("Failed to load pending inbound retry count:", error);
      setPendingRetryCount(0);
    }
  }, []);

  useEffect(() => {
    loadPendingRetryCount();
  }, [loadPendingRetryCount]);

  useEffect(() => {
    inboundDraftCache = scannedItems;
  }, [scannedItems]);

  useEffect(() => {
    const actionValue = getSingleParam(action);
    const codeValue = getSingleParam(editedCode);
    const quantityValue = getSingleParam(editedQuantity);
    const nonceValue = getSingleParam(nonce);

    if (!nonceValue || lastHandledEditNonce.current === nonceValue) {
      return;
    }

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
        prev.map((item) =>
          normalizeBarcode(item.code) === normalizedCode
            ? { ...item, quantity: nextQuantity, timestamp: new Date() }
            : item
        )
      );
    }

    setSummary(null);
    lastHandledEditNonce.current = nonceValue;
  }, [action, editedCode, editedQuantity, nonce]);

  const handleScan = useCallback((data: string, type: string) => {
    // Prevent multiple scans while processing
    if (isProcessing.current) return;

    isProcessing.current = true;

    const timestamp = new Date();
    setScannedItems((prev) => {
      const normalizedData = normalizeBarcode(data);
      const existingIndex = prev.findIndex(
        (item) => normalizeBarcode(item.code) === normalizedData
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          quantity: existing.quantity + 1,
          timestamp,
        };
        return updated;
      }

      return [
        {
          code: data,
          type,
          timestamp,
          quantity: 1,
        },
        ...prev,
      ];
    });

    // Show prompt asking to continue or close
    Alert.alert(
      "Termék beolvasva",
      `Kód: ${data}\nTípus: ${type}`,
      [
        {
          text: "Tovább szkennelés",
          onPress: () => {
            isProcessing.current = false;
            setScannerKey(prev => prev + 1);
          },
          style: "default"
        },
        {
          text: "Kész",
          onPress: () => {
            isProcessing.current = false;
            setShowScanner(false);
            setScannerKey(prev => prev + 1);
          },
          style: "cancel"
        }
      ],
      {
        cancelable: false,
        onDismiss: () => {
          isProcessing.current = false;
        }
      }
    );
  }, []);

  const fetchItems = useCallback(async (apiUrl: string, token: string): Promise<ApiItem[]> => {
    const response = await fetch(buildApiUrl(apiUrl, '/items'), {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(`Nem sikerült lekérni a termékeket: ${response.status} - ${errorText}`);
    }

    const payload = await response.json();
    return Array.isArray(payload) ? payload : [];
  }, []);

  const enqueueInboundRetry = useCallback(
    async (item: ScannedInboundItem) => {
      if (!isDatabaseInitialized()) {
        await initDatabase();
      }

      await enqueueSyncOperation("UPSERT", "item", null, {
        barcode: item.code,
        quantityIncrement: item.quantity,
        name: `Beolvasott termék ${item.code}`,
        description: "Inbound scan",
      });
    },
    []
  );

  const saveScannedItems = useCallback(async () => {
    if (scannedItems.length === 0 || isSaving) {
      return;
    }

    setIsSaving(true);
    setSummary(null);

    const batchSummary: SaveSummary = {
      total: scannedItems.length,
      successful: 0,
      failed: 0,
      queued: 0,
    };

    try {
      const [apiUrl, token, online] = await Promise.all([getApiUrl(), getToken(), isOnline()]);

      if (!token) {
        throw new Error("Nincs bejelentkezett felhasználó.");
      }

      if (!online) {
        for (const item of scannedItems) {
          await enqueueInboundRetry(item);
          batchSummary.queued += 1;
        }

        setScannedItems([]);
        setSummary(batchSummary);
        await loadPendingRetryCount();
        Alert.alert("Offline mentés", "A tételek várólistára kerültek, és online állapotban újrapróbálhatók.");
        return;
      }

      const items = await fetchItems(apiUrl, token);
      const itemByBarcode = new Map<string, ApiItem>();

      for (const item of items) {
        if (item.barcode) {
          itemByBarcode.set(normalizeBarcode(item.barcode), item);
        }
      }

      for (const scannedItem of scannedItems) {
        const normalizedBarcode = normalizeBarcode(scannedItem.code);
        const existingItem = itemByBarcode.get(normalizedBarcode);

        try {
          if (existingItem) {
            const updateResponse = await fetch(buildApiUrl(apiUrl, `/items/${existingItem.id}`), {
              method: "PUT",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: existingItem.name,
                barcode: existingItem.barcode ?? scannedItem.code,
                description: existingItem.description,
                quantity: Math.max(0, Number(existingItem.quantity || 0)) + scannedItem.quantity,
                category_id: existingItem.category_id ?? null,
                location_id: existingItem.location_id ?? null,
              }),
            });

            if (!updateResponse.ok) {
              const errorText = await updateResponse.text().catch(() => "Unknown error");
              throw new Error(`Update hiba: ${updateResponse.status} - ${errorText}`);
            }

            const updated = await updateResponse.json();
            itemByBarcode.set(normalizedBarcode, updated);
          } else {
            const createResponse = await fetch(buildApiUrl(apiUrl, '/items'), {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                name: `Beolvasott termék ${scannedItem.code}`,
                barcode: scannedItem.code,
                description: "Inbound scan",
                quantity: scannedItem.quantity,
                category_id: null,
                location_id: null,
              }),
            });

            if (!createResponse.ok) {
              const errorText = await createResponse.text().catch(() => "Unknown error");
              throw new Error(`Create hiba: ${createResponse.status} - ${errorText}`);
            }

            const created = await createResponse.json();
            itemByBarcode.set(normalizedBarcode, created);
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
        Alert.alert(
          "Részleges mentés",
          `Sikeres: ${batchSummary.successful}\nSikertelen: ${batchSummary.failed}\nVárólistára tett: ${batchSummary.queued}`
        );
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

      Alert.alert(
        "Mentési hiba",
        "A mentés nem sikerült, a tételek várólistára kerültek újrapróbáláshoz."
      );
    } finally {
      setIsSaving(false);
    }
  }, [enqueueInboundRetry, fetchItems, isSaving, loadPendingRetryCount, scannedItems]);

  const retryPendingInbound = useCallback(async () => {
    if (isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      const result = await syncData();
      await loadPendingRetryCount();

      if (!result.success) {
        Alert.alert("Újrapróbálás", result.error ?? "Az újrapróbálás nem sikerült.");
      } else {
        Alert.alert("Újrapróbálás", "A várólistás tételek szinkronja lefutott.");
      }
    } catch (error) {
      console.error("Failed to retry pending inbound operations:", error);
      Alert.alert("Újrapróbálás", "Hiba történt az újrapróbálás során.");
    } finally {
      setIsRetrying(false);
    }
  }, [isRetrying, loadPendingRetryCount]);

  const clearScannedItems = useCallback(() => {
    if (scannedItems.length === 0) {
      return;
    }

    Alert.alert(
      "Lista törlése",
      `Biztosan törlöd az összes beolvasott tételt? (${scannedItems.length} db)`,
      [
        { text: "Mégse", style: "cancel" },
        {
          text: "Törlés",
          style: "destructive",
          onPress: () => {
            setScannedItems([]);
            setSummary(null);
          },
        },
      ]
    );
  }, [scannedItems.length]);

  if (showScanner) {
    return (
      <BarcodeScanner
        key={scannerKey}
        onScan={handleScan}
        onClose={() => {
          isProcessing.current = false;
          setShowScanner(false);
          setScannerKey(prev => prev + 1);
        }}
        title="Termék szkennelés"
        instruction="Szkenneld be a termék vonalkódját"
        autoResetDelay={0}
      />
    );
  }

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$4">
      <YStack gap="$2">
        <H2>Bevételezés (Inbound)</H2>
        <Text color="$color11" fontSize={14}>
          Szkenneld be a beérkező termékeket
        </Text>
      </YStack>

      <Button
        size="$5"
        theme="blue"
        icon={ScanBarcode}
        onPress={() => setShowScanner(true)}
      >
        <Text>Termék szkennelése</Text>
      </Button>

      <Card padding="$3" backgroundColor="$background">
        <YStack gap="$2">
          <Text fontWeight="600">Offline újrapróbálás állapota</Text>
          <Text color="$color11">Várólistás inbound műveletek: {pendingRetryCount}</Text>
          <XStack gap="$2" flex={1} justifyContent="space-between">
            <Button
              size="$3"
              theme="blue"
              flex={1}
              disabled={pendingRetryCount === 0 || isRetrying}
              onPress={retryPendingInbound}
            >
              <Text>{isRetrying ? "Újrapróbálás..." : "Várólista újrapróbálása"}</Text>
            </Button>
            <Button onPress={() => loadPendingRetryCount()} size="$3" theme="gray" flex={1}>
              <Text>Újratöltés</Text>
            </Button>
          </XStack>
        </YStack>
      </Card>

      {summary && (
        <Card padding="$3" backgroundColor="$background">
          <YStack gap="$1">
            <Text fontWeight="600">Utolsó mentés összegzés</Text>
            <Text color="$color11">Összes: {summary.total}</Text>
            <Text color="$color11">Sikeres: {summary.successful}</Text>
            <Text color="$color11">Sikertelen: {summary.failed}</Text>
            <Text color="$color11">Várólistára tett: {summary.queued}</Text>
          </YStack>
        </Card>
      )}

      <ScrollView flex={1} backgroundColor="$background" onScroll={() => {
        // Reload the pending retry count when user scrolls back to the top, in case it changed due to background sync or edits
        if (pendingRetryCount > 0) {
          loadPendingRetryCount();
        }
      }}>
        {scannedItems.length > 0 && (
          <YStack gap="$3" flex={1}>
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontWeight="600" fontSize={16}>
                Beolvasott termékek ({scannedItems.length})
              </Text>
              <Button size="$3" theme="red" onPress={clearScannedItems}>
                <Text>Összes törlése</Text>
              </Button>
            </XStack>

            <YStack gap="$2" flex={1}>
              {scannedItems.map((item, index) => (
                <Card key={index} padding="$3" backgroundColor="$background">
                  <XStack gap="$3" alignItems="center">
                    <YStack
                      backgroundColor="$blue5"
                      padding="$2"
                      borderRadius="$4"
                    >
                      <Package size={24} color="$blue10" />
                    </YStack>
                    <YStack flex={1} gap="$1">
                      <Text fontWeight="600">{item.code}</Text>
                      <Text fontSize={12} color="$color11">
                        Mennyiség: {item.quantity}
                      </Text>
                      <Text fontSize={12} color="$color11">
                        Típus: {item.type}
                      </Text>
                      <Text fontSize={12} color="$color11">
                        {item.timestamp.toLocaleTimeString('hu-HU')}
                      </Text>
                    </YStack>
                    <Button
                      size="$3"
                      theme="gray"
                      onPress={() =>
                        router.push({
                          pathname: "/edit",
                          params: {
                            code: item.code,
                            type: "inbound",
                            quantity: String(item.quantity),
                          },
                        })
                      }
                    >
                      <Text>Szerkesztés</Text>
                    </Button>
                  </XStack>
                </Card>
              ))}
            </YStack>

            <Button
              size="$4"
              theme="green"
              disabled={isSaving}
              onPress={saveScannedItems}
            >
              <Text>{isSaving ? "Mentés..." : `Mentés (${scannedItems.length} termék)`}</Text>
            </Button>
          </YStack>
        )}

        {scannedItems.length === 0 && (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
            <Package size={80} color="$color9" opacity={0.3} />
            <Text color="$color11" textAlign="center">
              Még nincsenek beolvasott termékek.{'\n'}
              Kezdd el a szkennelést a fenti gombra kattintva.
            </Text>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
