// ============================================================
// BiometricLockScreen.js — Screen lock overlay for biometrics
// Protects the app when biometrics are enabled and session is locked
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  ActivityIndicator, StatusBar, KeyboardAvoidingView, Platform, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { biometricsService } from '../../services/biometrics';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function BiometricLockScreen({ onUnlock }) {
  const { logout, user } = useAuth();
  const [passwordInput, setPasswordInput] = useState('');
  const [showPasswordFallback, setShowPasswordFallback] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [hasBiometrics, setHasBiometrics] = useState(false);

  useEffect(() => {
    const checkHardware = async () => {
      const hw = await biometricsService.hasHardware();
      const enrolled = await biometricsService.isEnrolled();
      setHasBiometrics(hw && enrolled);
      if (hw && enrolled) {
        triggerAuthentication();
      } else {
        setShowPasswordFallback(true);
      }
    };
    checkHardware();
  }, []);

  const triggerAuthentication = async () => {
    setErrorMessage('');
    const success = await biometricsService.authenticate('Unlock PulseChat');
    if (success) {
      onUnlock();
    } else {
      setErrorMessage('Biometric verification failed. Try again or use your password.');
    }
  };

  const handlePasswordUnlock = async () => {
    if (!passwordInput.trim()) return;
    setIsVerifyingPassword(true);
    setErrorMessage('');
    try {
      // Re-authenticate via the auth API (authAPI imported at module scope — no hooks violation)
      const identifier = user?.email || user?.username || '';
      await authAPI.login({ identifier, password: passwordInput });
      onUnlock();
    } catch (err) {
      setErrorMessage('Incorrect password. Please try again.');
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0B0B0F" />
      
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="lock-closed-outline" size={48} color={Colors.brand.indigo} />
        </View>
        
        <Text style={styles.title}>PulseChat Locked</Text>
        <Text style={styles.subTitle}>
          {hasBiometrics 
            ? 'Authenticate using biometrics or your password to continue.' 
            : 'Enter your account password to unlock.'}
        </Text>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {showPasswordFallback ? (
          <View style={styles.fallbackContainer}>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={passwordInput}
                onChangeText={setPasswordInput}
                placeholder="Enter password"
                placeholderTextColor={Colors.text.placeholder}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity 
              style={[styles.unlockBtn, !passwordInput.trim() && styles.unlockBtnDisabled]}
              onPress={handlePasswordUnlock}
              disabled={!passwordInput.trim() || isVerifyingPassword}
            >
              {isVerifyingPassword ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.unlockBtnText}>Unlock</Text>
              )}
            </TouchableOpacity>

            {hasBiometrics && (
              <TouchableOpacity 
                style={styles.textBtn} 
                onPress={() => {
                  setShowPasswordFallback(false);
                  triggerAuthentication();
                }}
              >
                <Text style={styles.textBtnLabel}>Use Biometrics</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.biometricContainer}>
            <TouchableOpacity style={styles.biometricBtn} onPress={triggerAuthentication}>
              <Ionicons name="finger-print-outline" size={60} color={Colors.brand.teal} />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.textBtn} onPress={() => setShowPasswordFallback(true)}>
              <Text style={styles.textBtnLabel}>Use Password</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
          <Ionicons name="log-out-outline" size={16} color={Colors.semantic.error} />
          <Text style={styles.logoutBtnText}>Log Out Account</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: SCREEN_W * 0.85,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124, 110, 247, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subTitle: {
    fontSize: 14,
    color: Colors.text.tertiary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  errorText: {
    color: Colors.semantic.error,
    fontSize: 13,
    marginBottom: 16,
    textAlign: 'center',
  },
  biometricContainer: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
  },
  biometricBtn: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(54, 187, 173, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  fallbackContainer: {
    width: '100%',
    gap: 12,
  },
  inputWrapper: {
    height: 48,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  textInput: {
    color: Colors.text.primary,
    fontSize: 15,
  },
  unlockBtn: {
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.indigo,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  unlockBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  unlockBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  textBtn: {
    padding: 8,
  },
  textBtnLabel: {
    color: Colors.brand.teal,
    fontWeight: '600',
    fontSize: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 24,
    padding: 8,
  },
  logoutBtnText: {
    color: Colors.semantic.error,
    fontSize: 14,
    fontWeight: '600',
  },
});
