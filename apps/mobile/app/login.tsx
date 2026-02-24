import { useState, useEffect, SetStateAction } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { YStack, XStack, Text, Input, Button, H2, Spinner, ScrollView } from '@repo/ui';
import { LogIn } from '@tamagui/lucide-icons';
import { router } from 'expo-router';
import { login, logout } from '@/services/auth';
import { initializeSyncService } from '@/services/sync';

const COLD_START_THRESHOLD = 10000; // Show hint after 10 seconds

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showColdStartHint, setShowColdStartHint] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (loading) {
      setElapsedTime(0);
      setShowColdStartHint(false);
      interval = setInterval(() => {
        setElapsedTime((prev) => {
          const next = prev + 1000;
          if (next >= COLD_START_THRESHOLD) {
            setShowColdStartHint(true);
          }
          return next;
        });
      }, 1000);
    }
    return () => {
      if (interval !== null) clearInterval(interval);
    };
  }, [loading]);

  async function handleLogin() {
    const trimmed = email.trim();

    if (!trimmed) {
      setError('Kérjük adja meg az e-mail címét.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      setError('Kérjük adjon meg érvényes e-mail címet.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await login(trimmed);

    setLoading(false);

    if (result.success) {
      try {
        await initializeSyncService();
      } catch (error) {
        console.error('Failed to initialize sync service after login:', error);
      }
      setEmail('');
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Ismeretlen hiba történt. Kérjük próbálja újra később.');
    }
  }

  async function handleResetAuth() {
    await logout();
    setError(null);
    setEmail('');
  }

  const formatTime = (ms: number) => {
    return Math.ceil(ms / 1000);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView flex={1} backgroundColor="$background">
        <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" gap="$6" minHeight="100%">

          {/* Header */}
          <YStack gap="$3" alignItems="center">
            <YStack width={60} height={60} borderRadius="$4" backgroundColor="$color12" justifyContent="center" alignItems="center">
              <Text fontSize={32}>📦</Text>
            </YStack>
            <YStack gap="$1" alignItems="center">
              <H2 color="$color12">Depo</H2>
              <Text fontSize={14} color="$color10">Bejelentkezés az alkalmazásba</Text>
            </YStack>
          </YStack>

          {/* Form */}
          <YStack width="100%" gap="$3" maxWidth={420}>

            {/* Email Label */}
            <YStack gap="$2">
              <Text fontSize={12} fontWeight="600" color="$color11" textTransform="uppercase">
                E-mail cím
              </Text>
              <Input
                placeholder="example@example.com"
                value={email}
                onChangeText={(text: SetStateAction<string>) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                editable={!loading}
                size="$4"
              />
            </YStack>

            {/* Error Message */}
            {error && (
              <YStack padding="$3" borderRadius="$3" backgroundColor="$red3" borderLeftWidth={3} borderLeftColor="$red10" gap="$1">
                <Text fontSize={13} color="$red10" fontWeight="500">
                  {error}
                </Text>
              </YStack>
            )}

            {/* Cold Start Hint */}
            {showColdStartHint && loading && (
              <YStack padding="$3" borderRadius="$3" backgroundColor="$blue3" gap="$2">
                <Text fontSize={12} fontWeight="600" color="$blue11">
                  ℹ️ Első csatlakozás
                </Text>
                <Text fontSize={13} color="$blue11" lineHeight={18}>
                  Az alkalmazás szervere indulást követően csatlakozik. Ez lehet, hogy eltart még {Math.max(0, 60 - formatTime(elapsedTime))} másodpercig.
                </Text>
                <XStack gap="$2" alignItems="center" marginTop="$2">
                  <YStack flex={1} height={3} borderRadius="$2" backgroundColor="$blue8" />
                  <Text fontSize={12} fontWeight="600" color="$blue11" minWidth={30}>
                    {formatTime(elapsedTime)}s
                  </Text>
                </XStack>
              </YStack>
            )}

            {/* Login Button */}
            <Button
              size="$5"
              theme={loading || !email.trim() ? 'gray' : 'blue'}
              onPress={handleLogin}
              disabled={loading || !email.trim()}
              pressStyle={{ scale: 0.96 }}
            >
              <XStack gap="$2" alignItems="center" justifyContent="center">
                {loading && <Spinner size="small" />}
                <Text fontWeight="600">{loading ? 'Bejelentkezés...' : 'Bejelentkezés'}</Text>
              </XStack>
            </Button>

            {/* Reset Button */}
            <Button
              size="$4"
              theme="gray"
              onPress={handleResetAuth}
              disabled={loading}
              pressStyle={{ scale: 0.96 }}
            >
              <Text fontWeight="500">Adatok törlése</Text>
            </Button>

          </YStack>

          {/* Footer */}
          <Text fontSize={12} color="$color9">
            Verzió 1.0.0
          </Text>
        </YStack>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
