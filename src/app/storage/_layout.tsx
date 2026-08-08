import { Stack } from 'expo-router';

export default function StorageLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="[photoId]" />
    </Stack>
  );
}
