import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, ActivityIndicator, Image, Platform, StatusBar,
  Share, Alert, Linking
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { userAPI, chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function SearchScreen({ navigation }) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [isInviting, setIsInviting] = useState(false);

  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const isPhone = /^[+\d\s-]{5,20}$/.test(query.trim()) && /[\d]/.test(query.trim());

  const handleInviteEmail = async () => {
    try {
      setIsInviting(true);
      await userAPI.inviteUser({ email: query.trim() });
      Alert.alert('Invitation Sent', `An invitation email has been dispatched to ${query.trim()}!`);
    } catch (err) {
      Alert.alert('Invitation Failed', err.response?.data?.message || err.message || 'Failed to send invite.');
    } finally {
      setIsInviting(false);
    }
  };

  const handleInviteSMS = async () => {
    const inviteMessage = `Hey, join me on PulseChat! It's a secure real-time messaging app. Register here: https://go-pulsechat.vercel.app/signup`;
    const separator = Platform.OS === 'ios' ? '&' : '?';
    const smsUrl = `sms:${query.trim()}${separator}body=${encodeURIComponent(inviteMessage)}`;
    try {
      const supported = await Linking.canOpenURL(smsUrl);
      if (supported) {
        await Linking.openURL(smsUrl);
      } else {
        Alert.alert('Not Supported', 'Sending SMS directly is not supported on this device. We will open share options.');
        await handleShareInvite();
      }
    } catch (err) {
      console.warn('[SearchScreen] SMS error:', err.message);
      await handleShareInvite();
    }
  };

  const handleShareInvite = async () => {
    const inviteMessage = `Hey, join me on PulseChat! It's a secure real-time messaging app. Register here: https://go-pulsechat.vercel.app/signup`;
    try {
      await Share.share({
        message: inviteMessage,
      });
    } catch (err) {
      console.warn('[SearchScreen] Share error:', err.message);
    }
  };

  const handleSearch = async (text) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setIsLoading(true);
    try {
      const res = await userAPI.searchUsers(text.trim());
      setResults(res.data?.filter((u) => u._id !== user._id) || []);
      setSearched(true);
    } catch (err) {
      console.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserPress = async (targetUser) => {
    try {
      const res = await chatAPI.accessChat({ userId: targetUser._id });
      const chat = res.data;
      navigation.replace('Chat', {
        chatId: chat._id,
        chatName: targetUser.name,
        isGroup: false,
      });
    } catch (err) {
      console.error(err.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.searchWrapper}>
          <Ionicons name="search" size={16} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={handleSearch}
            placeholder="Search people..."
            placeholderTextColor={Colors.text.placeholder}
            autoFocus
            autoCapitalize="none"
          />
          {query ? (
            <TouchableOpacity onPress={() => { setQuery(''); setResults([]); setSearched(false); }}>
              <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* Results */}
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand.indigo} size="large" />
      ) : (
        <FlatList
          data={results}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userRow} onPress={() => handleUserPress(item)}>
              <View style={styles.avatarWrapper}>
                {item.profilePic?.url ? (
                  <Image source={{ uri: item.profilePic.url }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Text style={styles.avatarLetter}>{item.name?.charAt(0)?.toUpperCase()}</Text>
                  </View>
                )}
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.name}</Text>
                <Text style={styles.userUsername}>@{item.username}</Text>
              </View>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.brand.indigo} />
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            searched ? (
              <View style={styles.empty}>
                <Ionicons name="person-outline" size={48} color={Colors.text.placeholder} />
                <Text style={styles.emptyText}>No users found</Text>

                <View style={styles.inviteContainer}>
                  {isEmail ? (
                    <TouchableOpacity
                      style={[styles.inviteBtn, styles.emailInviteBtn]}
                      onPress={handleInviteEmail}
                      disabled={isInviting}
                    >
                      {isInviting ? (
                        <ActivityIndicator color={Colors.brand.indigo} size="small" />
                      ) : (
                        <>
                          <Ionicons name="mail-outline" size={16} color={Colors.brand.indigo} style={{ marginRight: 6 }} />
                          <Text style={styles.emailInviteText}>Invite via Email</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {isPhone ? (
                    <TouchableOpacity
                      style={[styles.inviteBtn, styles.emailInviteBtn]}
                      onPress={handleInviteSMS}
                    >
                      <Ionicons name="chatbox-ellipses-outline" size={16} color={Colors.brand.indigo} style={{ marginRight: 6 }} />
                      <Text style={styles.emailInviteText}>Invite via SMS</Text>
                    </TouchableOpacity>
                  ) : null}

                  <TouchableOpacity
                    style={[styles.inviteBtn, styles.shareInviteBtn]}
                    onPress={handleShareInvite}
                  >
                    <Ionicons name="share-social-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.shareInviteText}>Share Invite Link</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : query.length < 2 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyHint}>Type at least 2 characters to search</Text>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.bg.secondary,
    borderBottomWidth: 1, borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 10,
  },
  searchWrapper: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.tertiary, borderRadius: 12,
    paddingHorizontal: 12, height: 44,
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  avatarWrapper: { marginRight: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: Colors.brand.indigo },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  userUsername: { fontSize: 13, color: Colors.text.tertiary },
  empty: { alignItems: 'center', paddingTop: 60, width: '100%' },
  emptyText: { fontSize: 16, color: Colors.text.tertiary, marginTop: 16 },
  emptyHint: { fontSize: 14, color: Colors.text.placeholder, marginTop: 40 },
  inviteContainer: { width: '100%', paddingHorizontal: 40, marginTop: 24, gap: 12 },
  inviteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    height: 48, borderRadius: 24, borderWidth: 1,
  },
  emailInviteBtn: { borderColor: Colors.brand.indigo + '40', backgroundColor: Colors.brand.indigo + '15' },
  shareInviteBtn: { borderColor: Colors.glass.border, backgroundColor: Colors.bg.tertiary },
  emailInviteText: { color: Colors.brand.indigo, fontSize: 14, fontWeight: '600' },
  shareInviteText: { color: Colors.text.primary, fontSize: 14, fontWeight: '600' },
});
