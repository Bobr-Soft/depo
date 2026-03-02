import React from "react";
import { ScrollView, YStack, XStack, Button, H1, Text, Truck, PackagePlus, ScanBarcode, Warehouse, AlertTriangle } from "@repo/ui";
import { router } from "expo-router";
import { useState } from "react";
import { Colors, useHeaderColors } from "@/constants";
import { useColorScheme } from "@/hooks";

/**
 * Main dashboard screen with navigation to key features:
 */

export default function HomeScreen() {
  const [role, setRole] = useState<string>('');
  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack padding="$4" gap="$4">
        <Button
          size="$4"
          theme="green"
          height="$12"
          flexDirection="column"
          gap="$1"
          onPress={() => router.push("/inbound")}>
          <PackagePlus size={50} />
          <Text fontSize={14}>Bevételezés (Inbound)</Text>
        </Button>
        <Button
          size="$4"
          theme="yellow"
          height="$12"
          flexDirection="column"
          gap="$1"
          onPress={() => router.push("/picking")}>
          <Truck size={50} />
          <Text fontSize={14}>Komissiózás (Picking)</Text>
        </Button>
        <Button
          size="$4"
          theme="blue"
          height="$12"
          flexDirection="column"
          gap="$1"
          onPress={() => router.push("/scanner")}>
          <ScanBarcode size={50} />
          <Text fontSize={14}>Keresés (Scan)</Text>
        </Button>
        <XStack gap="$3">
          <Button flex={1} height="$12" flexDirection="column" gap="$1">
            <Warehouse size={50} />
            <Text fontSize={12}>Warehouse (Map)</Text>
          </Button>
          <Button flex={1} height="$12" flexDirection="column" gap="$1">
            <AlertTriangle size={50} />
            <Text fontSize={12}>Sérült áru jelentése</Text>
          </Button>
        </XStack>
      </YStack>
    </ScrollView>
  );
}

