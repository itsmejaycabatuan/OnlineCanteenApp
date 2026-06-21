// app/_layout.tsx
import { useColorScheme } from '@/hooks/use-color-scheme';
import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from "../contexts/CartContext";
import { supabase } from '../lib/supabase';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  useEffect(() => {
    // ── handle deep link when app is already open ──────────────────────────
   const handleDeepLink = async (url: string) => {
  console.log("Deep link received:", url);

  if (url.includes("reset-password") || url.includes("type=recovery")) {
    try {
      const urlObj = new URL(url.replace("#", "?"));
      const accessToken  = urlObj.searchParams.get("access_token");
      const refreshToken = urlObj.searchParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        });

        if (!error) {
          router.push("/reset-password" as any);
        }
      } else {
        router.push("/reset-password" as any);
      }
    } catch (e) {
      console.error("Deep link error:", e);
      router.push("/reset-password" as any);
    }
  }
};

    // ── handle deep link when app opens FROM the link ──────────────────────
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        await handleDeepLink(initialUrl);
      }
    };

    handleInitialURL();

    // listen for links while app is open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  return (
    <CartProvider>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="index"           options={{ headerShown: false }} />
            <Stack.Screen name="login"           options={{ headerShown: false }} />
            <Stack.Screen name="register"        options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password"  options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)"          options={{ headerShown: false }} />
            <Stack.Screen name="admin"           options={{ headerShown: false }} />
            <Stack.Screen name="category/[name]" options={{ headerShown: false }} />
            <Stack.Screen name="modal"           options={{ presentation: 'modal', title: 'Modal' }} />
          </Stack>
          <StatusBar style="auto" />
        </ThemeProvider>
      </AuthProvider>
    </CartProvider>
  );
}