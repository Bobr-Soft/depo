import { useMemo, useState } from "react";
import { Alert } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, H3, Button, Card, Input } from "@repo/ui";

function singleParam(value: string | string[] | undefined): string {
    if (Array.isArray(value)) {
        return value[0] ?? "";
    }
    return value ?? "";
}

export default function EditScreen() {
    const params = useLocalSearchParams<{
        code?: string | string[];
        type?: string | string[];
        quantity?: string | string[];
    }>();

    const code = singleParam(params.code);
    const type = singleParam(params.type);
    const initialQuantity = useMemo(() => {
        const parsed = Number.parseInt(singleParam(params.quantity), 10);
        return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
    }, [params.quantity]);

    const [quantityInput, setQuantityInput] = useState(String(initialQuantity));

    const parsedQuantity = Number.parseInt(quantityInput, 10);
    const normalizedQuantity = Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? parsedQuantity : 1;
    const isInbound = type === "inbound";

    const goBack = () => {
        if (router.canGoBack()) {
            router.back();
            return;
        }
        router.replace("/inbound");
    };

    const saveInboundEdit = () => {
        if (!code) {
            Alert.alert("Hiányzó adat", "Nem található a szerkesztendő vonalkód.");
            return;
        }

        router.replace({
            pathname: "/inbound",
            params: {
                action: "update",
                code,
                quantity: String(normalizedQuantity),
                nonce: String(Date.now()),
            },
        });
    };

    const deleteInboundItem = () => {
        if (!code) {
            Alert.alert("Hiányzó adat", "Nem található a törlendő vonalkód.");
            return;
        }

        Alert.alert("Törlés megerősítése", `Biztosan törlöd ezt a tételt?\n\n${code}`, [
            { text: "Mégse", style: "cancel" },
            {
                text: "Törlés",
                style: "destructive",
                onPress: () => {
                    router.replace({
                        pathname: "/inbound",
                        params: {
                            action: "delete",
                            code,
                            nonce: String(Date.now()),
                        },
                    });
                },
            },
        ]);
    };

    return (
        <YStack flex={1} padding="$4" backgroundColor="$background" gap="$4">
            <YStack gap="$2">
                <XStack alignItems="center" gap="$3">
                    <Button size="$3" theme="gray" onPress={goBack}>
                        <Text>← Vissza</Text>
                    </Button>
                    <H3>Szerkesztés</H3>
                </XStack>
                <Text color="$color11">Típus: {type || "ismeretlen"}</Text>
            </YStack>

            <Card padding="$4" backgroundColor="$background">
                <YStack gap="$3">
                    <Text fontWeight="600">Vonalkód: {code || "N/A"}</Text>

                    {isInbound ? (
                        <>
                            <YStack gap="$2">
                                <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                                    Mennyiség
                                </Text>
                                <Input
                                    value={quantityInput}
                                    onChangeText={(text: string) => setQuantityInput(text.replace(/[^0-9]/g, ""))}
                                    keyboardType="numeric"
                                    size="$4"
                                />
                                <Text color="$color10" fontSize={12}>Mentéskor alkalmazott mennyiség: {normalizedQuantity}</Text>
                            </YStack>

                            <XStack gap="$2">
                                <Button size="$3" theme="gray" onPress={() => setQuantityInput(String(Math.max(1, normalizedQuantity - 1)))}>
                                    <Text>-1</Text>
                                </Button>
                                <Button size="$3" theme="gray" onPress={() => setQuantityInput(String(normalizedQuantity + 1))}>
                                    <Text>+1</Text>
                                </Button>
                                <Button size="$3" theme="gray" onPress={() => setQuantityInput(String(initialQuantity))}>
                                    <Text>Alapérték</Text>
                                </Button>
                            </XStack>

                            <XStack gap="$3" marginTop="$2">
                                <Button size="$4" theme="blue" onPress={saveInboundEdit}>
                                    <Text>Módosítás mentése</Text>
                                </Button>
                                <Button size="$4" theme="red" onPress={deleteInboundItem}>
                                    <Text>Tétel törlése</Text>
                                </Button>
                            </XStack>
                        </>
                    ) : (
                        <YStack gap="$2">
                            <Text color="$color11">Ehhez a típushoz még nincs dedikált szerkesztő nézet.</Text>
                            <Button size="$4" theme="blue" onPress={goBack}>
                                <Text>Vissza</Text>
                            </Button>
                        </YStack>
                    )}
                </YStack>
            </Card>
        </YStack>
    );
}
