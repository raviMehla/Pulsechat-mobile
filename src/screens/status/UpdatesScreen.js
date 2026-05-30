import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, FlatList,
  Image, TextInput, ActivityIndicator, StatusBar, Alert, Modal,
  Dimensions, ScrollView, Platform, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

const GRADIENTS = [
  ['#8EC5FC', '#E0C3FC'], // Light purple-blue
  ['#f77062', '#fe5196'], // Pink-orange
  ['#30cfd0', '#330867'], // Deep teal-indigo
  ['#0F2027', '#203A43', '#2C5364'], // Dark slate
  ['#F76B1C', '#FAD961'], // Vibrant orange-yellow
];

export default function UpdatesScreen() {
  const { user } = useAuth();
  
  // Local status states
  const [myStatus, setMyStatus] = useState(null);
  
  // Status creator states
  const [showTextCreator, setShowTextCreator] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [activeGradientIdx, setActiveGradientIdx] = useState(0);

  // Status Viewer States
  const [activeStories, setActiveStories] = useState([]);
  const [showViewer, setShowViewer] = useState(false);
  const [activeStoryIdx, setActiveStoryIdx] = useState(0);
  const [viewerUser, setViewerUser] = useState(null);

  // Animated bar ref
  const progressAnim = useRef(new Animated.Value(0)).current;
  const progressTimerRef = useRef(null);

  // Pre-populated high fidelity mock updates
  const [mockUpdates, setMockUpdates] = useState([
    {
      _id: 'mock_1',
      user: {
        name: 'Jane Cooper',
        username: 'janecooper',
        profilePic: { url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150' },
      },
      stories: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800', createdAt: new Date(Date.now() - 3600000).toISOString() },
        { type: 'text', content: 'Loving the beach vibe today! 🏖️✨', gradient: ['#f77062', '#fe5196'], createdAt: new Date(Date.now() - 1800000).toISOString() }
      ],
      viewed: false,
    },
    {
      _id: 'mock_2',
      user: {
        name: 'Alex Rivera',
        username: 'alexrivera',
        profilePic: { url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150' },
      },
      stories: [
        { type: 'image', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800', createdAt: new Date(Date.now() - 7200000).toISOString() }
      ],
      viewed: false,
    },
    {
      _id: 'mock_3',
      user: {
        name: 'Emma Watson',
        username: 'emmawatson',
        profilePic: { url: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150' },
      },
      stories: [
        { type: 'text', content: '"The only way to do great work is to love what you do." - Steve Jobs 💡', gradient: ['#30cfd0', '#330867'], createdAt: new Date(Date.now() - 14400000).toISOString() }
      ],
      viewed: true,
    }
  ]);

  // Load user status
  useEffect(() => {
    loadMyStatus();
  }, []);

  const loadMyStatus = async () => {
    try {
      const data = await AsyncStorage.getItem(`my_status_${user?._id}`);
      if (data) {
        setMyStatus(JSON.parse(data));
      } else {
        setMyStatus(null);
      }
    } catch (_) {}
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photos access to share image updates.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.[0]) {
      const newStatus = {
        type: 'image',
        url: result.assets[0].uri,
        createdAt: new Date().toISOString(),
      };
      const updatedStatus = myStatus ? { ...myStatus, stories: [...myStatus.stories, newStatus] } : { user: { name: 'My Status', profilePic: user?.profilePic }, stories: [newStatus] };
      await AsyncStorage.setItem(`my_status_${user?._id}`, JSON.stringify(updatedStatus));
      setMyStatus(updatedStatus);
      Alert.alert('Status shared', 'Your image status has been published.');
    }
  };

  const handleCreateTextStatus = async () => {
    if (!statusText.trim()) return;
    const newStatus = {
      type: 'text',
      content: statusText.trim(),
      gradient: GRADIENTS[activeGradientIdx],
      createdAt: new Date().toISOString(),
    };
    const updatedStatus = myStatus ? { ...myStatus, stories: [...myStatus.stories, newStatus] } : { user: { name: 'My Status', profilePic: user?.profilePic }, stories: [newStatus] };
    await AsyncStorage.setItem(`my_status_${user?._id}`, JSON.stringify(updatedStatus));
    setMyStatus(updatedStatus);
    setStatusText('');
    setShowTextCreator(false);
    Alert.alert('Status shared', 'Your text status has been published.');
  };

  const handleClearStatus = async () => {
    Alert.alert(
      'Clear Status',
      'Are you sure you want to delete all your status updates?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(`my_status_${user?._id}`);
            setMyStatus(null);
          }
        }
      ]
    );
  };

  // Open stories viewer
  const openStories = (targetUser, stories, startIndex = 0) => {
    setViewerUser(targetUser);
    setActiveStories(stories);
    setActiveStoryIdx(startIndex);
    setShowViewer(true);
  };

  // Story playback automation
  useEffect(() => {
    if (!showViewer || activeStories.length === 0) return;
    
    // Reset animation
    progressAnim.setValue(0);
    
    // Start timing
    Animated.timing(progressAnim, {
      toValue: 1,
      duration: 5000, // 5s slide
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });

    return () => {
      progressAnim.setValue(0);
    };
  }, [showViewer, activeStoryIdx, activeStories]);

  const handleNextStory = () => {
    if (activeStoryIdx < activeStories.length - 1) {
      setActiveStoryIdx((prev) => prev + 1);
    } else {
      // End of user's stories, close viewer
      closeViewer();
      // Mark viewed if it was a mock
      if (viewerUser && viewerUser.username !== user?.username) {
        setMockUpdates((prev) =>
          prev.map((up) =>
            up.user.username === viewerUser.username ? { ...up, viewed: true } : up
          )
        );
      }
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIdx > 0) {
      setActiveStoryIdx((prev) => prev - 1);
    } else {
      closeViewer();
    }
  };

  const closeViewer = () => {
    setShowViewer(false);
    setActiveStories([]);
    setActiveStoryIdx(0);
    setViewerUser(null);
  };

  const formatStoryTime = (isoStr) => {
    const diff = Date.now() - new Date(isoStr);
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(isoStr).toLocaleDateString();
  };

  const unviewedMockCount = mockUpdates.filter(u => !u.viewed).length;
  const viewedMockCount = mockUpdates.filter(u => u.viewed).length;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Updates</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* Status Section */}
        <Text style={styles.sectionTitle}>Status</Text>
        
        {/* Status List Cards */}
        <View style={styles.statusListContainer}>
          {/* My Status row */}
          <View style={styles.statusRow}>
            <TouchableOpacity 
              style={styles.avatarWrapper}
              onPress={() => {
                if (myStatus && myStatus.stories?.length > 0) {
                  openStories({ name: 'My Status', username: user?.username, profilePic: user?.profilePic }, myStatus.stories);
                } else {
                  handlePickImage();
                }
              }}
            >
              {user?.profilePic?.url ? (
                <Image source={{ uri: user.profilePic.url }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Text style={styles.avatarLetter}>
                    {user?.name?.charAt(0)?.toUpperCase()}
                  </Text>
                </View>
              )}
              {(!myStatus || myStatus.stories?.length === 0) ? (
                <View style={styles.addStatusBadge}>
                  <Ionicons name="add" size={12} color="#fff" />
                </View>
              ) : (
                <View style={[styles.ringBorder, { borderColor: Colors.brand.indigo }]} />
              )}
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.statusInfo}
              onPress={() => {
                if (myStatus && myStatus.stories?.length > 0) {
                  openStories({ name: 'My Status', username: user?.username, profilePic: user?.profilePic }, myStatus.stories);
                } else {
                  handlePickImage();
                }
              }}
            >
              <Text style={styles.statusName}>My Status</Text>
              <Text style={styles.statusTime}>
                {myStatus && myStatus.stories?.length > 0
                  ? `Tap to view · ${formatStoryTime(myStatus.stories[myStatus.stories.length - 1].createdAt)}`
                  : 'Tap to add status update'}
              </Text>
            </TouchableOpacity>

            {myStatus && myStatus.stories?.length > 0 ? (
              <TouchableOpacity style={styles.clearBtn} onPress={handleClearStatus}>
                <Ionicons name="trash-outline" size={20} color={Colors.text.tertiary} />
              </TouchableOpacity>
            ) : null}
          </View>

          {/* Contact Updates (Unviewed) */}
          {unviewedMockCount > 0 && (
            <View style={styles.feedBlock}>
              <Text style={styles.feedHeader}>Recent updates</Text>
              {mockUpdates.filter(u => !u.viewed).map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.statusRow}
                  onPress={() => openStories(item.user, item.stories)}
                >
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: item.user.profilePic.url }} style={styles.avatar} />
                    <View style={[styles.ringBorder, { borderColor: Colors.brand.teal }]} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={styles.statusName}>{item.user.name}</Text>
                    <Text style={styles.statusTime}>
                      {formatStoryTime(item.stories[item.stories.length - 1].createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Contact Updates (Viewed) */}
          {viewedMockCount > 0 && (
            <View style={styles.feedBlock}>
              <Text style={styles.feedHeader}>Viewed updates</Text>
              {mockUpdates.filter(u => u.viewed).map((item) => (
                <TouchableOpacity
                  key={item._id}
                  style={styles.statusRow}
                  onPress={() => openStories(item.user, item.stories)}
                >
                  <View style={styles.avatarWrapper}>
                    <Image source={{ uri: item.user.profilePic.url }} style={styles.avatar} />
                    <View style={[styles.ringBorder, { borderColor: Colors.divider }]} />
                  </View>
                  <View style={styles.statusInfo}>
                    <Text style={[styles.statusName, { color: Colors.text.secondary }]}>{item.user.name}</Text>
                    <Text style={styles.statusTime}>
                      {formatStoryTime(item.stories[item.stories.length - 1].createdAt)}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity 
          style={styles.miniFab}
          onPress={() => setShowTextCreator(true)}
          activeOpacity={0.85}
        >
          <Ionicons name="pencil" size={20} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.fab}
          onPress={handlePickImage}
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* ─────────────────────────────────────────────────────────────
          TEXT STATUS CREATOR MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showTextCreator}
        animationType="slide"
        onRequestClose={() => setShowTextCreator(false)}
      >
        <SafeAreaView style={[
          styles.textCreatorContainer,
          { backgroundColor: GRADIENTS[activeGradientIdx][0] }
        ]}>
          {/* Header */}
          <View style={styles.creatorHeader}>
            <TouchableOpacity onPress={() => setShowTextCreator(false)} style={styles.creatorHeaderBtn}>
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
            
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setActiveGradientIdx((prev) => (prev + 1) % GRADIENTS.length)}
                style={styles.creatorHeaderBtn}
              >
                <Ionicons name="color-palette-outline" size={26} color="#fff" />
              </TouchableOpacity>
              {statusText.trim().length > 0 && (
                <TouchableOpacity onPress={handleCreateTextStatus} style={styles.creatorHeaderBtn}>
                  <Ionicons name="checkmark" size={26} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Text Input area */}
          <View style={styles.creatorBody}>
            <TextInput
              style={styles.creatorInput}
              value={statusText}
              onChangeText={setStatusText}
              placeholder="Type a status"
              placeholderTextColor="rgba(255,255,255,0.6)"
              multiline
              maxLength={100}
              autoFocus
              textAlign="center"
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* ─────────────────────────────────────────────────────────────
          STORY VIEWER MODAL
          ───────────────────────────────────────────────────────────── */}
      <Modal
        visible={showViewer}
        transparent
        animationType="fade"
        onRequestClose={closeViewer}
      >
        <View style={styles.viewerContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000" />
          
          {/* Progress Indicators Bar */}
          <View style={styles.progressRow}>
            {activeStories.map((story, index) => {
              // Current item animates progress, previous items are 100%, next items are 0%
              let barWidth = '0%';
              if (index < activeStoryIdx) barWidth = '100%';
              else if (index > activeStoryIdx) barWidth = '0%';

              return (
                <View key={index} style={styles.progressBarBackground}>
                  {index === activeStoryIdx ? (
                    <Animated.View
                      style={[
                        styles.progressBarFill,
                        {
                          width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%']
                          })
                        }
                      ]}
                    />
                  ) : (
                    <View style={[styles.progressBarFill, { width: barWidth }]} />
                  )}
                </View>
              );
            })}
          </View>

          {/* Viewer User info Header */}
          <View style={styles.viewerHeader}>
            {viewerUser?.profilePic?.url ? (
              <Image source={{ uri: viewerUser.profilePic.url }} style={styles.viewerAvatar} />
            ) : (
              <View style={[styles.viewerAvatar, styles.viewerAvatarFallback]}>
                <Text style={styles.viewerAvatarLetter}>
                  {viewerUser?.name?.charAt(0)?.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.viewerHeaderInfo}>
              <Text style={styles.viewerName}>{viewerUser?.name}</Text>
              <Text style={styles.viewerTime}>
                {activeStories[activeStoryIdx] 
                  ? formatStoryTime(activeStories[activeStoryIdx].createdAt) 
                  : ''}
              </Text>
            </View>
            <TouchableOpacity onPress={closeViewer} style={styles.viewerCloseBtn}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Viewer Core Content */}
          <View style={styles.viewerBody}>
            {/* Left and Right navigation press tabs */}
            <TouchableOpacity style={styles.leftTap} onPress={handlePrevStory} />
            <TouchableOpacity style={styles.rightTap} onPress={handleNextStory} />

            {/* Displaying Story based on type */}
            {activeStories[activeStoryIdx]?.type === 'image' ? (
              <Image
                source={{ uri: activeStories[activeStoryIdx].url }}
                style={styles.viewerImage}
                resizeMode="contain"
              />
            ) : activeStories[activeStoryIdx]?.type === 'text' ? (
              <View style={[
                styles.viewerTextCard,
                { backgroundColor: activeStories[activeStoryIdx].gradient?.[0] || Colors.brand.indigo }
              ]}>
                <Text style={styles.viewerStoryText}>
                  {activeStories[activeStoryIdx].content}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
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
  sectionTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginHorizontal: 16, marginTop: 16, marginBottom: 8 },
  
  statusListContainer: { paddingHorizontal: 16 },
  statusRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
  },
  avatarWrapper: { position: 'relative', width: 56, height: 56, marginRight: 14, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 20, fontWeight: '700', color: Colors.brand.indigo },
  addStatusBadge: {
    position: 'absolute', bottom: 1, right: 1,
    backgroundColor: Colors.brand.indigo,
    width: 20, height: 20, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bg.primary,
  },
  ringBorder: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 28, borderWidth: 2,
  },
  statusInfo: { flex: 1 },
  statusName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, marginBottom: 4 },
  statusTime: { fontSize: 13, color: Colors.text.tertiary },
  clearBtn: { padding: 8 },

  feedBlock: { marginTop: 18 },
  feedHeader: { fontSize: 12, fontWeight: '700', color: Colors.text.placeholder, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  
  // Floating action button styles
  fabContainer: { position: 'absolute', bottom: 24, right: 20, gap: 14, alignItems: 'center' },
  fab: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.brand.teal,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10,
    elevation: 6,
  },
  miniFab: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.bg.secondary,
    borderWidth: 1, borderColor: Colors.glass.border,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 4,
    elevation: 3,
  },

  // Text Creator styles
  textCreatorContainer: { flex: 1, justifyContent: 'space-between' },
  creatorHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  creatorHeaderBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  creatorBody: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  creatorInput: { color: '#fff', fontSize: 28, fontWeight: '600', width: '100%' },

  // Story Viewer styles
  viewerContainer: { flex: 1, backgroundColor: '#000', paddingVertical: Platform.OS === 'ios' ? 44 : 20 },
  progressRow: { flexDirection: 'row', gap: 6, paddingHorizontal: 10, marginVertical: 8 },
  progressBarBackground: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1.5, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#fff' },

  viewerHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, zIndex: 1000 },
  viewerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  viewerAvatarFallback: { backgroundColor: Colors.bg.tertiary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.brand.indigo },
  viewerAvatarLetter: { fontSize: 14, fontWeight: '700', color: Colors.brand.indigo },
  viewerHeaderInfo: { flex: 1 },
  viewerName: { color: '#fff', fontSize: 14, fontWeight: '600' },
  viewerTime: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 1 },
  viewerCloseBtn: { padding: 6 },

  viewerBody: { flex: 1, position: 'relative', justifyContent: 'center', alignItems: 'center' },
  leftTap: { position: 'absolute', left: 0, top: 0, bottom: 0, width: SCREEN_W * 0.35, zIndex: 900 },
  rightTap: { position: 'absolute', right: 0, top: 0, bottom: 0, width: SCREEN_W * 0.65, zIndex: 900 },
  viewerImage: { width: SCREEN_W, height: SCREEN_H * 0.8 },
  viewerTextCard: { width: SCREEN_W * 0.85, aspectRatio: 3/4, borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 24 },
  viewerStoryText: { color: '#fff', fontSize: 24, fontWeight: '700', textAlign: 'center', lineHeight: 32 },
});
