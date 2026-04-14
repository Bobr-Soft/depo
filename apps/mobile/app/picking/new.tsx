import { useEffect, useMemo, useState } from "react";
import { router } from "expo-router";
import { H2, Text, YStack, XStack, Button, Card, ScrollView, Spinner, Separator, Input } from "@repo/ui";
import { RefreshCw, ArrowLeft, WifiOff, AlertCircle, Clock, Package, CheckCircle2, Plus, Trash2 } from "@tamagui/lucide-icons";
import loadTasks, { refreshTasks, takeTask } from "@/components/api";
import { adminCreateTask, adminGetItems, type ApiItem, type CreateTaskInput } from "@/components/adminApi";
import { TaskComplete } from "@/constants/types";
import { useSyncStatus } from "@/hooks";
import { enqueueSyncOperation, initDatabase, isDatabaseInitialized } from "@/services/database";
import { isOnline } from "@/services/sync";

const ASSIGNABLE_STATUSES = new Set(["pending", "in_progress"]);

type DraftItem = {
  key: string;
  item_id: string;
  requested_quantity: string;
};

function getPriorityLabel(priority: number): string {
  if (priority === 1) return "Kritikus";
  if (priority === 2) return "Magas";
  if (priority === 3) return "Normál";
  return "Alacsony";
}

function getPriorityColor(priority: number) {
  if (priority === 1) return "$red10";
  if (priority === 2) return "$yellow10";
  if (priority === 3) return "$green10";
  return "$color10";
}

const createDraftItem = (): DraftItem => ({
  key: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  item_id: "",
  requested_quantity: "1",
});

export default function NewPickingScreen() {
  const [tasks, setTasks] = useState<TaskComplete[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [assigningTaskId, setAssigningTaskId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<ApiItem[]>([]);

  const [name, setName] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [priorityText, setPriorityText] = useState("2");
  const [deadlineInput, setDeadlineInput] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([createDraftItem()]);

  const syncStatus = useSyncStatus();

  const unassignedTasks = useMemo(() => {
    return tasks
      .filter((task) => task.assigned_user === null && ASSIGNABLE_STATUSES.has(task.status))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (!a.deadline && !b.deadline) return a.id - b.id;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      });
  }, [tasks]);

  async function fetchTasks() {
    setLoading(true);
    setError(null);
    try {
      setTasks(await loadTasks());
    } catch {
      setError("Nem sikerült betölteni a hozzárendelhető feladatokat.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchItems() {
    try {
      const items = await adminGetItems();
      setAvailableItems(items.slice(0, 10));
    } catch {
      setAvailableItems([]);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      setTasks(await refreshTasks());
      const currentlyOnline = await isOnline();
      if (currentlyOnline) {
        await fetchItems();
      }
    } catch {
      setError("Nem sikerült frissíteni a feladatlistát.");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleTakeTask(task: TaskComplete) {
    setAssigningTaskId(task.id);
    setError(null);
    setNotice(null);

    try {
      const ok = await takeTask(task.id);
      if (!ok) {
        setError("A feladat felvétele nem sikerült.");
        return;
      }
      setNotice(`Feladat felvéve: ${task.source_id ?? task.name}`);
      setTasks(await refreshTasks());
      router.push({ pathname: "/picking/[id]", params: { id: task.id } });
    } catch {
      setError("A feladat felvétele közben hiba történt.");
    } finally {
      setAssigningTaskId(null);
    }
  }

  function addDraftItem() {
    setDraftItems((prev) => [...prev, createDraftItem()]);
  }

  function removeDraftItem(key: string) {
    setDraftItems((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((item) => item.key !== key);
    });
  }

  function updateDraftItem(key: string, field: "item_id" | "requested_quantity", value: string) {
    setDraftItems((prev) => prev.map((item) => (item.key === key ? { ...item, [field]: value } : item)));
  }

  function resetCreateForm() {
    setName("");
    setSourceId("");
    setPriorityText("2");
    setDeadlineInput("");
    setDraftItems([createDraftItem()]);
  }

  async function enqueueCreateForOffline(payload: CreateTaskInput): Promise<void> {
    if (!isDatabaseInitialized()) {
      await initDatabase();
    }
    await enqueueSyncOperation("CREATE", "task", null, payload as unknown as Record<string, unknown>);
  }

  function buildCreatePayload(): { payload: CreateTaskInput | null; error: string | null } {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return { payload: null, error: "A feladat neve kötelező." };
    }

    const parsedPriority = Number.parseInt(priorityText, 10);
    if (!Number.isInteger(parsedPriority) || parsedPriority < 1 || parsedPriority > 4) {
      return { payload: null, error: "A prioritás 1 és 4 közötti egész szám legyen." };
    }

    let normalizedDeadline: string | null = null;
    const trimmedDeadline = deadlineInput.trim();
    if (trimmedDeadline) {
      const date = new Date(trimmedDeadline);
      if (Number.isNaN(date.getTime())) {
        return { payload: null, error: "A határidő formátuma érvénytelen." };
      }
      normalizedDeadline = date.toISOString();
    }

    const normalizedItems = draftItems
      .map((entry) => ({
        item_id: Number.parseInt(entry.item_id.trim(), 10),
        requested_quantity: Number.parseInt(entry.requested_quantity.trim(), 10),
        isEmpty: entry.item_id.trim().length === 0,
      }))
      .filter((entry) => !entry.isEmpty);

    for (const entry of normalizedItems) {
      if (!Number.isInteger(entry.item_id) || entry.item_id <= 0) {
        return { payload: null, error: "Az item ID pozitív egész szám legyen." };
      }
      if (!Number.isInteger(entry.requested_quantity) || entry.requested_quantity <= 0) {
        return { payload: null, error: "A kért mennyiség pozitív egész szám legyen." };
      }
    }

    const seen = new Set<number>();
    for (const entry of normalizedItems) {
      if (seen.has(entry.item_id)) {
        return { payload: null, error: "Egy item csak egyszer szerepelhet a listában." };
      }
      seen.add(entry.item_id);
    }

    const payload: CreateTaskInput = {
      name: trimmedName,
      type: "picking",
      priority: parsedPriority,
      source_id: sourceId.trim() ? sourceId.trim() : null,
      deadline: normalizedDeadline,
      items: normalizedItems.map((entry) => ({
        item_id: entry.item_id,
        requested_quantity: entry.requested_quantity,
      })),
    };

    return { payload, error: null };
  }

  async function handleCreateTask() {
    setCreating(true);
    setError(null);
    setNotice(null);

    try {
      const { payload, error: validationError } = buildCreatePayload();
      if (!payload) {
        setError(validationError ?? "Érvénytelen feladat adatok.");
        return;
      }

      const currentlyOnline = await isOnline();
      if (!currentlyOnline) {
        await enqueueCreateForOffline(payload);
        setNotice("Offline mód: a feladat létrehozása sorba állítva, online állapotban kerül elküldésre.");
        resetCreateForm();
        return;
      }

      const createdTask = await adminCreateTask(payload);
      setNotice(`Feladat létrehozva: ${createdTask.source_id ?? createdTask.name}`);
      resetCreateForm();
      await handleRefresh();
      router.push({ pathname: "/picking/[id]", params: { id: createdTask.id } });
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "A feladat létrehozása közben hiba történt.";
      setError(message.includes("403") ? "Nincs jogosultság új feladat létrehozásához." : message);
    } finally {
      setCreating(false);
    }
  }

  useEffect(() => {
    fetchTasks();
    if (syncStatus.isOnline) {
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <YStack flex={1} backgroundColor="$background" paddingTop="$4">
      <YStack paddingHorizontal="$4" gap="$3" marginBottom="$3">
        <XStack alignItems="center" gap="$3">
          <Button size="$3" theme="gray" circular icon={ArrowLeft} onPress={() => router.back()} />
          <YStack flex={1}>
            <H2 color="$color12">Új feladat</H2>
            <Text fontSize={14} color="$color10">Szabad feladatok felvétele és új komissiózási feladat létrehozása</Text>
          </YStack>
          <Button size="$3" theme="gray" circular icon={RefreshCw} onPress={handleRefresh} disabled={refreshing || loading} />
        </XStack>

        {!syncStatus.isOnline && (
          <XStack backgroundColor="$orange5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <WifiOff size={16} color="$orange10" />
            <Text fontSize={12} color="$orange10">Offline mód - Felvétel letiltva, létrehozás sorba állítással</Text>
          </XStack>
        )}
        {notice && (
          <XStack backgroundColor="$green5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <CheckCircle2 size={16} color="$green10" />
            <Text fontSize={12} color="$green10">{notice}</Text>
          </XStack>
        )}
        {error && (
          <XStack backgroundColor="$red5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <AlertCircle size={16} color="$red10" />
            <Text fontSize={12} color="$red10">{error}</Text>
          </XStack>
        )}
        {syncStatus.lastFailureReason && !error && (
          <XStack backgroundColor="$yellow5" padding="$2" borderRadius="$3" alignItems="center" gap="$2">
            <AlertCircle size={16} color="$yellow10" />
            <Text fontSize={12} color="$yellow10">Utolsó szinkron hiba oka: {syncStatus.lastFailureReason}</Text>
          </XStack>
        )}
      </YStack>

      <Separator borderColor="$color4" marginBottom="$2" />

      <ScrollView flex={1} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        <YStack gap="$4">
          <Card backgroundColor="$color2" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4">
            <YStack gap="$3">
              <Text fontSize={15} fontWeight="700" color="$color12">Új komissiózási feladat létrehozása</Text>

              <YStack gap="$1">
                <Text fontSize={12} color="$color10">Név</Text>
                <Input value={name} onChangeText={setName} placeholder="pl. Vevői rendelés #452" />
              </YStack>

              <YStack gap="$1">
                <Text fontSize={12} color="$color10">Forrás azonosító (opcionális)</Text>
                <Input value={sourceId} onChangeText={setSourceId} placeholder="pl. SO-452" />
              </YStack>

              <XStack gap="$2">
                <YStack flex={1} gap="$1">
                  <Text fontSize={12} color="$color10">Prioritás (1-4)</Text>
                  <Input value={priorityText} onChangeText={setPriorityText} keyboardType="numeric" placeholder="2" />
                </YStack>
                <YStack flex={1} gap="$1">
                  <Text fontSize={12} color="$color10">Határidő (ISO / dátum)</Text>
                  <Input
                    value={deadlineInput}
                    onChangeText={setDeadlineInput}
                    placeholder="2026-03-25T12:00:00Z"
                    autoCapitalize="none"
                  />
                </YStack>
              </XStack>

              <YStack gap="$2">
                <XStack justifyContent="space-between" alignItems="center">
                  <Text fontSize={13} fontWeight="600" color="$color11">Tételek</Text>
                  <Button size="$2" theme="gray" icon={Plus} onPress={addDraftItem}>Új tétel</Button>
                </XStack>

                {draftItems.map((draft) => (
                  <XStack key={draft.key} gap="$2" alignItems="center">
                    <Input
                      flex={1}
                      placeholder="Item ID"
                      keyboardType="numeric"
                      value={draft.item_id}
                      onChangeText={(text: string) => updateDraftItem(draft.key, "item_id", text)}
                    />
                    <Input
                      width={110}
                      placeholder="Mennyiség"
                      keyboardType="numeric"
                      value={draft.requested_quantity}
                      onChangeText={(text: string) => updateDraftItem(draft.key, "requested_quantity", text)}
                    />
                    <Button
                      size="$2"
                      theme="red"
                      circular
                      icon={Trash2}
                      onPress={() => removeDraftItem(draft.key)}
                      disabled={draftItems.length <= 1}
                    />
                  </XStack>
                ))}

                {availableItems.length > 0 && (
                  <YStack backgroundColor="$color1" borderRadius="$3" padding="$2" gap="$1">
                    <Text fontSize={11} color="$color9">Gyors súgó item ID-khoz (első 10):</Text>
                    {availableItems.map((item) => (
                      <Text key={item.id} fontSize={11} color="$color10">#{item.id} - {item.name}</Text>
                    ))}
                  </YStack>
                )}
              </YStack>

              <XStack justifyContent="space-between" alignItems="center">
                <Text fontSize={12} color={getPriorityColor(Number.parseInt(priorityText, 10) || 4)}>
                  Prioritás címke: {getPriorityLabel(Number.parseInt(priorityText, 10) || 4)}
                </Text>
                <Button size="$3" theme="gray" variant="outlined" onPress={resetCreateForm} disabled={creating}>
                  Törlés
                </Button>
              </XStack>

              <Button size="$4" theme="blue" onPress={handleCreateTask} disabled={creating}>
                {creating ? "Létrehozás folyamatban..." : "Feladat létrehozása"}
              </Button>
            </YStack>
          </Card>

          <YStack>
            <XStack justifyContent="space-between" alignItems="center" marginBottom="$3" paddingHorizontal="$1">
              <Text fontSize={14} fontWeight="600" color="$color11">Elérhető feladatok</Text>
              <Text fontSize={12} color="$color9">{unassignedTasks.length} db</Text>
            </XStack>

            {loading || refreshing ? (
              <YStack flex={1} justifyContent="center" alignItems="center" paddingVertical="$10">
                <Spinner size="large" />
              </YStack>
            ) : unassignedTasks.length === 0 ? (
              <YStack flex={1} gap="$3" justifyContent="center" alignItems="center" paddingVertical="$10">
                <CheckCircle2 size={48} color="$color8" />
                <YStack alignItems="center" gap="$1">
                  <Text fontSize={16} fontWeight="600" color="$color11" textAlign="center">Nincs szabad feladat</Text>
                  <Text fontSize={13} color="$color9" textAlign="center">Jelenleg minden feladat ki van osztva.</Text>
                </YStack>
              </YStack>
            ) : (
              <YStack gap="$3">
                {unassignedTasks.map((task) => {
                  const isAssigning = assigningTaskId === task.id;

                  return (
                    <Card key={task.id} backgroundColor="$color3" borderRadius="$4" padding="$4" borderWidth={1} borderColor="$color4">
                      <YStack gap="$2">
                        <XStack justifyContent="space-between" alignItems="flex-start">
                          <YStack flex={1}>
                            <Text fontWeight="700" fontSize={18} color="$color12">{task.source_id ?? task.name}</Text>
                            <Text fontSize={13} color="$color10">{task.name}</Text>
                          </YStack>
                          <YStack backgroundColor="$blue5" paddingHorizontal="$2" paddingVertical="$1" borderRadius="$3">
                            <Text fontSize={10} fontWeight="700" color="$blue10" textTransform="uppercase">{task.type}</Text>
                          </YStack>
                        </XStack>

                        <XStack gap="$4" marginTop="$1">
                          <XStack gap="$1.5" alignItems="center">
                            <Package size={14} color="$color10" />
                            <Text fontSize={14} color="$color11">{task.items?.length || 0} tétel</Text>
                          </XStack>
                          <XStack gap="$1.5" alignItems="center">
                            <AlertCircle size={14} color={getPriorityColor(task.priority)} />
                            <Text fontSize={14} fontWeight="600" color={getPriorityColor(task.priority)}>
                              {getPriorityLabel(task.priority)}
                            </Text>
                          </XStack>
                        </XStack>

                        <XStack gap="$1.5" alignItems="center" marginTop="$1">
                          <Clock size={14} color="$color10" />
                          <Text fontSize={13} color="$color11">
                            {task.deadline
                              ? `${new Date(task.deadline).toLocaleTimeString()} (${Math.max(0, Math.round((new Date(task.deadline).getTime() - Date.now()) / 60000))}p hátra)`
                              : "Nincs határidő"}
                          </Text>
                        </XStack>

                        <Button
                          marginTop="$2"
                          size="$4"
                          theme="blue"
                          disabled={isAssigning || !syncStatus.isOnline}
                          onPress={() => handleTakeTask(task)}
                        >
                          <Text fontWeight="600">
                            {isAssigning ? "Felvétel folyamatban..." : "Felveszem"}
                          </Text>
                        </Button>
                      </YStack>
                    </Card>
                  );
                })}
              </YStack>
            )}
          </YStack>
        </YStack>
      </ScrollView>
    </YStack>
  );
}
