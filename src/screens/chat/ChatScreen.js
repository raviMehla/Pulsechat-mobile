// ============================================================
// ChatScreen.js — Full chat experience for mobile-apk
// Features: Messages, real-time socket, typing, media, reply
// ============================================================

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator,
  StatusBar, Alert, Animated, Linking, Image, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useFocusEffect, useSafeAreaInsets } from '@react-navigation/native';
import { Colors } from '../../theme/colors';
import { messageAPI, chatAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../services/socket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';

const { width: SCREEN_W } = Dimensions.get('window');
const MESSAGE_LIMIT = 25;

// ─────────────────────────────────────────────────────────────
// TYPING INDICATOR
// ─────────────────────────────────────────────────────────────
function TypingIndicator() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    dots.forEach((dot, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(dot, { toValue: 1, duration: 280, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 280, useNativeDriver: true }),
        ])
      ).start();
    });
  }, []);

  return (
    <View style={styles.typingContainer}>
      <View style={styles.typingBubble}>
        {dots.map((dot, i) => (
          <Animated.View
            key={i}
            style={[
              styles.typingDot,
              {
                transform: [{
                  translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }),
                }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────
function SkeletonBubble({ isMine, width }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        styles.skeletonBubble,
        isMine ? styles.skeletonMine : styles.skeletonTheirs,
        { width: SCREEN_W * width, opacity },
      ]}
    />
  );
}

function ChatSkeleton() {
  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16, gap: 12 }}>
      <SkeletonBubble isMine={false} width={0.55} />
      <SkeletonBubble isMine={true} width={0.40} />
      <SkeletonBubble isMine={false} width={0.70} />
      <SkeletonBubble isMine={true} width={0.50} />
      <SkeletonBubble isMine={false} width={0.45} />
      <SkeletonBubble isMine={true} width={0.65} />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// AUDIO PLAYER BUBBLE (waveform progress animation)
// ─────────────────────────────────────────────────────────────
function AudioPlayerBubble({ fileUrl, duration, isMine }) {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [soundDuration, setSoundDuration] = useState(0);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync().catch(() => {});
        }
      : undefined;
  }, [sound]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setSoundDuration(status.durationMillis || 0);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const playPauseSound = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: fileUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (err) {
      console.warn('[AudioPlayer] Playback error:', err.message);
    }
  };

  const formatTime = (millis) => {
    const totalSecs = Math.floor(millis / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = soundDuration > 0 ? position / soundDuration : 0;
  const BAR_COUNT = 20;
  const activeBars = Math.floor(progress * BAR_COUNT);

  return (
    <View style={styles.audioMsg}>
      <TouchableOpacity style={styles.playBtn} onPress={playPauseSound}>
        <Ionicons name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
      </TouchableOpacity>
      <View style={styles.waveformPlaceholder}>
        {Array(BAR_COUNT).fill(0).map((_, i) => {
          const isActive = i < activeBars;
          return (
            <View
              key={i}
              style={[
                styles.waveBar,
                { height: 5 + ((i * 7) % 15) },
                isMine && styles.waveBarMine,
                isActive && { backgroundColor: isMine ? '#fff' : Colors.brand.indigo }
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.audioDuration, isMine && styles.audioDurationMine]}>
        {isPlaying ? formatTime(position) : (duration || '0:00')}
      </Text>
    </View>
  );
}

const getFileIconName = (fileName) => {
  const ext = fileName?.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'document-text';
    case 'doc':
    case 'docx': return 'document';
    case 'xls':
    case 'xlsx': return 'grid-outline';
    case 'ppt':
    case 'pptx': return 'easel-outline';
    case 'zip':
    case 'rar': return 'archive-outline';
    case 'txt': return 'document-text-outline';
    default: return 'document-outline';
  }
};

// ─────────────────────────────────────────────────────────────
// MESSAGE BUBBLE
// ─────────────────────────────────────────────────────────────
function MessageBubble({ message, isMine, isGroup, onLongPress, onReplyPress, onImagePress, onDocPress, downloadProgress, highlightedMessageId, currentUserId }) {
  const isDeleted = message.isDeleted;
  const msgType = message.messageType || message.type || 'text';

  if (msgType === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <View style={styles.systemMessagePill}>
          <Text style={styles.systemMessageText}>{message.content}</Text>
        </View>
      </View>
    );
  }

  const time = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });

  // Read receipt icon
  const ReadIcon = () => {
    if (!isMine) return null;
    if (message.status === 'pending') {
      return <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.5)" />;
    }
    if (message.status === 'failed') {
      return <Ionicons name="alert-circle" size={12} color={Colors.semantic.error} />;
    }
    const hasRead = message.readBy?.length > 0;
    const hasDelivered = message.deliveredTo?.length > 0;
    return (
      <Ionicons
        name="checkmark-done"
        size={13}
        color={hasRead ? Colors.brand.teal : hasDelivered ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.4)'}
      />
    );
  };

  // Reply preview
  const ReplyPreview = () => {
    if (!message.replyTo) return null;
    const replyContent = message.replyTo?.content || message.replyTo?.messageType || 'Message';
    const replySender = message.replyTo?.sender?.name || 'Unknown';
    return (
      <TouchableOpacity
        style={[styles.replyPreview, isMine ? styles.replyPreviewMine : styles.replyPreviewTheirs]}
        onPress={() => onReplyPress && onReplyPress(message.replyTo)}
      >
        <View style={[styles.replyBar, { backgroundColor: isMine ? 'rgba(255,255,255,0.4)' : Colors.brand.indigo }]} />
        <View style={styles.replyContent}>
          <Text style={[styles.replySender, isMine && { color: 'rgba(255,255,255,0.85)' }]}>{replySender}</Text>
          <Text
            style={[styles.replyText, isMine && { color: 'rgba(255,255,255,0.7)' }]}
            numberOfLines={1}
          >
            {replyContent}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Reactions row
  const Reactions = () => {
    if (!message.reactions?.length) return null;
    const grouped = message.reactions.reduce((acc, r) => {
      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
      return acc;
    }, {});
    return (
      <View style={styles.reactionsRow}>
        {Object.entries(grouped).map(([emoji, count]) => (
          <View key={emoji} style={styles.reactionChip}>
            <Text style={styles.reactionEmoji}>{emoji}</Text>
            {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
          </View>
        ))}
      </View>
    );
  };

  const scaleAnim = useRef(new Animated.Value(1)).current;
  const onPressIn = () => Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, speed: 20 }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20 }).start();

  const isHighlighted = String(highlightedMessageId) === String(message._id);

  return (
    <Animated.View
      style={[
        styles.bubbleWrapper,
        isMine ? styles.bubbleWrapperRight : styles.bubbleWrapperLeft,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      {/* Sender name (group chats) */}
      {!isMine && isGroup && message.sender?.name && (
        <Text style={styles.senderName}>{message.sender.name}</Text>
      )}

      <TouchableOpacity
        onLongPress={() => !isDeleted && onLongPress && onLongPress(message)}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        delayLongPress={350}
      >
        <View style={[
          styles.bubble,
          isMine ? styles.bubbleMine : styles.bubbleTheirs,
          isHighlighted && styles.highlightedBubble
        ]}>
          {/* Forwarded Badge */}
          {message.isForwarded && (
            <View style={styles.forwardedRow}>
              <Ionicons name="arrow-redo" size={11} color={isMine ? 'rgba(255,255,255,0.6)' : Colors.text.placeholder} />
              <Text style={[styles.forwardedText, isMine && { color: 'rgba(255,255,255,0.6)' }]}>Forwarded</Text>
            </View>
          )}

          {/* Reply stripe */}
          <ReplyPreview />

          {/* Deleted message */}
          {isDeleted ? (
            <View style={styles.deletedRow}>
              <Ionicons name="ban-outline" size={14} color={Colors.text.placeholder} />
              <Text style={styles.deletedText}> Message was deleted</Text>
            </View>
          ) : msgType === 'image' ? (
            /* Image message */
            <TouchableOpacity onPress={() => onImagePress && onImagePress(message.fileUrl || message.mediaUrl)}>
              {message.fileUrl || message.mediaUrl ? (
                <Image
                  source={{ uri: message.fileUrl || message.mediaUrl }}
                  style={styles.imageMsg}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Ionicons name="image-outline" size={32} color={Colors.text.placeholder} />
                </View>
              )}
            </TouchableOpacity>
          ) : msgType === 'audio' || msgType === 'voice' ? (
            /* Audio message */
            <AudioPlayerBubble
              fileUrl={message.fileUrl || message.mediaUrl}
              duration={message.duration}
              isMine={isMine}
            />
          ) : msgType === 'file' || msgType === 'document' ? (
            /* Document message */
            <TouchableOpacity onPress={() => onDocPress && onDocPress(message)}>
              <View style={styles.docMsg}>
                <View style={styles.docIcon}>
                  <Ionicons name={getFileIconName(message.fileName)} size={24} color={Colors.brand.indigo} />
                </View>
                <View style={styles.docInfo}>
                  <Text style={[styles.docName, isMine && { color: '#fff' }]} numberOfLines={2}>
                    {message.fileName || 'Document'}
                  </Text>
                  <Text style={[styles.docSize, isMine && { color: 'rgba(255,255,255,0.6)' }]}>
                    {downloadProgress !== undefined && downloadProgress < 1
                      ? `Downloading ${Math.floor(downloadProgress * 100)}%`
                      : message.fileSize || 'Tap to open'}
                  </Text>
                </View>
                {downloadProgress !== undefined && downloadProgress < 1 ? (
                  <ActivityIndicator size="small" color={isMine ? '#fff' : Colors.brand.indigo} />
                ) : (
                  <Ionicons name="download-outline" size={18} color={isMine ? 'rgba(255,255,255,0.6)' : Colors.text.tertiary} />
                )}
              </View>
            </TouchableOpacity>
          )
          ) : (
            /* Text message */
            <Text style={[styles.messageText, isMine ? styles.messageTextMine : styles.messageTextTheirs]}>
              {message.content}
            </Text>
          )}

          {/* Time + read receipts */}
          <View style={styles.msgMeta}>
            {message.isStarred?.some(u => String(u._id || u) === String(currentUserId)) && (
              <Ionicons name="star" size={10} color={isMine ? 'rgba(255,255,255,0.6)' : Colors.text.placeholder} style={{ marginRight: 3 }} />
            )}
            {message.isEdited && (
              <Text style={[styles.editedBadge, isMine && styles.editedBadgeMine]}>Edited</Text>
            )}
            <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>{time}</Text>
            <ReadIcon />
          </View>
        </View>
      </TouchableOpacity>

      {/* Reactions */}
      <Reactions />
    </Animated.View>
  );
}

// ─────────────────────────────────────────────────────────────
// MESSAGE OPTIONS MODAL
// ─────────────────────────────────────────────────────────────
function MessageOptionsModal({
  visible, message, isMine, currentUserId, onClose,
  onReply, onDelete, onReact, onCopy, onEdit, onPin, onStar, onForward, onRetry
}) {
  const EMOJIS = ['❤️', '😂', '👍', '😮', '😢', '🔥'];

  if (!message) return null;

  const isStarred = message.isStarred?.some(u => String(u._id || u) === String(currentUserId));
  const isPinned = message.isPinned;
  const isText = !message.messageType || message.messageType === 'text' || message.type === 'text';
  const timeDifferenceMs = Date.now() - new Date(message.createdAt).getTime();
  const isEditable = isMine && isText && timeDifferenceMs < 15 * 60 * 1000;

  return (
    <TouchableOpacity
      style={styles.modalOverlay}
      activeOpacity={1}
      onPress={onClose}
    >
      <View style={styles.optionsModal}>
        {/* Emoji reactions */}
        <View style={styles.emojiRow}>
          {EMOJIS.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiBtn}
              onPress={() => onReact(emoji)}
            >
              <Text style={styles.emojiChar}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.optionsDivider} />

        {/* Action buttons */}
        {/* Action buttons */}
        {message.status === 'failed' && (
          <TouchableOpacity style={styles.optionRow} onPress={onRetry}>
            <Ionicons name="refresh-outline" size={20} color={Colors.brand.indigo} />
            <Text style={[styles.optionLabel, { color: Colors.brand.indigo }]}>Retry Sending</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.optionRow} onPress={onReply}>
          <Ionicons name="arrow-undo-outline" size={20} color={Colors.text.primary} />
          <Text style={styles.optionLabel}>Reply</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={onStar}>
          <Ionicons name={isStarred ? "star" : "star-outline"} size={20} color={isStarred ? Colors.brand.teal : Colors.text.primary} />
          <Text style={[styles.optionLabel, isStarred && { color: Colors.brand.teal }]}>
            {isStarred ? 'Unstar' : 'Star'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={onPin}>
          <Ionicons name={isPinned ? "pin" : "pin-outline"} size={20} color={isPinned ? Colors.brand.teal : Colors.text.primary} />
          <Text style={[styles.optionLabel, isPinned && { color: Colors.brand.teal }]}>
            {isPinned ? 'Unpin Message' : 'Pin Message'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.optionRow} onPress={onForward}>
          <Ionicons name="arrow-redo-outline" size={20} color={Colors.text.primary} />
          <Text style={styles.optionLabel}>Forward Message</Text>
        </TouchableOpacity>

        {isEditable && (
          <TouchableOpacity style={styles.optionRow} onPress={onEdit}>
            <Ionicons name="create-outline" size={20} color={Colors.text.primary} />
            <Text style={styles.optionLabel}>Edit Message</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.optionRow} onPress={onCopy}>
          <Ionicons name="copy-outline" size={20} color={Colors.text.primary} />
          <Text style={styles.optionLabel}>Copy Text</Text>
        </TouchableOpacity>

        {isMine && (
          <TouchableOpacity style={[styles.optionRow, styles.optionRowDestructive]} onPress={onDelete}>
            <Ionicons name="trash-outline" size={20} color={Colors.semantic.error} />
            <Text style={[styles.optionLabel, { color: Colors.semantic.error }]}>Delete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={onClose}>
          <Ionicons name="close-outline" size={20} color={Colors.text.tertiary} />
          <Text style={[styles.optionLabel, { color: Colors.text.tertiary }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// ATTACHMENT MENU
// ─────────────────────────────────────────────────────────────
function AttachmentMenu({ visible, onClose, onPickImage, onPickVideo, onPickDocument }) {
  if (!visible) return null;

  const options = [
    { icon: 'image-outline', label: 'Photo', color: '#0A84FF', action: onPickImage },
    { icon: 'videocam-outline', label: 'Video', color: '#FF453A', action: onPickVideo },
    { icon: 'document-outline', label: 'Document', color: Colors.brand.teal, action: onPickDocument },
  ];

  return (
    <TouchableOpacity style={styles.attachOverlay} activeOpacity={1} onPress={onClose}>
      <View style={styles.attachMenu}>
        {options.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            style={styles.attachOption}
            onPress={opt.action}
          >
            <View style={[styles.attachIcon, { backgroundColor: opt.color + '22' }]}>
              <Ionicons name={opt.icon} size={24} color={opt.color} />
            </View>
            <Text style={styles.attachLabel}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </TouchableOpacity>
  );
}

// ─────────────────────────────────────────────────────────────
// MAIN CHAT SCREEN
// ─────────────────────────────────────────────────────────────
export default function ChatScreen({ navigation, route }) {
  const { chatId, chatName, isGroup } = route.params || {};
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  // ── State ──
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState(null);

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isOtherOnline, setIsOtherOnline] = useState(false);
  const [otherUserId, setOtherUserId] = useState(null);
  const [chatDetails, setChatDetails] = useState(null);
  const [isMuted, setIsMuted] = useState(false);
  const [adminsOnly, setAdminsOnly] = useState(false);
  const [downloadingFiles, setDownloadingFiles] = useState({});

  // Search States
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchIndex, setSearchIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Forward States
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessageItem, setForwardMessageItem] = useState(null);
  const [forwardSearchQuery, setForwardSearchQuery] = useState('');
  const [forwardSearchResults, setForwardSearchResults] = useState([]);
  const [selectedForwardChats, setSelectedForwardChats] = useState([]);
  const [isForwarding, setIsForwarding] = useState(false);
  const [isSearchingForward, setIsSearchingForward] = useState(false);
  const [editingMessage, setEditingMessage] = useState(null);
  const [otherUserLastSeen, setOtherUserLastSeen] = useState(null);

  const [replyingTo, setReplyingTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showAttachment, setShowAttachment] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  // ── Refs ──
  const flatListRef = useRef(null);
  const typingTimerRef = useRef(null);
  const remoteTypingTimers = useRef({});
  const otherUserIdRef = useRef(null);
  const isLoadingMoreRef = useRef(false);
  const scrollBtnAnim = useRef(new Animated.Value(0)).current;

  // Sync otherUserId ref
  useEffect(() => { otherUserIdRef.current = otherUserId; }, [otherUserId]);

  // ─── Toggle scroll-to-bottom button ───
  useEffect(() => {
    Animated.timing(scrollBtnAnim, {
      toValue: showScrollBtn ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [showScrollBtn]);

  // ─── Voice Recording States & Refs ───
  const [recording, setRecording] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordIntervalRef = useRef(null);
  const recordingDotAnim = useRef(new Animated.Value(1)).current;

  // Dot blinking animation when recording
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(recordingDotAnim, { toValue: 0.2, duration: 500, useNativeDriver: true }),
          Animated.timing(recordingDotAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      ).start();
    } else {
      recordingDotAnim.setValue(1);
    }
  }, [isRecording]);

  // Clean up audio on screen unmount
  useEffect(() => {
    return () => {
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
    };
  }, []);

  // Set audio mode for screen
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldRouteThroughEarpieceIOS: false,
    }).catch(() => {});
  }, []);

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        Alert.alert('Permission Needed', 'Please allow microphone access to record voice messages.');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(newRecording);
      setIsRecording(true);
      setRecordDuration(0);

      recordIntervalRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
      Alert.alert('Recording Error', 'Failed to initialize microphone.');
    }
  };

  const stopRecording = async (shouldSend = true) => {
    if (!recording) return;
    setIsRecording(false);
    clearInterval(recordIntervalRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      // Re-configure audio mode for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (shouldSend && uri) {
        await sendVoiceMessage(uri, recordDuration);
      }
    } catch (err) {
      console.error('[Recording] Failed to stop:', err);
    }
  };

  const sendVoiceMessage = async (uri, durationSec) => {
    try {
      setIsSending(true);
      const formatDuration = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
      };
      const durationStr = formatDuration(durationSec);

      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('messageType', 'audio');
      formData.append('content', `🎵 Voice Message (${durationStr})`);
      formData.append('duration', durationStr);

      if (replyingTo) formData.append('replyTo', replyingTo._id);
      setReplyingTo(null);

      const fileExt = uri.split('.').pop() || 'm4a';
      formData.append('file', {
        uri,
        name: `voice_${Date.now()}.${fileExt}`,
        type: `audio/${fileExt === 'm4a' ? 'm4a' : 'aac'}`,
      });

      // Optimistic message
      const tempId = `pending_audio_${Date.now()}`;
      const optimistic = {
        _id: tempId,
        content: `🎵 Voice Message (${durationStr})`,
        chatId,
        sender: { _id: user?._id, name: user?.name },
        createdAt: new Date().toISOString(),
        status: 'pending',
        replyTo: null,
        messageType: 'audio',
        duration: durationStr,
        fileUrl: uri,
      };
      setMessages((prev) => [optimistic, ...prev]);
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

      const res = await messageAPI.sendMedia(formData);
      const real = res.data?.data || res.data;
      if (real) {
        setMessages((prev) => prev.map((m) => m._id === tempId ? real : m));
      }
    } catch (err) {
      console.error('[Recording] Upload failed:', err);
      Alert.alert('Upload Failed', 'Could not send the voice message.');
      // Remove optimistic message
      setMessages((prev) => prev.filter((m) => m._id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // ─── Load messages ───
  const fetchMessages = useCallback(async (cursor = null, isInitial = false) => {
    try {
      if (isInitial) setIsLoading(true);
      else setIsLoadingMore(true);

      const params = { limit: MESSAGE_LIMIT };
      if (cursor) params.cursor = cursor;

      const res = await messageAPI.getMessages(chatId, params);
      const raw = res.data?.messages || res.data?.data || res.data || [];
      const fetched = Array.isArray(raw) ? raw : [];
      const newCursor = res.data?.nextCursor;

      if (fetched.length === 0) {
        setHasMore(false);
        return;
      }

      const reversed = [...fetched].reverse();

      if (isInitial) {
        setMessages(reversed);
        // Cache latest
        AsyncStorage.setItem(`chat_cache_${chatId}`, JSON.stringify(reversed.slice(0, 30)));
      } else {
        setMessages((prev) => [...prev, ...reversed]);
      }

      if (fetched.length < MESSAGE_LIMIT) setHasMore(false);
      setNextCursor(newCursor);
    } catch (err) {
      console.error('[ChatScreen] fetchMessages:', err.message);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [chatId]);

  // ─── Load chat info ───
  const loadChatInfo = useCallback(async () => {
    try {
      const res = await chatAPI.fetchChats();
      const list = res.data?.data || res.data || [];
      const chats = Array.isArray(list) ? list : [];
      const chat = chats.find((c) => String(c._id) === String(chatId));
      if (!chat) return;

      setChatDetails(chat);

      // Load mute & admin message restrictions
      const muteVal = await AsyncStorage.getItem(`mute_${chatId}`);
      setIsMuted(muteVal === 'true');
      const adminVal = await AsyncStorage.getItem(`admins_only_${chatId}`);
      setAdminsOnly(adminVal === 'true');

      if (!chat.isGroupChat) {
        const other = chat.users?.find((u) => String(u._id) !== String(user?._id));
        if (other) {
          setOtherUserId(other._id);
          setIsOtherOnline(Boolean(other.isOnline));
          setOtherUserLastSeen(other.lastSeen);
        }
      }
    } catch (err) {
      console.warn('[ChatScreen] loadChatInfo:', err.message);
    }
  }, [chatId, user?._id]);

  const saveToOfflineQueue = async (msg) => {
    try {
      const queueStr = await AsyncStorage.getItem(`offline_queue_${chatId}`);
      const queue = queueStr ? JSON.parse(queueStr) : [];
      if (!queue.some((m) => String(m._id) === String(msg._id))) {
        queue.push(msg);
        await AsyncStorage.setItem(`offline_queue_${chatId}`, JSON.stringify(queue));
      }
    } catch (err) {
      console.warn('[OfflineQueue] saveToOfflineQueue error:', err.message);
    }
  };

  const processOfflineQueue = useCallback(async () => {
    try {
      const queueStr = await AsyncStorage.getItem(`offline_queue_${chatId}`);
      if (!queueStr) return;
      const queue = JSON.parse(queueStr);
      if (!Array.isArray(queue) || queue.length === 0) return;

      let remainingQueue = [...queue];
      for (const msg of queue) {
        try {
          const payload = { content: msg.content, chatId };
          if (msg.replyTo?._id) payload.replyTo = msg.replyTo._id;

          const res = await messageAPI.sendMessage(payload);
          const real = res.data?.data || res.data;
          if (real) {
            setMessages((prev) => prev.map((m) => String(m._id) === String(msg._id) ? real : m));
            remainingQueue = remainingQueue.filter((m) => String(m._id) !== String(msg._id));
            await AsyncStorage.setItem(`offline_queue_${chatId}`, JSON.stringify(remainingQueue));
          }
        } catch (err) {
          console.warn('[OfflineQueue] Retry failed for message:', msg._id, err.message);
          if (!err.response) {
            break;
          } else {
            setMessages((prev) =>
              prev.map((m) => String(m._id) === String(msg._id) ? { ...m, status: 'failed' } : m)
            );
            remainingQueue = remainingQueue.filter((m) => String(m._id) !== String(msg._id));
            await AsyncStorage.setItem(`offline_queue_${chatId}`, JSON.stringify(remainingQueue));
          }
        }
      }
    } catch (err) {
      console.warn('[OfflineQueue] processOfflineQueue error:', err.message);
    }
  }, [chatId]);

  const handleRetryMessage = async (msg) => {
    setMessages((prev) => prev.map((m) => String(m._id) === String(msg._id) ? { ...m, status: 'pending' } : m));

    try {
      const payload = { content: msg.content, chatId };
      if (msg.replyTo?._id) payload.replyTo = msg.replyTo._id;

      const res = await messageAPI.sendMessage(payload);
      const real = res.data?.data || res.data;
      if (real) {
        setMessages((prev) => prev.map((m) => String(m._id) === String(msg._id) ? real : m));
      }
    } catch (err) {
      if (!err.response) {
        saveToOfflineQueue(msg);
      } else {
        setMessages((prev) => prev.map((m) => String(m._id) === String(msg._id) ? { ...m, status: 'failed' } : m));
      }
    }
  };

  // ─── Initial load ───
  useEffect(() => {
    const init = async () => {
      // Try cache first
      try {
        const cached = await AsyncStorage.getItem(`chat_cache_${chatId}`);
        if (cached) {
          setMessages(JSON.parse(cached));
          setIsLoading(false);
        }
      } catch (_) {}

      await loadChatInfo();
      await fetchMessages(null, true);
    };
    init();
  }, [chatId]);

  // ─── Mark read on focus ───
  useFocusEffect(
    useCallback(() => {
      if (chatId) {
        messageAPI.markRead({ chatId }).catch(() => {});
      }
    }, [chatId])
  );

  // ─── Socket events ───
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Join the chat room
    socket.emit('join_chat', chatId);
    processOfflineQueue();

    const onConnect = () => {
      processOfflineQueue();
    };

    const onMessageReceived = (msg) => {
      const msgChatId = msg.chat?._id || msg.chat || msg.chatId;
      if (String(msgChatId) !== String(chatId)) return;

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(msg._id))) return prev;
        return [msg, ...prev];
      });
      messageAPI.markRead({ chatId }).catch(() => {});
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    };

    const onMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(messageId)
            ? { ...m, isDeleted: true, content: '' }
            : m
        )
      );
    };

    const onMessageReacted = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => String(m._id) === String(messageId) ? { ...m, reactions } : m)
      );
    };

    const onMessagePinned = ({ messageId, isPinned }) => {
      setMessages((prev) =>
        prev.map((m) => String(m._id) === String(messageId) ? { ...m, isPinned } : m)
      );
    };

    const onMessageEdited = (updated) => {
      const msgChatId = updated.chat?._id || updated.chat || updated.chatId;
      if (String(msgChatId) !== String(chatId)) return;
      setMessages((prev) =>
        prev.map((m) => String(m._id) === String(updated._id) ? updated : m)
      );
    };

    const onUserOnline = (uid) => {
      if (String(uid) === String(otherUserIdRef.current)) setIsOtherOnline(true);
    };

    const onUserOffline = (uid) => {
      if (String(uid) === String(otherUserIdRef.current)) {
        setIsOtherOnline(false);
        setOtherUserLastSeen(new Date().toISOString());
      }
    };

    const onTyping = ({ userId: typingUid }) => {
      if (String(typingUid) === String(user?._id)) return;
      if (remoteTypingTimers.current[typingUid]) {
        clearTimeout(remoteTypingTimers.current[typingUid]);
      }
      setTypingUsers((prev) => prev.includes(typingUid) ? prev : [...prev, typingUid]);
      remoteTypingTimers.current[typingUid] = setTimeout(() => {
        setTypingUsers((prev) => prev.filter((id) => id !== typingUid));
        delete remoteTypingTimers.current[typingUid];
      }, 3000);
    };

    const onStopTyping = ({ userId: typingUid }) => {
      clearTimeout(remoteTypingTimers.current[typingUid]);
      delete remoteTypingTimers.current[typingUid];
      setTypingUsers((prev) => prev.filter((id) => id !== typingUid));
    };

    const onMessagesDelivered = ({ chatId: dcid, userId: duid }) => {
      if (String(dcid) !== String(chatId)) return;
      if (String(duid) === String(user?._id)) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          deliveredTo: m.deliveredTo?.some((id) => String(id?._id || id) === String(duid))
            ? m.deliveredTo
            : [...(m.deliveredTo || []), duid],
        }))
      );
    };

    const onMessagesRead = ({ chatId: rcid, userId: ruid }) => {
      if (String(rcid) !== String(chatId)) return;
      if (String(ruid) === String(user?._id)) return;
      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          readBy: m.readBy?.some((id) => String(id?._id || id) === String(ruid))
            ? m.readBy
            : [...(m.readBy || []), ruid],
        }))
      );
    };

    const onGroupUpdated = (updated) => {
      if (String(updated._id) === String(chatId)) setChatDetails(updated);
    };

    const onGroupSettingsUpdated = ({ chatId: scid, adminsOnly: newAdminsOnly }) => {
      if (String(scid) === String(chatId)) {
        setAdminsOnly(newAdminsOnly);
      }
    };

    const onKicked = ({ chatId: kid }) => {
      if (String(kid) === String(chatId)) {
        Alert.alert('Removed', 'You have been removed from this group.');
        navigation.replace('Tabs');
      }
    };

    socket.on('connect', onConnect);
    socket.on('message_received', onMessageReceived);
    socket.on('message_deleted', onMessageDeleted);
    socket.on('message_reacted', onMessageReacted);
    socket.on('message_pinned', onMessagePinned);
    socket.on('message_edited', onMessageEdited);
    socket.on('user_online', onUserOnline);
    socket.on('user_offline', onUserOffline);
    socket.on('typing', onTyping);
    socket.on('stop_typing', onStopTyping);
    socket.on('messages_delivered', onMessagesDelivered);
    socket.on('messages_read', onMessagesRead);
    socket.on('group_updated', onGroupUpdated);
    socket.on('group_settings_updated', onGroupSettingsUpdated);
    socket.on('kicked_from_group', onKicked);

    return () => {
      socket.emit('leave_chat', chatId);
      socket.off('connect', onConnect);
      socket.off('message_received', onMessageReceived);
      socket.off('message_deleted', onMessageDeleted);
      socket.off('message_reacted', onMessageReacted);
      socket.off('message_pinned', onMessagePinned);
      socket.off('message_edited', onMessageEdited);
      socket.off('user_online', onUserOnline);
      socket.off('user_offline', onUserOffline);
      socket.off('typing', onTyping);
      socket.off('stop_typing', onStopTyping);
      socket.off('messages_delivered', onMessagesDelivered);
      socket.off('messages_read', onMessagesRead);
      socket.off('group_updated', onGroupUpdated);
      socket.off('group_settings_updated', onGroupSettingsUpdated);
      socket.off('kicked_from_group', onKicked);

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      Object.values(remoteTypingTimers.current).forEach(clearTimeout);
    };
  }, [chatId, user?._id]);

  // ─── Send text message ───
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || isSending) return;

    if (editingMessage) {
      const msgId = editingMessage._id;
      setEditingMessage(null);
      setInputText('');
      
      try {
        setIsSending(true);
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(msgId)
              ? { ...m, content: text, isEdited: true, editedAt: new Date().toISOString() }
              : m
          )
        );
        const res = await messageAPI.editMessage(msgId, { content: text });
        const updated = res.data?.data || res.data;
        if (updated) {
          setMessages((prev) => prev.map((m) => String(m._id) === String(msgId) ? updated : m));
        }
      } catch (err) {
        Alert.alert('Error', 'Failed to edit message.');
        setInputText(text);
      } finally {
        setIsSending(false);
      }
      return;
    }

    setInputText('');
    const replyId = replyingTo?._id;
    setReplyingTo(null);

    const socket = getSocket();
    if (socket) socket.emit('stop_typing', { chatId });

    // Optimistic message
    const tempId = `pending_${Date.now()}`;
    const optimistic = {
      _id: tempId,
      content: text,
      chatId,
      sender: { _id: user?._id, name: user?.name },
      createdAt: new Date().toISOString(),
      status: 'pending',
      replyTo: replyingTo || null,
      messageType: 'text',
    };
    setMessages((prev) => [optimistic, ...prev]);
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });

    try {
      setIsSending(true);
      const payload = { content: text, chatId };
      if (replyId) payload.replyTo = replyId;

      const res = await messageAPI.sendMessage(payload);
      const real = res.data?.data || res.data;
      if (real) {
        setMessages((prev) => prev.map((m) => m._id === tempId ? real : m));
      }
    } catch (err) {
      if (!err.response) {
        await saveToOfflineQueue({ ...optimistic, _id: tempId });
      } else {
        setMessages((prev) =>
          prev.map((m) => m._id === tempId ? { ...m, status: 'failed' } : m)
        );
      }
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  };

  // ─── Typing handler ───
  const handleTyping = (text) => {
    setInputText(text);
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing', { chatId });
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      socket.emit('stop_typing', { chatId });
    }, 2000);
  };

  // ─── Message actions ───
  const handleLongPress = (msg) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setSelectedMessage(msg);
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    const msgId = selectedMessage._id;
    setSelectedMessage(null);
    try {
      await messageAPI.deleteMessage(msgId);
      setMessages((prev) =>
        prev.map((m) => String(m._id) === String(msgId)
          ? { ...m, isDeleted: true, content: '' }
          : m
        )
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to delete message');
    }
  };

  const handleReact = async (emoji) => {
    const msgId = selectedMessage?._id;
    setSelectedMessage(null);
    if (!msgId) return;
    try {
      await messageAPI.reactToMessage({ messageId: msgId, emoji });
    } catch (err) {
      console.warn('React error:', err.message);
    }
  };

  const handleCopy = () => {
    if (selectedMessage?.content) {
      // Clipboard.setString(selectedMessage.content); // Would need @react-native-clipboard
      Alert.alert('Copied', 'Message text copied');
    }
    setSelectedMessage(null);
  };

  // ─── Media attachments ───
  const pickImage = async () => {
    setShowAttachment(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.6,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMedia(result.assets[0], 'image');
    }
  };

  const pickVideo = async () => {
    setShowAttachment(false);
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo library access.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]) {
      await sendMedia(result.assets[0], 'video');
    }
  };

  const pickDocument = async () => {
    setShowAttachment(false);
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.[0]) {
      await sendMedia(result.assets[0], 'file');
    }
  };

  const sendMedia = async (asset, type) => {
    try {
      setIsSending(true);
      const formData = new FormData();
      formData.append('chatId', chatId);
      formData.append('messageType', type);
      formData.append('content', type === 'image' ? '📷 Photo' : type === 'video' ? '🎬 Video' : '📎 File');
      if (replyingTo) formData.append('replyTo', replyingTo._id);

      const fileExt = asset.uri?.split('.').pop() || (type === 'image' ? 'jpg' : 'mp4');
      const mimeMap = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', mp4: 'video/mp4', pdf: 'application/pdf' };
      formData.append('file', {
        uri: asset.uri,
        name: asset.name || asset.fileName || `${type}.${fileExt}`,
        type: mimeMap[fileExt] || 'application/octet-stream',
      });

      setReplyingTo(null);
      await messageAPI.sendMedia(formData);
    } catch (err) {
      Alert.alert('Upload Failed', 'Could not send the file. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // ─── Load more (pagination) ───
  const handleLoadMore = () => {
    if (!hasMore || isLoadingMoreRef.current || !nextCursor) return;
    isLoadingMoreRef.current = true;
    fetchMessages(nextCursor, false).finally(() => {
      isLoadingMoreRef.current = false;
    });
  };

  // ─── Scroll events ───
  const handleScroll = (event) => {
    const offset = event.nativeEvent.contentOffset.y;
    setShowScrollBtn(offset > 300);
  };

  // ─── Header display ───
  const displayName = chatDetails?.isGroupChat
    ? chatDetails?.chatName
    : (chatDetails?.users?.find((u) => String(u._id) !== String(user?._id))?.name || chatName || 'Chat');

  const displayAvatar = chatDetails?.isGroupChat
    ? chatDetails?.groupAvatar?.url
    : (chatDetails?.users?.find((u) => String(u._id) !== String(user?._id))?.profilePic?.url);

  const statusText = typingUsers.length > 0
    ? getTypingStatusText()
    : (isGroup ? null : (isOtherOnline ? 'online' : (otherUserLastSeen ? formatLastSeen(otherUserLastSeen) : null)));

  const handleDownloadDoc = async (msg) => {
    const url = msg.fileUrl || msg.mediaUrl;
    if (!url) return;

    const msgId = msg._id;
    const fileName = msg.fileName || 'Document';
    const localUri = `${FileSystem.documentDirectory}${fileName}`;

    try {
      const fileInfo = await FileSystem.getInfoAsync(localUri);
      if (fileInfo.exists) {
        await Sharing.shareAsync(localUri);
        return;
      }

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgressData) => {
          const progress = downloadProgressData.totalBytesWritten / downloadProgressData.totalBytesExpectedToWrite;
          setDownloadingFiles(prev => ({ ...prev, [msgId]: progress }));
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      setDownloadingFiles(prev => {
        const updated = { ...prev };
        delete updated[msgId];
        return updated;
      });

      await Sharing.shareAsync(uri);
    } catch (err) {
      console.warn('[DocDownload] Error:', err);
      Alert.alert('Download Error', 'Failed to download document.');
      setDownloadingFiles(prev => {
        const updated = { ...prev };
        delete updated[msgId];
        return updated;
      });
    }
  };

  const handleSearch = async (text) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      setSearchIndex(0);
      return;
    }
    setIsSearching(true);
    try {
      const res = await messageAPI.searchMessages(chatId, text.trim());
      const results = res.data || [];
      setSearchResults(results);
      setSearchIndex(results.length > 0 ? 0 : -1);
      
      if (results.length > 0) {
        jumpToMessage(results[0]._id);
      }
    } catch (err) {
      console.warn('[ChatSearch] Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const jumpToMessage = async (msgId) => {
    if (!msgId) return;

    const existingIndex = messages.findIndex((m) => String(m._id) === String(msgId));
    if (existingIndex >= 0) {
      setHighlightedMessageId(msgId);
      flatListRef.current?.scrollToIndex({
        index: existingIndex,
        animated: true,
        viewPosition: 0.5,
      });
      setTimeout(() => setHighlightedMessageId(null), 2500);
    } else {
      setIsLoading(true);
      try {
        const res = await messageAPI.getContext(chatId, msgId);
        const contextSlice = res.data || [];
        if (contextSlice.length > 0) {
          const invertedSlice = [...contextSlice].reverse();
          setMessages(invertedSlice);
          setHighlightedMessageId(msgId);

          setTimeout(() => {
            const newIndex = invertedSlice.findIndex((m) => String(m._id) === String(msgId));
            if (newIndex >= 0) {
              flatListRef.current?.scrollToIndex({
                index: newIndex,
                animated: true,
                viewPosition: 0.5,
              });
            }
            setTimeout(() => setHighlightedMessageId(null), 2500);
          }, 400);
        }
      } catch (err) {
        console.warn('[ChatSearch] Get context error:', err);
        Alert.alert('Search Error', 'Failed to jump to message.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const triggerEditMessage = (msg) => {
    setSelectedMessage(null);
    setEditingMessage(msg);
    setInputText(msg.content || '');
  };
    setSelectedMessage(null);
    setEditingMessage(msg);
    setInputText(msg.content || '');
  };

  const triggerPinMessage = async (msg) => {
    setSelectedMessage(null);
    try {
      await messageAPI.pinMessage(msg._id);
      setMessages((prev) =>
        prev.map((m) =>
          String(m._id) === String(msg._id) ? { ...m, isPinned: !m.isPinned } : m
        )
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to pin message.');
    }
  };

  const triggerStarMessage = async (msg) => {
    setSelectedMessage(null);
    try {
      await messageAPI.starMessage(msg._id);
      setMessages((prev) =>
        prev.map((m) => {
          if (String(m._id) !== String(msg._id)) return m;
          const starredList = m.isStarred || [];
          const hasStarred = starredList.some((u) => String(u._id || u) === String(user?._id));
          const newStarredList = hasStarred
            ? starredList.filter((u) => String(u._id || u) !== String(user?._id))
            : [...starredList, user?._id];
          return { ...m, isStarred: newStarredList };
        })
      );
    } catch (err) {
      Alert.alert('Error', 'Failed to star message.');
    }
  };

  const triggerForwardMessage = async (msg) => {
    setSelectedMessage(null);
    setForwardMessageItem(msg);
    setSelectedForwardChats([]);
    setForwardSearchQuery('');
    setShowForwardModal(true);
    try {
      setIsSearchingForward(true);
      const res = await chatAPI.fetchChats();
      const list = res.data?.data || res.data || [];
      setForwardSearchResults(list);
    } catch (err) {
      console.warn('Failed to load forward chats:', err.message);
    } finally {
      setIsSearchingForward(false);
    }
  };

  const handleForwardSearch = async (text) => {
    setForwardSearchQuery(text);
    try {
      const res = await chatAPI.fetchChats();
      const list = res.data?.data || res.data || [];
      if (!text.trim()) {
        setForwardSearchResults(list);
        return;
      }
      const query = text.toLowerCase();
      const filtered = list.filter((c) => {
        const name = c.isGroupChat
          ? c.chatName
          : c.users?.find((u) => String(u._id) !== String(user?._id))?.name || '';
        return name.toLowerCase().includes(query);
      });
      setForwardSearchResults(filtered);
    } catch (err) {
      console.warn('Forward search error:', err.message);
    }
  };

  const handleForwardSend = async () => {
    if (selectedForwardChats.length === 0 || !forwardMessageItem) return;
    setIsForwarding(true);
    try {
      const type = forwardMessageItem.messageType || forwardMessageItem.type || 'text';
      const content = forwardMessageItem.content;
      const fileUrl = forwardMessageItem.fileUrl || forwardMessageItem.mediaUrl;
      const fileName = forwardMessageItem.fileName;

      for (const chat of selectedForwardChats) {
        await messageAPI.sendMessage({
          chatId: chat._id,
          content,
          messageType: type,
          fileUrl,
          fileName,
          isForwarded: true
        });
      }

      setShowForwardModal(false);
      Alert.alert('Success', `Message forwarded to ${selectedForwardChats.length} chats.`);
    } catch (err) {
      console.warn('Forward failed:', err);
      Alert.alert('Forward Failed', 'Failed to forward the message.');
    } finally {
      setIsForwarding(false);
      setForwardMessageItem(null);
      setSelectedForwardChats([]);
    }
  };

  const toggleForwardChatSelection = (chat) => {
    setSelectedForwardChats((prev) => {
      const exists = prev.some((c) => c._id === chat._id);
      if (exists) {
        return prev.filter((c) => c._id !== chat._id);
      } else {
        return [...prev, chat];
      }
    });
  };

  // ─── Typing Status Calculations ───
  const getTypingStatusText = () => {
    if (typingUsers.length === 0) return null;
    if (!isGroup) return 'typing...';
    const typingUserNames = typingUsers.map(uid => {
      const foundUser = chatDetails?.users?.find(u => String(u._id) === String(uid));
      return foundUser ? foundUser.name : 'Someone';
    });
    if (typingUserNames.length === 1) return `${typingUserNames[0]} is typing...`;
    if (typingUserNames.length === 2) return `${typingUserNames[0]} and ${typingUserNames[1]} are typing...`;
    return `${typingUserNames.slice(0, 2).join(', ')} and others are typing...`;
  };

  const formatLastSeen = (isoStr) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.toDateString() === yesterday.toDateString();
      
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
      
      if (isToday) return `last seen today at ${timeStr}`;
      if (isYesterday) return `last seen yesterday at ${timeStr}`;
      
      const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric' });
      return `last seen on ${dateStr} at ${timeStr}`;
    } catch (_) {
      return '';
    }
  };

  // ─── Render message ───
  const renderMessage = useCallback(({ item }) => {
    const isMine = String(item.sender?._id || item.sender) === String(user?._id);
    return (
      <MessageBubble
        message={item}
        isMine={isMine}
        isGroup={isGroup}
        onLongPress={handleLongPress}
        onReplyPress={(msg) => setReplyingTo(msg)}
        onImagePress={(mediaUrl) => {
          const mediaMessages = [...messages]
            .reverse()
            .filter(m => m.messageType === 'image' || m.messageType === 'video' || m.type === 'image' || m.type === 'video');
          const initialIndex = mediaMessages.findIndex(m => String(m._id) === String(item._id));
          navigation.navigate('MediaViewer', {
            mediaItems: mediaMessages,
            initialIndex: initialIndex >= 0 ? initialIndex : 0,
            mediaUrl,
            message: item
          });
        }}
        onDocPress={handleDownloadDoc}
        downloadProgress={downloadingFiles[item._id]}
        highlightedMessageId={highlightedMessageId}
        currentUserId={user?._id}
      />
    );
  }, [user?._id, isGroup, navigation, downloadingFiles, messages, highlightedMessageId]);

  const keyExtractor = useCallback((item) => String(item._id), []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.bg.secondary} />

      {/* ── HEADER ── */}
      {showSearch ? (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => {
              setShowSearch(false);
              setSearchQuery('');
              setSearchResults([]);
              setSearchIndex(0);
              fetchMessages(null, true);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <View style={styles.searchInputWrapper}>
            <TextInput
              style={styles.headerSearchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Search messages..."
              placeholderTextColor={Colors.text.placeholder}
              autoFocus
            />
          </View>
          {searchResults.length > 0 && (
            <View style={styles.searchControls}>
              <Text style={styles.searchCountText}>
                {searchIndex + 1}/{searchResults.length}
              </Text>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={() => {
                  const nextIndex = (searchIndex - 1 + searchResults.length) % searchResults.length;
                  setSearchIndex(nextIndex);
                  jumpToMessage(searchResults[nextIndex]._id);
                }}
              >
                <Ionicons name="chevron-up" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.searchNavBtn}
                onPress={() => {
                  const nextIndex = (searchIndex + 1) % searchResults.length;
                  setSearchIndex(nextIndex);
                  jumpToMessage(searchResults[nextIndex]._id);
                }}
              >
                <Ionicons name="chevron-down" size={20} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      ) : (
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>

          {/* Avatar + name */}
          <TouchableOpacity
            style={styles.headerInfo}
            onPress={() => {
              if (isGroup) {
                navigation.navigate('GroupInfo', { chatId });
              } else if (otherUserId) {
                navigation.navigate('UserProfile', { userId: otherUserId });
              }
            }}
            activeOpacity={0.8}
          >
            <View style={styles.headerAvatarWrapper}>
              {displayAvatar ? (
                <Image source={{ uri: displayAvatar }} style={styles.headerAvatar} />
              ) : (
                <View style={[styles.headerAvatar, styles.headerAvatarFallback]}>
                  <Text style={styles.headerAvatarLetter}>
                    {displayName?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              {!isGroup && isOtherOnline && <View style={styles.onlineDot} />}
            </View>

            <View>
              <Text style={styles.headerName} numberOfLines={1}>{displayName}</Text>
              {statusText ? (
                <Text style={[
                  styles.headerStatus,
                  typingUsers.length > 0 && styles.headerTyping,
                ]}>
                  {statusText}
                </Text>
              ) : null}
            </View>
          </TouchableOpacity>

          {/* Header actions */}
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setShowSearch(true)}>
              <Ionicons name="search-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Ionicons name="call-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerBtn}>
              <Ionicons name="videocam-outline" size={22} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Pinned Message Banner */}
      {messages.filter(m => m.isPinned).length > 0 && (
        <View style={styles.pinnedBanner}>
          <Ionicons name="pin" size={14} color={Colors.brand.indigo} style={styles.pinnedBannerIcon} />
          <TouchableOpacity
            style={styles.pinnedBannerContent}
            onPress={() => {
              const pinnedList = messages.filter(m => m.isPinned);
              if (pinnedList.length > 0) {
                jumpToMessage(pinnedList[0]._id);
              }
            }}
          >
            <Text style={styles.pinnedBannerTitle} numberOfLines={1}>
              Pinned Message
            </Text>
            <Text style={styles.pinnedBannerText} numberOfLines={1}>
              {messages.filter(m => m.isPinned)[0].content || messages.filter(m => m.isPinned)[0].messageType || 'Media'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.unpinBannerBtn}
            onPress={() => {
              const pinnedList = messages.filter(m => m.isPinned);
              if (pinnedList.length > 0) {
                triggerPinMessage(pinnedList[0]);
              }
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={Colors.text.tertiary} />
          </TouchableOpacity>
        </View>
      )}

      {/* ── MESSAGE LIST ── */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {isLoading ? (
          <ChatSkeleton />
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={keyExtractor}
            renderItem={renderMessage}
            inverted
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={15}
            contentContainerStyle={styles.messageList}
            ListHeaderComponent={
              typingUsers.length > 0 ? <TypingIndicator /> : null
            }
            ListFooterComponent={
              isLoadingMore ? (
                <View style={{ padding: 16 }}>
                  <ActivityIndicator color={Colors.brand.indigo} size="small" />
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={60} color={Colors.text.placeholder} />
                <Text style={styles.emptyTitle}>Say hello! 👋</Text>
                <Text style={styles.emptySubtitle}>Start the conversation with {displayName}</Text>
              </View>
            }
          />
        )}

        {/* Scroll-to-bottom FAB */}
        <Animated.View
          style={[
            styles.scrollFab,
            { opacity: scrollBtnAnim, transform: [{ scale: scrollBtnAnim }] },
          ]}
          pointerEvents={showScrollBtn ? 'auto' : 'none'}
        >
          <TouchableOpacity
            style={styles.scrollFabBtn}
            onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          >
            <Ionicons name="chevron-down" size={20} color="#fff" />
          </TouchableOpacity>
        </Animated.View>

        {/* ── REPLY PREVIEW STRIP ── */}
        {replyingTo && (
          <View style={styles.replyStrip}>
            <View style={styles.replyStripBar} />
            <View style={styles.replyStripContent}>
              <Text style={styles.replyStripName}>{replyingTo.sender?.name || 'Message'}</Text>
              <Text style={styles.replyStripText} numberOfLines={1}>
                {replyingTo.content || 'Media'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setReplyingTo(null)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── EDIT PREVIEW STRIP ── */}
        {editingMessage && (
          <View style={styles.replyStrip}>
            <View style={[styles.replyStripBar, { backgroundColor: Colors.brand.teal }]} />
            <View style={styles.replyStripContent}>
              <Text style={[styles.replyStripName, { color: Colors.brand.teal }]}>Edit Message</Text>
              <Text style={styles.replyStripText} numberOfLines={1}>
                {editingMessage.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setEditingMessage(null);
                setInputText('');
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={20} color={Colors.text.tertiary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ── INPUT BAR ── */}
        {(!chatDetails?.isGroupChat || !adminsOnly || String(chatDetails?.groupAdmin?._id || chatDetails?.groupAdmin) === String(user?._id)) ? (
          isRecording ? (
            <View style={[styles.inputBar, styles.recordingBar, { paddingBottom: insets.bottom + 10 }]}>
              <TouchableOpacity
                style={styles.discardBtn}
                onPress={() => stopRecording(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="trash-outline" size={24} color={Colors.semantic.error} />
              </TouchableOpacity>

              <View style={styles.recordingStatus}>
                <Animated.View style={[styles.recordingDot, { opacity: recordingDotAnim }]} />
                <Text style={styles.recordingTime}>
                  Recording {Math.floor(recordDuration / 60)}:{(recordDuration % 60) < 10 ? '0' : ''}{recordDuration % 60}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.sendRecordingBtn}
                onPress={() => stopRecording(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="send" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
              {/* Attachment button */}
              <TouchableOpacity
                style={styles.inputAction}
                onPress={() => setShowAttachment(true)}
              >
                <Ionicons name="attach" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>

              {/* Text input */}
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.textInput}
                  value={inputText}
                  onChangeText={handleTyping}
                  placeholder="Message"
                  placeholderTextColor={Colors.text.placeholder}
                  multiline
                  maxLength={2000}
                  returnKeyType="default"
                />
              </View>

              {/* Send or Mic */}
              {inputText.trim().length > 0 ? (
                <TouchableOpacity
                  style={styles.sendBtn}
                  onPress={handleSend}
                  disabled={isSending}
                >
                  {isSending ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micBtn} onPress={startRecording}>
                  <Ionicons name="mic-outline" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )
        ) : (
          <View style={[styles.disabledInputBar, { paddingBottom: insets.bottom + 16 }]}>
            <Ionicons name="lock-closed-outline" size={16} color={Colors.text.tertiary} style={{ marginRight: 6 }} />
            <Text style={styles.disabledInputText}>Only admins can send messages</Text>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* ── MESSAGE OPTIONS MODAL ── */}
      {selectedMessage && (
        <MessageOptionsModal
          visible={!!selectedMessage}
          message={selectedMessage}
          isMine={String(selectedMessage?.sender?._id || selectedMessage?.sender) === String(user?._id)}
          currentUserId={user?._id}
          onClose={() => setSelectedMessage(null)}
          onReply={() => {
            setReplyingTo(selectedMessage);
            setSelectedMessage(null);
          }}
          onDelete={() => {
            Alert.alert(
              'Delete Message',
              'Are you sure you want to delete this message?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: handleDelete },
              ]
            );
          }}
          onReact={handleReact}
          onCopy={handleCopy}
          onEdit={() => triggerEditMessage(selectedMessage)}
          onPin={() => triggerPinMessage(selectedMessage)}
          onStar={() => triggerStarMessage(selectedMessage)}
          onForward={() => triggerForwardMessage(selectedMessage)}
          onRetry={() => {
            setSelectedMessage(null);
            handleRetryMessage(selectedMessage);
          }}
        />
      )}

      {/* ── FORWARD MODAL ── */}
      {showForwardModal && (
        <View style={styles.modalOverlay}>
          <View style={[styles.optionsModal, { height: '80%', paddingHorizontal: 16 }]}>
            <View style={styles.forwardHeader}>
              <Text style={styles.forwardTitle}>Forward to...</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowForwardModal(false);
                  setForwardMessageItem(null);
                  setSelectedForwardChats([]);
                }}
                style={styles.forwardCloseBtn}
              >
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={styles.forwardSearch}>
              <Ionicons name="search" size={18} color={Colors.text.tertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={styles.forwardSearchInput}
                value={forwardSearchQuery}
                onChangeText={handleForwardSearch}
                placeholder="Search chats..."
                placeholderTextColor={Colors.text.placeholder}
              />
            </View>

            {/* Selected lists horizontal */}
            {selectedForwardChats.length > 0 && (
              <View style={{ maxHeight: 70, marginVertical: 8 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {selectedForwardChats.map((c) => {
                    const name = c.isGroupChat
                      ? c.chatName
                      : c.users?.find((u) => String(u._id) !== String(user?._id))?.name || 'User';
                    return (
                      <View key={c._id} style={styles.forwardBadge}>
                        <Text style={styles.forwardBadgeText} numberOfLines={1}>{name}</Text>
                        <TouchableOpacity onPress={() => toggleForwardChatSelection(c)}>
                          <Ionicons name="close-circle" size={14} color="#fff" style={{ marginLeft: 4 }} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* List of Chats */}
            {isSearchingForward ? (
              <ActivityIndicator size="large" color={Colors.brand.indigo} style={{ flex: 1 }} />
            ) : (
              <FlatList
                data={forwardSearchResults}
                keyExtractor={(item) => item._id}
                style={{ flex: 1 }}
                renderItem={({ item }) => {
                  const isSelected = selectedForwardChats.some((c) => c._id === item._id);
                  const name = item.isGroupChat
                    ? item.chatName
                    : item.users?.find((u) => String(u._id) !== String(user?._id))?.name || 'User';
                  const avatar = item.isGroupChat
                    ? item.groupAvatar?.url
                    : item.users?.find((u) => String(u._id) !== String(user?._id))?.profilePic?.url;
                  return (
                    <TouchableOpacity
                      style={styles.forwardRowItem}
                      onPress={() => toggleForwardChatSelection(item)}
                    >
                      {avatar ? (
                        <Image source={{ uri: avatar }} style={styles.forwardAvatar} />
                      ) : (
                        <View style={[styles.forwardAvatar, styles.forwardAvatarFallback]}>
                          <Text style={styles.forwardAvatarLetter}>{name.charAt(0).toUpperCase()}</Text>
                        </View>
                      )}
                      <Text style={styles.forwardRowName} numberOfLines={1}>{name}</Text>
                      <View style={[styles.forwardCheckbox, isSelected && styles.forwardCheckboxActive]}>
                        {isSelected && <Ionicons name="checkmark" size={12} color="#fff" />}
                      </View>
                    </TouchableOpacity>
                  );
                }}
              />
            )}

            {/* Action button */}
            <TouchableOpacity
              style={[styles.forwardSendBtn, selectedForwardChats.length === 0 && styles.forwardSendBtnDisabled]}
              onPress={handleForwardSend}
              disabled={selectedForwardChats.length === 0 || isForwarding}
            >
              {isForwarding ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.forwardSendBtnText}>
                  Send to {selectedForwardChats.length} Chat{selectedForwardChats.length !== 1 ? 's' : ''}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── ATTACHMENT MENU ── */}
      <AttachmentMenu
        visible={showAttachment}
        onClose={() => setShowAttachment(false)}
        onPickImage={pickImage}
        onPickVideo={pickVideo}
        onPickDocument={pickDocument}
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────
// STYLES
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg.primary },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  backBtn: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 12,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  headerAvatarWrapper: { position: 'relative' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20 },
  headerAvatarFallback: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
  },
  headerAvatarLetter: { fontSize: 16, fontWeight: '700', color: Colors.brand.indigo },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.status.online,
    borderWidth: 1.5, borderColor: Colors.bg.secondary,
  },
  headerName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  headerStatus: { fontSize: 12, color: Colors.text.tertiary },
  headerTyping: { color: Colors.brand.indigo },
  headerActions: { flexDirection: 'row', gap: 2 },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },

  // ── Messages ──
  messageList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexGrow: 1,
    justifyContent: 'flex-end',
  },

  // ── Bubble ──
  bubbleWrapper: { marginVertical: 2 },
  bubbleWrapperRight: { alignItems: 'flex-end' },
  bubbleWrapperLeft: { alignItems: 'flex-start' },
  bubble: {
    maxWidth: SCREEN_W * 0.76,
    borderRadius: 18,
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 6,
  },
  bubbleMine: {
    backgroundColor: Colors.bubble.sent,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: Colors.bubble.received,
    borderWidth: 1,
    borderColor: Colors.bubble.receivedBorder,
    borderBottomLeftRadius: 4,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.brand.indigo,
    marginBottom: 2,
    marginLeft: 4,
  },

  // ── Message content ──
  messageText: { fontSize: 15, lineHeight: 21 },
  messageTextMine: { color: '#fff' },
  messageTextTheirs: { color: Colors.text.primary },
  msgMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    justifyContent: 'flex-end',
    marginTop: 3,
  },
  msgTime: { fontSize: 11, color: Colors.text.placeholder },
  msgTimeMine: { color: 'rgba(255,255,255,0.6)' },

  // ── Deleted ──
  deletedRow: { flexDirection: 'row', alignItems: 'center' },
  deletedText: { color: Colors.text.placeholder, fontSize: 14, fontStyle: 'italic' },

  // ── Image message ──
  imageMsg: { width: SCREEN_W * 0.6, height: SCREEN_W * 0.5, borderRadius: 12 },
  imagePlaceholder: {
    width: SCREEN_W * 0.6, height: SCREEN_W * 0.5, borderRadius: 12,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Audio message ──
  audioMsg: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    minWidth: SCREEN_W * 0.5,
  },
  playBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  waveformPlaceholder: {
    flex: 1, flexDirection: 'row',
    alignItems: 'center', gap: 2, height: 28,
  },
  waveBar: { width: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  waveBarMine: { backgroundColor: 'rgba(255,255,255,0.6)' },
  audioDuration: { fontSize: 11, color: Colors.text.placeholder },
  audioDurationMine: { color: 'rgba(255,255,255,0.6)' },

  // ── Document message ──
  docMsg: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  docIcon: {
    width: 44, height: 44, borderRadius: 12,
    backgroundColor: 'rgba(124, 110, 247, 0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  docInfo: { flex: 1 },
  docName: { fontSize: 13, fontWeight: '600', color: Colors.text.primary },
  docSize: { fontSize: 11, color: Colors.text.tertiary, marginTop: 2 },

  // ── Reply preview (in bubble) ──
  replyPreview: {
    flexDirection: 'row',
    borderRadius: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  replyPreviewMine: { backgroundColor: 'rgba(255,255,255,0.15)' },
  replyPreviewTheirs: { backgroundColor: 'rgba(124, 110, 247, 0.1)' },
  replyBar: { width: 3 },
  replyContent: { flex: 1, paddingHorizontal: 8, paddingVertical: 4 },
  replySender: { fontSize: 11, fontWeight: '700', color: Colors.brand.indigo, marginBottom: 2 },
  replyText: { fontSize: 12, color: Colors.text.secondary },

  // ── Reactions ──
  reactionsRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  reactionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, color: Colors.text.tertiary, marginLeft: 2 },

  // ── Skeleton ──
  skeletonBubble: {
    height: 36, borderRadius: 14, backgroundColor: Colors.bg.tertiary,
  },
  skeletonMine: { alignSelf: 'flex-end' },
  skeletonTheirs: { alignSelf: 'flex-start' },

  // ── Typing ──
  typingContainer: { marginLeft: 12, marginBottom: 6 },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bubble.received,
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.bubble.receivedBorder,
  },
  typingDot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: Colors.brand.indigo,
  },

  // ── Empty state ──
  emptyState: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingTop: 80, paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22, fontWeight: '700', color: Colors.text.primary,
    marginTop: 16, marginBottom: 8, textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14, color: Colors.text.tertiary,
    textAlign: 'center', lineHeight: 20,
  },

  // ── Scroll FAB ──
  scrollFab: {
    position: 'absolute', bottom: 90, right: 16,
  },
  scrollFabBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8,
    elevation: 6,
  },

  // ── Reply strip ──
  replyStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 10,
  },
  replyStripBar: {
    width: 3, height: '100%', minHeight: 36,
    backgroundColor: Colors.brand.indigo,
    borderRadius: 2,
  },
  replyStripContent: { flex: 1 },
  replyStripName: { fontSize: 12, fontWeight: '700', color: Colors.brand.indigo, marginBottom: 2 },
  replyStripText: { fontSize: 13, color: Colors.text.secondary },

  // ── Input bar ──
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    gap: 6,
  },
  inputAction: {
    width: 40, height: 40,
    alignItems: 'center', justifyContent: 'center',
    borderRadius: 20,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
    maxHeight: 120,
    minHeight: 42,
    justifyContent: 'center',
  },
  textInput: {
    color: Colors.text.primary,
    fontSize: 15,
    lineHeight: 20,
    padding: 0,
    margin: 0,
  },
  sendBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.brand.indigo,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 6,
    elevation: 4,
  },
  micBtn: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Options Modal ──
  modalOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
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
  emojiRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  emojiBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.glass.border,
  },
  emojiChar: { fontSize: 22 },
  optionsDivider: { height: 1, backgroundColor: Colors.divider, marginVertical: 4 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 24,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  optionRowDestructive: {},
  optionLabel: { fontSize: 16, fontWeight: '500', color: Colors.text.primary },

  // ── Attachment menu ──
  attachOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    zIndex: 999,
  },
  attachMenu: {
    backgroundColor: Colors.bg.elevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: Colors.glass.border,
  },
  attachOption: { alignItems: 'center', gap: 8 },
  attachIcon: {
    width: 60, height: 60, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
  },
  attachLabel: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary },

  // ── Recording bar styles ──
  recordingBar: {
    height: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    backgroundColor: Colors.bg.secondary,
    gap: 12,
  },
  discardBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255, 69, 58, 0.08)',
  },
  recordingStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.semantic.error,
  },
  recordingTime: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  sendRecordingBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: Colors.brand.indigo,
    shadowColor: Colors.brand.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  disabledInputBar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bg.secondary,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingHorizontal: 16,
  },
  disabledInputText: {
    color: Colors.text.tertiary,
    fontSize: 14,
    fontWeight: '500',
  },
  highlightedBubble: {
    backgroundColor: 'rgba(124, 110, 247, 0.35)', // semi-transparent indigo flash
    borderColor: Colors.brand.indigo,
    borderWidth: 1.5,
  },
  searchInputWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.glass.border,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  headerSearchInput: {
    color: Colors.text.primary,
    fontSize: 15,
  },
  searchControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  searchCountText: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  searchNavBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: Colors.bg.tertiary,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  forwardedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  forwardedText: {
    fontSize: 10,
    color: Colors.text.placeholder,
    fontStyle: 'italic',
  },
  editedBadge: {
    fontSize: 9,
    color: Colors.text.placeholder,
    marginRight: 4,
    fontStyle: 'italic',
  },
  editedBadgeMine: {
    color: 'rgba(255,255,255,0.5)',
  },
  pinnedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 10,
  },
  pinnedBannerIcon: {
    transform: [{ rotate: '45deg' }],
  },
  pinnedBannerContent: {
    flex: 1,
  },
  pinnedBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.brand.indigo,
    marginBottom: 2,
  },
  pinnedBannerText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  unpinBannerBtn: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  forwardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  forwardCloseBtn: {
    padding: 4,
  },
  forwardSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bg.tertiary,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.glass.border,
  },
  forwardSearchInput: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
  },
  forwardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.brand.indigo,
    borderRadius: 16,
    paddingHorizontal: 10,
    height: 32,
  },
  forwardBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 80,
  },
  forwardRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.divider,
  },
  forwardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  forwardAvatarFallback: {
    backgroundColor: Colors.bg.tertiary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardAvatarLetter: {
    color: Colors.brand.indigo,
    fontWeight: '700',
    fontSize: 16,
  },
  forwardRowName: {
    flex: 1,
    color: Colors.text.primary,
    fontSize: 15,
    fontWeight: '500',
  },
  forwardCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.text.placeholder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  forwardCheckboxActive: {
    backgroundColor: Colors.brand.indigo,
    borderColor: Colors.brand.indigo,
  },
  forwardSendBtn: {
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
  forwardSendBtnDisabled: {
    backgroundColor: Colors.bg.tertiary,
    shadowOpacity: 0,
    elevation: 0,
  },
  forwardSendBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  systemMessageContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
    width: '100%',
  },
  systemMessagePill: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 5,
    maxWidth: '85%',
  },
  systemMessageText: {
    color: Colors.text.tertiary,
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
});
