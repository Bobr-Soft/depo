/**
 * Reusable Barcode and QR Code Scanner Component
 *
 * A professional, full-featured scanner that supports multiple barcode formats.
 * Can be used as a standalone screen or embedded in other screens.
 *
 * USAGE:
 * ```tsx
 * import { BarcodeScanner } from '@/components';
 *
 * function MyScreen() {
 *   const handleScan = (data: string, type: string) => {
 *     console.log('Scanned:', data, type);
 *   };
 *
 *   return (
 *     <BarcodeScanner
 *       onScan={handleScan}
 *       onClose={() => navigation.goBack()}
 *       title="Scan Product"
 *       instruction="Scan barcode or QR code"
 *     />
 *   );
 * }
 * ```
 *
 * FEATURES:
 * - Supports QR codes and barcodes (EAN, UPC, Code128, etc.)
 * - Animated scanning frame with visual feedback
 * - Flashlight toggle for low-light conditions
 * - Haptic feedback on successful scan
 * - Automatic permission handling
 * - Customizable UI and callbacks
 */

import React, { useState, useEffect, useRef } from "react";
import { StyleSheet, Dimensions } from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { YStack, XStack, Button, Text, H3 } from "@repo/ui";
import { X, Flashlight, FlashlightOff } from "@tamagui/lucide-icons";
import * as Haptics from "expo-haptics";
import { useColorScheme } from "@/hooks";
import { Colors } from "@/constants";

const { width } = Dimensions.get("window");
const SCAN_AREA_SIZE = width * 0.7;

export interface BarcodeScannerProps {
  /** Callback when barcode/QR code is scanned */
  onScan: (data: string, type: string) => void;
  /** Callback when close button is pressed */
  onClose?: () => void;
  /** Title displayed in header (default: "Szkennelés") */
  title?: string;
  /** Instruction text shown at bottom (default: "Helyezze a vonalkódot vagy QR kódot a keretbe") */
  instruction?: string;
  /** Auto-reset delay in ms after scan (default: 2000, set to 0 to disable) */
  autoResetDelay?: number;
  /** Show close button in header (default: true) */
  showCloseButton?: boolean;
  /** Enable flashlight toggle (default: true) */
  enableFlashlight?: boolean;
  /** Show haptic feedback on scan (default: true) */
  enableHaptics?: boolean;
  /** Custom barcode types to scan (defaults to all supported types) */
  barcodeTypes?: Array<
    | "qr"
    | "ean13"
    | "ean8"
    | "code128"
    | "code39"
    | "code93"
    | "codabar"
    | "upc_a"
    | "upc_e"
    | "itf14"
    | "pdf417"
    | "aztec"
    | "datamatrix"
  >;
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
    "qr",
    "ean13",
    "ean8",
    "code128",
    "code39",
    "code93",
    "codabar",
    "upc_a",
    "upc_e",
    "itf14",
    "pdf417",
    "aztec",
    "datamatrix",
  ],
}: BarcodeScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [scannedData, setScannedData] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const scanLock = useRef(false);

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

  const handleBarCodeScanned = ({ type, data }: BarcodeScanningResult) => {
    // Double protection: check both state and ref
    if (scanned || scanLock.current) return;

    // Immediately lock to prevent any duplicate scans
    scanLock.current = true;
    setScanned(true);
    setScannedData(data);

    // Haptic feedback
    if (enableHaptics) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

    // Call callback
    onScan(data, type);
  };

  // Manual reset function (can be called externally if needed)
  const resetScanner = () => {
    setScanned(false);
    setScannedData(null);
    scanLock.current = false;
  };

  if (!permission) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="$background">
        <Text>Kamera engedély betöltése...</Text>
      </YStack>
    );
  }

  if (!permission.granted) {
    return (
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$4" backgroundColor="$background">
        <H3 textAlign="center">Kamera hozzáférés szükséges</H3>
        <Text textAlign="center" color="$color11">
          Az alkalmazásnak hozzá kell férnie a kamerához vonalkódok és QR kódok szkennelésére.
        </Text>
        <Button size="$5" theme="blue" onPress={requestPermission}>
          Engedély megadása
        </Button>
        {showCloseButton && onClose && (
          <Button size="$5" chromeless onPress={onClose}>
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
        enableTorch={torchOn}
        barcodeScannerSettings={{
          barcodeTypes,
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Header */}
        <YStack padding="$4" paddingTop="$8" backgroundColor="rgba(0,0,0,0.5)">
          <XStack justifyContent="space-between" alignItems="center">
            {showCloseButton && onClose ? (
              <Button
                size="$4"
                circular
                icon={X}
                backgroundColor="rgba(255,255,255,0.2)"
                borderColor="transparent"
                onPress={onClose}
              />
            ) : (
              <YStack width={48} />
            )}
            <Text color="white" fontSize={18} fontWeight="600">
              {title}
            </Text>
            {enableFlashlight ? (
              <Button
                size="$4"
                circular
                icon={torchOn ? FlashlightOff : Flashlight}
                backgroundColor="rgba(255,255,255,0.2)"
                borderColor="transparent"
                onPress={() => setTorchOn(!torchOn)}
              />
            ) : (
              <YStack width={48} />
            )}
          </XStack>
        </YStack>

        {/* Scanning Frame */}
        <YStack flex={1} justifyContent="center" alignItems="center">
          <YStack width={SCAN_AREA_SIZE} height={SCAN_AREA_SIZE} position="relative">
            {/* Corner borders */}
            <YStack
              position="absolute"
              top={0}
              left={0}
              width={60}
              height={60}
              borderTopWidth={4}
              borderLeftWidth={4}
              borderColor={scanned ? "#10B981" : "white"}
              borderTopLeftRadius={12}
            />
            <YStack
              position="absolute"
              top={0}
              right={0}
              width={60}
              height={60}
              borderTopWidth={4}
              borderRightWidth={4}
              borderColor={scanned ? "#10B981" : "white"}
              borderTopRightRadius={12}
            />
            <YStack
              position="absolute"
              bottom={0}
              left={0}
              width={60}
              height={60}
              borderBottomWidth={4}
              borderLeftWidth={4}
              borderColor={scanned ? "#10B981" : "white"}
              borderBottomLeftRadius={12}
            />
            <YStack
              position="absolute"
              bottom={0}
              right={0}
              width={60}
              height={60}
              borderBottomWidth={4}
              borderRightWidth={4}
              borderColor={scanned ? "#10B981" : "white"}
              borderBottomRightRadius={12}
            />

            {/* Scanning line animation */}
            {!scanned && (
              <YStack
                position="absolute"
                width="100%"
                height={2}
                backgroundColor="white"
                opacity={0.7}
                top="50%"
                animation="quick"
                animateOnly={["opacity"]}
              />
            )}

            {/* Success indicator */}
            {scanned && (
              <YStack
                flex={1}
                justifyContent="center"
                alignItems="center"
                backgroundColor="rgba(16, 185, 129, 0.2)"
                borderRadius={12}
              >
                <YStack backgroundColor="#10B981" padding="$4" borderRadius="$10">
                  <Text color="white" fontSize={20} fontWeight="bold">
                    ✓ Sikeresen beolvasva
                  </Text>
                </YStack>
              </YStack>
            )}
          </YStack>
        </YStack>

        {/* Instructions */}
        <YStack padding="$6" backgroundColor="rgba(0,0,0,0.5)" gap="$3">
          <Text color="white" textAlign="center" fontSize={16}>
            {scanned ? "Kód beolvasva!" : instruction}
          </Text>
          {scannedData && (
            <Text color="white" textAlign="center" fontSize={14} opacity={0.8}>
              {scannedData}
            </Text>
          )}
          {scanned && autoResetDelay === 0 && (
            <Button
              size="$3"
              theme="blue"
              marginTop="$2"
              onPress={resetScanner}
            >
              Újra szkennelés
            </Button>
          )}
        </YStack>
      </CameraView>
    </YStack>
  );
}
