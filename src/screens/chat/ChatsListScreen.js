import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  RefreshControl,
  StatusBar,
  Animated,
  Image,
  Platform,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { chatAPI, userAPI, messageAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Helpers
const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const oneDay = 86400000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } else if (diff < 2 * oneDay) {
    return 'Yesterday';
  } else if (diff < 7 * oneDay) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
};

const getOtherUser = (chat, currentUser) => {
  if (chat.isGroupChat) return null;
  return chat.users?.find((u) => u._id !== currentUser._id);
};

function ChatRowItem({ chat, currentUser, onPress }) {
  const otherUser = getOtherUser(chat, currentUser);
  const displayName = chat.isGroupChat ? chat.chatName : (otherUser?.name || 'Unknown');
  const avatarUri = chat.isGroupChat ? chat.groupAvatar?.url : otherUser?.profilePic?.url;
  const lastMsg = chat.latestMessage;
  const isOnline = !chat.isGroupChat && otherUser?.isOnline;

  const lastMsgPreview = lastMsg
    ? lastMsg.content || (lastMsg.type === 'image' ? '📷 Photo' : lastMsg.type === 'audio' ? '🎵 Voice' : '📎 File')
    : 'No messages yet';

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.chatRow}
        onPress={() => onPress(chat)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {/* Avatar */}
        <View style={styles.avatarWrapper}>
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarLetter}>
                {displayName?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
          {isOnline && <View style={styles.onlineDot} />}
          {chat.isGroupChat && (
            <View style={styles.groupBadge}>
              <Ionicons name="people" size={10} color="#fff" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={styles.chatContent}>
          <View style={styles.chatTop}>
            <Text style={styles.chatName} numberOfLines={1}>{displayName}</Text>
            <Text style={styles.chatTime}>{formatTime(lastMsg?.createdAt)}</Text>
          </View>
          <View style={styles.chatBottom}>
            <Text style={styles.chatPreview} numberOfLines={1}>{lastMsgPreview}</Text>
            {/* Unread badge placeholder - would need unread count from API */}
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ChatsListScreen({ navigation }) {
  const { user } = useAuth();
  const [chats, setChats] = useState([]);
  const [filteredChats, setFilteredChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Broadcast list states
  const [showBroadcastManager, setShowBroadcastManager] = useState(false);
  const [broadcastLists, setBroadcastLists] = useState([]);
  const [showNewBroadcast, setShowNewBroadcast] = useState(false);
  const [broadcastListName, setBroadcastListName] = useState('');
  const [selectedBroadcastUsers, setSelectedBroadcastUsers] = useState([]);
  const [broadcastSearchQuery, setBroadcastSearchQuery] = useState('');
  const [broadcastSearchResults, setBroadcastSearchResults] = useState([]);
  const [isSearchingBroadcastContacts, setIsSearchingBroadcastContacts] = useState(false);
  const [activeBroadcastList, setActiveBroadcastList] = useState(null);
  const [broadcastLogs, setBroadcastLogs] = useState([]);
  const [broadcastInputText, setBroadcastInputText] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  const [broadcastSendProgress, setBroadcastSendProgress] = useState('');

  const searchAnim = useRef(new Animated.Value(0)).current;
  const fabAnim = useRef(new Animated.Value(1)).current;

  const loadBroadcastLists = async () => {
    try {
      const saved = await AsyncStorage.getItem('broadcast_lists');
      if (saved) {
        setBroadcastLists(JSON.parse(saved));
      } else {
        setBroadcastLists([]);
      }
    } catch (err) {
      console.warn('[loadBroadcastLists] error:', err.message);
    }
  };

  const loadChats = useCallback(async () => {
    try {
      const res = await chatAPI.fetchChats();
      const sorted = (res.data || []).sort((a, b) => {
        const ta = new Date(a.latestMessage?.createdAt || a.updatedAt || 0);
        const tb = new Date(b.latestMessage?.createdAt || b.updatedAt || 0);
        return tb - ta;
      });
      setChats(sorted);
      setFilteredChats(sorted);
    } catch (err) {
      console.error('[ChatsListScreen]', err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadBroadcastLists();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadChats();

      // Listen for real-time new messages to update list
      const socket = getSocket();
      const handleNewMsg = (message) => {
        setChats((prev) => {
          const updated = prev.map((c) =>
            c._id === message.chat?._id ? { ...c, latestMessage: message } : c
          );
          return updated.sort((a, b) => {
            const ta = new Date(a.latestMessage?.createdAt || 0);
            const tb = new Date(b.latestMessage?.createdAt || 0);
            return tb - ta;
          });
        });
      };

      socket?.on('message_received', handleNewMsg);
      return () => {
        socket?.off('message_received', handleNewMsg);
      };
    }, [loadChats])
  );

  // Filter chats on search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
      return;
    }
    const q = searchQuery.toLowerCase();
    const results = chats.filter((c) => {
      const name = c.isGroupChat
        ? c.chatName
        : getOtherUser(c, user)?.name || '';
      return name.toLowerCase().includes(q);
    });
    setFilteredChats(results);
  }, [searchQuery, chats]);

  const toggleSearch = () => {
    const toValue = showSearch ? 0 : 1;
    setShowSearch(!showSearch);
    Animated.timing(searchAnim, {
      toValue,
      duration: 250,
      useNativeDriver: false,
    }).start();
    if (showSearch) setSearchQuery('');
  };

  const handleChatPress = (chat) => {
    navigation.navigate('Chat', { chatId: chat._id, chatName: chat.isGroupChat ? chat.chatName : getOtherUser(chat, user)?.name, isGroup: chat.isGroupChat });
  };

  const handleNewChat = () => {
    navigation.navigate('Search');
  };

  const performBroadcastSearch = async (query) => {
    if (query.trim().length < 2) {
      setBroadcastSearchResults([]);
      return;
    }
    setIsSearchingBroadcastContacts(true);
    try {
      const res = await userAPI.searchUsers(query.trim());
      const filtered = (res.data || []).filter((u) => u._id !== user?._id);
      setBroadcastSearchResults(filtered);
    } catch (err) {
      console.warn('[BroadcastSearch] error:', err.message);
    } finally {
      setIsSearchingBroadcastContacts(false);
    }
  };

  const handleCreateBroadcastList = async () => {
    if (!broadcastListName.trim()) {
      Alert.alert('Required field', 'Please name your broadcast list.');
      return;
    }
    if (selectedBroadcastUsers.length === 0) {
      Alert.alert('Required field', 'Please select at least 1 contact.');
      return;
    }

    const newList = {
      id: `broadcast_${Date.now()}`,
      name: broadcastListName.trim(),
      recipients: selectedBroadcastUsers,
      createdAt: new Date().toISOString(),
    };

    try {
      const updated = [newList, ...broadcastLists];
      await AsyncStorage.setItem('broadcast_lists', JSON.stringify(updated));
      setBroadcastLists(updated);

      setBroadcastListName('');
      setSelectedBroadcastUsers([]);
      setBroadcastSearchQuery('');
      setBroadcastSearchResults([]);
      setShowNewBroadcast(false);
      Alert.alert('Success', `Broadcast List "${newList.name}" created!`);
    } catch (err) {
      Alert.alert('Error', 'Failed to create broadcast list.');
    }
  };

  const handleDeleteBroadcastList = async (listId) => {
    Alert.alert(
      'Delete List',
      'Are you sure you want to delete this broadcast list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = broadcastLists.filter((l) => l.id !== listId);
              await AsyncStorage.setItem('broadcast_lists', JSON.stringify(updated));
              setBroadcastLists(updated);
              await AsyncStorage.removeItem(`broadcast_logs_${listId}`);
            } catch (err) {
              Alert.alert('Error', 'Failed to delete list.');
            }
          },
        },
      ]
    );
  };

  const handleOpenBroadcastSender = async (list) => {
    setActiveBroadcastList(list);
    setBroadcastInputText('');
    try {
      const logsStr = await AsyncStorage.getItem(`broadcast_logs_${list.id}`);
      setBroadcastLogs(logsStr ? JSON.parse(logsStr) : []);
    } catch (err) {
      setBroadcastLogs([]);
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastInputText.trim() || !activeBroadcastList) return;
    const text = broadcastInputText.trim();
    setBroadcastInputText('');
    setIsSendingBroadcast(true);

    const total = activeBroadcastList.recipients.length;
    let sentCount = 0;
    const failedUsers = [];

    for (let i = 0; i < total; i++) {
      const recipient = activeBroadcastList.recipients[i];
      setBroadcastSendProgress(`Sending ${i + 1}/${total} to ${recipient.name}...`);
      try {
        const chatRes = await chatAPI.accessChat({ userId: recipient._id });
        const chatId = chatRes.data?._id || chatRes.data?.data?._id || chatRes.data;

        await messageAPI.sendMessage({
          chatId,
          content: text,
          messageType: 'text',
        });
        sentCount++;
      } catch (err) {
        console.warn(`[Broadcast] Failed to send to ${recipient.name}:`, err.message);
        failedUsers.push(recipient.name);
      }
    }

    try {
      const logItem = {
        id: `log_${Date.now()}`,
        content: text,
        sentCount,
        total,
        failedCount: failedUsers.length,
        failedList: failedUsers,
        createdAt: new Date().toISOString(),
      };
      const logsStr = await AsyncStorage.getItem(`broadcast_logs_${activeBroadcastList.id}`);
      const logs = logsStr ? JSON.parse(logsStr) : [];
      const updatedLogs = [logItem, ...logs];
      await AsyncStorage.setItem(`broadcast_logs_${activeBroadcastList.id}`, JSON.stringify(updatedLogs));
      setBroadcastLogs(updatedLogs);
    } catch (err) {
      console.warn('[BroadcastLog] Save failed:', err.message);
    }

    setIsSendingBroadcast(false);
    setBroadcastSendProgress('');

    if (failedUsers.length > 0) {
      Alert.alert(
        'Broadcast Complete',
        `Sent successfully to ${sentCount} of ${total} recipients.\nFailed: ${failedUsers.join(', ')}`
      );
    } else {
      Alert.alert('Broadcast Complete', `Message sent to all ${total} recipients successfully!`);
    }
  };

  const renderHorizontalBroadcasts = () => {
    if (broadcastLists.length === 0) return null;
    return (
      <View style={styles.broadcastBar}>
        <FlatList
          horizontal
          data={broadcastLists}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.broadcastScroll}
          ListHeaderComponent={
            <TouchableOpacity
              style={styles.broadcastCircleBtn}
              onPress={() => setShowNewBroadcast(true)}
            >
              <View style={styles.broadcastAddCircle}>
                <Ionicons name="add" size={20} color="#fff" />
              </View>
              <Text style={styles.broadcastCircleText} numberOfLines={1}>New List</Text>
            </TouchableOpacity>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.broadcastCircleBtn}
              onPress={() => handleOpenBroadcastSender(item)}
              onLongPress={() => handleDeleteBroadcastList(item.id)}
            >
              <View style={styles.broadcastMegaphoneCircle}>
                <Ionicons name="megaphone" size={20} color="#fff" />
                <View style={styles.recipientsBadge}>
                  <Text style={styles.recipientsBadgeText}>{item.recipients.length}</Text>
                </View>
              </View>
              <Text style={styles.broadcastCircleText} numberOfLines={1}>{item.name}</Text>
            </TouchableOpacity>
          )}
        />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Chats</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={toggleSearch}>
              <Ionicons
                name={showSearch ? 'close' : 'search'}
                size={22}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => setShowBroadcastManager(true)}
            >
              <Ionicons name="megaphone-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => navigation.navigate('NewGroup')}
            >
              <Ionicons name="people-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Animated Search Bar */}
        <Animated.View
          style={[
            styles.searchContainer,
            {
              maxHeight: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 52],
              }),
              opacity: searchAnim,
              marginBottom: searchAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 8],
              }),
            },
          ]}
        >
          <Ionicons name="search" size={16} color={Colors.text.tertiary} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search conversations..."
            placeholderTextColor={Colors.text.placeholder}
            autoFocus={showSearch}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </Animated.View>
      </View>

      {/* Broadcast Bar */}
      {!isLoading && renderHorizontalBroadcasts()}

      {/* Chat List */}
      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color={Colors.brand.indigo} />
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item._id}
          removeClippedSubviews={Platform.OS === 'android'}
          maxToRenderPerBatch={12}
          windowSize={11}
          initialNumToRender={12}
          renderItem={({ item }) => (
            <ChatRowItem
              chat={item}
              currentUser={user}
              onPress={handleChatPress}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => {
                setIsRefreshing(true);
                loadChats();
              }}
              tintColor={Colors.brand.indigo}
              colors={[Colors.brand.indigo]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={48} color={Colors.text.placeholder} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptySubtitle}>
                Tap the button below to start chatting
              </Text>
            </View>
          }
          contentContainerStyle={filteredChats.length === 0 && styles.emptyListContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB - New Chat */}
      <TouchableOpacity style={styles.fab} onPress={handleNewChat} activeOpacity={0.85}>
        <Animated.View style={{ transform: [{ scale: fabAnim }] }}>
          <Ionicons name="create-outline" size={24} color="#fff" />
        </Animated.View>
      </TouchableOpacity>

      {/* ── BROADCAST MANAGER MODAL ── */}
      {showBroadcastManager && (
        <View style={styles.modalOverlay}>
          <View style={[styles.optionsModal, { height: '80%', paddingHorizontal: 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Broadcast Lists</Text>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  onPress={() => {
                    setShowNewBroadcast(true);
                  }}
                  style={styles.headerBtn}
                >
                  <Ionicons name="add" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowBroadcastManager(false)}
                  style={styles.headerBtn}
                >
                  <Ionicons name="close" size={24} color={Colors.text.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <FlatList
              data={broadcastLists}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <View style={styles.broadcastListItem}>
                  <TouchableOpacity
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}
                    onPress={() => {
                      setShowBroadcastManager(false);
                      handleOpenBroadcastSender(item);
                    }}
                  >
                    <View style={styles.listMegaphoneCircle}>
                      <Ionicons name="megaphone" size={20} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.broadcastListNameText}>{item.name}</Text>
                      <Text style={styles.broadcastListRecipientsText}>
                        {item.recipients.length} recipient{item.recipients.length !== 1 ? 's' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteBroadcastList(item.id)}
                    style={styles.listDeleteBtn}
                  >
                    <Ionicons name="trash-outline" size={20} color={Colors.semantic.error} />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Ionicons name="megaphone-outline" size={48} color={Colors.text.placeholder} />
                  <Text style={styles.emptyTitle}>No Broadcast Lists</Text>
                  <Text style={styles.emptySubtitle}>
                    Create lists to send messages to multiple contacts individually.
                  </Text>
                </View>
              }
            />
          </View>
        </View>
      )}

      {/* ── NEW BROADCAST MODAL ── */}
      {showNewBroadcast && (
        <View style={styles.modalOverlay}>
          <View style={[styles.optionsModal, { height: '85%', paddingHorizontal: 16 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New Broadcast List</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowNewBroadcast(false);
                  setBroadcastListName('');
                  setSelectedBroadcastUsers([]);
                  setBroadcastSearchQuery('');
                  setBroadcastSearchResults([]);
                }}
                style={styles.headerBtn}
              >
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* List Name */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.textInput, { height: 44, color: Colors.text.primary }]}
                value={broadcastListName}
                onChangeText={setBroadcastListName}
                placeholder="List Name (e.g. Family)"
                placeholderTextColor={Colors.text.placeholder}
              />
            </View>

            {/* Search contacts */}
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color={Colors.text.tertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                value={broadcastSearchQuery}
                onChangeText={(text) => {
                  setBroadcastSearchQuery(text);
                  performBroadcastSearch(text);
                }}
                placeholder="Search contacts to add..."
                placeholderTextColor={Colors.text.placeholder}
                autoCapitalize="none"
              />
            </View>

            {/* Selected Contacts preview */}
            {selectedBroadcastUsers.length > 0 && (
              <View style={{ maxHeight: 70, marginVertical: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {selectedBroadcastUsers.map((u) => (
                    <View key={u._id} style={styles.selectedUserBadge}>
                      <Text style={styles.badgeText} numberOfLines={1}>{u.name}</Text>
                      <TouchableOpacity onPress={() => setSelectedBroadcastUsers(prev => prev.filter(x => x._id !== u._id))}>
                        <Ionicons name="close-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Search Results */}
            {isSearchingBroadcastContacts ? (
              <ActivityIndicator size="large" color={Colors.brand.indigo} style={{ flex: 1 }} />
            ) : (
              <FlatList
                data={broadcastSearchResults}
                keyExtractor={(item) => item._id}
                style={{ flex: 1 }}
                renderItem={({ item }) => {
                  const isSelected = selectedBroadcastUsers.some((u) => u._id === item._id);
                  return (
                    <TouchableOpacity
                      style={styles.userRow}
                      onPress={() => {
                        setSelectedBroadcastUsers((prev) => {
                          if (prev.some((u) => u._id === item._id)) {
                            return prev.filter((u) => u._id !== item._id);
                          } else {
                            return [...prev, item];
                          }
                        });
                      }}
                    >
                      {item.profilePic?.url ? (
                        <Image source={{ uri: item.profilePic.url }} style={styles.avatar} />
                      ) : (
                        <View style={[styles.avatar, styles.avatarPlaceholder]}>
                          <Text style={styles.avatarLetter}>{item.name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyState}>
                    <Text style={styles.emptySubtitle}>
                      {broadcastSearchQuery.trim().length >= 2
                        ? 'No users found'
                        : 'Type name to search contacts...'}
                    </Text>
                  </View>
                }
              />
            )}

            {/* Create Button */}
            <TouchableOpacity
              style={[styles.createBtn, (selectedBroadcastUsers.length === 0 || !broadcastListName.trim()) && styles.createBtnDisabled]}
              onPress={handleCreateBroadcastList}
              disabled={selectedBroadcastUsers.length === 0 || !broadcastListName.trim()}
            >
              <Text style={styles.createBtnText}>Create Broadcast List</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── BROADCAST SENDER MODAL ── */}
      {activeBroadcastList && (
        <View style={styles.modalOverlay}>
          <View style={[styles.optionsModal, { height: '85%', paddingHorizontal: 16 }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.listMegaphoneCircle}>
                  <Ionicons name="megaphone" size={18} color="#fff" />
                </View>
                <View>
                  <Text style={styles.modalTitle}>{activeBroadcastList.name}</Text>
                  <Text style={styles.modalSubTitle}>
                    {activeBroadcastList.recipients.length} recipients
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setActiveBroadcastList(null)}
                style={styles.headerBtn}
              >
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Logs of Broadcasts */}
            <Text style={styles.logTitle}>Broadcast Logs</Text>
            <FlatList
              data={broadcastLogs}
              keyExtractor={(item) => item.id}
              style={{ flex: 1 }}
              renderItem={({ item }) => (
                <View style={styles.logItemCard}>
                  <Text style={styles.logContentText}>{item.content}</Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                    <Text style={styles.logTimeText}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    <Text style={styles.logStatusText}>
                      Sent to {item.sentCount}/{item.total}
                    </Text>
                  </View>
                  {item.failedCount > 0 && (
                    <Text style={styles.logFailedText}>
                      Failed: {item.failedList.join(', ')}
                    </Text>
                  )}
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptySubtitle}>No messages sent yet to this broadcast list.</Text>
                </View>
              }
            />

            {/* Progress overlay */}
            {isSendingBroadcast && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="large" color={Colors.brand.indigo} />
                <Text style={styles.progressText}>{broadcastSendProgress}</Text>
              </View>
            )}

            {/* Sending input bar */}
            <View style={styles.broadcastInputBar}>
              <View style={styles.broadcastInputWrapper}>
                <TextInput
                  style={styles.broadcastTextInput}
                  value={broadcastInputText}
                  onChangeText={setBroadcastInputText}
                  placeholder="Type broadcast message..."
                  placeholderTextColor={Colors.text.placeholder}
                />
              </View>
              <TouchableOpacity
                style={styles.broadcastSendBtn}
                onPress={handleSendBroadcast}
                disabled={!broadcastInputText.trim() || isSendingBroadcast}
              >
                <Ionicons name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },
  header: {
    backgroundColor: Colors.bg.secondary,
    paddingTop: Platform.OS === 'ios' ? 52 : 16,
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: -0.5,
  },
  headerActions: { flexDirection: 'row', gap: 4 },
  headerBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, color: Colors.text.primary, fontSize: 15, height: 52 },
  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  avatarWrapper: { position: 'relative', marginRight: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarPlaceholder: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 20, fontWeight: '700',
    color: Colors.brand.indigo,
  },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: Colors.status.online,
    borderWidth: 2, borderColor: Colors.bg.primary,
  },
  groupBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: Colors.brand.teal,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.bg.primary,
  },
  chatContent: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary, flex: 1, marginRight: 8 },
  chatTime: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '400' },
  chatBottom: { flexDirection: 'row', alignItems: 'center' },
  chatPreview: { fontSize: 14, color: Colors.text.tertiary, flex: 1 },
  emptyState: {
    alignItems: 'center', paddingTop: 80, paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20, fontWeight: '700', color: Colors.text.primary,
    marginBottom: 8, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20,
  },
  emptyListContent: { flexGrow: 1, justifyContent: 'center' },
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
  broadcastBar: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    backgroundColor: Colors.bg.secondary,
  },
  broadcastScroll: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
  },
  broadcastCircleBtn: {
    alignItems: 'center',
    width: 64,
    marginRight: 12,
  },
  broadcastAddCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  broadcastMegaphoneCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
    position: 'relative',
  },
  recipientsBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: Colors.brand.indigo,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  recipientsBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
  },
  broadcastCircleText: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
    width: '100%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalSubTitle: {
    fontSize: 12,
    color: Colors.text.tertiary,
  },
  broadcastListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  listMegaphoneCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.brand.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  broadcastListNameText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  broadcastListRecipientsText: {
    fontSize: 12,
    color: Colors.text.tertiary,
    marginTop: 2,
  },
  listDeleteBtn: {
    padding: 8,
  },
  logTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginVertical: 10,
  },
  logItemCard: {
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  logContentText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 18,
  },
  logTimeText: {
    fontSize: 11,
    color: Colors.text.placeholder,
  },
  logStatusText: {
    fontSize: 11,
    color: Colors.brand.teal,
    fontWeight: '600',
  },
  logFailedText: {
    fontSize: 11,
    color: Colors.semantic.error,
    marginTop: 4,
  },
  progressContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  progressText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  broadcastInputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  broadcastInputWrapper: {
    flex: 1,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  broadcastTextInput: {
    color: Colors.text.primary,
    fontSize: 14,
  },
  broadcastSendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedUserBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.indigo,
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 32,
    marginRight: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 80,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  userName: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.text.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.brand.indigo,
    borderColor: Colors.brand.indigo,
  },
  createBtn: {
    backgroundColor: Colors.brand.teal,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    shadowColor: Colors.brand.teal,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  optionsModal: {
    backgroundColor: Colors.bg.elevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopWidth: 1,
    borderColor: Colors.glass.border,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 14,
    height: 48,
    marginBottom: 12,
  },
  textInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
  },
});
