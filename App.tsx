import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar, StyleSheet, Text } from 'react-native';

import HomeScreen from '@/app/index';
import ItemsScreen from '@/app/items';
import BoxesScreen from '@/app/boxes';
import SearchScreen from '@/app/search';
import MemoryHomeScreen from '@/app/memory/index';
import RoomsScreen from '@/app/memory/[houseId]/index';
import RoomEditorScreen from '@/app/memory/[houseId]/[roomId]';
import StoragePhotoScreen from '@/app/storage/[photoId]';
import { AppColors } from '@/constants/app-theme';
import { MemoryProvider } from '@/context/memory-context';
import { MovingProvider } from '@/context/moving-context';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

const tabIcons: Record<keyof MainTabParamList, string> = {
  Home: '⌂',
  Items: '◇',
  Boxes: '□',
  Search: '⌕',
  Memory: '◉',
};

const tabLabels: Record<keyof MainTabParamList, string> = {
  Home: '进度',
  Items: '物品',
  Boxes: '箱子',
  Search: '查找',
  Memory: '回忆',
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: AppColors.primary,
        tabBarInactiveTintColor: AppColors.textMuted,
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
        tabBarLabel: tabLabels[route.name],
        tabBarIcon: ({ color }) => (
          <Text style={[styles.tabIcon, { color }]}>{tabIcons[route.name]}</Text>
        ),
      })}>
      <Tabs.Screen name="Home" component={HomeScreen} />
      <Tabs.Screen name="Items" component={ItemsScreen} />
      <Tabs.Screen name="Boxes" component={BoxesScreen} />
      <Tabs.Screen name="Search" component={SearchScreen} />
      <Tabs.Screen name="Memory" component={MemoryHomeScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  return (
    <MovingProvider>
      <MemoryProvider>
        <StatusBar barStyle="dark-content" />
        <NavigationContainer>
          <RootStack.Navigator screenOptions={{ headerShown: false }}>
            <RootStack.Screen name="MainTabs" component={MainTabs} />
            <RootStack.Screen name="Rooms" component={RoomsScreen} />
            <RootStack.Screen name="RoomEditor" component={RoomEditorScreen} />
            <RootStack.Screen name="StoragePhoto" component={StoragePhotoScreen} />
          </RootStack.Navigator>
        </NavigationContainer>
      </MemoryProvider>
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
