import { Stack } from 'expo-router';

export default function MemoryLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[houseId]" />
    </Stack>
  );
}
