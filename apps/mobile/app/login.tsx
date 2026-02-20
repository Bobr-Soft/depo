import { useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { YStack, Text, Input, Button, H2, Spinner } from '@repo/ui';
import { router } from 'expo-router';
import { login, logout } from '@/services/auth';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Kérjük adja meg az e-mail címét.');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await login(trimmed);

    setLoading(false);

    if (result.success) {
      router.replace('/(tabs)');
    } else {
      setError(result.error ?? 'Ismeretlen hiba történt.');
    }
  }

  async function handleResetAuth() {
    await logout();
    setError(null);
    setEmail('');
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <YStack flex={1} justifyContent="center" alignItems="center" padding="$6" backgroundColor="$background" gap="$5">
        <YStack gap="$2" alignItems="center">
          <H2 color="$color12">Depo</H2>
          <Text fontSize={14} color="$color10">Bejelentkezés</Text>
        </YStack>

        <YStack width="100%" gap="$3">
          <Input
            placeholder="E-mail cím"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            returnKeyType="done"
            onSubmitEditing={handleLogin}
            editable={!loading}
          />

          {error && (
            <Text fontSize={13} color="$red10" textAlign="center">
              {error}
            </Text>
          )}

          <Button
            theme="blue"
            size="$4"
            onPress={handleLogin}
            disabled={loading}
            pressStyle={{ scale: 0.97 }}
          >
            {loading ? <Spinner color="$color1" /> : <Text fontWeight="600" color="$color1">Bejelentkezés</Text>}
          </Button>

          <Button
            theme="gray"
            size="$4"
            onPress={handleResetAuth}
            disabled={loading}
            pressStyle={{ scale: 0.97 }}
          >
            <Text fontWeight="600">Reset Auth</Text>
          </Button>
        </YStack>
      </YStack>
    </KeyboardAvoidingView>
  );
}
