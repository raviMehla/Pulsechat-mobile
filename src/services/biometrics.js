// ============================================================
// biometrics.js — Local Biometric Authentication Service
// Wrapper around expo-local-authentication for secure lock
// ============================================================

import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

export const biometricsService = {
  // Check if device supports biometrics
  hasHardware: async () => {
    try {
      return await LocalAuthentication.hasHardwareAsync();
    } catch (_) {
      return false;
    }
  },

  // Check if user has biometrics enrolled (fingerprint or face)
  isEnrolled: async () => {
    try {
      return await LocalAuthentication.isEnrolledAsync();
    } catch (_) {
      return false;
    }
  },

  // Get list of supported biometric types (Face ID, Touch ID, Iris)
  getSupportedTypes: async () => {
    try {
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      const mapped = [];
      if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        mapped.push('Fingerprint');
      }
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        mapped.push('Facial Recognition');
      }
      return mapped;
    } catch (_) {
      return [];
    }
  },

  // Authenticate user via Face ID / Touch ID / Device passcode
  authenticate: async (promptMessage = 'Authenticate to unlock PulseChat') => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      return result.success;
    } catch (_) {
      return false;
    }
  },

  // Enable biometric lock setting
  enableBiometrics: async () => {
    try {
      await SecureStore.setItemAsync('biometrics_enabled', 'true');
      return true;
    } catch (_) {
      return false;
    }
  },

  // Disable biometric lock setting
  disableBiometrics: async () => {
    try {
      await SecureStore.deleteItemAsync('biometrics_enabled');
      return true;
    } catch (_) {
      return false;
    }
  },

  // Check if biometric lock is enabled
  isBiometricsEnabled: async () => {
    try {
      const val = await SecureStore.getItemAsync('biometrics_enabled');
      return val === 'true';
    } catch (_) {
      return false;
    }
  },
};
