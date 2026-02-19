/**
 * Inbound Screen
 *
 * Example integration of BarcodeScanner component for scanning products.
 * Shows how to use the scanner as an embedded modal within a screen.
 */

import React, { useState, useCallback, useRef } from "react";
import { Alert } from "react-native";
import { YStack, XStack, Button, Text, H2, Card, ScrollView } from "@repo/ui";
import { ScanBarcode, Package } from "@tamagui/lucide-icons";
import { BarcodeScanner } from "@/components";

export default function InboundScreen() {
  const [showScanner, setShowScanner] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const [scannedItems, setScannedItems] = useState<Array<{ code: string; type: string; timestamp: Date }>>([]);
  const isProcessing = useRef(false);

  const handleScan = useCallback((data: string, type: string) => {
    // Prevent multiple scans while processing
    if (isProcessing.current) return;

    isProcessing.current = true;

    // Add scanned item to list
    setScannedItems(prev => [{
      code: data,
      type: type,
      timestamp: new Date()
    }, ...prev]);

    // Show prompt asking to continue or close
    Alert.alert(
      "Termék beolvasva",
      `Kód: ${data}\nTípus: ${type}`,
      [
        {
          text: "Tovább szkennelés",
          onPress: () => {
            isProcessing.current = false;
            setScannerKey(prev => prev + 1);
          },
          style: "default"
        },
        {
          text: "Kész",
          onPress: () => {
            isProcessing.current = false;
            setShowScanner(false);
            setScannerKey(prev => prev + 1);
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
  }, []);

  if (showScanner) {
    return (
      <BarcodeScanner
        key={scannerKey}
        onScan={handleScan}
        onClose={() => {
          isProcessing.current = false;
          setShowScanner(false);
          setScannerKey(prev => prev + 1);
        }}
        title="Termék szkennelés"
        instruction="Szkenneld be a termék vonalkódját"
        autoResetDelay={0}
      />
    );
  }

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$4">
      <YStack gap="$2">
        <H2>Bevételezés (Inbound)</H2>
        <Text color="$color11" fontSize={14}>
          Szkenneld be a beérkező termékeket
        </Text>
      </YStack>

      <Button
        size="$5"
        theme="blue"
        icon={ScanBarcode}
        onPress={() => setShowScanner(true)}
      >
        <Text>Termék szkennelése</Text>
      </Button>

      <ScrollView flex={1} backgroundColor="$background">
        {scannedItems.length > 0 && (
          <YStack gap="$3" flex={1}>
            <Text fontWeight="600" fontSize={16}>
              Beolvasott termékek ({scannedItems.length})
            </Text>

            <YStack gap="$2" flex={1}>
              {scannedItems.map((item, index) => (
                <Card key={index} padding="$3" backgroundColor="$background">
                  <XStack gap="$3" alignItems="center">
                    <YStack
                      backgroundColor="$blue5"
                      padding="$2"
                      borderRadius="$4"
                    >
                      <Package size={24} color="$blue10" />
                    </YStack>
                    <YStack flex={1} gap="$1">
                      <Text fontWeight="600">{item.code}</Text>
                      <Text fontSize={12} color="$color11">
                        Típus: {item.type}
                      </Text>
                      <Text fontSize={12} color="$color11">
                        {item.timestamp.toLocaleTimeString('hu-HU')}
                      </Text>
                    </YStack>
                  </XStack>
                </Card>
              ))}
            </YStack>

            <Button
              size="$4"
              theme="green"
              onPress={() => {
                // Here you would save the scanned items
                console.log('Saving items:', scannedItems);
                setScannedItems([]);
              }}
            >
              <Text>Mentés ({scannedItems.length} termék)</Text>
            </Button>
          </YStack>
        )}

        {scannedItems.length === 0 && (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3">
            <Package size={80} color="$color9" opacity={0.3} />
            <Text color="$color11" textAlign="center">
              Még nincsenek beolvasott termékek.{'\n'}
              Kezdd el a szkennelést a fenti gombra kattintva.
            </Text>
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
