import { useState } from 'react';
import { KeyboardAvoidingView, Platform, NativeModules } from 'react-native';
import { YStack, XStack, Text, Button, H2, Spinner, ScrollView, Input } from '@repo/ui';
import { router } from 'expo-router';
import { login } from '@/services/auth';
import { deleteUserPhotoUrl, setUserPhotoUrl } from '@/services/secureStorage';
import { initializeSyncService } from '@/services/sync';
import AzureAuth from 'react-native-azure-auth';
import Constants from 'expo-constants';

const azureClientId = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
const azureTenantId = process.env.EXPO_PUBLIC_AZURE_TENANT_ID;
const azureRedirectUri = process.env.EXPO_PUBLIC_AZURE_REDIRECT_URI;

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function fetchGraphPhotoDataUrl(accessToken: string): Promise<string | null> {
  const photoSizes = ['96x96', '64x64', '48x48'];

  for (const size of photoSizes) {
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/photos/${size}/$value`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        continue;
      }

      const contentType = response.headers.get('content-type') ?? 'image/jpeg';
      const blob = await response.blob();

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Nem sikerült a profilképet adat URL-re konvertálni.'));
          }
        };
        reader.onerror = () => reject(new Error('Nem sikerült a profilkép olvasása.'));
        reader.readAsDataURL(new Blob([blob], { type: contentType }));
      });

      return dataUrl;
    } catch (error) {
      console.warn(`Failed to load Graph profile photo (${size}):`, error);
    }
  }

  return null;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [azureLoading, setAzureLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSuccessfulLogin() {
    try {
      await initializeSyncService();
    } catch (error) {
      console.error('Failed to initialize sync service after login:', error);
    }
    router.replace('/(tabs)');
  }

  async function handleAzureLogin() {
    setAzureLoading(true);
    setError(null);

    try {
      const isExpoGo = Constants.appOwnership === 'expo';

      if (isExpoGo || !NativeModules.AzureAuth) {
        const bypassEmail = email.trim();

        if (!bypassEmail || !isValidEmail(bypassEmail)) {
          throw new Error('Expo Go bypasshoz adj meg egy érvényes e-mail címet.');
        }

        const bypassResult = await login(bypassEmail);
        if (!bypassResult.success) {
          throw new Error(bypassResult.error ?? 'Sikertelen Expo Go bypass bejelentkezés.');
        }

        await deleteUserPhotoUrl();

        await handleSuccessfulLogin();
        return;
      }

      if (!azureClientId || !azureTenantId || !azureRedirectUri) {
        throw new Error('Microsoft bejelentkezés nincs beállítva. Ellenőrizd az EXPO_PUBLIC_AZURE_* változókat.');
      }

      const azureAuth = new AzureAuth({
        clientId: azureClientId,
        tenant: azureTenantId,
        redirectUri: azureRedirectUri,
      });

      const tokens = await azureAuth.webAuth.authorize({
        scope: 'openid profile email User.Read',
      });

      if (!tokens.accessToken) {
        throw new Error('Nem érkezett hozzáférési token a Microsofttól.');
      }

      const profile = await azureAuth.auth.msGraphRequest({
        token: tokens.accessToken,
        path: '/me',
      });

      const azureEmail = profile?.mail || profile?.userPrincipalName;
      if (!azureEmail || typeof azureEmail !== 'string') {
        throw new Error('A Microsoft-fiókhoz nem tartozik e-mail cím.');
      }

      const result = await login(azureEmail);

      if (!result.success) {
        throw new Error(result.error ?? 'Sikertelen backend bejelentkezés Microsoft azonosítás után.');
      }

      const photoDataUrl = await fetchGraphPhotoDataUrl(tokens.accessToken);
      if (photoDataUrl) {
        try {
          await setUserPhotoUrl(photoDataUrl);
        } catch (error) {
          console.warn('Profilkép mentése sikertelen, fallback avatart használunk:', error);
          await deleteUserPhotoUrl();
        }
      } else {
        await deleteUserPhotoUrl();
      }

      await handleSuccessfulLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen Microsoft bejelentkezés.');
    } finally {
      setAzureLoading(false);
    }
  }

  async function handleEmailLogin() {
    const trimmed = email.trim();

    if (!trimmed || !isValidEmail(trimmed)) {
      setError('Kérlek adj meg egy érvényes e-mail címet.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await login(trimmed);
      if (!result.success) {
        throw new Error(result.error ?? 'Sikertelen bejelentkezés.');
      }

      await deleteUserPhotoUrl();

      await handleSuccessfulLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sikertelen bejelentkezés.');
    } finally {
      setLoading(false);
    }
  }

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

            <YStack gap="$2">
              <Text fontSize={12} fontWeight="600" color="$color11" textTransform="uppercase">
                E-mail cím
              </Text>
              <Input
                placeholder="valaki@domain.hu"
                value={email}
                onChangeText={(text: string) => {
                  setEmail(text);
                  if (error) setError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                returnKeyType="done"
                onSubmitEditing={handleEmailLogin}
                editable={!loading && !azureLoading}
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

            {/* Azure Login Button */}
            <Button
              size="$5"
              theme={loading ? 'gray' : 'blue'}
              onPress={handleEmailLogin}
              disabled={loading || azureLoading}
              pressStyle={{ scale: 0.96 }}
            >
              <XStack gap="$2" alignItems="center" justifyContent="center">
                {loading && <Spinner size="small" />}
                <Text fontWeight="600">{loading ? 'Bejelentkezés...' : 'Bejelentkezés'}</Text>
              </XStack>
            </Button>

            {/* Microsoft Login Button */}
            <Button
              size="$5"
              theme={azureLoading ? 'gray' : 'blue'}
              onPress={handleAzureLogin}
              disabled={loading || azureLoading}
              pressStyle={{ scale: 0.96 }}
            >
              <XStack gap="$2" alignItems="center" justifyContent="center">
                {azureLoading && <Spinner size="small" />}
                <Text fontWeight="600">{azureLoading ? 'Microsoft bejelentkezés...' : 'Bejelentkezés Microsofttal'}</Text>
              </XStack>
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
