import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner } from "@repo/ui";
import { useLocalSearchParams, router } from "expo-router";
import { useEffect, useState } from "react";

export default function PickingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // TODO: Fetch task details by id
    setLoading(false);
  }, [id]);

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center">
          <Button size="$3" onPress={() => router.back()}>
            <Text>← Vissza</Text>
          </Button>
          <H2 color="$color12">Feladat részletek</H2>
        </XStack>
        <Text fontSize={14} color="$color10">Feladat ID: {id}</Text>
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
        ) : (
          <ScrollView flex={1}>
            <YStack gap="$4">
              <Text fontSize={16} fontWeight="600">Feladat információk</Text>
              <Text fontSize={14} color="$color11">
                Itt jelennek meg a feladat részletes adatai.
              </Text>
              {/* TODO: Add task details here */}
            </YStack>
          </ScrollView>
        )}
      </Card>
    </YStack>
  );
}
