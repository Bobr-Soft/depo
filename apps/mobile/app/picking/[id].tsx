import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Scan, ClipboardCheck, ClipboardX, Box, Square } from "@repo/ui";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { loadTask } from "@/components/api";
import { TaskComplete } from "@/constants";
import { ScanBarcode } from "@repo/ui";
import { Alert } from "react-native";
import { BarcodeScanner } from "@/components";

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskComplete | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannedItems, setScannedItems] = useState<Array<{ code: string; type: string; timestamp: Date }>>([]);
  const isProcessing = useRef(false);

  useEffect(() => {
    fetchTaskDetails();

  }, [id]);

  async function fetchTaskDetails() {
    setLoading(true);
    setError(null);
    try {
      const task = await loadTask(Number(id));
      if (!task) {
        setError('Nem található a feladat.');
      } else {
        setTask(task);
      }
    } catch (error) {
      setError('Nem sikerült betölteni a feladat részleteit.');
    } finally {
      setLoading(false);
    }
  }

    const handleScan = useCallback((data: string, type: string) => {
      // Prevent multiple scans while processing
      if (isProcessing.current) return;

      isProcessing.current = true;

      // Add scanned item to list
      setScannedItems(prev => [{
        code: data,
        type: type,
        timestamp: new Date()
      }, ...prev]);

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
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <H2 color="$color12">{task?.source_id || 'Nincs név'}</H2>
        <Text fontSize={14} color="$color12">Határidő: {task?.deadline ? `${new Date(task?.deadline).toLocaleString()} (${Math.max(0, Math.round((new Date(task?.deadline).getTime() - Date.now()) / 60000))} perc hátra)` : 'N/A'}</Text>

      </YStack>

      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" onPress={() => router.back()}>
              <Text>Vissza</Text>
            </Button>
          </YStack>
        ) : task?.items && task?.items.length > 0 ? (
          <ScrollView flex={1}>
            {task?.items.map((item) =>
              <Card key={`${item.task_id}-${item.id}-${item.item.id}`} backgroundColor="$color5" marginBottom="$3" padding="$4" borderRadius="$4" gap="$3" onPress={() => {
                setShowScanner(true);
              }}>
                <YStack gap="$2">
                  <XStack gap="$4" justifyContent="space-between">
                    <YStack flex={1} gap="$1">
                      {/**TODO Fix item category being loaded probably at the db side instead of the name */}
                      <Text fontWeight="600" fontSize={16}>{item.item.name}</Text>
                      <Text fontSize={14} color="$color10">Kért: {item.requested_quantity}</Text>
                      <Text fontSize={14} color="$color10">Összes: {item.item.quantity}</Text>
                      <Text fontSize={14} color="$color10">Vonalkód: {item.item.barcode ?? 'N/A'}</Text>
                    </YStack>
                    {/**TODO If item isnt picked show in progress icon, if its picked show green check */}
                    <YStack alignItems="center" justifyContent="center" paddingRight="$2">
                      {item.status === 'picked' ? (
                        <Square size={72} backgroundColor="$green5" borderRadius="$4" justifyContent="center" alignItems="center">
                          <ClipboardCheck size={48} color="$color12"/>
                        </Square>
                      ) : (
                        <Square size={72} backgroundColor="$yellow5" borderRadius="$4" justifyContent="center" alignItems="center">
                          <Box size={48} color="$color12" />
                        </Square>
                      )}
                    </YStack>
                  </XStack>
                </YStack>
              </Card>
            )}
            <YStack gap="$4">


            </YStack>
          </ScrollView>

        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Text fontSize={14} color="$color12">Nincsenek tételek ehhez a feladathoz.</Text>
          </YStack>
        )}
      </Card>
    </YStack>
  );
}
