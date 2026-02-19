import { H2, Text, YStack, XStack, Button, Card, ScrollView, Package } from "@repo/ui";
import loadTasks from "@/components/api";
import { TaskComplete } from "@/constants/types";

export default async function PickingScreen() {
  const tasks = await loadTasks() || [];
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
            <Text fontSize={12} color="$color9">0 aktív feladat</Text>
          </YStack>
          <Button size="$4" theme="blue" pressStyle={{ scale: 0.95 }}>
            <Text fontWeight="600">+ Új feladat</Text>
          </Button>
        </XStack>
        <ScrollView flex={1} backgroundColor="$background">
          {tasks.length > 0 ? (
            await createPickingTasks(tasks)
          ) : (
            <YStack flex={1} gap="$3" justifyContent="center" alignItems="center">
              <Text fontSize={16} color="$color10" textAlign="center">
                Nincsenek aktív feladatok
              </Text>
              <Text fontSize={12} color="$color9" textAlign="center">
              Új feladat létrehozásához nyomja meg az "Új feladat" gombot
            </Text>
          </YStack>
          )}
        </ScrollView>
      </Card>
    </YStack>
  );
}

async function createPickingTasks(tasks: TaskComplete[]): Promise<React.JSX.Element[]> {
  let taskCards: React.JSX.Element[] = [];

  for (const task of tasks) {
    const card = (
      <Card key={task.id} padding="$3" backgroundColor="$background">
        <XStack gap="$3" alignItems="center">
          <YStack
            backgroundColor="$blue5"
            padding="$2"
            borderRadius="$4"
          >
            <Package size={24} color="$blue10" />
          </YStack>
          <YStack flex={1} gap="$1">
            <Text fontWeight="600">{task.source_id ? task.source_id : "Nincs forrás"}</Text>
            <Text fontSize={12} color="$color11">
              Típus: {task.type}
            </Text>
            <Text fontSize={12} color="$color11">
              {new Date(task.created_at).toLocaleTimeString('hu-HU')}
            </Text>
          </YStack>
        </XStack>
      </Card>
    );
    taskCards.push(card);
  }

  return taskCards;
}
