// ============================================================
// notifications.js — Expo Notifications and FCM Configuration Service
// Handles permission requests, FCM token generation, and local foreground banners
// ============================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { userAPI } from './api';

// Configure default notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const initNotifications = () => {
  // Listener for received notifications
  const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
    console.log('[NotificationService] Foreground notification received:', notification);
  });

  // Listener for user tapping on notification
  const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
    console.log('[NotificationService] User interacted with notification:', response);
  });

  return () => {
    receivedSubscription.remove();
    responseSubscription.remove();
  };
};

export const registerForPushNotificationsAsync = async () => {
  let token;
  if (Platform.OS === 'web') {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[NotificationService] Failed to get push token for push notification!');
    return null;
  }

  try {
    token = (await Notifications.getDevicePushTokenAsync()).data;
    console.log('[NotificationService] Device Push Token:', token);

    // Stub: send to backend if user is authenticated
    // await userAPI.updateFcmToken({ fcmToken: token });
  } catch (err) {
    console.warn('[NotificationService] Error getting push token:', err.message);
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  return token;
};

export const showLocalNotification = async (title, body, data = {}) => {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
      },
      trigger: null, // deliver immediately
    });
  } catch (err) {
    console.warn('[NotificationService] Error scheduling local notification:', err.message);
  }
};
