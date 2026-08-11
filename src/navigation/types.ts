import type { NavigatorScreenParams } from '@react-navigation/native';

export type MainTabParamList = {
  Home: undefined;
  Items: undefined;
  Boxes: undefined;
  Search: undefined;
  Memory: undefined;
};

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Rooms: { houseId: string };
  RoomEditor: { roomId: string };
  StoragePhoto: { photoId: string };
};
