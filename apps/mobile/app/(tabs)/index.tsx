import React, { useEffect, useState } from "react";
import { ScrollView, YStack, XStack, Button, Text, H2 } from "@repo/ui";
import { Truck, PackagePlus, ScanBarcode, Warehouse, AlertTriangle } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { getUserRole } from "@/services/secureStorage";

export default function HomeScreen() {
  const [role, setRole] = useState<string>('');

  useEffect(() => {
    async function fetchRole() {
      const storedRole = await getUserRole();
      setRole(storedRole?.toLowerCase() ?? '');
    }
    fetchRole();
  }, []);

  return (
    <ScrollView flex={1} backgroundColor="$background">
      <YStack padding="$4" gap="$4" paddingTop="$4">

        {/* Fejléc a konzisztencia miatt */}
        <YStack marginBottom="$2">
          <H2 color="$color12">Főoldal</H2>
          <Text fontSize={14} color="$color10">Válasszon menüpontot a folytatáshoz</Text>
        </YStack>

        <Button
          size="$4"
          theme="green"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/inbound")}
        >
          <PackagePlus size={44} color="$color11" />
          <Text fontSize={16} fontWeight="600" color="$color12">Bevételezés (Inbound)</Text>
        </Button>

        <Button
          size="$4"
          theme="yellow"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/picking")}
        >
          <Truck size={44} color="$color11" />
          <Text fontSize={16} fontWeight="600" color="$color12">Komissiózás (Picking)</Text>
        </Button>

        <Button
          size="$4"
          theme="blue"
          height="$12"
          flexDirection="column"
          gap="$2"
          onPress={() => router.push("/scanner")}
        >
          <ScanBarcode size={44} color="$color11" />
          <Text fontSize={16} fontWeight="600" color="$color12">Keresés (Scan)</Text>
        </Button>

        <XStack gap="$3" marginTop="$2">
          <Button flex={1} theme="gray" height="$10" flexDirection="column" gap="$2" onPress={() => router.push("/warehouse-map")}>
            <Warehouse size={32} color="$color11" />
            <Text fontSize={13} fontWeight="600" color="$color12">Raktártérkép</Text>
          </Button>

          <Button flex={1} theme="red" height="$10" flexDirection="column" gap="$2">
            <AlertTriangle size={32} color="$color11" />
            <Text fontSize={13} fontWeight="600" color="$color12">Sérült áru</Text>
          </Button>
        </XStack>

      </YStack>
    </ScrollView>
  );
}
