import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Colors } from '../theme/colors';

// Main Screens
import BottomTabs from './BottomTabs';
import ChatScreen from '../screens/chat/ChatScreen';
import UserProfileScreen from '../screens/profile/UserProfileScreen';
import SearchScreen from '../screens/chat/SearchScreen';
import NewGroupScreen from '../screens/chat/NewGroupScreen';
import GroupInfoScreen from '../screens/chat/GroupInfoScreen';
import MediaViewerScreen from '../screens/chat/MediaViewerScreen';

// Settings Screens
import ChangePasswordScreen from '../screens/settings/ChangePasswordScreen';
import PrivacySettingsScreen from '../screens/settings/PrivacySettingsScreen';
import StarredMessagesScreen from '../screens/settings/StarredMessagesScreen';

const Stack = createNativeStackNavigator();

const screenOptions = {
  headerShown: false,
  contentStyle: { backgroundColor: Colors.bg.primary },
  animation: 'slide_from_right',
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

export default function MainStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Tabs" component={BottomTabs} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="Search" component={SearchScreen} />
      <Stack.Screen name="NewGroup" component={NewGroupScreen} />
      <Stack.Screen name="GroupInfo" component={GroupInfoScreen} />
      <Stack.Screen
        name="MediaViewer"
        component={MediaViewerScreen}
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="PrivacySettings" component={PrivacySettingsScreen} />
      <Stack.Screen name="StarredMessages" component={StarredMessagesScreen} />
    </Stack.Navigator>
  );
}
