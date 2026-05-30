import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Platform,
  Image,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useState, useEffect } from 'react';
import { biometricsService } from '../../services/biometrics';

function SettingsSection({ title, children }) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function SettingsRow({ icon, iconBg, label, value, onPress, destructive, showChevron = true }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.iconBox, { backgroundColor: iconBg || 'rgba(124, 110, 247, 0.12)' }]}>
        <Ionicons name={icon} size={18} color={destructive ? Colors.semantic.error : Colors.brand.indigo} />
      </View>
      <View style={styles.rowContent}>
        <Text style={[styles.rowLabel, destructive && styles.destructiveLabel]}>{label}</Text>
        {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={16} color={Colors.text.placeholder} />
      )}
    </TouchableOpacity>
  );
}

export default function SettingsScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      const enabled = await biometricsService.isBiometricsEnabled();
      setBiometricsEnabled(enabled);
    };
    checkStatus();
  }, []);

  const handleSecurityPress = async () => {
    const hw = await biometricsService.hasHardware();
    const enrolled = await biometricsService.isEnrolled();
    if (!hw || !enrolled) {
      Alert.alert('Security', 'Biometrics (Face ID/Touch ID) are not set up or not supported on this device.');
      return;
    }

    Alert.alert(
      'Screen Lock',
      biometricsEnabled
        ? 'Do you want to disable biometric screen lock?'
        : 'Do you want to enable biometric screen lock? The app will require authentication after 5 minutes in background.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: biometricsEnabled ? 'Disable' : 'Enable',
          onPress: async () => {
            if (biometricsEnabled) {
              await biometricsService.disableBiometrics();
              setBiometricsEnabled(false);
              Alert.alert('Disabled', 'Biometric lock disabled.');
            } else {
              const success = await biometricsService.authenticate('Confirm to enable screen lock');
              if (success) {
                await biometricsService.enableBiometrics();
                setBiometricsEnabled(true);
                Alert.alert('Enabled', 'Biometric lock enabled successfully.');
              } else {
                Alert.alert('Error', 'Authentication failed.');
              }
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <TouchableOpacity
          style={styles.profileCard}
          activeOpacity={0.85}
          onPress={() => navigation.navigate('UserProfile', { userId: user?._id, isSelf: true })}
        >
          <View style={styles.profileAvatarWrapper}>
            {user?.profilePic?.url ? (
              <Image source={{ uri: user.profilePic.url }} style={styles.profileAvatar} />
            ) : (
              <View style={[styles.profileAvatar, styles.profileAvatarFallback]}>
                <Text style={styles.profileInitial}>
                  {user?.name?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || 'User'}</Text>
            <Text style={styles.profileUsername}>@{user?.username || 'unknown'}</Text>
            <Text style={styles.profileStatus} numberOfLines={1}>{user?.about || 'Available'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={Colors.text.placeholder} />
        </TouchableOpacity>

        <SettingsSection title="Account">
          <SettingsRow
            icon="shield-checkmark-outline"
            label="Privacy"
            iconBg="rgba(0, 210, 180, 0.12)"
            onPress={() => navigation.navigate('PrivacySettings')}
          />
          <SettingsRow
            icon="lock-closed-outline"
            label="Security / Screen Lock"
            value={biometricsEnabled ? 'Enabled' : 'Disabled'}
            onPress={handleSecurityPress}
          />
          <SettingsRow
            icon="key-outline"
            label="Change Password"
            iconBg="rgba(255, 159, 10, 0.12)"
            onPress={() => navigation.navigate('ChangePassword')}
          />
          <SettingsRow
            icon="phone-portrait-outline"
            label="Linked Devices"
            onPress={() => {}}
          />
        </SettingsSection>

        <SettingsSection title="Chats">
          <SettingsRow icon="star-outline" label="Starred Messages" iconBg="rgba(255, 214, 10, 0.12)" onPress={() => navigation.navigate('StarredMessages')} />
          <SettingsRow icon="chatbubble-outline" label="Chat Backup" onPress={() => {}} />
          <SettingsRow icon="image-outline" label="Wallpaper" iconBg="rgba(255, 214, 10, 0.12)" onPress={() => {}} />
          <SettingsRow icon="archive-outline" label="Archived Chats" onPress={() => {}} />
        </SettingsSection>

        <SettingsSection title="Notifications">
          <SettingsRow icon="notifications-outline" label="Notification Sound" onPress={() => {}} />
          <SettingsRow icon="phone-call-outline" label="Call Notifications" iconBg="rgba(50, 215, 75, 0.12)" onPress={() => {}} />
        </SettingsSection>

        <SettingsSection title="Storage">
          <SettingsRow icon="server-outline" label="Manage Storage" onPress={() => {}} />
          <SettingsRow icon="cloud-download-outline" label="Auto-Download" onPress={() => {}} />
        </SettingsSection>

        <SettingsSection title="Support">
          <SettingsRow icon="help-circle-outline" label="Help Center" iconBg="rgba(10, 132, 255, 0.12)" onPress={() => {}} />
          <SettingsRow icon="document-text-outline" label="Export My Data" onPress={() => {}} />
        </SettingsSection>

        <SettingsSection>
          <SettingsRow
            icon="log-out-outline"
            label="Sign Out"
            onPress={handleLogout}
            destructive
            showChevron={false}
            iconBg="rgba(255, 69, 58, 0.12)"
          />
        </SettingsSection>

        <Text style={styles.versionText}>PulseChat v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    backgroundColor: Colors.bg.secondary,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.5 },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    margin: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  profileAvatarWrapper: { position: 'relative', marginRight: 14 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30 },
  profileAvatarFallback: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  profileInitial: { fontSize: 24, fontWeight: '700', color: Colors.brand.indigo },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: Colors.semantic.success,
    borderWidth: 2, borderColor: Colors.bg.secondary,
  },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 3 },
  profileUsername: { fontSize: 13, color: Colors.brand.indigo, marginBottom: 3 },
  profileStatus: { fontSize: 13, color: Colors.text.tertiary },
  section: { marginBottom: 8, paddingHorizontal: 16 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: Colors.text.placeholder, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' },
  sectionCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: Colors.text.primary },
  rowValue: { fontSize: 13, color: Colors.text.tertiary, marginTop: 1 },
  destructiveLabel: { color: Colors.semantic.error },
  versionText: {
    textAlign: 'center', color: Colors.text.placeholder,
    fontSize: 12, marginVertical: 24,
  },
});
