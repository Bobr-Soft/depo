import { H2, Text, YStack, XStack, Button, Card, Spinner, Input } from "@repo/ui";
import { useLocalSearchParams, router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { loadTask } from "@/components/api";
import { TaskComplete } from "@/constants";
import { updateTaskItemQuantity } from "@/services";
import { Alert } from "react-native";

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
  const parsedPickedQuantity = Number.parseInt(pickedQuantityInput, 10);

  useEffect(() => {
    if (selectedItem) {
      setPickedQuantityInput(String(selectedItem.picked_quantity));
    }
  }, [selectedItem]);

  const saveChanges = useCallback(async () => {
    if (!selectedItem) {
      return;
    }

    if (!Number.isFinite(parsedPickedQuantity) || Number.isNaN(parsedPickedQuantity)) {
      Alert.alert('Hibás mennyiség', 'Adj meg érvényes számot.');
      return;
    }

    if (parsedPickedQuantity < 0) {
      Alert.alert('Hibás mennyiség', 'A felvett mennyiség nem lehet negatív.');
      return;
    }

    if (parsedPickedQuantity > selectedItem.item.quantity) {
      Alert.alert('Hibás mennyiség', 'A felvett mennyiség nem lehet nagyobb az összes készletnél.');
      return;
    }

    setSaving(true);
    try {
      await updateTaskItemQuantity(selectedItem.id, parsedPickedQuantity);
      setTask((prevTask) => {
        if (!prevTask) {
          return prevTask;
        }

        return {
          ...prevTask,
          items: prevTask.items.map((item) => {
            if (item.id !== selectedItem.id) {
              return item;
            }

            return {
              ...item,
              picked_quantity: parsedPickedQuantity,
              status: parsedPickedQuantity >= item.requested_quantity ? 'picked' : 'pending',
            };
          }),
        };
      });

      Alert.alert('Mentve', 'A tétel mennyisége frissítve lett.', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (saveError) {
      Alert.alert('Mentési hiba', saveError instanceof Error ? saveError.message : 'Nem sikerült menteni a módosítást.');
    } finally {
      setSaving(false);
    }
  }, [parsedPickedQuantity, selectedItem]);

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center">
          <Button size="$3" onPress={() => router.back()}>
            <Text>← Vissza</Text>
          </Button>
          <H2 color="$color12">Kész tétel szerkesztése</H2>
        </XStack>
        <Text fontSize={14} color="$color10">A már teljesített tétel adatai</Text>
      </YStack>

      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" onPress={fetchTaskDetails}>
              <Text>Újra</Text>
            </Button>
          </YStack>
        ) : !selectedItem ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
            <Text fontSize={14} color="$red10" textAlign="center">A kiválasztott tétel nem található.</Text>
            <Button size="$3" onPress={() => router.back()}>
              <Text>Vissza</Text>
            </Button>
          </YStack>
        ) : (
          <YStack gap="$4">
            <Text fontSize={18} fontWeight="700">{selectedItem.item.name}</Text>
            <Text fontSize={14} color="$color10">Kért mennyiség: {selectedItem.requested_quantity}</Text>
            <Text fontSize={14} color="$color10">Felvett mennyiség: {selectedItem.picked_quantity}</Text>
            <Text fontSize={14} color="$color10">Összes készlet: {selectedItem.item.quantity}</Text>
            <Text fontSize={14} color="$color10">Vonalkód: {selectedItem.item.barcode ?? "N/A"}</Text>

            <YStack gap="$2" marginTop="$2">
              <Text fontSize={12} fontWeight="600" color="$color11" textTransform="uppercase">
                Felvett mennyiség szerkesztése
              </Text>
              <Input
                value={pickedQuantityInput}
                onChangeText={(text: string) => setPickedQuantityInput(text.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                size="$4"
                editable={!saving}
              />
              <Text fontSize={12} color="$color9">
                Állapot: {parsedPickedQuantity >= requestedQuantity ? 'Teljesítve' : 'Részleges / függőben'}
              </Text>
            </YStack>

            <XStack gap="$3">
              <Button size="$3" theme="gray" disabled={saving} onPress={() => setPickedQuantityInput('0')}>
                <Text>0</Text>
              </Button>
              <Button size="$3" theme="gray" disabled={saving} onPress={() => setPickedQuantityInput(String(requestedQuantity))}>
                <Text>Kért mennyiség</Text>
              </Button>
              <Button size="$3" theme="gray" disabled={saving} onPress={() => setPickedQuantityInput(String(selectedItem.item.quantity))}>
                <Text>Max készlet</Text>
              </Button>
            </XStack>

            <XStack gap="$3" marginTop="$2">
              <Button size="$4" theme="gray" onPress={() => router.back()}>
                <Text>Feladathoz vissza</Text>
              </Button>
              <Button
                size="$4"
                theme="blue"
                disabled={saving}
                onPress={saveChanges}
              >
                <Text fontWeight="600">{saving ? 'Mentés...' : 'Módosítás mentése'}</Text>
              </Button>
              <Button
                size="$4"
                theme="blue"
                onPress={() => router.push({ pathname: "/edit", params: { code: selectedItem.item.barcode ?? "", type: "picking" } })}
              >
                <Text fontWeight="600">Általános szerkesztő</Text>
              </Button>
            </XStack>
          </YStack>
        )}
      </Card>
    </YStack>
  );
}
