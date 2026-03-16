import { useCallback, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator } from "@repo/ui";
import { ArrowLeft, CheckCircle2, Package, Clock, Barcode, AlertCircle, MapPin, Lock } from "@tamagui/lucide-icons";
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

  useFocusEffect(useCallback(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]));

  // --- IRÁNYÍTOTT MUNKAVÉGZÉS (DIRECTED WORK) LOGIKA ---
  // A backend S-Shape algoritmus alapján rendezve küldi az adatokat.
  // Az "activeItem" szigorúan az első olyan tétel, ami még nincs kész.
  const { activeItem, upcomingItems, completedItems, progressPercent, totalItems, pickedItems } = useMemo(() => {
    if (!task?.items) {
      return { activeItem: null, upcomingItems: [], completedItems: [], progressPercent: 0, totalItems: 0, pickedItems: 0 };
    }

    const items = task.items;
    const completed = items.filter(i => i.status === 'picked' || i.picked_quantity >= i.requested_quantity);
    const pending = items.filter(i => i.status !== 'picked' && i.picked_quantity < i.requested_quantity);

    return {
      activeItem: pending.length > 0 ? pending[0] : null,
      upcomingItems: pending.slice(1),
      completedItems: completed,
      progressPercent: items.length === 0 ? 0 : Math.round((completed.length / items.length) * 100),
      totalItems: items.length,
      pickedItems: completed.length
    };
  }, [task]);

  // --- SZKENNELÉS LOGIKA ---
  const handleScan = useCallback((data: string, type: string) => {
    if (isProcessing.current || !activeItem) return;
    isProcessing.current = true;

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
          { text: "Kész", onPress: () => { isProcessing.current = false; setShowScanner(false); setScannerKey(prev => prev + 1); }, style: "cancel" }
        ],
        { cancelable: false, onDismiss: () => { isProcessing.current = false; } }
      );
    }
  }, [activeItem, fetchTaskDetails]);

  // --- SZKENNER NÉZET ---
  if (showScanner && activeItem) {
    if (activeItem.requested_quantity - activeItem.picked_quantity <= 0) {
      router.replace(`/picking/${id}/edit?item_id=${activeItem.id}`);
      return null;
    }

    return (
      <BarcodeScanner
        key={scannerKey}
        onScan={handleScan}
        onClose={() => { isProcessing.current = false; setShowScanner(false); setScannerKey(prev => prev + 1); }}
        title="Termék szkennelés"
        instruction={`Keresd ezt: ${activeItem.item.name} (Polc: ${activeItem.location?.location_code ?? 'Ismeretlen'})`}
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
          <YStack gap="$4">

            {/* 1. AKTÍV TÉTEL (Ezt kell most csinálni) */}
            {activeItem && (
              <YStack gap="$2">
                <Text fontSize={14} fontWeight="700" color="$blue10" textTransform="uppercase">Soron következő tétel</Text>
                <Card backgroundColor="$blue2" borderWidth={2} borderColor="$blue8" borderRadius="$4" padding="$4">
                  <YStack gap="$3">
                    <XStack justifyContent="space-between" alignItems="flex-start">
                      <YStack flex={1} gap="$1">
                        <Text fontWeight="800" fontSize={22} color="$blue12">{activeItem.item.name}</Text>
                        <XStack alignItems="center" gap="$1.5" marginTop="$1">
                          <MapPin size={18} color="$blue10" />
                          {/* Jelenleg a backend nem küldi, de így fel van készítve a location_code-ra */}
                          <Text fontSize={16} fontWeight="700" color="$blue10">Lokáció: {activeItem.location?.location_code ?? 'Ismeretlen polc'}</Text>
                        </XStack>
                      </YStack>
                    </XStack>

                    <XStack gap="$4" backgroundColor="$blue3" padding="$3" borderRadius="$3">
                      <YStack flex={1}>
                        <Text fontSize={12} color="$blue11" textTransform="uppercase">Szedendő</Text>
                        <Text fontSize={20} fontWeight="800" color="$blue11">{activeItem.requested_quantity} db</Text>
                      </YStack>
                      <YStack flex={1}>
                        <Text fontSize={12} color="$blue11" textTransform="uppercase">Vonalkód</Text>
                        <Text fontSize={16} fontWeight="600" color="$blue11">{activeItem.item.barcode ?? 'N/A'}</Text>
                      </YStack>
                    </XStack>

                    <XStack gap="$2" marginTop="$2">
                      <Button flex={1} size="$4" theme="blue" icon={Barcode} onPress={() => setShowScanner(true)}>
                        Szkennelés
                      </Button>
                      <Button size="$4" theme="red" variant="outlined" onPress={() => router.push(`/picking/${id}/edit?item_id=${activeItem.id}`)}>
                        Hiány
                      </Button>
                    </XStack>
                  </YStack>
                </Card>
              </YStack>
            )}

            {/* 2. ZÁROLT / VÁRAKOZÓ TÉTELEK (S-Shape útvonal szerint a következők) */}
            {upcomingItems.length > 0 && (
              <YStack gap="$2" marginTop="$4">
                <Text fontSize={14} fontWeight="600" color="$color10" textTransform="uppercase">Következő a sorban</Text>
                {upcomingItems.map((item) => (
                  <Card key={item.id} backgroundColor="$color2" borderWidth={1} borderColor="$color4" borderRadius="$4" padding="$3" opacity={0.6}>
                    <XStack gap="$3" alignItems="center">
                      <Lock size={20} color="$color9" />
                      <YStack flex={1}>
                        <Text fontWeight="600" fontSize={15} color="$color11">{item.item.name}</Text>
                        <Text fontSize={13} color="$color10">
                          Lokáció: {item.location?.location_code ?? 'N/A'} • Mennyiség: {item.requested_quantity} db
                        </Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </YStack>
            )}

            {/* 3. TELJESÍTETT TÉTELEK */}
            {completedItems.length > 0 && (
              <YStack gap="$2" marginTop="$4">
                <Text fontSize={14} fontWeight="600" color="$green10" textTransform="uppercase">Teljesítve</Text>
                {completedItems.map((item) => (
                  <Card
                    key={item.id}
                    backgroundColor="$green2"
                    borderWidth={1}
                    borderColor="$green5"
                    borderRadius="$4"
                    padding="$3"
                    onPress={() => router.push(`/picking/${id}/edit?item_id=${item.id}`)}
                    pressStyle={{ opacity: 0.8 }}
                  >
                    <XStack gap="$3" alignItems="center">
                      <CheckCircle2 size={20} color="$green10" />
                      <YStack flex={1}>
                        <Text fontWeight="600" fontSize={15} color="$green11" textDecorationLine="line-through">{item.item.name}</Text>
                        <Text fontSize={13} color="$green10">{item.picked_quantity} db kiszedve</Text>
                      </YStack>
                    </XStack>
                  </Card>
                ))}
              </YStack>
            )}

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
