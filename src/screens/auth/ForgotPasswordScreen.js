import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authAPI } from '../../services/api';
import { Colors } from '../../theme/colors';

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState(1); // 1: email, 2: otp+newpass
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSendOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address');
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await authAPI.forgotPassword({ email: email.toLowerCase().trim() });
      setStep(2);
    } catch (err) {
      setError(err.message || 'Failed to send reset code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!otp.trim()) { setError('Enter the reset code'); return; }
    if (!newPassword) { setError('Password is required'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(newPassword)) {
      setError('Password must contain uppercase, lowercase, number, and special character (!@#$%^&*)');
      return;
    }
    if (newPassword !== confirmPassword) { setError('Passwords do not match'); return; }

    setIsLoading(true);
    setError('');
    try {
      await authAPI.resetPassword({
        email: email.toLowerCase().trim(),
        otp: otp.trim(),
        newPassword,
      });
      setSuccess('Password reset successfully!');
      setTimeout(() => navigation.navigate('Login'), 1500);
    } catch (err) {
      setError(err.message || 'Reset failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.iconContainer}>
          <Ionicons name="key" size={40} color={Colors.brand.indigo} />
        </View>

        <Text style={styles.title}>Reset password</Text>
        <Text style={styles.subtitle}>
          {step === 1
            ? 'Enter your email and we\'ll send you a reset code'
            : `We sent a code to ${email}`}
        </Text>

        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle" size={16} color={Colors.semantic.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {success ? (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.semantic.success} />
            <Text style={styles.successText}>{success}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(t) => { setEmail(t); setError(''); }}
                placeholder="Enter your email"
                placeholderTextColor={Colors.text.placeholder}
                keyboardType="email-address"
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSendOtp}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={handleSendOtp}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Send Reset Code</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={18} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={otp}
                onChangeText={(t) => { setOtp(t); setError(''); }}
                placeholder="Enter reset code"
                placeholderTextColor={Colors.text.placeholder}
                keyboardType="number-pad"
                maxLength={6}
                returnKeyType="next"
              />
            </View>
            <View style={[styles.inputWrapper, { marginTop: 12 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={(t) => { setNewPassword(t); setError(''); }}
                placeholder="New password"
                placeholderTextColor={Colors.text.placeholder}
                secureTextEntry={!showPassword}
                returnKeyType="next"
              />
              <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.text.tertiary} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputWrapper, { marginTop: 12 }]}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.text.tertiary} style={styles.icon} />
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={(t) => { setConfirmPassword(t); setError(''); }}
                placeholder="Confirm new password"
                placeholderTextColor={Colors.text.placeholder}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleResetPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.btn, isLoading && styles.btnDisabled]}
              onPress={handleResetPassword}
              disabled={isLoading}
            >
              {isLoading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.btnText}>Reset Password</Text>
              }
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 120, paddingBottom: 40 },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: 20,
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 10, borderWidth: 1, borderColor: Colors.glass.border,
  },
  iconContainer: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(124, 110, 247, 0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24, borderWidth: 1, borderColor: 'rgba(124, 110, 247, 0.2)',
  },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text.primary, marginBottom: 10, letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: Colors.text.secondary, lineHeight: 22, marginBottom: 28 },
  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderWidth: 1, borderColor: 'rgba(255, 69, 58, 0.2)',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  errorText: { color: Colors.semantic.error, fontSize: 13, flex: 1 },
  successBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(50, 215, 75, 0.1)',
    borderWidth: 1, borderColor: 'rgba(50, 215, 75, 0.2)',
    borderRadius: 12, padding: 12, marginBottom: 16,
  },
  successText: { color: Colors.semantic.success, fontSize: 13, flex: 1 },
  form: {},
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.tertiary, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.glass.border,
    paddingHorizontal: 14, height: 52,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  btn: {
    backgroundColor: Colors.brand.indigo, borderRadius: 14,
    height: 54, alignItems: 'center', justifyContent: 'center',
    marginTop: 20,
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35,
    shadowRadius: 12, elevation: 6,
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
