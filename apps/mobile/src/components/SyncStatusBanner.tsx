import React from 'react';
import { XStack, YStack, Text, Card, Button } from '@repo/ui';
import { RefreshCw, AlertTriangle, Wifi, WifiOff, Trash2 } from '@tamagui/lucide-icons';
import { useSyncStatus } from '@/hooks/useSync';
import { forceRefresh } from '@/services/sync';
import { clearDeadLetterQueue } from '@/services/database';
import { Alert } from 'react-native';

/**
 * Compact banner showing pending/dead-letter sync diagnostics.
 * Drop into any screen that benefits from sync visibility.
 */
export function SyncStatusBanner() {
  const status = useSyncStatus();
  const [isSyncing, setIsSyncing] = React.useState(false);

  const hasPending = status.pendingOperations > 0;
  const hasDeadLetter = status.deadLetterOperations > 0;
  const showBanner = !status.isOnline || hasPending || hasDeadLetter;

  if (!showBanner) return null;

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await forceRefresh();
      if (!result.success) {
        Alert.alert('Szinkronizáció', result.error ?? 'Nem sikerült szinkronizálni.');
      }
    } catch {
      Alert.alert('Szinkronizáció', 'Hiba történt.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearDeadLetter = () => {
    Alert.alert(
      'Hibás műveletek törlése',
      `${status.deadLetterOperations} véglegesen sikertelen művelet van. Biztosan törlöd? Az adatok nem állíthatók helyre.`,
      [
        { text: 'Mégse', style: 'cancel' },
        {
          text: 'Törlés',
          style: 'destructive',
          onPress: () => clearDeadLetterQueue().catch(() => {}),
        },
      ]
    );
  };

  return (
    <YStack paddingHorizontal="$4" gap="$2" marginBottom="$2">
      {/* Offline indicator */}
      {!status.isOnline && (
        <Card backgroundColor="$red2" padding="$2" borderRadius="$3" borderWidth={1} borderColor="$red5">
          <XStack alignItems="center" gap="$2">
            <WifiOff size={16} color="$red10" />
            <Text fontSize={12} fontWeight="600" color="$red10">Offline mód</Text>
          </XStack>
        </Card>
      )}

      {/* Pending operations */}
      {hasPending && (
        <Card backgroundColor="$orange2" padding="$2" borderRadius="$3" borderWidth={1} borderColor="$orange5">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2" flex={1}>
              <RefreshCw size={14} color="$orange10" />
              <Text fontSize={12} fontWeight="600" color="$orange10">
                {status.pendingOperations} függő szinkronizáció
              </Text>
            </XStack>
            {status.isOnline && (
              <Button size="$2" theme="orange" disabled={isSyncing} onPress={handleSync}>
                <Text fontSize={11}>{isSyncing ? '...' : 'Szinkron'}</Text>
              </Button>
            )}
          </XStack>
        </Card>
      )}

      {/* Dead-letter operations */}
      {hasDeadLetter && (
        <Card backgroundColor="$red2" padding="$2" borderRadius="$3" borderWidth={1} borderColor="$red5">
          <XStack justifyContent="space-between" alignItems="center">
            <XStack alignItems="center" gap="$2" flex={1}>
              <AlertTriangle size={14} color="$red10" />
              <Text fontSize={12} fontWeight="600" color="$red10">
                {status.deadLetterOperations} sikertelen művelet
              </Text>
            </XStack>
            <Button size="$2" theme="red" onPress={handleClearDeadLetter}>
              <Trash2 size={12} />
            </Button>
          </XStack>
        </Card>
      )}
    </YStack>
  );
}
