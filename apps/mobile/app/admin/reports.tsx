import React, { useCallback, useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ScrollView, YStack, XStack, Button, Text, H2, Card, Separator, Spinner } from "@repo/ui";
import { ArrowLeft, AlertTriangle, RefreshCw, CheckCircle2, XCircle, Clock, AlertCircle } from "@tamagui/lucide-icons";
import { router } from "expo-router";
import { adminGetDamageReports, type DamageReport } from "@/components/adminApi";
import { useSyncStatus } from "@/hooks";

const STATUS_LABELS: Record<string, string> = {
  pending: "Várakozik",
  approved: "Jóváhagyva",
  rejected: "Elutasítva",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "$orange10",
  approved: "$green10",
  rejected: "$red10",
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("hu-HU", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminReportsScreen() {
  const insets = useSafeAreaInsets();
  const syncStatus = useSyncStatus();
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReports(await adminGetDamageReports());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nem sikerült betölteni a hibajelentéseket.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const pendingCount = reports.filter(r => r.status === "pending").length;
  const approvedCount = reports.filter(r => r.status === "approved").length;
  const rejectedCount = reports.filter(r => r.status === "rejected").length;

  return (
    <YStack flex={1} backgroundColor="$background" style={{ paddingTop: insets.top + 16 }}>
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$2">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Hibajelentések</H2>
            <Text fontSize={14} color="$color10">Sérült áru és dolgozói bejelentések</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={loadReports} disabled={loading} />
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
            Offline – az adatok esetleg nem naprakészek
          </Text>
        </XStack>
      )}

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {loading ? (
          <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
            <Spinner size="large" />
          </YStack>
        ) : error ? (
          <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
            <AlertCircle size={32} color="$red10" />
            <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
            <Button size="$3" onPress={loadReports}>Újrapróbálkozás</Button>
          </YStack>
        ) : reports.length === 0 ? (
          <YStack flex={1} justifyContent="center" alignItems="center" gap="$3" paddingVertical="$10">
            <CheckCircle2 size={40} color="$green10" />
            <Text fontSize={16} fontWeight="600" color="$color12">Nincs hibajelentés</Text>
            <Text fontSize={14} color="$color10" textAlign="center">
              Jelenleg nincsenek beküldött hibajelentések.
            </Text>
          </YStack>
        ) : (
          <YStack gap="$3">
            <XStack gap="$3" marginBottom="$2">
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={18} fontWeight="800" color="$orange10">{pendingCount}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Várakozik</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={18} fontWeight="800" color="$green10">{approvedCount}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Jóváhagyva</Text>
              </Card>
              <Card flex={1} padding="$3" borderRadius="$4" backgroundColor="$color3" alignItems="center" gap="$1" borderWidth={1} borderColor="$color4">
                <Text fontSize={18} fontWeight="800" color="$red10">{rejectedCount}</Text>
                <Text fontSize={11} color="$color10" textAlign="center">Elutasítva</Text>
              </Card>
            </XStack>

            {reports.map((report) => (
              <Card
                key={report.id}
                backgroundColor="$color2"
                borderRadius="$4"
                padding="$4"
                borderWidth={1}
                borderColor={report.status === "pending" ? "$orange5" : "$color4"}
                gap="$2"
              >
                <XStack alignItems="flex-start" gap="$3">
                  <YStack
                    width={40}
                    height={40}
                    backgroundColor={report.status === "pending" ? "$orange5" : "$color4"}
                    borderRadius="$3"
                    alignItems="center"
                    justifyContent="center"
                    flexShrink={0}
                  >
                    {report.status === "pending" ? (
                      <Clock size={18} color="$orange10" />
                    ) : report.status === "approved" ? (
                      <CheckCircle2 size={18} color="$green10" />
                    ) : (
                      <XCircle size={18} color="$red10" />
                    )}
                  </YStack>
                  <YStack flex={1} gap="$0.5">
                    <Text fontSize={14} fontWeight="600" color="$color12">
                      {report.item_name ?? report.item_barcode ?? "Ismeretlen termék"}
                    </Text>
                    {report.item_barcode && (
                      <Text fontSize={12} color="$color9">Kód: {report.item_barcode}</Text>
                    )}
                    <Text fontSize={12} color="$color10" numberOfLines={3}>{report.description}</Text>
                    <XStack gap="$3" alignItems="center" marginTop="$1">
                      <Text fontSize={11} color={STATUS_COLORS[report.status] ?? "$color10"} fontWeight="600">
                        {STATUS_LABELS[report.status] ?? report.status}
                      </Text>
                      <Text fontSize={11} color="$color9">
                        {report.reporter_email ?? "Ismeretlen dolgozó"} · {formatDate(report.created_at)}
                      </Text>
                    </XStack>
                    {report.review_note && (
                      <Text fontSize={12} color="$color10" marginTop="$1">
                        Megjegyzés: {report.review_note}
                      </Text>
                    )}
                  </YStack>
                </XStack>
              </Card>
            ))}
          </YStack>
        )}
      </ScrollView>
    </YStack>
  );
}
