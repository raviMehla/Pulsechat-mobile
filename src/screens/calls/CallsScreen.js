import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList,
  Image, ActivityIndicator, StatusBar, Alert, Modal, Dimensions,
  Platform, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';
import { userAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function CallsScreen() {
  const { user } = useAuth();
  
  // Call History States
  const [callLogs, setCallLogs] = useState([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // New Call Contacts Modal
  const [showNewCallModal, setShowNewCallModal] = useState(false);
  const [contactsSearchQuery, setContactsSearchQuery] = useState('');
  const [contactsSearchResults, setContactsSearchResults] = useState([]);
  const [isSearchingContacts, setIsSearchingContacts] = useState(false);

  // Ringing Call Overlay States
  const [activeCall, setActiveCall] = useState(null);
  const [showCallOverlay, setShowCallOverlay] = useState(false);
  const [callState, setCallState] = useState('Ringing...'); // Ringing... -> Connected
  const [callDuration, setCallDuration] = useState(0);

  // Call Refs
  const callTimerRef = useRef(null);
  const callConnectTimeoutRef = useRef(null);

  // Pre-populated mock call history
  const defaultMockLogs = [
    {
      _id: 'call_mock_1',
      user: {
        name: 'Jane Cooper',
        username: 'janecooper',
        profilePic: { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      },
      type: 'voice', // voice or video
      direction: 'incoming', // incoming, outgoing, missed
      createdAt: new Date(Date.now() - 7200000).toISOString(), // 2 hrs ago
    },
    {
      _id: 'call_mock_2',
      user: {
        name: 'Alex Rivera',
        username: 'alexrivera',
        profilePic: { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
      },
      type: 'video',
      direction: 'missed',
      createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    },
    {
      _id: 'call_mock_3',
      user: {
        name: 'Emma Watson',
        username: 'emmawatson',
        profilePic: { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
      },
      type: 'voice',
      direction: 'outgoing',
      createdAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    }
  ];

  // Load call logs
  useEffect(() => {
    loadCallLogs();
  }, []);

  const loadCallLogs = async () => {
    try {
      const data = await AsyncStorage.getItem(`call_logs_${user?._id}`);
      if (data) {
        setCallLogs(JSON.parse(data));
      } else {
        // Fallback to default mock logs initially
        setCallLogs(defaultMockLogs);
        await AsyncStorage.setItem(`call_logs_${user?._id}`, JSON.stringify(defaultMockLogs));
      }
    } catch (_) {
      setCallLogs(defaultMockLogs);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Contacts search
  const handleContactsSearch = async (text) => {
    setContactsSearchQuery(text);
    if (text.trim().length < 2) {
      setContactsSearchResults([]);
      return;
    }
    setIsSearchingContacts(true);
    try {
      const res = await userAPI.searchUsers(text.trim());
      // Exclude current user
      const filtered = (res.data || []).filter((u) => u._id !== user?._id);
      setContactsSearchResults(filtered);
    } catch (err) {
      console.warn('[CallsScreen] Search error:', err.message);
    } finally {
      setIsSearchingContacts(false);
    }
  };

  // Trigger call ringing overlay
  const initiateCall = (targetUser, type = 'voice') => {
    setShowNewCallModal(false);
    setContactsSearchQuery('');
    setContactsSearchResults([]);
    
    // Set call info
    setActiveCall({
      user: targetUser,
      type: type,
    });
    setCallState('Ringing...');
    setCallDuration(0);
    setShowCallOverlay(true);

    // Haptics ring effect
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    // Simulate connection after 3 seconds
    callConnectTimeoutRef.current = setTimeout(() => {
      setCallState('Connected');
      // Start call timer
      callTimerRef.current = setInterval(() => {
        setRecordDuration(); // trigger re-render / timer tick
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }, 3000);
  };

  // Stop/decline call and add record to logs
  const hangUpCall = async () => {
    if (!activeCall) return;
    
    // Clear simulation timers
    if (callConnectTimeoutRef.current) clearTimeout(callConnectTimeoutRef.current);
    if (callTimerRef.current) clearInterval(callTimerRef.current);

    // Build new log entry
    const newLog = {
      _id: `call_log_${Date.now()}`,
      user: activeCall.user,
      type: activeCall.type,
      direction: 'outgoing',
      createdAt: new Date().toISOString(),
    };

    const updatedLogs = [newLog, ...callLogs];
    setCallLogs(updatedLogs);
    await AsyncStorage.setItem(`call_logs_${user?._id}`, JSON.stringify(updatedLogs));

    // Reset call overlay
    setActiveCall(null);
    setShowCallOverlay(false);
    setCallDuration(0);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Clear Log History',
      'Are you sure you want to delete all call logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(`call_logs_${user?._id}`);
            setCallLogs([]);
          }
        }
      ]
    );
  };

  const formatCallTime = (isoStr) => {
    const date = new Date(isoStr);
    const now = new Date();
    const diff = now - date;
    const oneDay = 86400000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } else if (diff < 2 * oneDay) {
      return 'Yesterday';
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const renderCallRow = ({ item }) => {
    const directionIcon = item.direction === 'outgoing' 
      ? 'arrow-up-forward' 
      : item.direction === 'incoming' 
        ? 'arrow-down-left' 
        : 'alert-circle';
    
    const directionColor = item.direction === 'missed' 
      ? Colors.semantic.error 
      : item.direction === 'incoming' 
        ? Colors.brand.teal 
        : Colors.brand.indigo;

    return (
      <View style={styles.callRow}>
        {item.user.profilePic?.url ? (
          <Image source={{ uri: item.user.profilePic.url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>
              {item.user.name?.charAt(0)?.toUpperCase()}
            </Text>
          </View>
        )}

        <View style={styles.callInfo}>
          <Text style={styles.callName}>{item.user.name}</Text>
          <View style={styles.directionRow}>
            <Ionicons name={directionIcon} size={14} color={directionColor} style={{ marginRight: 4 }} />
            <Text style={styles.callTime}>
              {formatCallTime(item.createdAt)}
            </Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.callRowBtn}
          onPress={() => initiateCall(item.user, item.type)}
        >
          <Ionicons 
            name={item.type === 'video' ? 'videocam-outline' : 'call-outline'} 
            size={22} 
            color={Colors.brand.indigo} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Calls</Text>
        {callLogs.length > 0 && (
          <TouchableOpacity onPress={handleClearHistory} style={styles.headerBtn}>
            <Ionicons name="trash-outline" size={22} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Logs List */}
      {isLoadingLogs ? (
        <View style={styles.loader}>
          <ActivityIndicator color={Colors.brand.indigo} size="large" />
        </View>
      ) : (
        <FlatList
          data={callLogs}
          keyExtractor={(item) => item._id}
          renderItem={renderCallRow}
          contentContainerStyle={{ paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="call-outline" size={48} color={Colors.text.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>No call logs</Text>
              <Text style={styles.emptySubtitle}>
                Initiate voice and video calls with your contacts. Logs will show up here.
              </Text>
            </View>
          }
        />
      )}

      {/* Floating Action Button (New Call) */}
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setShowNewCallModal(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="call" size={24} color="#fff" />
      </TouchableOpacity>

      {/* ─────────────────────────────────────────────────────────────
          NEW CALL CONTACTS MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showNewCallModal}
        animationType="slide"
        onRequestClose={() => setShowNewCallModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.bg.primary }]}>
          <StatusBar barStyle="light-content" />
          
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNewCallModal(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Call</Text>
          </View>

          {/* Search Contacts */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={contactsSearchQuery}
              onChangeText={handleContactsSearch}
              placeholder="Search contacts to call..."
              placeholderTextColor={Colors.text.placeholder}
              autoCapitalize="none"
              autoFocus
            />
            {contactsSearchQuery ? (
              <TouchableOpacity onPress={() => handleContactsSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isSearchingContacts ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand.indigo} size="large" />
          ) : (
            <FlatList
              data={contactsSearchResults}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <View style={styles.contactRow}>
                  {item.profilePic?.url ? (
                    <Image source={{ uri: item.profilePic.url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarLetter}>
                        {item.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactSub}>@{item.username}</Text>
                  </View>
                  <View style={styles.contactActionButtons}>
                    <TouchableOpacity 
                      style={styles.circleCallBtn}
                      onPress={() => initiateCall(item, 'voice')}
                    >
                      <Ionicons name="call" size={16} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.circleCallBtn}
                      onPress={() => initiateCall(item, 'video')}
                    >
                      <Ionicons name="videocam" size={16} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={48} color={Colors.text.placeholder} />
                  <Text style={styles.emptyTitle}>Find a contact</Text>
                  <Text style={styles.emptySubtitle}>
                    {contactsSearchQuery.trim().length >= 2 
                      ? 'No users found matching search'
                      : 'Search above for users to call.'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          RINGING CALL OVERLAY (Fullscreen Glassmorphic Ring Screen)
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showCallOverlay}
        transparent
        animationType="slide"
        onRequestClose={hangUpCall}
      >
        <View style={styles.callOverlayContainer}>
          {/* Glass background blur backdrop simulation */}
          {activeCall?.user?.profilePic?.url ? (
            <Image
              source={{ uri: activeCall.user.profilePic.url }}
              style={styles.overlayBgBlur}
              blurRadius={30}
            />
          ) : (
            <View style={[styles.overlayBgBlur, { backgroundColor: '#13131F' }]} />
          )}
          <View style={styles.overlayMask} />

          {/* Core Content Layout */}
          <SafeAreaView style={styles.overlayContentWrapper}>
            {/* Call Header */}
            <View style={styles.overlayHeader}>
              <Ionicons 
                name={activeCall?.type === 'video' ? 'videocam' : 'call'} 
                size={18} 
                color="rgba(255,255,255,0.6)" 
              />
              <Text style={styles.overlayCallType}>
                {activeCall?.type === 'video' ? 'PULSE VIDEO CALL' : 'PULSE VOICE CALL'}
              </Text>
            </View>

            {/* Caller Info */}
            <View style={styles.overlayUserCard}>
              {activeCall?.user?.profilePic?.url ? (
                <Image source={{ uri: activeCall.user.profilePic.url }} style={styles.overlayAvatar} />
              ) : (
                <View style={[styles.overlayAvatar, styles.overlayAvatarFallback]}>
                  <Text style={styles.overlayAvatarLetter}>
                    {activeCall?.user?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.overlayCallerName}>{activeCall?.user?.name}</Text>
              <Text style={styles.overlayCallState}>
                {callState === 'Connected' ? formatDuration(callDuration) : callState}
              </Text>
            </View>

            {/* Buttons / Options Controls */}
            <View style={styles.overlayControls}>
              <TouchableOpacity style={styles.controlCircleBtn}>
                <Ionicons name="mic-off" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.controlCircleBtn, styles.declineBtn]}
                onPress={hangUpCall}
              >
                <Ionicons name="call" size={26} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlCircleBtn}>
                <Ionicons name="volume-high" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.bg.secondary,
    paddingTop: Platform.OS === 'ios' ? 0 : 16,
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.5 },
  headerBtn: { padding: 4 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  callRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  avatar: { width: 50, height: 50, borderRadius: 25, marginRight: 14 },
  avatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '700', color: Colors.brand.indigo },
  callInfo: { flex: 1 },
  callName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
  directionRow: { flexDirection: 'row', alignItems: 'center' },
  callTime: { fontSize: 13, color: Colors.text.tertiary },
  callRowBtn: { padding: 8, borderRadius: 10, backgroundColor: Colors.bg.tertiary },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, paddingTop: 100 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginBottom: 8, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },

  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12,
    elevation: 8,
  },

  // Modal new call styles
  modalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.secondary, borderRadius: 12,
    paddingHorizontal: 12, height: 46,
    marginHorizontal: 16, marginVertical: 14,
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },

  contactRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  contactSub: { fontSize: 12, color: Colors.text.tertiary },
  contactActionButtons: { flexDirection: 'row', gap: 10 },
  circleCallBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center', justifyContent: 'center',
  },

  // Ringing Call overlay styles
  callOverlayContainer: { flex: 1, backgroundColor: '#000', position: 'relative' },
  overlayBgBlur: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.45 },
  overlayMask: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(11,11,15,0.7)' },
  overlayContentWrapper: { flex: 1, justifyContent: 'space-between', alignItems: 'center', paddingVertical: 40 },
  overlayHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  overlayCallType: { color: 'rgba(255,255,255,0.6)', fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },
  
  overlayUserCard: { alignItems: 'center', marginTop: 40 },
  overlayAvatar: { width: 120, height: 120, borderRadius: 60, marginBottom: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)' },
  overlayAvatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.brand.indigo },
  overlayAvatarLetter: { fontSize: 44, fontWeight: '800', color: Colors.brand.indigo },
  overlayCallerName: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  overlayCallState: { color: 'rgba(255,255,255,0.6)', fontSize: 16, fontWeight: '500' },
  
  overlayControls: { flexDirection: 'row', gap: 28, alignItems: 'center', marginBottom: 40 },
  controlCircleBtn: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  declineBtn: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: Colors.semantic.error,
    borderWidth: 0,
  },
});
