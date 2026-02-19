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

import { Tabs } from "expo-router";
import { Home, Package, User, ScanBarcode, ListTodo } from "@tamagui/lucide-icons";
import { useRouter } from "expo-router";
import { Button } from "@repo/ui";
import { Colors, useHeaderColors } from "@/constants";
import { useColorScheme } from "@/hooks";

export default function TabLayout() {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const { backgroundColor, textColor } = useHeaderColors();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: textColor,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: backgroundColor,
          borderTopColor: colors.border,
        },
        headerShown: true,
        headerStyle: {
          backgroundColor: backgroundColor,
        },
        headerTintColor: textColor,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Főoldal",
          tabBarIcon: ({ color }) => <Home size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="items"
        options={{
          title: "Feladatok",
          tabBarIcon: ({ color }) => <ListTodo size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <User size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
