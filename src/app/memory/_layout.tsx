import { Stack } from 'expo-router';

import { MemoryProvider } from '@/context/memory-context';

export default function MemoryLayout() {
  return (
    <MemoryProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="[houseId]" />
      </Stack>
    </MemoryProvider>
  );
}
