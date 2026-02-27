import React, { useState } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet, NativeModules } from 'react-native';
import AzureAuth from 'react-native-azure-auth';

interface AzureAuthComponentProps {
  onSuccess?: (token: string) => void;
  onError?: (error: Error) => void;
}

const clientId = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
const tenantId = process.env.EXPO_PUBLIC_AZURE_TENANT_ID;
const redirectUri = process.env.EXPO_PUBLIC_AZURE_REDIRECT_URI;

export const AzureAuthComponent: React.FC<AzureAuthComponentProps> = ({
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      if (!clientId || !tenantId || !redirectUri) {
        throw new Error('Azure auth is not configured. Set EXPO_PUBLIC_AZURE_CLIENT_ID, EXPO_PUBLIC_AZURE_TENANT_ID and EXPO_PUBLIC_AZURE_REDIRECT_URI.');
      }

      if (!NativeModules.AzureAuth) {
        throw new Error('AzureAuth native module is unavailable. Run the app with a development build instead of Expo Go.');
      }

      const azureAuth = new AzureAuth({
        clientId,
        tenant: tenantId,
        redirectUri,
      });

      setLoading(true);
      const credentials = await azureAuth.webAuth.authorize({
        scope: 'openid profile email User.Read',
      });
      if (credentials.accessToken) {
        onSuccess?.(credentials.accessToken);
      }
    } catch (error) {
      onError?.(error as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Sign in with Azure</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  button: {
    backgroundColor: '#0078D4',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
