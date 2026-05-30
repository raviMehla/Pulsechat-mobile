import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList,
  Image, ActivityIndicator, StatusBar, Alert, Dimensions, ScrollView,
  TextInput, Modal, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme/colors';
import { chatAPI, userAPI, messageAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';

const { width: SCREEN_W } = Dimensions.get('window');

export default function GroupInfoScreen({ navigation, route }) {
  const { chatId } = route.params || {};
  const { user } = useAuth();

  // ── State ──
  const [chatDetails, setChatDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modals and editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editAvatarAsset, setEditAvatarAsset] = useState(null);
  const [isUpdatingDetails, setIsUpdatingDetails] = useState(false);

  // Member Action Sheet Modal
  const [selectedMember, setSelectedMember] = useState(null);
  const [showMemberModal, setShowMemberModal] = useState(false);

  // Add Member Modal
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [addSearchResults, setAddSearchResults] = useState([]);
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);

  // Group settings and media gallery states
  const [isMuted, setIsMuted] = useState(false);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mediaGalleryItems, setMediaGalleryItems] = useState([]);

  // Load local settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const muteVal = await AsyncStorage.getItem(`mute_${chatId}`);
        setIsMuted(muteVal === 'true');
        const adminVal = await AsyncStorage.getItem(`admins_only_${chatId}`);
        setAdminsOnly(adminVal === 'true');
      } catch (err) {
        console.warn('Failed to load settings:', err);
      }
    };
    if (chatId) loadSettings();
  }, [chatId]);

  // Toggle Mute
  const handleToggleMute = async () => {
    try {
      const newVal = !isMuted;
      setIsMuted(newVal);
      await AsyncStorage.setItem(`mute_${chatId}`, String(newVal));
    } catch (err) {}
  };

  // Toggle Admins Only
  const handleToggleAdminsOnly = async () => {
    if (!isAdmin) return;
    try {
      const newVal = !adminsOnly;
      setAdminsOnly(newVal);
      await AsyncStorage.setItem(`admins_only_${chatId}`, String(newVal));
      const socket = getSocket();
      socket?.emit('group_settings_updated', { chatId, adminsOnly: newVal });
    } catch (err) {}
  };

  // Fetch media gallery items
  const loadMediaGallery = async () => {
    try {
      const res = await messageAPI.getMessages(chatId, { limit: 100 });
      const raw = res.data?.messages || res.data?.data || res.data || [];
      const filtered = raw.filter(m => m.messageType === 'image' || m.messageType === 'video');
      setMediaGalleryItems(filtered);
      setShowMediaGallery(true);
    } catch (err) {
      console.warn('Failed to load media gallery:', err);
    }
  };

  // Fetch chat info
  const loadGroupDetails = useCallback(async () => {
    try {
      const res = await chatAPI.fetchChats();
      const list = res.data?.data || res.data || [];
      const chats = Array.isArray(list) ? list : [];
      const chat = chats.find((c) => String(c._id) === String(chatId));
      if (!chat) {
        Alert.alert('Error', 'Group details could not be found.');
        navigation.goBack();
        return;
      }
      setChatDetails(chat);
      setEditName(chat.chatName || '');
      setEditDesc(chat.description || '');
      
      const adminId = chat.groupAdmin?._id || chat.groupAdmin;
      setIsAdmin(String(adminId) === String(user?._id));
    } catch (err) {
      console.warn('[GroupInfoScreen] loadGroupDetails error:', err.message);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user?._id, navigation]);

  // Load initially
  useEffect(() => {
    loadGroupDetails();
  }, [chatId]);

  // Real-time socket updates
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onGroupUpdated = (updated) => {
      if (String(updated._id) === String(chatId)) {
        setChatDetails(updated);
        setEditName(updated.chatName || '');
        setEditDesc(updated.description || '');
        const adminId = updated.groupAdmin?._id || updated.groupAdmin;
        setIsAdmin(String(adminId) === String(user?._id));
      }
    };

    const onKicked = ({ chatId: kid }) => {
      if (String(kid) === String(chatId)) {
        Alert.alert('Group Ended', 'You are no longer a participant of this group.');
        navigation.popToTop();
      }
    };

    socket.on('group_updated', onGroupUpdated);
    socket.on('kicked_from_group', onKicked);
    socket.on('group_deleted', onKicked);

    return () => {
      socket.off('group_updated', onGroupUpdated);
      socket.off('kicked_from_group', onKicked);
      socket.off('group_deleted', onKicked);
    };
  }, [chatId, user?._id]);

  // Change avatar
  const pickNewAvatar = async () => {
    if (!isAdmin) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera roll access to set a group picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!result.canceled && result.assets?.[0]) {
      setEditAvatarAsset(result.assets[0]);
    }
  };

  // Submit edits
  const handleSaveDetails = async () => {
    if (!editName.trim()) {
      Alert.alert('Required field', 'Group name cannot be empty.');
      return;
    }
    setIsUpdatingDetails(true);
    try {
      const formData = new FormData();
      formData.append('chatName', editName.trim());
      formData.append('description', editDesc.trim());
      
      if (editAvatarAsset) {
        const fileUri = editAvatarAsset.uri;
        const fileExt = fileUri.split('.').pop() || 'jpg';
        formData.append('groupAvatar', {
          uri: fileUri,
          name: `group_avatar_${Date.now()}.${fileExt}`,
          type: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        });
      }

      const res = await chatAPI.updateGroup(chatId, formData);
      const updated = res.data;
      if (updated) {
        setChatDetails(updated);
        setEditAvatarAsset(null);
        setIsEditing(false);
        Alert.alert('Success', 'Group details updated successfully.');
      }
    } catch (err) {
      console.error('[GroupInfoScreen] Update details error:', err);
      Alert.alert('Update Failed', err.response?.data?.message || err.message || 'Failed to update details.');
    } finally {
      setIsUpdatingDetails(false);
    }
  };

  // Promote to Admin
  const handlePromoteAdmin = async (targetMember) => {
    setShowMemberModal(false);
    try {
      await chatAPI.promoteToAdmin({ chatId, userId: targetMember._id });
      Alert.alert('Promoted', `${targetMember.name} is now a Group Admin.`);
      loadGroupDetails();
    } catch (err) {
      Alert.alert('Failed to Promote', err.response?.data?.message || err.message);
    }
  };

  // Remove from Group
  const handleRemoveMember = async (targetMember) => {
    setShowMemberModal(false);
    Alert.alert(
      'Remove Participant',
      `Are you sure you want to remove ${targetMember.name} from the group?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.removeFromGroup({ chatId, userId: targetMember._id });
              Alert.alert('Removed', `${targetMember.name} has been removed.`);
              loadGroupDetails();
            } catch (err) {
              Alert.alert('Remove Failed', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  // Leave Group
  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.leaveGroup({ chatId });
              navigation.popToTop();
            } catch (err) {
              Alert.alert('Error Leaving', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  // Disband/Delete Group
  const handleDisbandGroup = () => {
    Alert.alert(
      'Disband Group',
      'This will delete the entire group and clear all messages for all members. This cannot be undone. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disband',
          style: 'destructive',
          onPress: async () => {
            try {
              await chatAPI.deleteChat(chatId);
              navigation.popToTop();
            } catch (err) {
              Alert.alert('Disband Failed', err.response?.data?.message || err.message);
            }
          }
        }
      ]
    );
  };

  // Message member (direct chat)
  const handleMessageMember = async (targetMember) => {
    setShowMemberModal(false);
    if (String(targetMember._id) === String(user?._id)) return;
    try {
      const res = await chatAPI.accessChat({ userId: targetMember._id });
      const chat = res.data;
      if (chat?._id) {
        navigation.navigate('Chat', {
          chatId: chat._id,
          chatName: targetMember.name,
          isGroup: false,
        });
      }
    } catch (err) {
      Alert.alert('Error', 'Could not open chat with participant.');
    }
  };

  // Search contacts to add
  const handleAddSearch = async (text) => {
    setAddSearchQuery(text);
    if (text.trim().length < 2) {
      setAddSearchResults([]);
      return;
    }
    setIsSearchingUsers(true);
    try {
      const res = await userAPI.searchUsers(text.trim());
      // Exclude members already in the group
      const existingIds = chatDetails?.users?.map((u) => String(u._id)) || [];
      const filtered = (res.data || []).filter(
        (u) => !existingIds.includes(String(u._id))
      );
      setAddSearchResults(filtered);
    } catch (err) {
      console.warn('[GroupInfoScreen] Search users error:', err.message);
    } finally {
      setIsSearchingUsers(false);
    }
  };

  // Add user to group
  const handleAddUserToGroup = async (targetUser) => {
    setIsAddingUser(true);
    try {
      await chatAPI.addToGroup({ chatId, userId: targetUser._id });
      Alert.alert('Added', `${targetUser.name} added to the group.`);
      setAddSearchQuery('');
      setAddSearchResults([]);
      setShowAddMemberModal(false);
      loadGroupDetails();
    } catch (err) {
      Alert.alert('Add Failed', err.response?.data?.message || err.message || 'Could not add user.');
    } finally {
      setIsAddingUser(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={Colors.brand.indigo} size="large" />
      </View>
    );
  }

  const groupAvatarUrl = chatDetails?.groupAvatar?.url || chatDetails?.groupAvatar;
  const adminUser = chatDetails?.groupAdmin;
  const participants = chatDetails?.users || [];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* Header Bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        {isAdmin && !isEditing && (
          <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
            <Ionicons name="create-outline" size={22} color={Colors.brand.indigo} />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* EDITING MODE */}
        {isEditing ? (
          <View style={styles.editSection}>
            <TouchableOpacity style={styles.editAvatarBtn} onPress={pickNewAvatar} activeOpacity={0.8}>
              {editAvatarAsset ? (
                <Image source={{ uri: editAvatarAsset.uri }} style={styles.editAvatarImage} />
              ) : groupAvatarUrl ? (
                <Image source={{ uri: groupAvatarUrl }} style={styles.editAvatarImage} />
              ) : (
                <View style={styles.editAvatarPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={Colors.text.secondary} />
                  <Text style={styles.editAvatarText}>Change Photo</Text>
                </View>
              )}
              <View style={styles.editAvatarOverlay}>
                <Ionicons name="camera" size={20} color="#fff" />
              </View>
            </TouchableOpacity>

            <View style={styles.editForm}>
              <Text style={styles.editFormLabel}>Group Name</Text>
              <TextInput
                style={styles.editTextInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Group name"
                placeholderTextColor={Colors.text.placeholder}
                maxLength={25}
              />
              <Text style={styles.editFormLabel}>Description</Text>
              <TextInput
                style={[styles.editTextInput, styles.editTextDesc]}
                value={editDesc}
                onChangeText={setEditDesc}
                placeholder="Add group description..."
                placeholderTextColor={Colors.text.placeholder}
                multiline
                maxLength={150}
                numberOfLines={3}
              />
            </View>

            <View style={styles.editActions}>
              <TouchableOpacity
                style={[styles.editActionBtn, styles.editActionCancel]}
                onPress={() => {
                  setIsEditing(false);
                  setEditAvatarAsset(null);
                  setEditName(chatDetails?.chatName || '');
                  setEditDesc(chatDetails?.description || '');
                }}
                disabled={isUpdatingDetails}
              >
                <Text style={[styles.editActionText, { color: Colors.text.secondary }]}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.editActionBtn, styles.editActionSave]}
                onPress={handleSaveDetails}
                disabled={isUpdatingDetails || !editName.trim()}
              >
                {isUpdatingDetails ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.editActionText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* DISPLAY MODE */
          <View style={styles.profileSection}>
            <View style={styles.avatarContainer}>
              {groupAvatarUrl ? (
                <Image source={{ uri: groupAvatarUrl }} style={styles.largeAvatar} />
              ) : (
                <View style={[styles.largeAvatar, styles.largeAvatarFallback]}>
                  <Text style={styles.largeAvatarLetter}>
                    {chatDetails?.chatName?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            
            <Text style={styles.groupNameText}>{chatDetails?.chatName}</Text>
            <Text style={styles.groupMetaText}>
              Group · {participants.length} Participants
            </Text>
            {chatDetails?.description ? (
              <View style={styles.descCard}>
                <Text style={styles.descTitle}>Group Description</Text>
                <Text style={styles.descText}>{chatDetails.description}</Text>
              </View>
            ) : null}

            {/* GROUP SETTINGS CARD */}
            <View style={styles.settingsCard}>
              <Text style={styles.descTitle}>Group Settings</Text>
              
              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingItemTitle}>Mute Notifications</Text>
                  <Text style={styles.settingItemSub}>Silence notifications for this chat</Text>
                </View>
                <Switch
                  value={isMuted}
                  onValueChange={handleToggleMute}
                  trackColor={{ false: '#3A3A3C', true: Colors.brand.indigo }}
                  thumbColor={isMuted ? '#fff' : '#8E8E93'}
                />
              </View>

              <View style={styles.settingItem}>
                <View style={styles.settingTextContainer}>
                  <Text style={styles.settingItemTitle}>Media Gallery</Text>
                  <Text style={styles.settingItemSub}>View shared photos & videos</Text>
                </View>
                <TouchableOpacity style={styles.settingActionBtn} onPress={loadMediaGallery}>
                  <Ionicons name="images-outline" size={20} color={Colors.brand.indigo} />
                </TouchableOpacity>
              </View>

              {isAdmin && (
                <View style={[styles.settingItem, { borderBottomWidth: 0, paddingBottom: 0 }]}>
                  <View style={styles.settingTextContainer}>
                    <Text style={styles.settingItemTitle}>Only Admins Send Messages</Text>
                    <Text style={styles.settingItemSub}>Restrict messaging to admins only</Text>
                  </View>
                  <Switch
                    value={adminsOnly}
                    onValueChange={handleToggleAdminsOnly}
                    trackColor={{ false: '#3A3A3C', true: Colors.brand.indigo }}
                    thumbColor={adminsOnly ? '#fff' : '#8E8E93'}
                  />
                </View>
              )}
            </View>
          </View>
        )}

        <View style={styles.sectionDivider} />

        {/* PARTICIPANTS SECTION */}
        <View style={styles.participantsHeader}>
          <Text style={styles.participantsTitle}>
            Participants ({participants.length})
          </Text>
          {isAdmin && (
            <TouchableOpacity
              style={styles.addParticipantBtn}
              onPress={() => setShowAddMemberModal(true)}
            >
              <Ionicons name="person-add-outline" size={16} color={Colors.brand.indigo} />
              <Text style={styles.addParticipantText}>Add Member</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.participantsList}>
          {participants.map((item) => {
            const isUserAdmin = String(chatDetails?.groupAdmin?._id || chatDetails?.groupAdmin) === String(item._id);
            const isSelf = String(item._id) === String(user?._id);
            return (
              <TouchableOpacity
                key={item._id}
                style={styles.participantRow}
                onPress={() => {
                  setSelectedMember(item);
                  setShowMemberModal(true);
                }}
                activeOpacity={0.7}
              >
                {item.profilePic?.url ? (
                  <Image source={{ uri: item.profilePic.url }} style={styles.memberAvatar} />
                ) : (
                  <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                    <Text style={styles.memberAvatarLetter}>
                      {item.name?.charAt(0)?.toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.memberInfo}>
                  <Text style={styles.memberName}>
                    {item.name} {isSelf && <Text style={styles.selfTag}>(You)</Text>}
                  </Text>
                  <Text style={styles.memberUsername}>@{item.username}</Text>
                </View>
                {isUserAdmin && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>Group Admin</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.sectionDivider} />

        {/* GROUP DESTRUCTION ACTIONS */}
        <View style={styles.actionContainer}>
          <TouchableOpacity style={styles.actionRow} onPress={handleLeaveGroup}>
            <Ionicons name="log-out-outline" size={22} color={Colors.semantic.error} />
            <Text style={[styles.actionLabel, { color: Colors.semantic.error }]}>Leave Group</Text>
          </TouchableOpacity>
          
          {isAdmin && (
            <TouchableOpacity style={[styles.actionRow, { borderBottomWidth: 0 }]} onPress={handleDisbandGroup}>
              <Ionicons name="trash-outline" size={22} color={Colors.semantic.error} />
              <Text style={[styles.actionLabel, { color: Colors.semantic.error }]}>Disband Group</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────
          MEMBER ACTION SHEET MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showMemberModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMemberModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowMemberModal(false)}
        >
          <View style={styles.bottomSheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{selectedMember?.name}</Text>
              <Text style={styles.sheetSub}>@{selectedMember?.username}</Text>
            </View>

            <View style={styles.sheetDivider} />

            {/* MESSAGE MEMBER */}
            {selectedMember && String(selectedMember._id) !== String(user?._id) && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => handleMessageMember(selectedMember)}>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={Colors.text.primary} />
                <Text style={styles.sheetLabel}>Message {selectedMember.name?.split(' ')[0]}</Text>
              </TouchableOpacity>
            )}

            {/* PROMOTE ADMIN */}
            {isAdmin && selectedMember && String(selectedMember._id) !== String(user?._id) &&
              String(chatDetails?.groupAdmin?._id || chatDetails?.groupAdmin) !== String(selectedMember._id) && (
              <TouchableOpacity style={styles.sheetRow} onPress={() => handlePromoteAdmin(selectedMember)}>
                <Ionicons name="ribbon-outline" size={20} color={Colors.brand.indigo} />
                <Text style={styles.sheetLabel}>Make Group Admin</Text>
              </TouchableOpacity>
            )}

            {/* REMOVE FROM GROUP */}
            {isAdmin && selectedMember && String(selectedMember._id) !== String(user?._id) && (
              <TouchableOpacity
                style={[styles.sheetRow, { borderBottomWidth: 0 }]}
                onPress={() => handleRemoveMember(selectedMember)}
              >
                <Ionicons name="person-remove-outline" size={20} color={Colors.semantic.error} />
                <Text style={[styles.sheetLabel, { color: Colors.semantic.error }]}>Remove from Group</Text>
              </TouchableOpacity>
            )}

            {/* CANCEL */}
            <TouchableOpacity
              style={[styles.sheetRow, styles.sheetRowCancel]}
              onPress={() => setShowMemberModal(false)}
            >
              <Ionicons name="close-outline" size={20} color={Colors.text.tertiary} />
              <Text style={[styles.sheetLabel, { color: Colors.text.tertiary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          ADD PARTICIPANT MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showAddMemberModal}
        animationType="slide"
        onRequestClose={() => setShowAddMemberModal(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: Colors.bg.primary }]}>
          <StatusBar barStyle="light-content" />
          
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowAddMemberModal(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Add Participant</Text>
          </View>

          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={addSearchQuery}
              onChangeText={handleAddSearch}
              placeholder="Search people..."
              placeholderTextColor={Colors.text.placeholder}
              autoCapitalize="none"
              autoFocus
            />
            {addSearchQuery ? (
              <TouchableOpacity onPress={() => handleAddSearch('')}>
                <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isSearchingUsers ? (
            <ActivityIndicator style={{ marginTop: 40 }} color={Colors.brand.indigo} size="large" />
          ) : (
            <FlatList
              data={addSearchResults}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.participantRow}
                  onPress={() => handleAddUserToGroup(item)}
                  disabled={isAddingUser}
                >
                  {item.profilePic?.url ? (
                    <Image source={{ uri: item.profilePic.url }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarFallback]}>
                      <Text style={styles.memberAvatarLetter}>
                        {item.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Text style={styles.memberUsername}>@{item.username}</Text>
                  </View>
                  <Ionicons name="add-circle" size={24} color={Colors.brand.indigo} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="person-outline" size={48} color={Colors.text.placeholder} />
                  <Text style={styles.emptyTitle}>Add new member</Text>
                  <Text style={styles.emptySub}>
                    {addSearchQuery.trim().length >= 2 
                      ? 'No users found matching search'
                      : 'Type name or username to search for users to add.'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          SHARED MEDIA GALLERY MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showMediaGallery}
        animationType="slide"
        onRequestClose={() => setShowMediaGallery(false)}
      >
        <SafeAreaView style={[styles.container, { backgroundColor: '#000' }]}>
          <StatusBar barStyle="light-content" />
          
          <View style={[styles.header, { backgroundColor: '#000', borderBottomColor: '#1A1A1A' }]}>
            <TouchableOpacity onPress={() => setShowMediaGallery(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: '#fff' }]}>Shared Media</Text>
          </View>

          <FlatList
            data={mediaGalleryItems}
            keyExtractor={(item) => item._id}
            numColumns={3}
            contentContainerStyle={{ padding: 4 }}
            renderItem={({ item, index }) => {
              const url = item.fileUrl || item.mediaUrl;
              const isVideo = item.messageType === 'video';
              return (
                <TouchableOpacity
                  style={styles.galleryItemBtn}
                  onPress={() => {
                    setShowMediaGallery(false);
                    navigation.navigate('MediaViewer', {
                      mediaItems: mediaGalleryItems,
                      initialIndex: index
                    });
                  }}
                >
                  <Image source={{ uri: url }} style={styles.galleryThumb} />
                  {isVideo && (
                    <View style={styles.galleryPlayIcon}>
                      <Ionicons name="play" size={16} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="images-outline" size={48} color={Colors.text.placeholder} />
                <Text style={styles.emptyTitle}>No shared media</Text>
                <Text style={styles.emptySub}>Photos and videos shared in this chat will appear here.</Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
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
  
  // Profile display section
  profileSection: { alignItems: 'center', paddingVertical: 24, paddingHorizontal: 20 },
  avatarContainer: {
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
  groupNameText: { fontSize: 22, fontWeight: '700', color: Colors.text.primary, textAlign: 'center', marginBottom: 6 },
  groupMetaText: { fontSize: 13, color: Colors.text.tertiary, textAlign: 'center', marginBottom: 20 },
  descCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  descTitle: { fontSize: 12, fontWeight: '700', color: Colors.brand.indigo, textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  descText: { fontSize: 14, color: Colors.text.secondary, lineHeight: 20 },

  // Edit details styles
  editSection: { padding: 20, alignItems: 'center' },
  editAvatarBtn: {
    width: 100, height: 100, borderRadius: 50,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1.5, borderColor: Colors.glass.border,
    marginBottom: 20,
  },
  editAvatarImage: { width: 100, height: 100 },
  editAvatarPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  editAvatarText: { fontSize: 10, color: Colors.text.tertiary, marginTop: 4, fontWeight: '600' },
  editAvatarOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 32,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  editForm: { width: '100%', gap: 10 },
  editFormLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, marginTop: 6 },
  editTextInput: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 12, borderWidth: 1, borderColor: Colors.glass.border,
    color: Colors.text.primary, fontSize: 15, paddingHorizontal: 14, height: 48,
  },
  editTextDesc: { height: 80, paddingVertical: 12, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', width: '100%', gap: 12, marginTop: 24 },
  editActionBtn: {
    flex: 1, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  editActionCancel: { backgroundColor: Colors.bg.tertiary, borderWidth: 1, borderColor: Colors.glass.border },
  editActionSave: { backgroundColor: Colors.brand.indigo },
  editActionText: { fontSize: 15, fontWeight: '700', color: '#fff' },

  sectionDivider: { height: 8, backgroundColor: Colors.bg.secondary, borderTopWidth: 1, borderBottomWidth: 1, borderColor: Colors.divider },

  // Participants styles
  participantsHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
  },
  participantsTitle: { fontSize: 15, fontWeight: '700', color: Colors.text.primary },
  addParticipantBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addParticipantText: { fontSize: 14, color: Colors.brand.indigo, fontWeight: '600' },
  
  participantsList: { paddingHorizontal: 20 },
  participantRow: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  memberAvatar: { width: 42, height: 42, borderRadius: 21, marginRight: 12 },
  memberAvatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  memberAvatarLetter: { fontSize: 16, fontWeight: '700', color: Colors.brand.indigo },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  selfTag: { fontSize: 13, color: Colors.text.tertiary, fontWeight: '400' },
  memberUsername: { fontSize: 12, color: Colors.text.tertiary },
  adminBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: Colors.brand.teal + '20', borderWidth: 0.5, borderColor: Colors.brand.teal,
  },
  adminBadgeText: { fontSize: 10, color: Colors.brand.teal, fontWeight: '700' },

  // Destruction Actions styles
  actionContainer: { backgroundColor: Colors.bg.primary, paddingHorizontal: 20, marginVertical: 16 },
  actionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  actionLabel: { fontSize: 15, fontWeight: '600' },

  // Modal / Bottom sheet styles
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: Colors.bg.elevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 16, paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1, borderColor: Colors.glass.border,
  },
  sheetHeader: { alignItems: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 4, textAlign: 'center' },
  sheetSub: { fontSize: 13, color: Colors.text.tertiary },
  sheetDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 8 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 24, paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  sheetRowCancel: { borderBottomWidth: 0 },
  sheetLabel: { fontSize: 15, fontWeight: '500', color: Colors.text.primary },

  // Add Participant styles
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.secondary, borderRadius: 12,
    paddingHorizontal: 12, height: 46,
    marginHorizontal: 16, marginVertical: 14,
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: Colors.text.secondary, marginTop: 12, marginBottom: 4 },
  emptySub: { fontSize: 13, color: Colors.text.placeholder, textAlign: 'center', lineHeight: 18 },

  // Settings card styles
  settingsCard: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16,
    padding: 16,
    width: '100%',
    borderWidth: 1, borderColor: Colors.glass.border,
    marginTop: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  settingTextContainer: {
    flex: 1,
    paddingRight: 10,
  },
  settingItemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  settingItemSub: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  settingActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  
  // Gallery styles
  galleryItemBtn: {
    width: SCREEN_W / 3 - 6,
    height: SCREEN_W / 3 - 6,
    margin: 3,
    backgroundColor: '#111',
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  galleryThumb: {
    width: '100%',
    height: '100%',
  },
  galleryPlayIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
