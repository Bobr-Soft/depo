import { TamaguiProvider } from "@repo/ui";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { useHeaderStyles } from "@/constants";
import { isAuthenticated } from "@/services/auth";
import { getToken, getApiUrl, buildApiUrl, setUserRole } from "@/services/secureStorage";
import { initializeSyncService, cleanupSyncService } from "@/services/sync";
import { useAutoSync } from "@/hooks";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const headerStyles = useHeaderStyles();

  // Auto-sync on network reconnection
  useAutoSync();

  useEffect(() => {
    async function init() {
      const authed = await isAuthenticated();
      if (!authed) {
        router.replace('/login');
      } else {
        // Refresh role from server to catch DB-side role changes
        try {
          const [token, apiUrl] = await Promise.all([getToken(), getApiUrl()]);
          if (token && apiUrl) {
            const meRes = await fetch(buildApiUrl(apiUrl, '/me'), {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (meRes.ok) {
              const meData = await meRes.json();
              const serverRole = meData?.user?.role ?? meData?.user?.dbUser?.role ?? '';
              if (serverRole) {
                await setUserRole(serverRole);
              }
            }
          }
        } catch (e) {
          // Non-critical — role will still be the one from last login
        }
        // Initialize sync service for authenticated users
        try {
          await initializeSyncService();
        } catch (error) {
          console.error('Failed to initialize sync service:', error);
        }
      }
      const timer = setTimeout(() => SplashScreen.hideAsync(), 100);
      return () => clearTimeout(timer);
    }
    init();

    // Cleanup on unmount
    return () => {
      cleanupSyncService().catch((error) => {
        console.error('Failed to cleanup sync service:', error);
      });
    };
  }, []);

  return (
    <TamaguiProvider>
      <Stack
        screenOptions={headerStyles}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="redirect" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, title: "Főoldal" }} />
        <Stack.Screen
          name="inbound"
          options={{
            title: "Bevételezés",
            headerShown: true,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="picking/index"
          options={{
            title: "Komissiózás",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="scanner"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="edit"
          options={{
            title: "Szerkesztés",
            headerShown: true,
            gestureEnabled: false,
          }}
        />
        <Stack.Screen
          name="admin"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/users"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/inventory"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/tasks"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/system"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/reports"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor/tasks"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor/workers"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor/shortages"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor/damages"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="supervisor/stats"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="admin/categories"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="damage-report"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="auto" />
    </TamaguiProvider>
  );
}
