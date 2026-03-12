import { useCallback, useEffect, useState } from "react";
import { Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, Spinner, Input, Separator, ScrollView } from "@repo/ui";
import { ArrowLeft, Save, Edit3, AlertCircle, Minus, Plus } from "@tamagui/lucide-icons";
import { loadTask } from "@/components/api";
import { TaskComplete } from "@/constants";
import { updateTaskItemQuantity } from "@/services";

export default function PickingCompletedItemEditScreen() {
  const { id, item_id } = useLocalSearchParams<{ id: string; item_id: string }>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [task, setTask] = useState<TaskComplete | null>(null);
  const [pickedQuantityInput, setPickedQuantityInput] = useState('0');

  const fetchTaskDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await loadTask(Number(id));
      if (!response) {
        setError("Nem található a feladat.");
      } else {
        setTask(response);
      }
    } catch (fetchError) {
      setError(`Nem sikerült betölteni a tételt. ${fetchError instanceof Error ? fetchError.message : "Ismeretlen hiba"}`);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchTaskDetails();
  }, [fetchTaskDetails]);

  const selectedItem = task?.items.find((item) => item.id === Number(item_id));
  const requestedQuantity = selectedItem?.requested_quantity ?? 0;
  const maxQuantity = selectedItem?.item.quantity ?? 0;
  const parsedPickedQuantity = Number.parseInt(pickedQuantityInput, 10) || 0;

  useEffect(() => {
    if (selectedItem) {
      setPickedQuantityInput(String(selectedItem.picked_quantity));
    }
  }, [selectedItem]);

  // --- STEPPER HANDLERS ---
  const handleIncrement = () => {
    setPickedQuantityInput(String(Math.min(parsedPickedQuantity + 1, maxQuantity)));
  };

  const handleDecrement = () => {
    setPickedQuantityInput(String(Math.max(parsedPickedQuantity - 1, 0)));
  };

  const handleQuickSet = (val: number) => {
    setPickedQuantityInput(String(val));
  };

  // --- SAVE HANDLER ---
  const saveChanges = useCallback(async () => {
    if (!selectedItem) return;

    if (!Number.isFinite(parsedPickedQuantity) || Number.isNaN(parsedPickedQuantity)) {
      Alert.alert('Hibás mennyiség', 'Adj meg érvényes számot.');
      return;
    }

    if (parsedPickedQuantity < 0) {
      Alert.alert('Hibás mennyiség', 'A felvett mennyiség nem lehet negatív.');
      return;
    }

    if (parsedPickedQuantity > maxQuantity) {
      Alert.alert('Hibás mennyiség', `A polcon lévő összes készlet (${maxQuantity} db) nem léphető túl.`);
      return;
    }

    setSaving(true);
    try {
      await updateTaskItemQuantity(selectedItem.id, parsedPickedQuantity);
      Alert.alert('Sikeres mentés', 'A tétel mennyisége frissítve lett.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (saveError) {
      Alert.alert('Mentési hiba', saveError instanceof Error ? saveError.message : 'Nem sikerült menteni a módosítást.');
    } finally {
      setSaving(false);
    }
  }, [parsedPickedQuantity, selectedItem, maxQuantity]);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">

      {/* HEADER SECTION */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} disabled={saving} />
          <YStack flex={1}>
            <H2 color="$color12" numberOfLines={1}>Mennyiség módosítása</H2>
            <Text fontSize={14} color="$color10">Tétel manuális korrekciója</Text>
          </YStack>
        </XStack>
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      {/* MAIN CONTENT */}
      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error || !selectedItem ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$10">
            <AlertCircle size={32} color="$red10" />
            <Text fontSize={14} color="$red10" textAlign="center">{error || 'A kiválasztott tétel nem található.'}</Text>
            <Button size="$3" onPress={error ? fetchTaskDetails : () => router.back()}>
              {error ? 'Újrapróbálkozás' : 'Vissza'}
            </Button>
          </YStack>
        ) : (
          <YStack gap="$4">

            {/* ITEM INFO CARD */}
            <Card backgroundColor="$color3" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4">
              <YStack gap="$2">
                <Text fontSize={20} fontWeight="700" color="$color12" marginBottom="$2">
                  {selectedItem.item.name}
                </Text>

                <XStack justifyContent="space-between" alignItems="center" paddingVertical="$1">
                  <Text fontSize={14} color="$color11">Kért mennyiség:</Text>
                  <Text fontSize={16} fontWeight="700" color="$color12">{requestedQuantity} db</Text>
                </XStack>
                <Separator borderColor="$color4" />

                <XStack justifyContent="space-between" alignItems="center" paddingVertical="$1">
                  <Text fontSize={14} color="$color11">Polcon lévő összes:</Text>
                  <Text fontSize={16} fontWeight="700" color="$color12">{maxQuantity} db</Text>
                </XStack>
                <Separator borderColor="$color4" />

                <XStack justifyContent="space-between" alignItems="center" paddingVertical="$1">
                  <Text fontSize={14} color="$color11">Vonalkód:</Text>
                  <Text fontSize={14} fontWeight="600" color="$color12" opacity={0.8}>{selectedItem.item.barcode ?? "N/A"}</Text>
                </XStack>
              </YStack>
            </Card>

            {/* QUICK ACTIONS ROW */}
            <XStack gap="$2" marginTop="$2">
              <Button flex={1} size="$4" theme="gray" variant="outlined" onPress={() => handleQuickSet(0)}>
                Nullázás
              </Button>
              <Button flex={1} size="$4" theme="green" variant="outlined" onPress={() => handleQuickSet(requestedQuantity)}>
                Teljes (Kért)
              </Button>
            </XStack>

            {/* LARGE STEPPER CONTROLS */}
            <Card backgroundColor="$color2" borderRadius="$4" padding="$4" marginTop="$2">
              <Text fontSize={13} fontWeight="600" color="$color11" textTransform="uppercase" marginBottom="$3">
                Felvett mennyiség megadása
              </Text>

              <XStack alignItems="center" justifyContent="center" gap="$4">
                <Button
                  size="$6"
                  circular
                  theme="red"
                  icon={Minus}
                  onPress={handleDecrement}
                  disabled={parsedPickedQuantity <= 0 || saving}
                />

                <Input
                  flex={1}
                  height={60}
                  fontSize={24}
                  fontWeight="bold"
                  textAlign="center"
                  value={pickedQuantityInput}
                  onChangeText={(text: string) => setPickedQuantityInput(text.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  editable={!saving}
                  backgroundColor="$color1"
                  borderColor="$color5"
                />

                <Button
                  size="$6"
                  circular
                  theme="green"
                  icon={Plus}
                  onPress={handleIncrement}
                  disabled={parsedPickedQuantity >= maxQuantity || saving}
                />
              </XStack>

              <YStack alignItems="center" marginTop="$3">
                <Text fontSize={13} fontWeight="600" color={parsedPickedQuantity >= requestedQuantity ? "$green10" : "$orange10"}>
                  {parsedPickedQuantity >= requestedQuantity ? 'Státusz: Teljesítve' : 'Státusz: Részleges (Hiány)'}
                </Text>
              </YStack>
            </Card>

            {/* ACTION BUTTONS */}
            <YStack gap="$3" marginTop="$4">
              <Button
                size="$5"
                theme="blue"
                icon={Save}
                onPress={saveChanges}
                disabled={saving}
              >
                {saving ? 'Mentés folyamatban...' : 'Módosítás mentése'}
              </Button>

              <Button
                size="$4"
                theme="gray"
                variant="outlined"
                icon={Edit3}
                onPress={() => router.push({ pathname: "/edit", params: { code: selectedItem.item.barcode ?? "", type: "picking" } })}
                disabled={saving}
              >
                Általános szerkesztő megnyitása
              </Button>
            </YStack>

          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
