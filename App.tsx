import { NavigationContainer } from '@react-navigation/native';
import type { Ref } from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Pressable,
  type PressableProps,
  StatusBar,
  StyleSheet,
  Text,
  type View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '@/app/index';
import ItemsScreen from '@/app/items';
import BoxesScreen from '@/app/boxes';
import SearchScreen from '@/app/search';
import MemoryHomeScreen from '@/app/memory/index';
import RoomsScreen from '@/app/memory/[houseId]/index';
import RoomEditorScreen from '@/app/memory/[houseId]/[roomId]';
import StoragePhotoScreen from '@/app/storage/[photoId]';
import { AppColors, AppRadius, AppShadow } from '@/constants/app-theme';
import { MemoryProvider } from '@/context/memory-context';
import { MovingProvider } from '@/context/moving-context';
import {
  getTabBarLayout,
  getTabItemPresentation,
  getTabPresentation,
} from '@/navigation/tab-presentation';
import type { MainTabParamList, RootStackParamList } from '@/navigation/types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();

function PhysicalTabBarButton({
  href: _href,
  hoverEffect: _hoverEffect,
  pressColor: _pressColor,
  pressOpacity: _pressOpacity,
  onPress,
  ref: buttonRef,
  style,
  ...props
}: BottomTabBarButtonProps) {
  const selected = props['aria-selected'] === true;

  return (
    <Pressable
      {...props}
      onPress={onPress as PressableProps['onPress']}
      ref={buttonRef as Ref<View>}
      style={[
        style,
        styles.tabBarButton,
        getTabItemPresentation(selected),
      ]}
    />
  );
}

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarLayout = getTabBarLayout(insets.bottom);

  return (
    <Tabs.Navigator
      screenOptions={({ route }) => {
        const presentation = getTabPresentation(route.name);

        return {
          headerShown: false,
          tabBarActiveBackgroundColor: AppColors.primary,
          tabBarInactiveBackgroundColor: 'transparent',
          tabBarActiveTintColor: AppColors.white,
          tabBarInactiveTintColor: AppColors.textMuted,
          tabBarStyle: [styles.tabBar, tabBarLayout],
          tabBarButton: (props) => <PhysicalTabBarButton {...props} />,
          tabBarItemStyle: styles.tabBarItem,
          tabBarLabelStyle: styles.tabBarLabel,
          tabBarLabel: presentation.label,
          tabBarIcon: ({ color }) => (
            <Text style={[styles.tabIcon, { color }]}>
              {presentation.glyph}
            </Text>
          ),
        };
      }}>
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
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopLeftRadius: AppRadius.page,
    borderTopRightRadius: AppRadius.page,
    borderCurve: 'continuous',
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    backgroundColor: AppColors.white,
    ...AppShadow.ceramic,
  },
  tabBarItem: {
    minHeight: 44,
    marginHorizontal: 4,
  },
  tabBarButton: {
    flex: 1,
    borderRadius: AppRadius.control,
    borderCurve: 'continuous',
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
