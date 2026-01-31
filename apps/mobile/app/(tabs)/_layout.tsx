/**
 * Tab Navigation Layout
 * 
 * Configures the bottom tab bar navigation for the app.
 * This creates the main navigation pattern users see at the bottom.
 * 
 * HOW TO ADD A NEW TAB:
 * 1. Create a new file in app/(tabs)/ (e.g., settings.tsx)
 * 2. Add a new <Tabs.Screen> component below
 * 3. Configure the tab's title and icon
 * 4. The file name becomes the route name automatically
 * 
 * EXAMPLE - Adding a Settings Tab:
 * <Tabs.Screen
 *   name="settings"  // Must match filename: settings.tsx
 *   options={{
 *     title: 'Settings',
 *     tabBarIcon: ({ focused }) => (
 *       <TabIcon focused={focused} emoji="⚙️" />
 *     ),
 *   }}
 * />
 * 
 * TAB BAR CUSTOMIZATION:
 * - Change colors in screenOptions
 * - Modify TabIcon component for different icon styles
 * - Add badges, hide tabs, or customize per-tab styles
 * 
 * CURRENT TABS:
 * - Home (index.tsx): Dashboard and overview
 * - Items (items.tsx): Inventory item list
 * - Profile (profile.tsx): User settings and info
 */

import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useColorScheme } from '@/hooks';
import { Colors } from '@/constants';

function TabIcon({ focused, emoji }: { focused: boolean; emoji: string }) {
  return (
    <Text style={{ fontSize: 24, opacity: focused ? 1 : 0.6 }}>{emoji}</Text>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="🏠" />
          ),
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: 'Items',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="📦" />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused} emoji="👤" />
          ),
        }}
      />
    </Tabs>
  );
}
