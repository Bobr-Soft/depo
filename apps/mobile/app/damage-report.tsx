import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Input, TextArea } from "@repo/ui";
import { ArrowLeft, AlertTriangle, ScanBarcode, Send, CheckCircle2 } from "@tamagui/lucide-icons";
import { router, useLocalSearchParams } from "expo-router";
import { buildApiUrl, getApiUrl, getToken } from "@/services/secureStorage";
import { reauthenticateSilently, logout } from "@/services/auth";
import { useSyncStatus } from "@/hooks";

async function submitDamageReport(payload: {
  item_barcode?: string;
  item_name?: string;
  description: string;
}): Promise<void> {
  const [apiUrl, token] = await Promise.all([getApiUrl(), getToken()]);
  if (!token || !apiUrl) throw new Error("Nincs hitelesítés.");

  const makeRequest = (tkn: string) =>
    fetch(buildApiUrl(apiUrl, "/damage-reports"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tkn}` },
      body: JSON.stringify(payload),
    });

  let res = await makeRequest(token);
  if (res.status === 401) {
    const reauth = await reauthenticateSilently();
    if (!reauth.success) { await logout(); throw new Error("Lejárt munkamenet."); }
    const newToken = reauth.token ?? (await getToken());
    if (!newToken) { await logout(); throw new Error("Lejárt munkamenet."); }
    res = await makeRequest(newToken);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(body.message ?? `HTTP ${res.status}`);
  }
}

export default function DamageReportScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ barcode?: string }>();
  const syncStatus = useSyncStatus();

  const [barcode, setBarcode] = useState(params.barcode ?? "");
  const [itemName, setItemName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleScanBarcode = () => {
    router.push({ pathname: "/scanner", params: { returnTo: "/damage-report" } });
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      Alert.alert("Hiányos adatok", "A kár leírása kötelező.");
      return;
    }
    if (!syncStatus.isOnline) {
      Alert.alert(
        "Offline módban",
        "A sérülésjelentés beküldéséhez internet-kapcsolat szükséges. Kérjük, csatlakozzon hálózathoz és próbálja újra."
      );
      return;
    }
    setSubmitting(true);
    try {
      await submitDamageReport({
        item_barcode: barcode.trim() || undefined,
        item_name: itemName.trim() || undefined,
        description: description.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      Alert.alert("Hiba", err instanceof Error ? err.message : "Nem sikerült elküldeni a bejelentést.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setBarcode("");
    setItemName("");
    setDescription("");
    setSubmitted(false);
  };

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Sérült áru bejelentés</H2>
            <Text fontSize={14} color="$color10">Sérült vagy selejtes termék rögzítése</Text>
          </YStack>
        </XStack>
      </YStack>

      {!syncStatus.isOnline && (
        <XStack
          backgroundColor="$orange5"
          paddingHorizontal="$4"
          paddingVertical="$2"
          alignItems="center"
          gap="$2"
          marginBottom="$1"
        >
          <AlertTriangle size={14} color="$orange10" />
          <Text fontSize={13} color="$orange10" fontWeight="600">
            Offline – a beküldéshez internetkapcsolat szükséges
          </Text>
        </XStack>
      )}

      <Separator borderColor="$color4" marginBottom="$2" />

      {submitted ? (
        <YStack flex={1} padding="$4" justifyContent="center" alignItems="center" gap="$4">
          <YStack
            width={72}
            height={72}
            backgroundColor="$green5"
            borderRadius={36}
            alignItems="center"
            justifyContent="center"
          >
            <CheckCircle2 size={36} color="$green10" />
          </YStack>
          <YStack gap="$2" alignItems="center" maxWidth={320}>
            <Text fontSize={20} fontWeight="700" color="$color12" textAlign="center">
              Bejelentés elküldve
            </Text>
            <Text fontSize={14} color="$color10" textAlign="center" lineHeight={22}>
              A vezető értesítést kap és jóváhagyja a bejelentést.
            </Text>
          </YStack>
          <XStack gap="$3">
            <Button size="$4" theme="gray" onPress={() => router.back()}>
              Vissza
            </Button>
            <Button size="$4" theme="orange" onPress={handleReset}>
              Új bejelentés
            </Button>
          </XStack>
        </YStack>
      ) : (
        <ScrollView flex={1} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: Math.max(40, insets.bottom + 40) }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={insets.top + 16}>
          <YStack gap="$4">

            {/* VONALKÓD */}
            <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
              <Text fontSize={14} fontWeight="600" color="$color11">Termék azonosítása</Text>

              <XStack gap="$3" alignItems="center">
                <YStack flex={1}>
                  <Text fontSize={12} color="$color10" marginBottom="$1">Vonalkód (opcionális)</Text>
                  <Input
                    value={barcode}
                    onChangeText={setBarcode}
                    placeholder="Vonalkód beolvasva vagy kézi bevitel"
                    autoCapitalize="none"
                    autoCorrect={false}
                    size="$4"
                  />
                </YStack>
                <Button
                  size="$3"
                  theme="blue"
                  icon={ScanBarcode}
                  onPress={handleScanBarcode}
                  marginTop="$4"
                />
              </XStack>

              <YStack>
                <Text fontSize={12} color="$color10" marginBottom="$1">Megnevezés (opcionális)</Text>
                <Input
                  value={itemName}
                  onChangeText={setItemName}
                  placeholder="pl. Csavar M6x30, kartondoboz..."
                  autoCapitalize="sentences"
                  size="$4"
                />
              </YStack>
            </Card>

            {/* LEÍRÁS */}
            <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4" gap="$3">
              <Text fontSize={14} fontWeight="600" color="$color11">
                Kár leírása <Text color="$red10">*</Text>
              </Text>
              <TextArea
                value={description}
                onChangeText={setDescription}
                placeholder="Írja le a sérülés jellegét, mértékét, körülményeit..."
                numberOfLines={5}
                maxLength={1000}
                size="$4"
              />
              <Text fontSize={11} color="$color9" textAlign="right">
                {description.length}/1000
              </Text>
            </Card>

            {/* BEKÜLD GOMB */}
            <Button
              size="$5"
              theme="red"
              icon={Send}
              onPress={handleSubmit}
              disabled={submitting || !syncStatus.isOnline}
              opacity={submitting || !syncStatus.isOnline ? 0.6 : 1}
            >
              {submitting ? "Küldés..." : "Bejelentés küldése"}
            </Button>

          </YStack>
          </KeyboardAvoidingView>
        </ScrollView>
      )}
    </YStack>
  );
}
