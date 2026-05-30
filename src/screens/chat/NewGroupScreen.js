import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity,
  FlatList, Image, ActivityIndicator, StatusBar, Alert, Dimensions,
  ScrollView, KeyboardAvoidingView, Platform, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../theme/colors';
import { userAPI, chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W } = Dimensions.get('window');

export default function NewGroupScreen({ navigation }) {
  const { user } = useAuth();
  
  // Steps: 1 = Add Members, 2 = Group Details
  const [step, setStep] = useState(1);
  
  // Step 1 States
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // Step 2 States
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarAsset, setAvatarAsset] = useState(null);
  const [isCreating, setIsCreating] = useState(false);

  // Animations
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Search contacts dynamically
  const performSearch = async (query) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const res = await userAPI.searchUsers(query.trim());
      // Exclude current user
      const filtered = (res.data || []).filter((u) => u._id !== user?._id);
      setSearchResults(filtered);
    } catch (err) {
      console.warn('[NewGroupScreen] Search error:', err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearchChange = (text) => {
    setSearchQuery(text);
    performSearch(text);
  };

  const toggleUserSelection = (targetUser) => {
    setSelectedUsers((prev) => {
      const exists = prev.some((u) => u._id === targetUser._id);
      if (exists) {
        return prev.filter((u) => u._id !== targetUser._id);
      } else {
        return [...prev, targetUser];
      }
    });
  };

  const removeUser = (targetUser) => {
    setSelectedUsers((prev) => prev.filter((u) => u._id !== targetUser._id));
  };

  const handleNextStep = () => {
    if (selectedUsers.length < 2) {
      Alert.alert('Group requirements', 'Please select at least 2 participants.');
      return;
    }
    setStep(2);
    Animated.spring(slideAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePrevStep = () => {
    setStep(1);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  };

  const pickImage = async () => {
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
      setAvatarAsset(result.assets[0]);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('Required field', 'Please provide a group name.');
      return;
    }
    
    setIsCreating(true);
    try {
      const formData = new FormData();
      formData.append('name', groupName.trim());
      formData.append('description', description.trim());
      
      // Serialize user IDs as expected by backend Zod validator and controller parsing
      const userIds = selectedUsers.map(u => u._id);
      formData.append('users', JSON.stringify(userIds));

      if (avatarAsset) {
        const fileUri = avatarAsset.uri;
        const fileExt = fileUri.split('.').pop() || 'jpg';
        formData.append('groupAvatar', {
          uri: fileUri,
          name: `avatar_${Date.now()}.${fileExt}`,
          type: `image/${fileExt === 'png' ? 'png' : 'jpeg'}`,
        });
      }

      const res = await chatAPI.createGroup(formData);
      const newGroup = res.data;
      
      if (newGroup?._id) {
        // Clear forms
        setGroupName('');
        setDescription('');
        setAvatarAsset(null);
        setSelectedUsers([]);
        
        // Replace with Chat screen
        navigation.reset({
          index: 0,
          routes: [
            { name: 'Tabs' },
            { 
              name: 'Chat', 
              params: { 
                chatId: newGroup._id, 
                chatName: newGroup.chatName, 
                isGroup: true 
              } 
            }
          ],
        });
      } else {
        throw new Error('Invalid group object received');
      }
    } catch (err) {
      console.error('[NewGroupScreen] Create group error:', err);
      Alert.alert('Creation Failed', err.response?.data?.message || err.message || 'Failed to create group. Please check connection.');
    } finally {
      setIsCreating(false);
    }
  };

  // Render Step 1
  const renderStep1 = () => {
    return (
      <View style={styles.stepContainer}>
        {/* Search Input */}
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={handleSearchChange}
            placeholder="Search contacts..."
            placeholderTextColor={Colors.text.placeholder}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Selected List */}
        {selectedUsers.length > 0 && (
          <View style={styles.selectedScrollViewContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedList}
            >
              {selectedUsers.map((item) => (
                <View key={item._id} style={styles.selectedUserBadge}>
                  <View style={styles.badgeAvatarWrapper}>
                    {item.profilePic?.url ? (
                      <Image source={{ uri: item.profilePic.url }} style={styles.badgeAvatar} />
                    ) : (
                      <View style={[styles.badgeAvatar, styles.badgeAvatarFallback]}>
                        <Text style={styles.badgeAvatarLetter}>
                          {item.name?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={styles.badgeRemove}
                      onPress={() => removeUser(item)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="close" size={10} color="#fff" />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.badgeText} numberOfLines={1}>
                    {item.name?.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.divider} />
          </View>
        )}

        {/* Results / List */}
        {isSearching ? (
          <View style={styles.loader}>
            <ActivityIndicator color={Colors.brand.indigo} size="large" />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item._id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isSelected = selectedUsers.some((u) => u._id === item._id);
              return (
                <TouchableOpacity
                  style={styles.userRow}
                  onPress={() => toggleUserSelection(item)}
                >
                  <View style={styles.avatarWrapper}>
                    {item.profilePic?.url ? (
                      <Image source={{ uri: item.profilePic.url }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, styles.avatarFallback]}>
                        <Text style={styles.avatarLetter}>
                          {item.name?.charAt(0)?.toUpperCase()}
                        </Text>
                      </View>
                    )}
                    {isSelected && (
                      <View style={styles.selectCheck}>
                        <Ionicons name="checkmark" size={10} color="#fff" />
                      </View>
                    )}
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>{item.name}</Text>
                    <Text style={styles.userBio} numberOfLines={1}>
                      {item.bio || `bio: @${item.username}`}
                    </Text>
                  </View>
                  <View style={[
                    styles.checkbox,
                    isSelected && styles.checkboxActive
                  ]}>
                    {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={Colors.text.placeholder} />
                <Text style={styles.emptyTitle}>Add participants</Text>
                <Text style={styles.emptySub}>
                  {searchQuery.trim().length >= 2 
                    ? 'No users found matching your search'
                    : 'Search above to find users to add to your new group.'}
                </Text>
              </View>
            }
          />
        )}

        {/* Floating Action Button for Next step */}
        {selectedUsers.length >= 2 && (
          <TouchableOpacity style={styles.fab} onPress={handleNextStep} activeOpacity={0.85}>
            <Ionicons name="arrow-forward" size={24} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render Step 2
  const renderStep2 = () => {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.stepContainer} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Avatar and Info input */}
          <View style={styles.avatarSection}>
            <TouchableOpacity style={styles.avatarBtn} onPress={pickImage} activeOpacity={0.8}>
              {avatarAsset ? (
                <Image source={{ uri: avatarAsset.uri }} style={styles.groupAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="camera-outline" size={32} color={Colors.text.secondary} />
                  <Text style={styles.avatarPlaceholderText}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formContainer}>
            <Text style={styles.inputLabel}>Group Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="Enter group name"
                placeholderTextColor={Colors.text.placeholder}
                maxLength={25}
              />
              <Text style={styles.charCount}>{groupName.length}/25</Text>
            </View>

            <Text style={styles.inputLabel}>Description (Optional)</Text>
            <View style={[styles.inputWrapper, styles.multilineWrapper]}>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Discuss updates, meetups, etc."
                placeholderTextColor={Colors.text.placeholder}
                multiline
                maxLength={150}
                numberOfLines={3}
              />
              <Text style={styles.charCount}>{description.length}/150</Text>
            </View>
          </View>

          {/* Member list horizontal preview */}
          <View style={styles.membersPreviewSection}>
            <Text style={styles.previewTitle}>
              Members: <Text style={{ color: Colors.brand.indigo }}>{selectedUsers.length}</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.membersPreviewScroll}>
              {selectedUsers.map((item) => (
                <View key={item._id} style={styles.previewBadge}>
                  {item.profilePic?.url ? (
                    <Image source={{ uri: item.profilePic.url }} style={styles.previewAvatar} />
                  ) : (
                    <View style={[styles.previewAvatar, styles.badgeAvatarFallback]}>
                      <Text style={[styles.badgeAvatarLetter, { fontSize: 13 }]}>
                        {item.name?.charAt(0)?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.previewName} numberOfLines={1}>
                    {item.name?.split(' ')[0]}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>

          {/* Create Button */}
          <TouchableOpacity
            style={[styles.createBtn, !groupName.trim() && styles.createBtnDisabled]}
            onPress={handleCreateGroup}
            disabled={isCreating || !groupName.trim()}
          >
            {isCreating ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.createBtnText}>Create Group</Text>
                <Ionicons name="checkmark" size={20} color="#fff" style={{ marginLeft: 6 }} />
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={step === 1 ? () => navigation.goBack() : handlePrevStep}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerTitleWrapper}>
          <Text style={styles.headerTitle}>New Group</Text>
          <Text style={styles.headerSub}>
            {step === 1 
              ? `${selectedUsers.length} of 2+ selected` 
              : 'Add subject & description'}
          </Text>
        </View>
      </View>

      {/* Steps */}
      {step === 1 ? renderStep1() : renderStep2()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
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
  headerTitleWrapper: {},
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  headerSub: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  
  stepContainer: { flex: 1 },
  
  // Step 1 styles
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.secondary, borderRadius: 12,
    paddingHorizontal: 12, height: 46,
    marginHorizontal: 16, marginVertical: 14,
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  
  selectedScrollViewContainer: {
    marginBottom: 8,
  },
  selectedList: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 12,
  },
  selectedUserBadge: {
    alignItems: 'center',
    width: 60,
  },
  badgeAvatarWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  badgeAvatar: { width: 50, height: 50, borderRadius: 25 },
  badgeAvatarFallback: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.brand.indigo,
  },
  badgeAvatarLetter: { fontSize: 18, fontWeight: '700', color: Colors.brand.indigo },
  badgeRemove: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.bg.elevated,
    borderRadius: 9, width: 18, height: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  badgeText: { fontSize: 11, color: Colors.text.secondary, textAlign: 'center', width: '100%' },
  divider: { height: 1, backgroundColor: Colors.divider, marginHorizontal: 16 },
  
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingBottom: 80 },
  userRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  avatarWrapper: { position: 'relative', marginRight: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 18, fontWeight: '700', color: Colors.brand.indigo },
  selectCheck: {
    position: 'absolute', bottom: -2, right: -2,
    backgroundColor: Colors.brand.teal,
    borderRadius: 8, width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bg.primary,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '600', color: Colors.text.primary, marginBottom: 2 },
  userBio: { fontSize: 12, color: Colors.text.tertiary },
  checkbox: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.text.placeholder,
    alignItems: 'center', justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.brand.indigo,
    borderColor: Colors.brand.indigo,
  },
  
  emptyState: { alignItems: 'center', paddingVertical: 60, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: Colors.text.secondary, marginTop: 12, marginBottom: 4 },
  emptySub: { fontSize: 13, color: Colors.text.placeholder, textAlign: 'center', lineHeight: 18 },
  
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
  
  // Step 2 styles
  avatarSection: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 20,
  },
  avatarBtn: {
    width: 100, height: 100, borderRadius: 50,
    overflow: 'hidden',
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1.5, borderColor: Colors.glass.border,
    justifyContent: 'center', alignItems: 'center',
  },
  groupAvatar: { width: 100, height: 100 },
  avatarPlaceholder: { alignItems: 'center' },
  avatarPlaceholderText: { fontSize: 11, color: Colors.text.tertiary, marginTop: 4, fontWeight: '600' },
  
  formContainer: { paddingHorizontal: 20, gap: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  inputWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.bg.secondary, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.glass.border,
    paddingHorizontal: 14, height: 50,
  },
  multilineWrapper: {
    height: 100,
    alignItems: 'flex-start',
    paddingVertical: 10,
  },
  textInput: { flex: 1, color: Colors.text.primary, fontSize: 15 },
  multilineInput: { height: '100%', textAlignVertical: 'top' },
  charCount: { fontSize: 11, color: Colors.text.tertiary, marginLeft: 8 },
  
  membersPreviewSection: { marginTop: 28, paddingHorizontal: 20 },
  previewTitle: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary, marginBottom: 12 },
  membersPreviewScroll: { gap: 14 },
  previewBadge: { alignItems: 'center', width: 50 },
  previewAvatar: { width: 44, height: 44, borderRadius: 22, marginBottom: 4 },
  previewName: { fontSize: 10, color: Colors.text.tertiary, textAlign: 'center', width: '100%' },
  
  createBtn: {
    marginHorizontal: 20, marginTop: 32,
    height: 52, borderRadius: 26,
    backgroundColor: Colors.brand.teal,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  createBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
