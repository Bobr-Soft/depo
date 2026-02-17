import React from "react";
import { YStack, Text, H2 } from "@repo/ui";

export default function ScannerScreen() {
  return (
    <YStack flex={1} justifyContent="center" alignItems="center" padding="$4">
      <H2 marginBottom="$4">Scanner</H2>
      <Text>Scanner functionality goes here</Text>
    </YStack>
  );
}
