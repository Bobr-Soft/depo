import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { StyleSheet, Dimensions } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { YStack, XStack, Button, Text, H2 } from "@repo/ui";
import { X, Flashlight, FlashlightOff, Camera, CheckCircle2 } from "@tamagui/lucide-icons";
import * as Haptics from "expo-haptics";

const { width } = Dimensions.get("window");
const SCAN_AREA_SIZE = width * 0.7;

export interface BarcodeScannerProps {
  onScan: (data: string, type: string) => void;
  onClose?: () => void;
  title?: string;
  instruction?: string;
  autoResetDelay?: number;
  showCloseButton?: boolean;
  enableFlashlight?: boolean;
  enableHaptics?: boolean;
  barcodeTypes?: (
    | "qr" | "ean13" | "ean8" | "code128" | "code39" | "code93"
    | "codabar" | "upc_a" | "upc_e" | "itf14" | "pdf417" | "aztec" | "datamatrix"
  )[];
}

export function BarcodeScanner({
  onScan,
  onClose,
  title = "Szkennelés",
  instruction = "Helyezze a vonalkódot vagy QR kódot a keretbe",
  autoResetDelay = 2000,
  showCloseButton = true,
  enableFlashlight = true,
  enableHaptics = true,
  barcodeTypes = [
    "qr", "ean13", "ean8", "code128", "code39", "code93",
    "codabar", "upc_a", "upc_e", "itf14", "pdf417", "aztec", "datamatrix",
  ],
}: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const scanLock = useRef(false);
  const onScanRef = useRef(onScan);
  const lastScanRef = useRef<{ data: string; timestamp: number } | null>(null);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const scannerSettings = useMemo(() => ({ barcodeTypes }), [barcodeTypes]);

  useEffect(() => {
    if (scanned && autoResetDelay > 0) {
      const timer = setTimeout(() => {
        setScanned(false);
        setScannedData(null);
        scanLock.current = false;
      }, autoResetDelay);
      return () => clearTimeout(timer);
    }
  }, [scanned, autoResetDelay]);

  const handleBarCodeScanned = useCallback(({ type, data }: BarcodeScanningResult) => {
    if (scanLock.current) return;

    const normalizedData = data.trim();
    if (!normalizedData) return;

    const now = Date.now();
    const previousScan = lastScanRef.current;
    if (previousScan && previousScan.data === normalizedData && now - previousScan.timestamp < 900) {
      return;
    }

    scanLock.current = true;
    lastScanRef.current = { data: normalizedData, timestamp: now };
    setScanned(true);
    setScannedData(normalizedData);

    if (enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    onScanRef.current(normalizedData, type);
  }, [enableHaptics]);

  const resetScanner = useCallback(() => {
    setScanned(false);
    setScannedData(null);
    scanLock.current = false;
  }, []);

  // Engedélykérő képernyő (kifésülve a DEPO arculatára)
  if (!permission) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
        <Text color="$color11">Kamera engedély betöltése...</Text>
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4" backgroundColor="$background">
        <Camera size={64} color="$color8" opacity={0.5} />
        <YStack alignItems="center" gap="$1" marginBottom="$2">
          <H2 color="$color12" textAlign="center">Kamera hozzáférés</H2>
          <Text textAlign="center" color="$color10" paddingHorizontal="$4">
            A vonalkódok és QR kódok beolvasásához engedélyezned kell a kamerát az eszközön.
          </Text>
        </YStack>
        <Button size="$5" theme="blue" onPress={requestPermission}>
          <Text fontWeight="600">Engedély megadása</Text>
        </Button>
        {showCloseButton && onClose && (
          <Button size="$4" theme="gray" variant="outlined" onPress={onClose} marginTop="$2">
            Vissza
          </Button>
        )}
      </YStack>
    );
  }

  return (
    <YStack flex={1} backgroundColor="black">
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        autofocus="on"
        enableTorch={torchOn}
        barcodeScannerSettings={scannerSettings}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Fejléc */}
        <YStack padding="$4" paddingTop="$8" backgroundColor="rgba(0, 0, 0, 0.7)">
          <XStack justifyContent="space-between" alignItems="center">
            {showCloseButton && onClose ? (
              <Button size="$4" circular theme="gray" icon={X} onPress={onClose} />
            ) : (
              <YStack width={48} />
            )}
            <Text color="$color12" fontSize={18} fontWeight="700">
              {title}
            </Text>
            {enableFlashlight ? (
              <Button
                size="$4"
                circular
                theme={torchOn ? "blue" : "gray"}
                icon={torchOn ? FlashlightOff : Flashlight}
                onPress={() => setTorchOn((prev) => !prev)}
              />
            ) : (
              <YStack width={48} />
            )}
          </XStack>
        </YStack>

        {/* Célkereszt (Keret) */}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <YStack width={SCAN_AREA_SIZE} height={SCAN_AREA_SIZE} position="relative">
            {/* Sarkok */}
            {['TopLeft', 'TopRight', 'BottomLeft', 'BottomRight'].map((corner) => (
              <YStack
                key={corner}
                position="absolute"
                top={corner.includes('Top') ? 0 : undefined}
                bottom={corner.includes('Bottom') ? 0 : undefined}
                left={corner.includes('Left') ? 0 : undefined}
                right={corner.includes('Right') ? 0 : undefined}
                width={60}
                height={60}
                borderTopWidth={corner.includes('Top') ? 4 : 0}
                borderBottomWidth={corner.includes('Bottom') ? 4 : 0}
                borderLeftWidth={corner.includes('Left') ? 4 : 0}
                borderRightWidth={corner.includes('Right') ? 4 : 0}
                borderColor={scanned ? "$green10" : "$blue10"}
                borderTopLeftRadius={corner === 'TopLeft' ? 12 : 0}
                borderTopRightRadius={corner === 'TopRight' ? 12 : 0}
                borderBottomLeftRadius={corner === 'BottomLeft' ? 12 : 0}
                borderBottomRightRadius={corner === 'BottomRight' ? 12 : 0}
              />
            ))}

            {/* Animált vonal */}
            {!scanned && (
              <YStack
                position="absolute"
                width="100%"
                height={2}
                backgroundColor="$blue10"
                opacity={0.8}
                top="50%"
                animation="quick"
                animateOnly={["opacity"]}
              />
            )}

            {/* Siker Overlay */}
            {scanned && (
              <YStack flex={1} justifyContent="center" alignItems="center" backgroundColor="rgba(25, 130, 109, 0.2)" borderRadius={12}>
                <YStack backgroundColor="$green5" padding="$4" borderRadius="$10" borderWidth={2} borderColor="$green8">
                  <XStack gap="$2" alignItems="center">
                    <CheckCircle2 size={24} color="$green10" />
                    <Text color="$green11" fontSize={18} fontWeight="bold">Sikeres beolvasás</Text>
                  </XStack>
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>

        {/* Instrukciók */}
        <YStack padding="$6" paddingBottom="$10" backgroundColor="rgba(0, 0, 0, 0.7)" gap="$3">
          <Text color="$color11" textAlign="center" fontSize={16} fontWeight="600">
            {scanned ? "Kód rögzítve!" : instruction}
          </Text>
          {scannedData && (
            <YStack backgroundColor="$color4" padding="$2" borderRadius="$3" alignSelf="center">
              <Text color="$color12" textAlign="center" fontSize={16} fontWeight="700" letterSpacing={1}>
                {scannedData}
              </Text>
            </YStack>
          )}
          {scanned && autoResetDelay === 0 && (
            <Button size="$5" theme="blue" marginTop="$3" onPress={resetScanner}>
              <Text fontWeight="600">Újra szkennelés</Text>
            </Button>
          )}
        </YStack>
      </CameraView>
    </YStack>
  );
}
