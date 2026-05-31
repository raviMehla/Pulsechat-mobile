import React, { useState, useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { View, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import { Colors } from '../theme/colors';
import AuthStack from './AuthStack';
import MainStack from './MainStack';
import { biometricsService } from '../services/biometrics';
import BiometricLockScreen from '../screens/auth/BiometricLockScreen';

const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color={Colors.brand.indigo} />
  </View>
);

const linking = {
  prefixes: ['msgapp://'],
  config: {
    screens: {
      Chat: 'chat/:chatId',
    },
  },
};

export default function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [checkingBiometrics, setCheckingBiometrics] = useState(true);
  const appState = useRef(AppState.currentState);
  const backgroundTimeRef = useRef(0);

  // Check on load if biometrics is enabled
  useEffect(() => {
    const initBiometricLock = async () => {
      if (isAuthenticated) {
        const enabled = await biometricsService.isBiometricsEnabled();
        setIsLocked(enabled);
      } else {
        setIsLocked(false);
      }
      setCheckingBiometrics(false);
    };
    initBiometricLock();
  }, [isAuthenticated]);

  // Handle AppState changes (lock on returning to foreground after 5 mins)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        if (isAuthenticated) {
          const enabled = await biometricsService.isBiometricsEnabled();
          if (enabled) {
            const elapsed = Date.now() - backgroundTimeRef.current;
            const FIVE_MINUTES_MS = 5 * 60 * 1000;
            if (elapsed > FIVE_MINUTES_MS) {
              setIsLocked(true);
            }
          }
        }
      } else if (nextAppState.match(/inactive|background/)) {
        backgroundTimeRef.current = Date.now();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [isAuthenticated]);

  if (isLoading || checkingBiometrics) return <LoadingScreen />;

  return (
    <NavigationContainer linking={linking}>
      <View style={styles.container}>
        {isAuthenticated ? <MainStack /> : <AuthStack />}
        {isAuthenticated && isLocked && (
          <View style={[StyleSheet.absoluteFill, { zIndex: 9999 }]}>
            <BiometricLockScreen onUnlock={() => setIsLocked(false)} />
          </View>
        )}
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.bg.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    flex: 1,
  },
});
