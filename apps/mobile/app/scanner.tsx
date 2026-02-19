/**
 * Scanner Screen
 *
 * Standalone scanner screen that uses the reusable BarcodeScanner component.
 * Shows an alert dialog when a code is scanned.
 */

import React, { useState, useRef } from "react";
import { Alert } from "react-native";
import { Stack, router } from "expo-router";
import { BarcodeScanner } from "@/components";

export default function ScannerScreen() {
  const [scanKey, setScanKey] = useState(0);
  const isProcessing = useRef(false);

  const handleScan = (data: string, type: string) => {
    // Prevent multiple scans while processing
    if (isProcessing.current) return;

    isProcessing.current = true;

    // Show alert with scanned data
    Alert.alert(
      "Szkennelve",
      `Típus: ${type}\nAdat: ${data}`,
      [
        {
          text: "Újra szkennelés",
          onPress: () => {
            isProcessing.current = false;
            setScanKey(prev => prev + 1);
          },
          style: "default"
        },
        {
          text: "Szerkesztés",
          onPress: () => {
            isProcessing.current = false;
            router.push({
              pathname: "/edit",
              params: { code: data, type: type }
            });
          },
          style: "default"
        },
        {
          text: "Bezárás",
          onPress: () => {
            isProcessing.current = false;
            router.back();
          },
          style: "cancel"
        }
      ],
      {
        cancelable: false,
        onDismiss: () => {
          isProcessing.current = false;
        }
      }
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BarcodeScanner
        key={scanKey}
        onScan={handleScan}
        onClose={() => router.back()}
        title="Szkennelés"
        instruction="Helyezze a vonalkódot vagy QR kódot a keretbe"
        autoResetDelay={0}
      />
    </>
  );
}
