import { H2, Text, YStack, XStack, Button, Card, ScrollView } from "@repo/ui";
import { router } from "expo-router";

export default function NewPickingScreen() {
  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <XStack gap="$3" alignItems="center">
          <Button size="$3" onPress={() => router.back()}>
            <Text>← Vissza</Text>
          </Button>
          <H2 color="$color12">Új feladat létrehozása</H2>
        </XStack>
        <Text fontSize={14} color="$color10">Új komissiózási feladat hozzáadása</Text>
      </YStack>

      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        <ScrollView flex={1}>
          <YStack gap="$4">
            <Text fontSize={16} fontWeight="600">Feladat adatok</Text>
            <Text fontSize={14} color="$color11">
              Itt hozható létre új komissiózási feladat.
            </Text>
            {/* TODO: Add form fields here */}
          </YStack>
        </ScrollView>

        <XStack gap="$3" justifyContent="flex-end">
          <Button size="$4" onPress={() => router.back()}>
            <Text>Mégse</Text>
          </Button>
          <Button size="$4" theme="blue">
            <Text fontWeight="600">Létrehozás</Text>
          </Button>
        </XStack>
      </Card>
    </YStack>
  );
}
