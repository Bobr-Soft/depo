import React from "react";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { YStack, XStack, Card, Text, H2, Button, Separator, ScrollView } from "@repo/ui";
import { ArrowLeft, MapPin, Package, Info } from "@tamagui/lucide-icons";

// Helper to safely extract single string values from Expo Router params
function one(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

// Reusable component for key-value data rows
const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <XStack justifyContent="space-between" alignItems="center" paddingVertical="$1.5">
    <Text fontSize={14} color="$color10">{label}</Text>
    <Text fontSize={15} fontWeight="600" color="$color12">{value}</Text>
  </XStack>
);

export default function LocationOthersScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    id?: string | string[];
    code?: string | string[];
    row?: string | string[];
    col?: string | string[];
    shelf?: string | string[];
    isActive?: string | string[];
    isXl?: string | string[];
  }>();

  const id = one(params.id);
  const code = one(params.code);
  const row = one(params.row);
  const col = one(params.col);
  const shelf = one(params.shelf);
  const isActive = one(params.isActive) === "1";
  const isXl = one(params.isXl) === "1";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <YStack flex={1} backgroundColor="$background" paddingTop={Math.max(insets.top, 16)}>

        {/* HEADER */}
        <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
          <XStack alignItems="center" gap="$3">
            <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
            <YStack flex={1}>
              <H2 color="$color12">Lokáció részletek</H2>
              <Text fontSize={14} color="$color10">A kiválasztott hely adatai</Text>
            </YStack>
          </XStack>
        </YStack>

        <Separator borderColor="$color4" marginBottom="$2" />

        {/* CONTENT */}
        <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: Math.max(insets.bottom, 40) }}>
          <YStack gap="$4">

            {/* IDENTIFICATION CARD */}
            <Card padding="$4" borderWidth={1} borderColor="$color5" backgroundColor="$color2" borderRadius="$4" elevation="$1">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <MapPin size={20} color="$blue10" />
                <Text fontSize={18} fontWeight="700" color="$color12">{code || "Ismeretlen lokáció"}</Text>
              </XStack>

              <Separator borderColor="$color4" marginBottom="$2" />

              <YStack gap="$1">
                <DetailRow label="Azonosító (ID)" value={id || "-"} />
                <DetailRow label="Sor" value={row || "-"} />
                <DetailRow label="Oszlop" value={col || "-"} />
                <DetailRow label="Polc szint" value={shelf || "-"} />
              </YStack>
            </Card>

            {/* STATUS CARD */}
            <Card padding="$4" borderWidth={1} borderColor="$color5" backgroundColor="$color2" borderRadius="$4" elevation="$1">
              <XStack alignItems="center" gap="$2" marginBottom="$3">
                <Info size={20} color="$color10" />
                <Text fontSize={16} fontWeight="700" color="$color12">Kapacitás és Állapot</Text>
              </XStack>

              <Separator borderColor="$color4" marginBottom="$3" />

              <XStack gap="$3" flexWrap="wrap">
                <YStack flex={1} padding="$2.5" backgroundColor={isActive ? "$green3" : "$red3"} borderRadius="$3" alignItems="center" borderWidth={1} borderColor={isActive ? "$green5" : "$red5"}>
                  <Text fontSize={12} color={isActive ? "$green11" : "$red11"} marginBottom="$1">Státusz</Text>
                  <Text fontSize={14} fontWeight="700" color={isActive ? "$green11" : "$red11"}>
                    {isActive ? "AKTÍV" : "INAKTÍV"}
                  </Text>
                </YStack>

                <YStack flex={1} padding="$2.5" backgroundColor={isXl ? "$orange3" : "$blue3"} borderRadius="$3" alignItems="center" borderWidth={1} borderColor={isXl ? "$orange5" : "$blue5"}>
                  <Text fontSize={12} color={isXl ? "$orange11" : "$blue11"} marginBottom="$1">Típus</Text>
                  <Text fontSize={14} fontWeight="700" color={isXl ? "$orange11" : "$blue11"}>
                    {isXl ? "XL (Raklapos)" : "NORMÁL"}
                  </Text>
                </YStack>
              </XStack>
            </Card>

            {/* ACTIONS */}
            <XStack gap="$3" marginTop="$2">
              <Button
                flex={1}
                size="$4"
                theme="blue"
                icon={Package}
                onPress={() => router.push({ pathname: "/admin/inventory", params: { locationId: id } })}
              >
                Készlet
              </Button>
              <Button
                flex={1}
                size="$4"
                theme="gray"
                variant="outlined"
                onPress={() => router.back()}
              >
                Vissza
              </Button>
            </XStack>

          </YStack>
        </ScrollView>
      </YStack>
    </>
  );
}
