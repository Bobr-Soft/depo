import React, { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, Text, ActivityIndicator, StyleSheet } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri, useAuthRequest } from 'expo-auth-session';

interface AzureAuthComponentProps {
  onSuccess?: (token: string) => void;
  onError?: (error: Error) => void;
}

const clientId = process.env.EXPO_PUBLIC_AZURE_CLIENT_ID;
const tenantId = process.env.EXPO_PUBLIC_AZURE_TENANT_ID;

WebBrowser.maybeCompleteAuthSession();

export const AzureAuthComponent: React.FC<AzureAuthComponentProps> = ({
  onSuccess,
  onError,
}) => {
  const [loading, setLoading] = useState(false);

  const discovery = useMemo(() => {
    if (!tenantId) {
      return null;
    }

    return {
      authorizationEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
      tokenEndpoint: `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    };
  }, []);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: clientId ?? '',
      scopes: ['openid', 'profile', 'email', 'offline_access'],
      responseType: 'token',
      redirectUri: makeRedirectUri({
        scheme: 'depomobile',
        path: 'redirect',
      }),
      extraParams: {
        prompt: 'select_account',
      },
    },
    discovery
  );

  useEffect(() => {
    if (!response) {
      return;
    }

    if (response.type !== 'success') {
      setLoading(false);
      return;
    }

    const accessToken = response.authentication?.accessToken;
    if (!accessToken) {
      onError?.(new Error('No access token returned from Microsoft.'));
      setLoading(false);
      return;
    }

    onSuccess?.(accessToken);
    setLoading(false);
  }, [onError, onSuccess, response]);

  const handleLogin = async () => {
    try {
      if (!clientId || !tenantId) {
        throw new Error('Azure auth is not configured. Set EXPO_PUBLIC_AZURE_CLIENT_ID and EXPO_PUBLIC_AZURE_TENANT_ID.');
      }

      if (!request) {
        throw new Error('Microsoft auth request is not ready yet. Please try again.');
      }

      setLoading(true);
      const result = await promptAsync();
      if (result.type !== 'success') {
        setLoading(false);
      }
    } catch (error) {
      setLoading(false);
      onError?.(error as Error);
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
