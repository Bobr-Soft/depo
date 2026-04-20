import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { YStack, XStack, Text, H3, Button, Card, Input, Separator, Spinner, ScrollView } from "@repo/ui";
import { adminCreateItem, adminGetItemByBarcode, adminUpdateItem, adminGetCategories, adminGetLocations, type ApiItem } from "@/components/adminApi";
import { enqueueSyncOperation, getItemByBarcode, initDatabase, isDatabaseInitialized, saveItemToLocal } from "@/services/database";
import { isOnline } from "@/services/sync";

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
    const [barcodeInput, setBarcodeInput] = useState(code || "");
    const [nameInput, setNameInput] = useState("");
    const [descriptionInput, setDescriptionInput] = useState("");
    const [categoryIdInput, setCategoryIdInput] = useState("");
    const [locationIdInput, setLocationIdInput] = useState("");
    const [resolvedItemId, setResolvedItemId] = useState<number | null>(null);
    const [loadingItem, setLoadingItem] = useState(false);
    const [savingItem, setSavingItem] = useState(false);
    const [lastLoadSource, setLastLoadSource] = useState<"none" | "local" | "api">("none");
    const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
    const [locations, setLocations] = useState<{ id: number; location_code: string }[]>([]);
    const [showCategoryPicker, setShowCategoryPicker] = useState(false);
    const [showLocationPicker, setShowLocationPicker] = useState(false);
    const [categorySearch, setCategorySearch] = useState("");
    const [locationSearch, setLocationSearch] = useState("");

    const insets = useSafeAreaInsets();

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

    const applyItemToForm = useCallback((item: {
        id: number;
        name: string;
        barcode: string | null;
        description: string | null;
        quantity: number;
        category_id: number | null;
        location_id: number | null;
    }) => {
        setResolvedItemId(item.id);
        setBarcodeInput(item.barcode ?? "");
        setNameInput(item.name ?? "");
        setDescriptionInput(item.description ?? "");
        setQuantityInput(String(Math.max(1, Number(item.quantity) || 1)));
        setCategoryIdInput(item.category_id != null ? String(item.category_id) : "");
        setLocationIdInput(item.location_id != null ? String(item.location_id) : "");
    }, []);

    const toNullableInt = (raw: string): number | null => {
        const trimmed = raw.trim();
        if (!trimmed) {
            return null;
        }

        const parsed = Number.parseInt(trimmed, 10);
        return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    };

    const loadItemByBarcode = useCallback(async (inputBarcode: string) => {
        const normalizedBarcode = inputBarcode.trim();
        if (!normalizedBarcode) {
            Alert.alert("Hiányzó adat", "Adj meg egy vonalkódot a betöltéshez.");
            return;
        }

        setLoadingItem(true);
        try {
            if (!isDatabaseInitialized()) {
                await initDatabase();
            }

            const localItem = await getItemByBarcode(normalizedBarcode);
            if (localItem) {
                applyItemToForm(localItem);
                setLastLoadSource("local");
                return;
            }

            const online = await isOnline();
            if (!online) {
                setResolvedItemId(null);
                setLastLoadSource("none");
                Alert.alert("Offline mód", "Nem található lokális tétel. Online kapcsolatnál API-ból is betöltjük.");
                return;
            }

            const apiItem = await adminGetItemByBarcode(normalizedBarcode);
            if (!apiItem) {
                setResolvedItemId(null);
                setLastLoadSource("none");
                Alert.alert("Új tétel", "Nem találtunk meglévő tételt. Létrehozási mód aktív.");
                return;
            }

            applyItemToForm(apiItem);
            await saveItemToLocal({
                id: apiItem.id,
                name: apiItem.name,
                barcode: apiItem.barcode,
                description: apiItem.description,
                quantity: apiItem.quantity,
                category_id: apiItem.category_id,
                location_id: apiItem.location_id,
            });
            setLastLoadSource("api");
        } catch (error) {
            console.error("Failed to load item by barcode:", error);
            Alert.alert("Betöltési hiba", error instanceof Error ? error.message : "Ismeretlen hiba történt.");
        } finally {
            setLoadingItem(false);
        }
    }, [applyItemToForm]);

    useEffect(() => {
        if (!code) {
            return;
        }

        loadItemByBarcode(code).catch((error) => {
            console.error("Failed to auto-load item:", error);
        });
    }, [code, loadItemByBarcode]);

    useEffect(() => {
        (async () => {
            try {
                const cats = await adminGetCategories();
                setCategories(cats.map((c) => ({ id: c.id, name: c.name })));
            } catch { /* offline - pickers will be empty */ }
            try {
                const locs = await adminGetLocations();
                setLocations(locs.map((l) => ({ id: l.id, location_code: l.location_code })));
            } catch { /* offline */ }
        })();
    }, []);

    const saveItem = async () => {
        const trimmedBarcode = barcodeInput.trim();
        const trimmedName = nameInput.trim();
        const trimmedDescription = descriptionInput.trim();

        if (!trimmedBarcode) {
            Alert.alert("Hiányzó adat", "A vonalkód megadása kötelező.");
            return;
        }

        if (!trimmedName) {
            Alert.alert("Hiányzó adat", "A név megadása kötelező.");
            return;
        }

        if (savingItem) {
            return;
        }

        const payload = {
            name: trimmedName,
            barcode: trimmedBarcode,
            description: trimmedDescription || null,
            quantity: normalizedQuantity,
            category_id: toNullableInt(categoryIdInput),
            location_id: toNullableInt(locationIdInput),
        };

        setSavingItem(true);

        try {
            if (!isDatabaseInitialized()) {
                await initDatabase();
            }

            const online = await isOnline();

            if (!online) {
                await enqueueSyncOperation("UPSERT", "item", resolvedItemId, {
                    ...payload,
                    quantityIncrement: normalizedQuantity,
                });

                if (resolvedItemId) {
                    await saveItemToLocal({
                        id: resolvedItemId,
                        ...payload,
                    });
                }

                Alert.alert("Offline mentés", "A módosítás a szinkron várólistára került.");
                return;
            }

            let savedItem: ApiItem;

            if (resolvedItemId) {
                savedItem = await adminUpdateItem(resolvedItemId, payload);
            } else {
                savedItem = await adminCreateItem(payload);
                setResolvedItemId(savedItem.id);
            }

            await saveItemToLocal({
                id: savedItem.id,
                name: savedItem.name,
                barcode: savedItem.barcode,
                description: savedItem.description,
                quantity: savedItem.quantity,
                category_id: savedItem.category_id,
                location_id: savedItem.location_id,
            });

            setLastLoadSource("api");
            Alert.alert("Mentés kész", resolvedItemId ? "A tétel frissítve lett." : "A tétel létrehozva lett.");
        } catch (error) {
            console.error("Failed to save item:", error);
            await enqueueSyncOperation("UPSERT", "item", resolvedItemId, {
                ...payload,
                quantityIncrement: normalizedQuantity,
            }).catch((queueError) => {
                console.error("Failed to enqueue fallback operation:", queueError);
            });

            Alert.alert(
                "Mentési hiba",
                "Az online mentés sikertelen volt, a módosítás várólistára került."
            );
        } finally {
            setSavingItem(false);
        }
    };

    const createVsEditMode = resolvedItemId ? "Szerkesztés" : "Létrehozás";

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
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
            flex={1}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16, paddingBottom: Math.max(80, insets.bottom + 80) }}
            backgroundColor="$background"
        >
        <YStack gap="$4">
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

                            <Separator marginTop="$2" marginBottom="$1" />
                        </>
                    ) : null}

                    <YStack gap="$2">
                        <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                            Mód
                        </Text>
                        <Text>{createVsEditMode}</Text>
                        {lastLoadSource !== "none" && (
                            <Text color="$color10" fontSize={12}>
                                Forrás: {lastLoadSource === "local" ? "Lokális cache" : "API"}
                            </Text>
                        )}
                    </YStack>

                    <YStack gap="$2">
                        <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                            Vonalkód
                        </Text>
                        <Input
                            value={barcodeInput}
                            onChangeText={setBarcodeInput}
                            placeholder="Pl. 5990000000012"
                            size="$4"
                            autoCapitalize="none"
                        />
                        <Button size="$3" theme="gray" disabled={loadingItem} onPress={() => loadItemByBarcode(barcodeInput)}>
                            {loadingItem ? (
                                <XStack alignItems="center" gap="$2">
                                    <Spinner size="small" />
                                    <Text>Betöltés...</Text>
                                </XStack>
                            ) : (
                                <Text>Betöltés vonalkód alapján</Text>
                            )}
                        </Button>
                    </YStack>

                    <YStack gap="$2">
                        <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                            Név
                        </Text>
                        <Input value={nameInput} onChangeText={setNameInput} placeholder="Termék neve" size="$4" />
                    </YStack>

                    <YStack gap="$2">
                        <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                            Leírás
                        </Text>
                        <Input
                            value={descriptionInput}
                            onChangeText={setDescriptionInput}
                            placeholder="Opcionális leírás"
                            size="$4"
                        />
                    </YStack>

                    <XStack gap="$2">
                        <YStack gap="$2" flex={1}>
                            <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                                Kategória
                            </Text>
                            <Button
                                size="$4"
                                theme="gray"
                                onPress={() => { setShowCategoryPicker(!showCategoryPicker); setShowLocationPicker(false); }}
                            >
                                <Text numberOfLines={1}>
                                    {categoryIdInput
                                        ? `#${categoryIdInput} ${categories.find((c) => String(c.id) === categoryIdInput)?.name ?? ""}`
                                        : "Válassz..."}
                                </Text>
                            </Button>
                            {showCategoryPicker && (
                                <YStack backgroundColor="$color2" borderWidth={1} borderColor="$color5" borderRadius="$3" maxHeight={160} overflow="hidden">
                                    <Input
                                        size="$3"
                                        placeholder="Keresés..."
                                        value={categorySearch}
                                        onChangeText={setCategorySearch}
                                    />
                                    <ScrollView nestedScrollEnabled>
                                        {categories.length === 0 ? (
                                            <Text padding="$2" fontSize={12} color="$color9">Nincs elérhető kategória</Text>
                                        ) : categories.filter((c) => !categorySearch || c.name.toLowerCase().includes(categorySearch.toLowerCase()) || String(c.id).includes(categorySearch)).map((cat) => (
                                            <Button
                                                key={cat.id}
                                                size="$3"
                                                backgroundColor={String(cat.id) === categoryIdInput ? "$blue5" : "transparent"}
                                                justifyContent="flex-start"
                                                borderRadius={0}
                                                onPress={() => { setCategoryIdInput(String(cat.id)); setShowCategoryPicker(false); setCategorySearch(""); }}
                                            >
                                                <Text fontSize={13} color="$color11">#{cat.id} — {cat.name}</Text>
                                            </Button>
                                        ))}
                                        <Button
                                            size="$3"
                                            backgroundColor="transparent"
                                            justifyContent="flex-start"
                                            borderRadius={0}
                                            onPress={() => { setCategoryIdInput(""); setShowCategoryPicker(false); setCategorySearch(""); }}
                                        >
                                            <Text fontSize={13} color="$color9">— Nincs —</Text>
                                        </Button>
                                    </ScrollView>
                                </YStack>
                            )}
                        </YStack>

                        <YStack gap="$2" flex={1}>
                            <Text color="$color11" fontSize={12} textTransform="uppercase" fontWeight="600">
                                Lokáció
                            </Text>
                            <Button
                                size="$4"
                                theme="gray"
                                onPress={() => { setShowLocationPicker(!showLocationPicker); setShowCategoryPicker(false); }}
                            >
                                <Text numberOfLines={1}>
                                    {locationIdInput
                                        ? `#${locationIdInput} ${locations.find((l) => String(l.id) === locationIdInput)?.location_code ?? ""}`
                                        : "Válassz..."}
                                </Text>
                            </Button>
                            {showLocationPicker && (
                                <YStack backgroundColor="$color2" borderWidth={1} borderColor="$color5" borderRadius="$3" maxHeight={160} overflow="hidden">
                                    <Input
                                        size="$3"
                                        placeholder="Keresés..."
                                        value={locationSearch}
                                        onChangeText={setLocationSearch}
                                    />
                                    <ScrollView nestedScrollEnabled>
                                        {locations.length === 0 ? (
                                            <Text padding="$2" fontSize={12} color="$color9">Nincs elérhető lokáció</Text>
                                        ) : locations.filter((l) => !locationSearch || l.location_code.toLowerCase().includes(locationSearch.toLowerCase()) || String(l.id).includes(locationSearch)).map((loc) => (
                                            <Button
                                                key={loc.id}
                                                size="$3"
                                                backgroundColor={String(loc.id) === locationIdInput ? "$blue5" : "transparent"}
                                                justifyContent="flex-start"
                                                borderRadius={0}
                                                onPress={() => { setLocationIdInput(String(loc.id)); setShowLocationPicker(false); setLocationSearch(""); }}
                                            >
                                                <Text fontSize={13} color="$color11">#{loc.id} — {loc.location_code}</Text>
                                            </Button>
                                        ))}
                                        <Button
                                            size="$3"
                                            backgroundColor="transparent"
                                            justifyContent="flex-start"
                                            borderRadius={0}
                                            onPress={() => { setLocationIdInput(""); setShowLocationPicker(false); setLocationSearch(""); }}
                                        >
                                            <Text fontSize={13} color="$color9">— Nincs —</Text>
                                        </Button>
                                    </ScrollView>
                                </YStack>
                            )}
                        </YStack>
                    </XStack>

                    <XStack gap="$3" marginTop="$1">
                        <Button size="$4" theme="blue" onPress={saveItem} disabled={savingItem}>
                            {savingItem ? (
                                <XStack alignItems="center" gap="$2">
                                    <Spinner size="small" />
                                    <Text>Mentés...</Text>
                                </XStack>
                            ) : (
                                <Text>{resolvedItemId ? "Frissítés API + queue" : "Létrehozás API + queue"}</Text>
                            )}
                        </Button>
                        <Button size="$4" theme="gray" onPress={goBack}>
                            <Text>Vissza</Text>
                        </Button>
                    </XStack>
                </YStack>
            </Card>
        </YStack>
        </ScrollView>
        </KeyboardAvoidingView>
    );
}
