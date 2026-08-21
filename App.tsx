import { NavigationContainer } from '@react-navigation/native';
import { useEffect, useState, type Ref } from 'react';
import {
  createBottomTabNavigator,
  type BottomTabBarButtonProps,
} from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Linking,
  Pressable,
  type PressableProps,
  StatusBar,
  StyleSheet,
  Text,
  type View,
} from 'react-native';
import Config from 'react-native-config';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '@/app/index';
import ItemsScreen from '@/app/items';
import BoxesScreen from '@/app/boxes';
import SearchScreen from '@/app/search';
import StoragePhotoScreen from '@/app/storage/[photoId]';
import TaskTimelineScreen from '@/app/task-timeline';
import { CollaborationOnboardingScreen } from '@/app/collaboration-onboarding';
import { JoinProjectScreen } from '@/app/join-project';
import { parseInvitationUrl } from '@/features/collaboration/invite-links';
import { LoadingScreen } from '@/components/ui-kit';
import { AppColors, AppRadius, AppShadow } from '@/constants/app-theme';
import { MovingProvider } from '@/context/moving-context';
import { SessionProvider, useSession } from '@/context/session-context';
import { SyncProvider } from '@/context/sync-context';
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
    </Tabs.Navigator>
  );
}

function useInvitationToken(): string | null {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const handleUrl = (url: string | null) => {
      if (!url) return;
      const inviteBaseUrl = Config.INVITE_BASE_URL;
      if (!inviteBaseUrl) return;
      const parsed = parseInvitationUrl(url, inviteBaseUrl);
      if (parsed) setToken(parsed.token);
    };

    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', event => handleUrl(event.url));
    return () => subscription.remove();
  }, []);

  return token;
}

function RootGate() {
  const { status, currentProjectId } = useSession();
  const invitationToken = useInvitationToken();
  const [inviteDismissed, setInviteDismissed] = useState(false);

  if (status === 'bootstrapping') {
    return <LoadingScreen label="正在准备你的搬家项目…" />;
  }

  if (invitationToken && !inviteDismissed) {
    return (
      <JoinProjectScreen
        token={invitationToken}
        onFinished={() => setInviteDismissed(true)}
      />
    );
  }

  if (status === 'needsOnboarding' || status === 'offlineWithoutIdentity' || status === 'retryable') {
    return <CollaborationOnboardingScreen />;
  }

  return (
    <SyncProvider projectId={currentProjectId ?? 'local'}>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="MainTabs" component={MainTabs} />
          <RootStack.Screen name="StoragePhoto" component={StoragePhotoScreen} />
          <RootStack.Screen name="TaskTimeline" component={TaskTimelineScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </SyncProvider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <MovingProvider>
        <StatusBar barStyle="dark-content" />
        <RootGate />
      </MovingProvider>
    </SessionProvider>
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
