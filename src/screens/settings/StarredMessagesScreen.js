import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, StatusBar, Platform, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../theme/colors';
import { messageAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

// Helper: format a timestamp into a readable relative date
function formatDate(ts) {
  const now = new Date();
  const date = new Date(ts);
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function StarredMessageBubble({ item, onNavigate, currentUserId }) {
  const isMine = String(item.sender?._id) === String(currentUserId);

  const renderContent = () => {
    switch (item.messageType) {
      case 'image':
        return (
          <View style={styles.mediaRow}>
            <Ionicons name="image-outline" size={16} color={Colors.text.tertiary} />
            <Text style={styles.mediaLabel}>Photo</Text>
          </View>
        );
      case 'video':
        return (
          <View style={styles.mediaRow}>
            <Ionicons name="videocam-outline" size={16} color={Colors.text.tertiary} />
            <Text style={styles.mediaLabel}>Video</Text>
          </View>
        );
      case 'file':
        return (
          <View style={styles.mediaRow}>
            <Ionicons name="document-outline" size={16} color={Colors.text.tertiary} />
            <Text style={styles.mediaLabel}>{item.fileName || 'Document'}</Text>
          </View>
        );
      default:
        return (
          <Text style={styles.messageContent} numberOfLines={3}>
            {item.content || '(deleted message)'}
          </Text>
        );
    }
  };

  return (
    <TouchableOpacity
      style={styles.bubble}
      onPress={() => onNavigate(item)}
      activeOpacity={0.8}
      accessibilityLabel={`Starred message from ${item.sender?.name || 'Unknown'}: ${item.content || item.messageType}`}
      accessibilityRole="button"
    >
      {/* Top row: sender + date */}
      <View style={styles.bubbleHeader}>
        <View style={styles.senderRow}>
          <View style={[styles.senderAvatar, isMine && styles.senderAvatarMine]}>
            <Text style={styles.senderInitial}>
              {(item.sender?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={styles.senderName}>
              {isMine ? 'You' : (item.sender?.name || 'Unknown')}
            </Text>
            {item.chat?.chatName && (
              <Text style={styles.chatName}>{item.chat.chatName}</Text>
            )}
          </View>
        </View>
        <View style={styles.metaRight}>
          <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          <Ionicons name="star" size={14} color="#FFD60A" />
        </View>
      </View>

      {/* Message body */}
      <View style={styles.bubbleBody}>
        {renderContent()}
      </View>

      {/* Footer: jump to chat */}
      <View style={styles.bubbleFooter}>
        <Ionicons name="arrow-forward-circle-outline" size={14} color={Colors.brand.indigo} />
        <Text style={styles.jumpText}>Jump to message</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function StarredMessagesScreen({ navigation }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const fetchStarred = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshing(true);
    else setIsLoading(true);
    setError('');
    try {
      // Starred messages API — hits the backend starred endpoint
      // We use a dedicated endpoint: GET /api/message/starred
      const res = await messageAPI.getStarredMessages();
      setMessages(res.data || []);
    } catch (err) {
      setError('Could not load starred messages. Pull down to retry.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStarred();
  }, [fetchStarred]);

  const handleNavigate = (item) => {
    if (item.chat?._id) {
      navigation.navigate('Chat', {
        chatId: item.chat._id,
        chatName: item.chat.chatName || item.sender?.name,
        jumpToMessageId: item._id,
      });
    }
  };

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconBox}>
          <Ionicons name="star-outline" size={48} color={Colors.text.placeholder} />
        </View>
        <Text style={styles.emptyTitle}>No starred messages</Text>
        <Text style={styles.emptySubtitle}>
          Long-press any message and tap ★ Star to save it here for quick access.
        </Text>
      </View>
    );
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
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Starred Messages</Text>
          {messages.length > 0 && (
            <Text style={styles.headerCount}>{messages.length} message{messages.length !== 1 ? 's' : ''}</Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.brand.indigo} />
          <Text style={styles.loadingText}>Loading starred messages…</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={40} color={Colors.text.placeholder} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => fetchStarred()}
            accessibilityLabel="Retry loading starred messages"
            accessibilityRole="button"
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={messages}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <StarredMessageBubble
              item={item}
              onNavigate={handleNavigate}
              currentUserId={user?._id}
            />
          )}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchStarred(true)}
              tintColor={Colors.brand.indigo}
              colors={[Colors.brand.indigo]}
            />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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
    borderBottomWidth: 1, borderBottomColor: Colors.divider, gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, letterSpacing: -0.3 },
  headerCount: { fontSize: 12, color: Colors.text.tertiary, marginTop: 2 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { color: Colors.text.tertiary, fontSize: 14 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 32 },
  errorText: { color: Colors.text.secondary, fontSize: 14, textAlign: 'center', lineHeight: 20 },
  retryBtn: {
    backgroundColor: Colors.brand.indigo, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 10,
  },
  retryBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  listContent: { padding: 16, flexGrow: 1 },
  separator: { height: 10 },
  bubble: {
    backgroundColor: Colors.bg.secondary,
    borderRadius: 16, borderWidth: 1, borderColor: Colors.glass.border,
    padding: 14, overflow: 'hidden',
  },
  bubbleHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  senderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  senderAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(124,110,247,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  senderAvatarMine: { backgroundColor: 'rgba(54,187,173,0.15)' },
  senderInitial: { color: Colors.brand.indigo, fontWeight: '700', fontSize: 15 },
  senderName: { fontSize: 14, fontWeight: '600', color: Colors.text.primary },
  chatName: { fontSize: 11, color: Colors.text.tertiary, marginTop: 1 },
  metaRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dateText: { fontSize: 11, color: Colors.text.placeholder },
  bubbleBody: {
    borderLeftWidth: 2, borderLeftColor: Colors.brand.indigo,
    paddingLeft: 10, marginBottom: 10,
  },
  messageContent: { color: Colors.text.primary, fontSize: 14, lineHeight: 20 },
  mediaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  mediaLabel: { color: Colors.text.secondary, fontSize: 13 },
  bubbleFooter: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  jumpText: { color: Colors.brand.indigo, fontSize: 12, fontWeight: '500' },
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16, padding: 48,
  },
  emptyIconBox: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.bg.secondary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  emptySubtitle: { fontSize: 14, color: Colors.text.tertiary, textAlign: 'center', lineHeight: 20 },
});
