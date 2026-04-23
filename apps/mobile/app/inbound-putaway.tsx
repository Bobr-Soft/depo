import { useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Button, Text, H2, Card } from "@repo/ui";
import { MapPin, CheckCircle2, Package, ArrowLeft } from "@tamagui/lucide-icons";

type PutawayItem = {
  code: string;
  quantity: number;
  assignedLocation: string;
};

export default function InboundPutawayScreen() {
  const insets = useSafeAreaInsets();
  const { items: itemsParam } = useLocalSearchParams<{ items?: string | string[] }>();
  const rawParam = Array.isArray(itemsParam) ? itemsParam[0] : itemsParam;

  const items = useMemo<PutawayItem[]>(() => {
    try {
      const parsed = JSON.parse(rawParam ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [rawParam]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentItem = items[currentIndex] ?? null;
  const totalItems = items.length;
  const progressPercent =
    totalItems === 0 ? 100 : Math.round((currentIndex / totalItems) * 100);

  function handlePlaced() {
    if (currentIndex < totalItems - 1) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      router.replace("/(tabs)");
    }
  }

  if (totalItems === 0) {
    return (
      <YStack
        flex={1}
        backgroundColor="$background"
        justifyContent="center"
        alignItems="center"
        padding="$6"
        gap="$4"
      >
        <CheckCircle2 size={64} color="$green10" />
        <Text fontSize={18} fontWeight="700" color="$color12" textAlign="center">
          Nincs elrakandó tétel
        </Text>
        <Button size="$5" theme="blue" onPress={() => router.replace("/(tabs)")}>
          <Text fontWeight="600">Vissza a főoldalra</Text>
        </Button>
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      {/* HEADER */}
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" gap="$3">
          <Button
            size="$3"
            theme="gray"
            circular
            icon={ArrowLeft}
            onPress={() => router.replace("/(tabs)")}
          />
          <YStack flex={1}>
            <H2 color="$color12">Elrakás</H2>
            <Text fontSize={14} color="$color10">
              Vidd a tételeket a kijelölt polcokra
            </Text>
          </YStack>
          <Text fontSize={14} fontWeight="700" color="$blue10">
            {currentIndex + 1} / {totalItems}
          </Text>
        </XStack>

        {/* Progress bar */}
        <XStack height={8} backgroundColor="$color5" borderRadius="$4" overflow="hidden">
          <XStack
            height={8}
            backgroundColor="$green9"
            borderRadius="$4"
            width={`${progressPercent}%` as `${number}%`}
          />
        </XStack>
        <Text fontSize={12} color="$color10" textAlign="right">
          {currentIndex} / {totalItems} elrakva
        </Text>
      </YStack>

      {/* CURRENT ITEM CARD */}
      <YStack flex={1} paddingHorizontal="$4" justifyContent="center" gap="$4">
        {currentItem && (
          <Card
            backgroundColor="$color2"
            borderRadius="$5"
            padding="$5"
            borderWidth={2}
            borderColor="$blue6"
            gap="$4"
          >
            <XStack gap="$3" alignItems="center">
              <YStack
                width={56}
                height={56}
                backgroundColor="$blue5"
                borderRadius="$4"
                alignItems="center"
                justifyContent="center"
              >
                <Package size={28} color="$blue10" />
              </YStack>
              <YStack flex={1} gap="$1">
                <Text fontSize={18} fontWeight="800" color="$color12" numberOfLines={2}>
                  {currentItem.code}
                </Text>
                <Text fontSize={15} color="$color11">
                  Mennyiség:{" "}
                  <Text fontWeight="700" color="$blue10">
                    {currentItem.quantity} db
                  </Text>
                </Text>
              </YStack>
            </XStack>

            {/* Location highlight */}
            <YStack
              backgroundColor="$green3"
              padding="$4"
              borderRadius="$4"
              borderWidth={1}
              borderColor="$green7"
              gap="$1"
            >
              <XStack alignItems="center" gap="$2" marginBottom="$1">
                <MapPin size={20} color="$green10" />
                <Text
                  fontSize={13}
                  fontWeight="600"
                  color="$green10"
                  textTransform="uppercase"
                >
                  Cél polc
                </Text>
              </XStack>
              <Text fontSize={32} fontWeight="900" color="$green11" letterSpacing={2}>
                {currentItem.assignedLocation}
              </Text>
            </YStack>
          </Card>
        )}

        {/* Upcoming items preview */}
        {currentIndex + 1 < totalItems && (
          <YStack gap="$2">
            <Text
              fontSize={12}
              color="$color10"
              textTransform="uppercase"
              fontWeight="600"
            >
              Következő tételek
            </Text>
            {items.slice(currentIndex + 1, currentIndex + 3).map((item, i) => (
              <XStack
                key={`${item.code}-${i}`}
                backgroundColor="$color3"
                borderRadius="$3"
                padding="$3"
                alignItems="center"
                gap="$3"
                opacity={0.6}
              >
                <Package size={16} color="$color9" />
                <Text fontSize={13} color="$color11" flex={1} numberOfLines={1}>
                  {item.code}
                </Text>
                <XStack alignItems="center" gap="$1">
                  <MapPin size={14} color="$color9" />
                  <Text fontSize={13} fontWeight="600" color="$color11">
                    {item.assignedLocation}
                  </Text>
                </XStack>
              </XStack>
            ))}
          </YStack>
        )}
      </YStack>

      {/* BOTTOM ACTION */}
      <YStack
        padding="$4"
        paddingBottom={Math.max(insets.bottom + 16, 24)}
        borderTopWidth={1}
        borderColor="$color4"
        backgroundColor="$background"
      >
        {currentIndex === totalItems - 1 ? (
          <Button size="$6" theme="green" icon={CheckCircle2} onPress={handlePlaced}>
            <Text fontWeight="700" fontSize={17}>
              Utolsó tétel elrakva — Kész!
            </Text>
          </Button>
        ) : (
          <Button size="$6" theme="blue" onPress={handlePlaced}>
            <Text fontWeight="700" fontSize={17}>
              Helyre tettem → Következő
            </Text>
          </Button>
        )}
      </YStack>
    </YStack>
  );
}
