/**
 * Root Layout (_layout.tsx)
 * 
 * This is the entry point for your app's navigation structure.
 * It wraps all screens and handles global app setup.
 * 
 * WHAT HAPPENS HERE:
 * 1. Splash screen management (shows/hides loading screen)
 * 2. Status bar configuration (controls the top bar on device)
 * 3. Navigation setup (Stack navigator wraps all routes)
 * 
 * HOW TO ADD GLOBAL FEATURES:
 * - Font loading: Add useFonts hook
 * - Authentication: Add auth context provider
 * - State management: Wrap with Redux/Context providers
 * - Analytics: Initialize tracking here
 * 
 * NAVIGATION STRUCTURE:
 * - Stack: The root navigator (allows push/pop screens)
 * - (tabs): A screen group that contains tab navigation
 *   - This special (parentheses) syntax creates a layout route
 *   - See app/(tabs)/_layout.tsx for tab configuration
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from '@/hooks';

// Prevent auto-hiding the splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    // Hide splash screen after a short delay
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
    }, 100);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
