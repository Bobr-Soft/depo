import React, { useState, useRef, useEffect } from "react";
import { Alert } from "react-native";
import { Stack, router } from "expo-router";
import { BarcodeScanner } from "@/components";
import { getScanSoundEnabled, getHapticFeedbackEnabled } from "@/services/secureStorage";

export default function ScannerScreen() {
  const [scanKey, setScanKey] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hapticEnabled, setHapticEnabled] = useState(true);
  const isProcessing = useRef(false);

  useEffect(() => {
    Promise.all([getScanSoundEnabled(), getHapticFeedbackEnabled()]).then(([s, h]) => {
      setSoundEnabled(s);
      setHapticEnabled(h);
    });
  }, []);

  const handleScan = (data: string, type: string) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    Alert.alert(
      "Kód beolvasva",
      `Típus: ${type}\nAdat: ${data}`,
      [
        {
          text: "Újra szkennelés",
          onPress: () => {
            isProcessing.current = false;
            setScanKey((prev) => prev + 1);
          },
          style: "default",
        },
        {
          text: "Szerkesztés",
          onPress: () => {
            isProcessing.current = false;
            router.push({
              pathname: "/edit",
              params: { code: data, type: type },
            });
          },
          style: "default",
        },
        {
          text: "Bezárás",
          onPress: () => {
            isProcessing.current = false;
            router.back();
          },
          style: "cancel",
        },
      ],
      {
        cancelable: false,
        onDismiss: () => {
          isProcessing.current = false;
        },
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
        title="Általános Szkenner"
        instruction="Keresd meg a termék vonalkódját vagy QR kódját."
        autoResetDelay={0}
        enableSound={soundEnabled}
        enableHaptics={hapticEnabled}
      />
    </>
  );
}
