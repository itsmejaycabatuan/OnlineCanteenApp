// app/admin/_layout.tsx
import { Stack } from "expo-router";

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="menu" />
      <Stack.Screen name="add-item" />
      <Stack.Screen name="edit-item" />
      <Stack.Screen name="students" />
      <Stack.Screen name="revenue" />
      <Stack.Screen name="reports" />
    </Stack>
  );
}