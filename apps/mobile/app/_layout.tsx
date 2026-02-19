import { TamaguiProvider } from "@repo/ui";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import "react-native-reanimated";
import { useHeaderStyles } from "@/constants";
import { isAuthenticated } from "@/services/auth";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const headerStyles = useHeaderStyles();

  useEffect(() => {
    async function init() {
      const authed = await isAuthenticated();
      if (!authed) {
        router.replace('/login');
      }
      const timer = setTimeout(() => SplashScreen.hideAsync(), 100);
      return () => clearTimeout(timer);
    }
    init();
  }, []);

  return (
    <TamaguiProvider>
      <Stack
        screenOptions={headerStyles}
      >
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="inbound"
          options={{
            title: "Bevételezés",
            headerShown: true,
          }}
        />
        <Stack.Screen
          name="picking"
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
          }}
        />
      </Stack>
      <StatusBar style="auto" />
    </TamaguiProvider>
  );
}
