import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Items: undefined;
  Boxes: undefined;
  Search: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  StoragePhoto: { photoId: string };
  TaskTimeline: undefined;
};
