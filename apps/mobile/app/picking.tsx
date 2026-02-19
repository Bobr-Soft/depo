import { H2, Text, YStack, XStack, Button, Card, ScrollView, Package, Spinner } from "@repo/ui";
import loadTasks from "@/components/api";
import { TaskComplete } from "@/constants/types";
import { useEffect, useState } from "react";

export default function PickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadTasks();
      setTasks(data);
    } catch {
      setError('Nem sikerült betölteni a feladatokat.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchTasks(); }, []);

  return (
    <YStack flex={1} padding="$4" backgroundColor="$background" gap="$5">
      <YStack gap="$2">
        <H2 color="$color12">Komissiózás (Picking)</H2>
        <Text fontSize={14} color="$color10">Kezeld a felvételi feladatokat</Text>
      </YStack>
      <Card flex={1} padding="$5" gap="$4" borderRadius="$4" shadowColor="$shadow" shadowOpacity={0.1} shadowRadius={8}>
        <XStack gap="$3" alignItems="center" justifyContent="space-between">
          <YStack gap="$1">
            <Text fontSize={14} fontWeight="600" color="$color11">Felvételi feladatok</Text>
            <Text fontSize={12} color="$color9">{tasks.length} aktív feladat</Text>
          </YStack>
          <Button size="$4" theme="blue" pressStyle={{ scale: 0.95 }}>
            <Text fontWeight="600">+ Új feladat</Text>
          </Button>
        </XStack>
        <ScrollView flex={1} backgroundColor="$background">
          {loading ? (
            <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$6">
              <Spinner size="large" />
            </YStack>
          ) : error ? (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={14} color="$red10" textAlign="center">{error}</Text>
              <Button size="$3" onPress={fetchTasks}><Text>Újra</Text></Button>
            </YStack>
          ) : tasks.length > 0 ? (
            tasks.map((task) => (
              <Card key={task.id} padding="$3" backgroundColor="$background" marginBottom="$2">
                <XStack gap="$3" alignItems="center">
                  <YStack backgroundColor="$blue5" padding="$2" borderRadius="$4">
                    <Package size={24} color="$blue10" />
                  </YStack>
                  <YStack flex={1} gap="$1">
                    <Text fontWeight="600">{task.source_id ?? 'Nincs forrás'}</Text>
                    <Text fontSize={12} color="$color11">Típus: {task.type}</Text>
                    <Text fontSize={12} color="$color11">
                      {new Date(task.created_at).toLocaleTimeString('hu-HU')}
                    </Text>
                  </YStack>
                </XStack>
              </Card>
            ))
          ) : (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={16} color="$color10" textAlign="center">
                Nincsenek aktív feladatok
              </Text>
              <Text fontSize={12} color="$color9" textAlign="center">
                Új feladat létrehozásához nyomja meg az &ldquo;Új feladat&rdquo; gombot
              </Text>
            </YStack>
          )}
        </ScrollView>
      </Card>
    </YStack>
  );
}
