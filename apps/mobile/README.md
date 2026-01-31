# Depo Mobile App

A modern React Native inventory management app built with Expo Router.

## 📁 Project Structure

```
apps/mobile/
├── app/                    # File-based routing (Expo Router)
│   ├── (tabs)/            # Tab navigation group
│   │   ├── _layout.tsx    # Tab navigator configuration
│   │   ├── index.tsx      # Home screen
│   │   ├── items.tsx      # Items screen
│   │   └── profile.tsx    # Profile screen
│   └── _layout.tsx        # Root layout
├── src/
│   ├── components/        # Reusable components
│   │   └── ui/           # UI components (Button, Card, Text, View)
│   ├── constants/        # App constants and theme
│   │   ├── theme.ts      # Colors, spacing, typography
│   │   └── config.ts     # App configuration
│   └── hooks/            # Custom React hooks
│       ├── useColorScheme.ts
│       └── useThemeColor.ts
├── assets/               # Images, fonts, etc.
└── app.json             # Expo configuration
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Yarn package manager
- Expo CLI
- iOS Simulator (for iOS development) or Android Studio (for Android)

### Installation

```bash
cd apps/mobile
yarn install
```

### Development

```bash
# Start the development server
yarn start

# Run on iOS simulator
yarn ios

# Run on Android emulator
yarn android

# Run on web
yarn web
```

## 🎨 Design System

### Theme
The app uses a comprehensive theme system with light and dark mode support:
- **Colors**: Primary, secondary, background, text, etc.
- **Spacing**: Consistent spacing scale (xs, sm, md, lg, xl, xxl)
- **Typography**: Font sizes and weights
- **Border Radius**: Consistent corner radius values

### Components
All UI components are theme-aware and support light/dark mode:
- `<View>` - Themed container
- `<Text>` - Themed text with variants (title, heading, body, caption)
- `<Button>` - Button with variants (primary, secondary, outline)
- `<Card>` - Card container component

## 🧭 Navigation

Using Expo Router's file-based routing with tab navigation:
- **Home**: Dashboard with quick actions and overview
- **Items**: Inventory items list
- **Profile**: User profile and settings

## 📝 Development Guidelines

### Path Aliases
Use `@/` alias for imports from `src/`:
```typescript
import { Button, Text } from '@/components';
import { Colors, Spacing } from '@/constants';
import { useColorScheme } from '@/hooks';
```

### Component Structure
- Keep components small and focused
- Use TypeScript for type safety
- Export types alongside components
- Use the theme system for styling

### Styling
- Use StyleSheet.create() for styles
- Reference theme constants instead of hardcoded values
- Support both light and dark modes

## 🔧 Configuration

### TypeScript
Path aliases are configured in `tsconfig.json`:
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Expo Router
File-based routing is automatically handled by Expo Router based on the `app/` directory structure.

## 📦 Key Dependencies

- **expo-router**: File-based navigation
- **react-native**: Core framework
- **@expo/vector-icons**: Icon library
- **expo-status-bar**: Status bar management
- **TypeScript**: Type safety

## 🎯 Next Steps

- [ ] Add authentication flow
- [ ] Implement API integration
- [ ] Add item creation/editing screens
- [ ] Implement barcode scanning
- [ ] Add search and filtering
- [ ] Set up state management (if needed)
- [ ] Add offline support
- [ ] Implement push notifications
