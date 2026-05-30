import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

export default function ChangePasswordScreen({ navigation }) {
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const getStrength = (pw) => {
    if (!pw) return { level: 0, label: '', color: Colors.text.placeholder };
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[a-z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[!@#$%^&*]/.test(pw)) score++;
    if (score <= 2) return { level: score, label: 'Weak', color: Colors.semantic.error };
    if (score === 3) return { level: score, label: 'Fair', color: '#FFB340' };
    if (score === 4) return { level: score, label: 'Good', color: Colors.brand.teal };
    return { level: score, label: 'Strong', color: Colors.semantic.success };
  };

  const strength = getStrength(newPassword);

  const validate = () => {
    const errs = {};
    if (!currentPassword) errs.currentPassword = 'Current password is required';
    if (!newPassword) errs.newPassword = 'New password is required';
    else if (!PASSWORD_REGEX.test(newPassword))
      errs.newPassword = 'Must be 8+ chars with uppercase, lowercase, number & special char';
    if (newPassword !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (currentPassword === newPassword && newPassword)
      errs.newPassword = 'New password must differ from current password';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setIsLoading(true);
    try {
      await userAPI.updatePassword({ currentPassword, newPassword });
      Alert.alert(
        'Password Changed',
        'Your password has been updated successfully. You will be signed out of all other devices.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (err) {
      const msg = err.message || 'Failed to change password';
      if (msg.toLowerCase().includes('incorrect') || msg.toLowerCase().includes('current')) {
        setErrors({ currentPassword: 'Current password is incorrect' });
      } else {
        Alert.alert('Error', msg);
      }
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

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-back" size={22} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Info banner */}
        <View style={styles.infoBanner}>
          <Ionicons name="shield-checkmark-outline" size={20} color={Colors.brand.teal} />
          <Text style={styles.infoBannerText}>
            Changing your password will sign you out of all other devices.
          </Text>
        </View>

        {/* Current Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Current Password</Text>
          <View style={[styles.inputWrapper, errors.currentPassword && styles.inputError]}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={errors.currentPassword ? Colors.semantic.error : Colors.text.tertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={currentPassword}
              onChangeText={(t) => { setCurrentPassword(t); setErrors(e => ({ ...e, currentPassword: null })); }}
              placeholder="Enter current password"
              placeholderTextColor={Colors.text.placeholder}
              secureTextEntry={!showCurrent}
              autoCapitalize="none"
              accessibilityLabel="Current password input"
            />
            <TouchableOpacity
              onPress={() => setShowCurrent(v => !v)}
              accessibilityLabel={showCurrent ? 'Hide current password' : 'Show current password'}
              accessibilityRole="button"
            >
              <Ionicons
                name={showCurrent ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
          {errors.currentPassword ? (
            <Text style={styles.fieldError}>{errors.currentPassword}</Text>
          ) : null}
        </View>

        {/* New Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>New Password</Text>
          <View style={[styles.inputWrapper, errors.newPassword && styles.inputError]}>
            <Ionicons
              name="key-outline"
              size={18}
              color={errors.newPassword ? Colors.semantic.error : Colors.text.tertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={newPassword}
              onChangeText={(t) => { setNewPassword(t); setErrors(e => ({ ...e, newPassword: null })); }}
              placeholder="Min. 8 chars with uppercase, number, symbol"
              placeholderTextColor={Colors.text.placeholder}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              accessibilityLabel="New password input"
            />
            <TouchableOpacity
              onPress={() => setShowNew(v => !v)}
              accessibilityLabel={showNew ? 'Hide new password' : 'Show new password'}
              accessibilityRole="button"
            >
              <Ionicons
                name={showNew ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={Colors.text.tertiary}
              />
            </TouchableOpacity>
          </View>
          {errors.newPassword ? (
            <Text style={styles.fieldError}>{errors.newPassword}</Text>
          ) : null}

          {/* Strength meter */}
          {newPassword.length > 0 && (
            <View style={styles.strengthContainer}>
              <View style={styles.strengthBars}>
                {[1, 2, 3, 4, 5].map(i => (
                  <View
                    key={i}
                    style={[
                      styles.strengthBar,
                      { backgroundColor: i <= strength.level ? strength.color : Colors.bg.tertiary }
                    ]}
                  />
                ))}
              </View>
              <Text style={[styles.strengthLabel, { color: strength.color }]}>{strength.label}</Text>
            </View>
          )}
        </View>

        {/* Confirm New Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm New Password</Text>
          <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
            <Ionicons
              name="lock-closed-outline"
              size={18}
              color={errors.confirmPassword ? Colors.semantic.error : Colors.text.tertiary}
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={(t) => { setConfirmPassword(t); setErrors(e => ({ ...e, confirmPassword: null })); }}
              placeholder="Repeat new password"
              placeholderTextColor={Colors.text.placeholder}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              accessibilityLabel="Confirm new password input"
            />
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
          ) : null}
        </View>

        {/* Requirements list */}
        <View style={styles.requirementsCard}>
          <Text style={styles.requirementsTitle}>Password Requirements</Text>
          {[
            { label: 'At least 8 characters', met: newPassword.length >= 8 },
            { label: 'Uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
            { label: 'Lowercase letter (a-z)', met: /[a-z]/.test(newPassword) },
            { label: 'Number (0-9)', met: /\d/.test(newPassword) },
            { label: 'Special character (!@#$%^&*)', met: /[!@#$%^&*]/.test(newPassword) },
          ].map((req, idx) => (
            <View key={idx} style={styles.requirementRow}>
              <Ionicons
                name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                size={16}
                color={req.met ? Colors.semantic.success : Colors.text.placeholder}
              />
              <Text style={[styles.requirementText, req.met && styles.requirementMet]}>
                {req.label}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, isLoading && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={isLoading}
          accessibilityLabel="Save new password"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
              <Text style={styles.submitBtnText}>Update Password</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  scroll: { padding: 20, paddingBottom: 48 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(54, 187, 173, 0.08)',
    borderWidth: 1, borderColor: 'rgba(54, 187, 173, 0.2)',
    borderRadius: 12, padding: 14, marginBottom: 24,
  },
  infoBannerText: { flex: 1, color: Colors.brand.teal, fontSize: 13, lineHeight: 18 },
  fieldGroup: { marginBottom: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: Colors.text.secondary,
    marginBottom: 8, letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.tertiary, borderRadius: 14,
    borderWidth: 1, borderColor: Colors.glass.border,
    paddingHorizontal: 14, height: 52,
  },
  inputError: { borderColor: Colors.semantic.error, backgroundColor: 'rgba(255, 69, 58, 0.05)' },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  fieldError: { color: Colors.semantic.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
  strengthContainer: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8,
  },
  strengthBars: { flexDirection: 'row', gap: 4, flex: 1 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { fontSize: 12, fontWeight: '600', minWidth: 48 },
  requirementsCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.glass.border,
    padding: 16, marginBottom: 24, gap: 10,
  },
  requirementsTitle: {
    fontSize: 13, fontWeight: '600', color: Colors.text.secondary,
    marginBottom: 4, letterSpacing: 0.2,
  },
  requirementRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  requirementText: { color: Colors.text.tertiary, fontSize: 13 },
  requirementMet: { color: Colors.semantic.success },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: Colors.brand.indigo,
    borderRadius: 14, height: 54,
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
