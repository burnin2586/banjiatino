import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text } from 'react-native';

import { AppColors } from '@/constants/app-theme';
import { MovingProvider } from '@/context/moving-context';

const tabIcons: Record<string, string> = {
  index: '⌂',
  items: '◇',
  boxes: '□',
  search: '⌕',
};

export default function RootLayout() {
  return (
    <MovingProvider>
      <StatusBar style="dark" />
      <Tabs
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: AppColors.primary,
          tabBarInactiveTintColor: AppColors.textMuted,
          tabBarStyle: styles.tabBar,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>{tabIcons[route.name] ?? '·'}</Text>
          ),
        })}>
        <Tabs.Screen name="index" options={{ title: '进度' }} />
        <Tabs.Screen name="items" options={{ title: '物品' }} />
        <Tabs.Screen name="boxes" options={{ title: '箱子' }} />
        <Tabs.Screen name="search" options={{ title: '查找' }} />
      </Tabs>
    </MovingProvider>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    height: 82,
    paddingTop: 8,
    paddingBottom: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AppColors.border,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  tabIcon: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 26,
  },
});
