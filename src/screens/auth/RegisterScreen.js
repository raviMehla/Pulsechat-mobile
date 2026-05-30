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
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { Colors } from '../../theme/colors';

export default function RegisterScreen({ navigation, route }) {
  const { register } = useAuth();
  const { email: prefilledEmail = '', otpVerified = false } = route.params || {};

  // Step 1: email + OTP send
  // Step 2: fill profile details
  const [step, setStep] = useState(otpVerified ? 2 : 1);

  // Step 1 state
  const [email, setEmail] = useState(prefilledEmail);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  // Step 2 state
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [avatar, setAvatar] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access to pick an avatar.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0]);
    }
  };

  const handleSendOtp = async () => {
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrors({ email: 'Enter a valid email address' });
      return;
    }

    setIsSendingOtp(true);
    setErrors({});
    try {
      await authAPI.sendRegistrationOtp({ email: email.toLowerCase().trim() });
      navigation.navigate('Otp', { email: email.toLowerCase().trim(), purpose: 'registration' });
    } catch (err) {
      setErrors({ email: err.message || 'Failed to send OTP' });
    } finally {
      setIsSendingOtp(false);
    }
  };

  const validateStep2 = () => {
    const errs = {};
    if (!name.trim()) errs.name = 'Name is required';
    else if (name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!username.trim()) errs.username = 'Username is required';
    else if (!/^[a-zA-Z0-9_]{3,20}$/.test(username))
      errs.username = 'Username: 3-20 chars, letters/numbers/underscore only';
    if (!password) errs.password = 'Password is required';
    else if (password.length < 8) errs.password = 'Minimum 8 characters';
    else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/.test(password))
      errs.password = 'Must contain uppercase, lowercase, number, and special character (!@#$%^&*)';
    if (password !== confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleRegister = async () => {
    if (!validateStep2()) return;

    setIsLoading(true);
    setErrors({});
    try {
      const formData = new FormData();
      formData.append('name', name.trim());
      formData.append('username', username.trim().toLowerCase());
      formData.append('email', prefilledEmail || email.toLowerCase().trim());
      formData.append('password', password);

      if (avatar) {
        const fileType = avatar.uri.split('.').pop();
        formData.append('profilePic', {
          uri: avatar.uri,
          name: `avatar.${fileType}`,
          type: `image/${fileType}`,
        });
      }

      await register(formData);
      // RootNavigator handles redirect on isAuthenticated change
    } catch (err) {
      setIsLoading(false);
      setErrors({ general: err.message || 'Registration failed. Please try again.' });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.primary} />

      {/* Background glow */}
      <View style={styles.glow} />

      {/* Back button */}
      <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
      </TouchableOpacity>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>
            {step === 1 ? 'Enter your email to get started' : 'Set up your profile'}
          </Text>
        </View>

        {step === 1 ? (
          /* ─────────── STEP 1: Email ─────────── */
          <View style={styles.form}>
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Email address</Text>
              <View style={[styles.inputWrapper, errors.email && styles.inputError]}>
                <Ionicons name="mail-outline" size={18} color={Colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={(t) => { setEmail(t); setErrors({}); }}
                  placeholder="Enter your email"
                  placeholderTextColor={Colors.text.placeholder}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>
              {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isSendingOtp && styles.primaryBtnDisabled]}
              onPress={handleSendOtp}
              disabled={isSendingOtp}
            >
              {isSendingOtp ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.primaryBtnText}>Send Verification Code</Text>
                  <Ionicons name="arrow-forward" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ─────────── STEP 2: Profile Setup ─────────── */
          <View style={styles.form}>
            {errors.general ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={16} color={Colors.semantic.error} />
                <Text style={styles.errorBannerText}>{errors.general}</Text>
              </View>
            ) : null}

            {/* Avatar Picker */}
            <TouchableOpacity style={styles.avatarContainer} onPress={pickAvatar}>
              {avatar ? (
                <Image source={{ uri: avatar.uri }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera" size={28} color={Colors.brand.indigo} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="add" size={14} color="#fff" />
              </View>
              <Text style={styles.avatarLabel}>
                {avatar ? 'Change photo' : 'Add photo (optional)'}
              </Text>
            </TouchableOpacity>

            {/* Name */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Full Name</Text>
              <View style={[styles.inputWrapper, errors.name && styles.inputError]}>
                <Ionicons name="person-outline" size={18} color={Colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={(t) => { setName(t); setErrors((e) => ({ ...e, name: null })); }}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.text.placeholder}
                  autoCapitalize="words"
                  returnKeyType="next"
                />
              </View>
              {errors.name ? <Text style={styles.fieldError}>{errors.name}</Text> : null}
            </View>

            {/* Username */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Username</Text>
              <View style={[styles.inputWrapper, errors.username && styles.inputError]}>
                <Text style={styles.atSign}>@</Text>
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={(t) => { setUsername(t.toLowerCase()); setErrors((e) => ({ ...e, username: null })); }}
                  placeholder="choose_username"
                  placeholderTextColor={Colors.text.placeholder}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="next"
                />
              </View>
              {errors.username ? <Text style={styles.fieldError}>{errors.username}</Text> : null}
            </View>

            {/* Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={[styles.inputWrapper, errors.password && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={(t) => { setPassword(t); setErrors((e) => ({ ...e, password: null })); }}
                  placeholder="Min. 6 characters"
                  placeholderTextColor={Colors.text.placeholder}
                  secureTextEntry={!showPassword}
                  returnKeyType="next"
                />
                <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color={Colors.text.tertiary} />
                </TouchableOpacity>
              </View>
              {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
            </View>

            {/* Confirm Password */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Confirm Password</Text>
              <View style={[styles.inputWrapper, errors.confirmPassword && styles.inputError]}>
                <Ionicons name="lock-closed-outline" size={18} color={Colors.text.tertiary} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setErrors((e) => ({ ...e, confirmPassword: null })); }}
                  placeholder="Repeat password"
                  placeholderTextColor={Colors.text.placeholder}
                  secureTextEntry={!showPassword}
                  returnKeyType="done"
                  onSubmitEditing={handleRegister}
                />
              </View>
              {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, isLoading && styles.primaryBtnDisabled]}
              onPress={handleRegister}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryBtnText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  glow: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 999,
    backgroundColor: 'rgba(0, 210, 180, 0.05)',
    top: -80,
    right: -80,
  },
  backBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 110 : 80,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  form: { gap: 4 },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.2)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorBannerText: { color: Colors.semantic.error, fontSize: 13, flex: 1 },
  avatarContainer: { alignItems: 'center', marginBottom: 24, position: 'relative' },
  avatarImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: Colors.brand.indigo,
  },
  avatarPlaceholder: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 2,
    borderColor: Colors.glass.borderStrong,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 20,
    right: '35%',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: { marginTop: 10, color: Colors.text.tertiary, fontSize: 13 },
  fieldGroup: { marginBottom: 14 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 14,
    height: 52,
  },
  inputError: { borderColor: Colors.semantic.error, backgroundColor: 'rgba(255, 69, 58, 0.05)' },
  inputIcon: { marginRight: 10 },
  atSign: { color: Colors.text.tertiary, fontSize: 16, fontWeight: '500', marginRight: 6 },
  input: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  fieldError: { color: Colors.semantic.error, fontSize: 12, marginTop: 6, marginLeft: 4 },
  primaryBtn: {
    backgroundColor: Colors.brand.indigo,
    borderRadius: 14,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  primaryBtnDisabled: { opacity: 0.7 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  loginText: { color: Colors.text.tertiary, fontSize: 14 },
  loginLink: { color: Colors.brand.indigo, fontSize: 14, fontWeight: '600' },
});
