import { YStack, Text, H3 } from "@repo/ui";
import { useLocalSearchParams } from "expo-router";

//TODO - If DB is implemented, fetch item details using the code and display them here for editing
//TODO - If found in DB, throw a dialogue to choose between creating or loading and editing existing item

export default function EditScreen() {
    const { code, type } = useLocalSearchParams<{ code: string; type?: string }>();

    return (
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" gap="$3">
            <H3 marginBottom="$2">Szerkesztés</H3>
            <Text>Kód: {code}</Text>
            {type && <Text>Típus: {type}</Text>}
        </YStack>
    );
}
