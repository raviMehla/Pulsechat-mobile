import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image,
  TextInput, ActivityIndicator, ScrollView, StatusBar, Alert, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../theme/colors';
import { userAPI, chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function UserProfileScreen({ navigation, route }) {
  const { userId, user: routeUser, isSelf = false } = route.params || {};
  const { user: currentUser, updateUser, refreshProfile } = useAuth();

  // ── States ──
  const [profileUser, setProfileUser] = useState(isSelf ? currentUser : routeUser || null);
  const [isLoading, setIsLoading] = useState(!profileUser);
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Edit fields (for Self)
  const [editName, setEditName] = useState(profileUser?.name || '');
  const [editBio, setEditBio] = useState(profileUser?.bio || profileUser?.about || '');
  const [editPhone, setEditPhone] = useState(profileUser?.phone || '');
  const [avatarAsset, setAvatarAsset] = useState(null);

  // Blocked status (for others)
  const [isBlocked, setIsBlocked] = useState(false);
  const [isTogglingBlock, setIsTogglingBlock] = useState(false);

  // Fetch block status and details if needed
  useEffect(() => {
    if (isSelf) {
      setProfileUser(currentUser);
      setEditName(currentUser?.name || '');
      setEditBio(currentUser?.bio || currentUser?.about || '');
      setEditPhone(currentUser?.phone || '');
    } else {
      // Check if blocked
      const blocked = currentUser?.blockedUsers?.some(
        (u) => String(u._id || u) === String(userId || routeUser?._id)
      );
      setIsBlocked(Boolean(blocked));
    }
  }, [currentUser, isSelf, userId, routeUser]);

  // Load profile if we only have userId
  useEffect(() => {
    const fetchUserData = async () => {
      if (isSelf || !userId || profileUser) return;
      setIsLoading(true);
      try {
        // Fetch users through a chat access or search fallback
        // Since there is no explicit GET /users/:id, we fallback to searching or route parameters.
        // Usually, routeUser is passed in. If not, we fetch statuses or details.
        const res = await userAPI.getUserStatus(userId);
        if (res.data) {
          setProfileUser((prev) => ({ ...prev, ...res.data, _id: userId }));
        }
      } catch (err) {
        console.warn('[UserProfileScreen] Fetch status error:', err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUserData();
  }, [userId, isSelf]);

  // Image selection
  const pickAvatar = async () => {
    if (!isSelf) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera roll access to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]) {
      setAvatarAsset(result.assets[0]);
    }
  };

  // Save profile modifications
  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required field', 'Name cannot be empty.');
      return;
    }
    setIsUpdating(true);
    try {
      const formData = new FormData();
      formData.append('name', editName.trim());
      formData.append('bio', editBio.trim());
      // Backwards compatibility with about/bio
      formData.append('about', editBio.trim());
      if (editPhone.trim()) {
        formData.append('phone', editPhone.trim());
      }

      if (avatarAsset) {
        const fileUri = avatarAsset.uri;
        const fileExt = fileUri.split('.').pop() || 'jpg';
        formData.append('profilePic', {
          uri: fileUri,
          name: `profile_${Date.now()}.${fileExt}`,
          type: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        });
      }

      const res = await userAPI.updateProfile(formData);
      const updatedUser = res.data?.user || res.data;
      if (updatedUser) {
        // Sync context
        updateUser(updatedUser);
        setAvatarAsset(null);
        setIsEditing(false);
        Alert.alert('Profile Updated', 'Your profile details have been saved.');
      }
    } catch (err) {
      console.error('[UserProfileScreen] Update error:', err);
      Alert.alert('Update Failed', err.response?.data?.message || err.message || 'Failed to save changes.');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Chat with user
  const handleMessageUser = async () => {
    if (isSelf || !profileUser) return;
    try {
      const res = await chatAPI.accessChat({ userId: profileUser._id });
      const chat = res.data;
      if (chat?._id) {
        navigation.navigate('Chat', {
          chatId: chat._id,
          chatName: profileUser.name,
          isGroup: false,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open chat room.');
    }
  };

  // Block / Unblock contact
  const handleToggleBlock = () => {
    if (isSelf || !profileUser) return;
    const actionText = isBlocked ? 'Unblock' : 'Block';
    Alert.alert(
      `${actionText} Contact`,
      `Are you sure you want to ${actionText.toLowerCase()} ${profileUser.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isBlocked ? 'default' : 'destructive',
          onPress: async () => {
            setIsTogglingBlock(true);
            try {
              const res = await userAPI.toggleBlock({ targetUserId: profileUser._id });
              const blockedState = res.data?.blocked;
              setIsBlocked(blockedState);
              
              // Sync context to update blockedUsers globally
              await refreshProfile();
              
              Alert.alert('Success', `User has been ${blockedState ? 'blocked' : 'unblocked'}.`);
            } catch (err) {
              Alert.alert('Action Failed', err.response?.data?.message || err.message);
            } finally {
              setIsTogglingBlock(false);
            }
          }
        }
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.brand.indigo} size="large" />
      </View>
    );
  }

  const avatarUrl = isSelf
    ? currentUser?.profilePic?.url || currentUser?.profilePic
    : profileUser?.profilePic?.url || profileUser?.profilePic;
  const displayName = profileUser?.name || 'User';
  const displayUsername = profileUser?.username || 'unknown';
  const displayBio = profileUser?.bio || profileUser?.about || 'Hey there! I am using PulseChat.';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{isSelf ? 'My Profile' : 'Contact Info'}</Text>
        {isSelf && !isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
            <Ionicons name="create-outline" size={22} color={Colors.brand.indigo} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* EDIT STATE */}
        {isEditing ? (
          <View style={styles.editWrapper}>
            <TouchableOpacity style={styles.editAvatarBtn} onPress={pickAvatar} activeOpacity={0.85}>
              {avatarAsset ? (
                <Image source={{ uri: avatarAsset.uri }} style={styles.editAvatar} />
              ) : avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.editAvatar} />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color={Colors.text.secondary} />
                </View>
              )}
              <View style={styles.editAvatarOverlay}>
                <Ionicons name="camera" size={18} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.editForm}>
              <Text style={styles.inputLabel}>Name</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Name"
                placeholderTextColor={Colors.text.placeholder}
                maxLength={40}
              />

              <Text style={styles.inputLabel}>About</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={editBio}
                onChangeText={setEditBio}
                placeholder="About you"
                placeholderTextColor={Colors.text.placeholder}
                multiline
                maxLength={120}
                numberOfLines={3}
              />

              <Text style={styles.inputLabel}>Phone (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={editPhone}
                onChangeText={setEditPhone}
                placeholder="e.g. +1 (555) 019-2834"
                placeholderTextColor={Colors.text.placeholder}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn]}
                onPress={() => {
                  setIsEditing(false);
                  setAvatarAsset(null);
                  setEditName(currentUser?.name || '');
                  setEditBio(currentUser?.bio || currentUser?.about || '');
                  setEditPhone(currentUser?.phone || '');
                }}
                disabled={isUpdating}
              >
                <Text style={[styles.btnText, { color: Colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.saveBtn, !editName.trim() && styles.saveBtnDisabled]}
                onPress={handleSaveProfile}
                disabled={isUpdating || !editName.trim()}
              >
                {isUpdating ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.btnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* DISPLAY STATE */
          <View style={styles.profileWrapper}>
            <View style={styles.avatarSection}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.largeAvatar} />
              ) : (
                <View style={[styles.largeAvatar, styles.largeAvatarFallback]}>
                  <Text style={styles.largeAvatarLetter}>
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>

            <Text style={styles.nameText}>{displayName}</Text>
            <Text style={styles.usernameText}>@{displayUsername}</Text>

            {/* Direct Action row (only for other users) */}
            {!isSelf && (
              <View style={styles.actionsRow}>
                <TouchableOpacity style={styles.actionCircle} onPress={handleMessageUser}>
                  <Ionicons name="chatbubble" size={20} color="#fff" />
                  <Text style={styles.actionCircleLabel}>Chat</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCircle} onPress={() => Alert.alert('Calling', 'Voice call mock')}>
                  <Ionicons name="call" size={20} color="#fff" />
                  <Text style={styles.actionCircleLabel}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionCircle} onPress={() => Alert.alert('Calling', 'Video call mock')}>
                  <Ionicons name="videocam" size={20} color="#fff" />
                  <Text style={styles.actionCircleLabel}>Video</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Info Cards */}
            <View style={styles.infoContainer}>
              <View style={styles.infoCard}>
                <Text style={styles.infoLabel}>About</Text>
                <Text style={styles.infoValue}>{displayBio}</Text>
              </View>

              {profileUser?.phone ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  <Text style={styles.infoValue}>{profileUser.phone}</Text>
                </View>
              ) : null}

              {profileUser?.email && isSelf ? (
                <View style={styles.infoCard}>
                  <Text style={styles.infoLabel}>Email</Text>
                  <Text style={styles.infoValue}>{profileUser.email}</Text>
                </View>
              ) : null}
            </View>

            {/* Block Action (only for other users) */}
            {!isSelf && (
              <TouchableOpacity
                style={[
                  styles.blockBtn,
                  isBlocked ? styles.unblockBtnStyle : styles.blockBtnStyle
                ]}
                onPress={handleToggleBlock}
                disabled={isTogglingBlock}
              >
                {isTogglingBlock ? (
                  <ActivityIndicator color={isBlocked ? Colors.brand.indigo : Colors.semantic.error} size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={isBlocked ? 'unlock-outline' : 'ban-outline'}
                      size={18}
                      color={isBlocked ? Colors.brand.indigo : Colors.semantic.error}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={[
                      styles.blockBtnText,
                      { color: isBlocked ? Colors.brand.indigo : Colors.semantic.error }
                    ]}>
                      {isBlocked ? 'Unblock Contact' : 'Block Contact'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  loadingContainer: { flex: 1, backgroundColor: Colors.bg.primary, justifyContent: 'center', alignItems: 'center' },
  header: {
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
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, flex: 1 },
  editBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  scrollContent: { paddingBottom: 40 },
  
  // Display styles
  profileWrapper: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarSection: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 16,
    elevation: 12,
    marginBottom: 16,
  },
  largeAvatar: { width: 110, height: 110, borderRadius: 55 },
  largeAvatarFallback: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.brand.indigo,
  },
  largeAvatarLetter: { fontSize: 44, fontWeight: '800', color: Colors.brand.indigo },
  nameText: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  usernameText: { fontSize: 13, color: Colors.brand.indigo, marginBottom: 24 },
  
  actionsRow: { flexDirection: 'row', gap: 24, marginBottom: 28 },
  actionCircle: { alignItems: 'center', gap: 6 },
  actionCircleBtn: {},
  actionCircleLabel: { fontSize: 12, color: Colors.text.secondary, fontWeight: '500' },
  
  // Custom button styling inside direct action
  actionCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1, borderColor: Colors.glass.border,
    alignItems: 'center', justifyContent: 'center',
    gap: 4,
  },
  actionCircleLabel: { fontSize: 11, color: Colors.text.secondary, marginTop: 2, fontWeight: '500' },
  
  infoContainer: { width: '100%', gap: 14, marginBottom: 28 },
  infoCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  infoLabel: { fontSize: 11, fontWeight: '700', color: Colors.brand.indigo, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  infoValue: { fontSize: 15, color: Colors.text.secondary, lineHeight: 22 },

  blockBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    width: '100%', height: 48, borderRadius: 24,
    borderWidth: 1.5,
  },
  blockBtnStyle: { borderColor: Colors.semantic.error, backgroundColor: 'transparent' },
  unblockBtnStyle: { borderColor: Colors.brand.indigo, backgroundColor: 'transparent' },
  blockBtnText: { fontSize: 15, fontWeight: '700' },

  // Edit styles
  editWrapper: { padding: 20, alignItems: 'center' },
  editAvatarBtn: {
    width: 100, height: 100, borderRadius: 50,
    overflow: 'hidden', position: 'relative',
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1.5, borderColor: Colors.glass.border,
    marginBottom: 24,
  },
  editAvatar: { width: 100, height: 100 },
  editAvatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editAvatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 30,
    backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center',
  },
  editForm: { width: '100%', gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, marginTop: 8 },
  textInput: {
    backgroundColor: Colors.bg.secondary, borderRadius: 12, borderWidth: 1, borderColor: Colors.glass.border,
    color: Colors.text.primary, fontSize: 15, paddingHorizontal: 14, height: 48, marginTop: 4,
  },
  multilineInput: { height: 80, paddingVertical: 12, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 28 },
  actionBtn: { flex: 1, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.glass.border },
  saveBtn: { backgroundColor: Colors.brand.indigo },
  saveBtnDisabled: { backgroundColor: Colors.bg.tertiary, opacity: 0.5 },
  btnText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
