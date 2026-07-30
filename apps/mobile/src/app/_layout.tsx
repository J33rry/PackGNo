import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AuthProvider } from '@/components/auth-provider';
import { NotificationRouter } from '@/components/notification-router';
import { configureNotificationHandler } from '@/lib/push';

SplashScreen.preventAutoHideAsync();

// Show pushes even when the app is in the foreground.
configureNotificationHandler();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <NotificationRouter />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="trips" options={{ headerShown: true, title: 'Your trips' }} />
          <Stack.Screen name="trip/[tripId]" options={{ headerShown: true }} />
        </Stack>
      </AuthProvider>
    </ThemeProvider>
  );
}
