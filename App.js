import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, StatusBar } from 'react-native';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { initNotifications, registerForPushNotificationsAsync } from './src/services/notifications';

export default function App() {
  useEffect(() => {
    const cleanUp = initNotifications();
    registerForPushNotificationsAsync();
    return cleanUp;
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <AuthProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0B0B0F" />
        <RootNavigator />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
