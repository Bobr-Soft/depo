import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { ArrowLeft, CheckCircle2, Package, Clock, Barcode, AlertCircle } from "@tamagui/lucide-icons";
import { loadTask } from "@/components/api";
import { TaskComplete } from "@/constants";
import { BarcodeScanner } from "@/components";
import { taskItemPicked } from "@/services/sync";

const normalizeBarcode = (value: string) => value.trim().replace(/\s+/g, '').toLowerCase();

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskComplete | null>(null);
  const [activeItem, setActiveItem] = useState<TaskComplete['items'][number] | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const isProcessing = useRef(false);

  const fetchTaskDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const loadedTask = await loadTask(Number(id));
      if (!loadedTask) {
        setError('Nem található a feladat.');
      } else {
        setTask(loadedTask);
      }
    } catch (error) {
      setError(`Nem sikerült betölteni a feladat részleteit. ${error instanceof Error ? error.message : 'Ismeretlen hiba'}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTaskDetails();
    setActiveItem(null);
  }, [fetchTaskDetails]);

  // --- PROGRESSZIÓ SZÁMÍTÁSA ---
  const { totalItems, pickedItems, progressPercent } = useMemo(() => {
    if (!task?.items) return { totalItems: 0, pickedItems: 0, progressPercent: 0 };
    const total = task.items.length;
    const picked = task.items.filter(i => i.status === 'picked' || i.picked_quantity >= i.requested_quantity).length;
    return {
      totalItems: total,
      pickedItems: picked,
      progressPercent: total === 0 ? 0 : Math.round((picked / total) * 100)
    };
  }, [task]);

  // --- SZKENNELÉS LOGIKA ---
  const handleScan = useCallback((data: string, type: string) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    if (!activeItem) {
      Alert.alert(
        "Sikertelen szkennelés",
        `Nincs kiválasztott tétel.\nKód: ${data}`,
        [
          { text: "Újra szkennelés", onPress: () => { isProcessing.current = false; setScannerKey(prev => prev + 1); }, style: "default" },
          { text: "Kész", onPress: () => { isProcessing.current = false; setShowScanner(false); setActiveItem(null); setScannerKey(prev => prev + 1); }, style: "cancel" }
        ],
        { cancelable: false, onDismiss: () => { isProcessing.current = false; } }
      );
      return;
    }

    const barcode = activeItem.item.barcode ?? '';
    const normalizedData = normalizeBarcode(data);
    const normalizedBarcode = normalizeBarcode(barcode);
    const matchedItem = barcode.length > 0 && normalizedBarcode === normalizedData ? activeItem : null;

    if (matchedItem) {
      Alert.alert(
        "Sikeres szkennelés",
        `Kért mennyiség: ${matchedItem.requested_quantity}\nPolcon lévő összes: ${matchedItem.item.quantity}`,
        [
          { text: "Részleges teljesítés (hiány)", onPress: () => { isProcessing.current = false; setScannerKey(prev => prev + 1); }, style: "default" },
          {
            text: "Kész (Teljes mennyiség)",
            onPress: async () => {
              try {
                await taskItemPicked(matchedItem.task_id, matchedItem.item.id, matchedItem.requested_quantity);
                await fetchTaskDetails();
                setShowScanner(false);
                setActiveItem(null);
                setScannerKey(prev => prev + 1);
              } catch (pickError) {
                Alert.alert(
                  "Mentési hiba",
                  pickError instanceof Error ? pickError.message : "Nem sikerült menteni a tételt.",
                  [{ text: "Újra", onPress: () => setScannerKey(prev => prev + 1), style: "default" }]
                );
              } finally {
                isProcessing.current = false;
              }
            },
            style: "default"
          },
          { text: "Mégsem", onPress: () => { isProcessing.current = false; setScannerKey(prev => prev + 1); }, style: "destructive" },
        ],
        { cancelable: false, onDismiss: () => { isProcessing.current = false; } }
      );
    } else {
      Alert.alert(
        "Sikertelen szkennelés",
        `A beolvasott termék téves.\nKód: ${data}\nVárt vonalkód: ${barcode || 'N/A'}`,
        [
          { text: "Újra szkennelés", onPress: () => { isProcessing.current = false; setScannerKey(prev => prev + 1); }, style: "default" },
          { text: "Kész", onPress: () => { isProcessing.current = false; setShowScanner(false); setActiveItem(null); setScannerKey(prev => prev + 1); }, style: "cancel" }
        ],
        { cancelable: false, onDismiss: () => { isProcessing.current = false; } }
      );
    }
  }, [activeItem, fetchTaskDetails]);

  // --- SZKENNER NÉZET ---
  if (showScanner) {
    if (!activeItem) {
      Alert.alert("Hiba", "Nincs kiválasztott tétel a szkenneléshez.", [{ text: "OK", onPress: () => { setShowScanner(false); setScannerKey(prev => prev + 1); }, style: "default" }], { cancelable: false });
      return null;
    }
    if (activeItem.requested_quantity - activeItem.picked_quantity <= 0) {
      router.replace(`/picking/${id}/edit?item_id=${activeItem.id}`);
      return null;
    }

    return (
      <BarcodeScanner
        key={scannerKey}
        onScan={handleScan}
        onClose={() => { isProcessing.current = false; setShowScanner(false); setActiveItem(null); setScannerKey(prev => prev + 1); }}
        title="Termék szkennelés"
        instruction={`Keresd ezt: ${activeItem.item.name}`}
        autoResetDelay={0}
      />
    );
  }

  // --- FŐ NÉZET ---
  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">

      {/* FEJLÉC ÉS PROGRESSZIÓ */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12" numberOfLines={1}>{task?.source_id || 'Betöltés...'}</H2>
            <XStack alignItems="center" gap="$1.5">
              <Clock size={12} color="$color10" />
              <Text fontSize={13} color="$color10">
                {task?.deadline ? `${new Date(task.deadline).toLocaleTimeString('hu-HU', {hour: '2-digit', minute:'2-digit'})} határidő` : 'Nincs határidő'}
              </Text>
            </XStack>
          </YStack>
        </XStack>

        {/* Progress Bar */}
        {!loading && !error && task && (
          <YStack gap="$2" marginTop="$2">
            <XStack justifyContent="space-between" alignItems="center">
              <Text fontSize={13} fontWeight="600" color="$color11">Komissiózás állapota</Text>
              <Text fontSize={13} fontWeight="bold" color={progressPercent === 100 ? "$green10" : "$blue10"}>
                {pickedItems} / {totalItems} tétel
              </Text>
            </XStack>
            <XStack height={8} backgroundColor="$color5" borderRadius="$4" overflow="hidden">
              <XStack width={`${progressPercent}%`} backgroundColor={progressPercent === 100 ? "$green10" : "$blue10"} height="100%" />
            </XStack>
          </YStack>
        )}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* TÉTELEK LISTÁJA */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
            <AlertCircle size={32} color="$red10" />
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" theme="gray" onPress={() => router.back()}>Vissza</Button>
          </YStack>
        ) : task?.items && task.items.length > 0 ? (
          <YStack gap="$3">
            {task.items.map((item) => {
              const isCompleted = item.status === 'picked' || item.picked_quantity >= item.requested_quantity;

              return (
                <Card
                  key={`${item.task_id}-${item.id}`}
                  backgroundColor={isCompleted ? "$green3" : "$color3"}
                  borderWidth={1}
                  borderColor={isCompleted ? "$green8" : "$color4"}
                  borderRadius="$4"
                  padding="$4"
                  onPress={() => {
                    if (isCompleted) {
                      router.push(`/picking/${id}/edit?item_id=${item.id}`);
                      return;
                    }
                    setActiveItem(item);
                    setShowScanner(true);
                  }}
                  pressStyle={{ scale: 0.98, opacity: 0.8 }}
                >
                  <XStack gap="$3" alignItems="center">

                    {/* Bal oldali státusz ikon */}
                    <YStack
                      width={48}
                      height={48}
                      backgroundColor={isCompleted ? "$green5" : "$color5"}
                      borderRadius="$3"
                      alignItems="center"
                      justifyContent="center"
                    >
                      {isCompleted ? <CheckCircle2 size={24} color="$green10" /> : <Package size={24} color="$color11" />}
                    </YStack>

                    {/* Középső adatok */}
                    <YStack flex={1} gap="$1.5">
                      <Text fontWeight="700" fontSize={16} color={isCompleted ? "$color11" : "$color12"}>
                        {item.item.name}
                      </Text>

                      <XStack gap="$3" flexWrap="wrap">
                        <XStack gap="$1" alignItems="center">
                          <Package size={12} color={isCompleted ? "$green10" : "$color10"} />
                          <Text fontSize={13} fontWeight="600" color={isCompleted ? "$green10" : "$color11"}>
                            {item.requested_quantity} db kért
                          </Text>
                        </XStack>
                        <XStack gap="$1" alignItems="center">
                          <Barcode size={12} color="$color10" />
                          <Text fontSize={13} color="$color10">
                            {item.item.barcode ?? 'Nincs vonalkód'}
                          </Text>
                        </XStack>
                      </XStack>

                      <Text fontSize={12} color={isCompleted ? "$green10" : "$color9"} marginTop="$1">
                        {isCompleted ? 'Teljesítve • Érintsd meg a módosításhoz' : 'Folyamatban • Érintsd meg a szkenneléshez'}
                      </Text>
                    </YStack>

                  </XStack>
                </Card>
              );
            })}
          </YStack>
        ) : (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Package size={48} color="$color8" />
            <Text fontSize={15} color="$color10" marginTop="$3">Nincsenek tételek ehhez a feladathoz.</Text>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
