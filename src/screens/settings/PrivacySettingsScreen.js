import React, { useState, useEffect } from 'react';
import {
  View, Text, Switch, TouchableOpacity, StyleSheet,
  ScrollView, ActivityIndicator, StatusBar, Platform, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

function PrivacyRow({ icon, iconBg, label, description, value, onPress, loading }) {
  const options = ['everyone', 'contacts', 'nobody'];
  const labels = { everyone: 'Everyone', contacts: 'Contacts', nobody: 'Nobody' };
  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onPress}
      disabled={loading}
      accessibilityLabel={`${label}: currently ${labels[value] || value}`}
      accessibilityRole="button"
    >
      <View style={[styles.iconBox, { backgroundColor: iconBg || 'rgba(124,110,247,0.12)' }]}>
        <Ionicons name={icon} size={18} color={Colors.brand.indigo} />
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{label}</Text>
        {description ? <Text style={styles.rowDesc}>{description}</Text> : null}
      </View>
      <View style={styles.valueChip}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.brand.indigo} />
        ) : (
          <Text style={styles.valueText}>{labels[value] || value}</Text>
        )}
        <Ionicons name="chevron-forward" size={14} color={Colors.text.placeholder} />
      </View>
    </TouchableOpacity>
  );
}

function SectionHeader({ title }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

export default function PrivacySettingsScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [lastSeen, setLastSeen] = useState(user?.privacy?.lastSeen || 'everyone');
  const [profilePhoto, setProfilePhoto] = useState(user?.privacy?.profilePhoto || 'everyone');
  const [readReceipts, setReadReceipts] = useState(true); // local-only for now
  const [isSaving, setIsSaving] = useState(null); // tracks which field is saving

  const OPTIONS = ['everyone', 'contacts', 'nobody'];

  const cycleValue = async (field, currentValue, setter) => {
    const idx = OPTIONS.indexOf(currentValue);
    const next = OPTIONS[(idx + 1) % OPTIONS.length];
    setter(next);
    setIsSaving(field);
    try {
      const payload = {};
      payload[field] = next;
      await userAPI.updatePrivacy(payload);
      updateUser({ privacy: { ...user?.privacy, [field]: next } });
    } catch (err) {
      // Revert on failure
      setter(currentValue);
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    } finally {
      setIsSaving(null);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

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
        <Text style={styles.headerTitle}>Privacy</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Info */}
        <View style={styles.infoBanner}>
          <Ionicons name="information-circle-outline" size={18} color={Colors.brand.teal} />
          <Text style={styles.infoBannerText}>
            Tap a setting to cycle between Everyone → Contacts → Nobody.
          </Text>
        </View>

        {/* Who Can See */}
        <SectionHeader title="WHO CAN SEE MY INFO" />
        <View style={styles.card}>
          <PrivacyRow
            icon="time-outline"
            label="Last Seen"
            description="Who can see when you were last active"
            value={lastSeen}
            loading={isSaving === 'lastSeen'}
            onPress={() => cycleValue('lastSeen', lastSeen, setLastSeen)}
          />
          <PrivacyRow
            icon="person-circle-outline"
            iconBg="rgba(54,187,173,0.12)"
            label="Profile Photo"
            description="Who can see your profile picture"
            value={profilePhoto}
            loading={isSaving === 'profilePhoto'}
            onPress={() => cycleValue('profilePhoto', profilePhoto, setProfilePhoto)}
          />
        </View>

        {/* Messages */}
        <SectionHeader title="MESSAGING" />
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={[styles.iconBox, { backgroundColor: 'rgba(10,132,255,0.12)' }]}>
              <Ionicons name="checkmark-done-outline" size={18} color="#0A84FF" />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Read Receipts</Text>
              <Text style={styles.rowDesc}>
                Show double blue ticks when messages are read
              </Text>
            </View>
            <Switch
              value={readReceipts}
              onValueChange={(v) => {
                setReadReceipts(v);
                // Read receipts are local-only — no backend update needed
              }}
              trackColor={{ false: Colors.bg.tertiary, true: Colors.brand.indigo }}
              thumbColor="#fff"
              accessibilityLabel="Toggle read receipts"
              accessibilityRole="switch"
            />
          </View>
        </View>

        {/* Blocked Users */}
        <SectionHeader title="BLOCKED CONTACTS" />
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('UserProfile', { isSelf: true })}
            accessibilityLabel="View blocked contacts"
            accessibilityRole="button"
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(255,69,58,0.12)' }]}>
              <Ionicons name="ban-outline" size={18} color={Colors.semantic.error} />
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Blocked Contacts</Text>
              <Text style={styles.rowDesc}>
                {user?.blockedUsers?.length || 0} contact
                {(user?.blockedUsers?.length || 0) !== 1 ? 's' : ''} blocked
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={Colors.text.placeholder} />
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          Changes to Last Seen and Profile Photo are applied immediately and synced across all your devices.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 20,
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  infoBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(54, 187, 173, 0.08)',
    borderWidth: 1, borderColor: 'rgba(54, 187, 173, 0.2)',
    borderRadius: 12, margin: 16, padding: 12,
  },
  infoBannerText: { flex: 1, color: Colors.brand.teal, fontSize: 12.5, lineHeight: 17 },
  sectionTitle: {
    fontSize: 11, fontWeight: '600', color: Colors.text.placeholder,
    letterSpacing: 0.9, textTransform: 'uppercase',
    paddingHorizontal: 20, paddingBottom: 6, paddingTop: 16,
  },
  card: {
    marginHorizontal: 16,
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.glass.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center', marginRight: 12,
  },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: Colors.text.primary },
  rowDesc: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2, lineHeight: 16 },
  valueChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  valueText: { fontSize: 13, color: Colors.brand.indigo, fontWeight: '600' },
  footer: {
    fontSize: 12, color: Colors.text.placeholder, lineHeight: 16,
    margin: 20, marginTop: 16, textAlign: 'center',
  },
});
