import React from "react";
import { ScrollView, YStack, XStack, Button, H1, Text, Truck, PackagePlus, ScanBarcode } from "@repo/ui";
import { router } from "expo-router";

export default function HomeScreen() {
  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack padding="$4" gap="$4">
        <Button
          size="$4"
          theme="green"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/inbound")}>
          <PackagePlus size={28} />
          <Text fontSize={16}>Bevételezés (Inbound)</Text>
        </Button>
        <Button
          size="$4"
          theme="yellow"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/picking")}>
          <Truck size={28} />
          <Text fontSize={16}>Komissiózás (Picking)</Text>
        </Button>
        <Button
          size="$4"
          theme="blue"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/scanner")}>
          <ScanBarcode size={28} />
          <Text fontSize={16}>Keresés (Scan)</Text>
        </Button>
        <XStack gap="$3">
          <Button flex={1} height="$12">Button 1</Button>
          <Button flex={1} height="$12">Button 2</Button>
        </XStack>
      </YStack>

      <YStack padding="$4" gap="$4">
        {/* Size tokens: $1, $2, $3, $4, $5, $6, etc. */}
        <Button size="$6">Large Button</Button>

        {/* Theme variants */}
        <Button theme="blue">Blue Button</Button>
        <Button theme="red">Red Button</Button>

        {/* Variants */}
        <Button variant="outlined">Outlined</Button>

        {/* Custom styling with tokens */}
        <Button
          size="$5"
          backgroundColor="$blue10"
          color="white"
          borderRadius="$4"
          pressStyle={{ backgroundColor: "$blue9" }}
        >
          Custom Styled
        </Button>

        {/* Layout with spacing tokens */}
        <XStack gap="$3" padding="$4">
          <Button flex={1}>Button 1</Button>
          <Button flex={1}>Button 2</Button>
        </XStack>

        {/* Text styling */}
        <YStack gap="$2">
          <H1 color="$color">Heading</H1>
          <Text fontSize="$5" color="$gray11">
            Body text with tokens
          </Text>
        </YStack>
      </YStack>
    </ScrollView>
  );
}

