import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity,
  ActivityIndicator, StatusBar, Alert, Platform, Dimensions, FlatList, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors } from '../../theme/colors';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function MediaViewerScreen({ navigation, route }) {
  const { mediaUrl, message, mediaItems = [], initialIndex = 0 } = route.params || {};
  
  // Normalize items to an array of media
  const [items, setItems] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSharing, setIsSharing] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState({});
  const [muted, setMuted] = useState(false);
  
  const videoRefs = useRef({});
  const flatListRef = useRef(null);

  useEffect(() => {
    if (mediaItems && mediaItems.length > 0) {
      setItems(mediaItems);
      setActiveIndex(initialIndex);
    } else if (mediaUrl) {
      setItems([{
        _id: message?._id || 'single',
        fileUrl: mediaUrl,
        mediaUrl: mediaUrl,
        messageType: message?.messageType || message?.type || 'image',
        sender: message?.sender,
        createdAt: message?.createdAt || new Date().toISOString(),
      }]);
      setActiveIndex(0);
    } else {
      Alert.alert('Error', 'No media provided.');
      navigation.goBack();
    }
  }, [mediaUrl, mediaItems, initialIndex]);

  // Scroll to initial index once items are loaded
  useEffect(() => {
    if (items.length > 0 && initialIndex > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToIndex({ index: initialIndex, animated: false });
      }, 100);
    }
  }, [items]);

  // Handle share (downloads to local filesystem and triggers native sharing sheet)
  const handleShare = async (item) => {
    if (isSharing) return;
    const url = item.fileUrl || item.mediaUrl;
    if (!url) return;

    setIsSharing(true);
    const itemId = item._id;
    try {
      const filename = url.split('/').pop()?.split('?')[0] || 'media.jpg';
      const localUri = `${FileSystem.cacheDirectory}${filename}`;
      
      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgressData) => {
          const progress = downloadProgressData.totalBytesWritten / downloadProgressData.totalBytesExpectedToWrite;
          setDownloadProgress(prev => ({ ...prev, [itemId]: progress }));
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      setDownloadProgress(prev => ({ ...prev, [itemId]: 1 }));
      
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Sharing Unavailable', 'Native sharing is not supported on this device.');
      }
    } catch (err) {
      console.error('[MediaViewerScreen] Share error:', err);
      Alert.alert('Sharing Failed', 'Could not download or share this file.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownload = async (item) => {
    const url = item.fileUrl || item.mediaUrl;
    if (!url) return;
    const itemId = item._id;

    try {
      const filename = url.split('/').pop()?.split('?')[0] || 'media.jpg';
      const localUri = `${FileSystem.cacheDirectory}${filename}`;

      const downloadResumable = FileSystem.createDownloadResumable(
        url,
        localUri,
        {},
        (downloadProgressData) => {
          const progress = downloadProgressData.totalBytesWritten / downloadProgressData.totalBytesExpectedToWrite;
          setDownloadProgress(prev => ({ ...prev, [itemId]: progress }));
        }
      );

      const { uri } = await downloadResumable.downloadAsync();
      setDownloadProgress(prev => ({ ...prev, [itemId]: 1 }));
      
      // On iOS / Android, sharing to save to gallery or opening is available
      await Sharing.shareAsync(uri);
    } catch (err) {
      console.error('[MediaViewerScreen] Save error:', err);
      Alert.alert('Download Failed', 'Could not save file.');
    }
  };

  const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems && viewableItems.length > 0) {
      const index = viewableItems[0].index;
      setActiveIndex(index);
      
      // Pause other videos, play current video if it's a video
      Object.keys(videoRefs.current).forEach((key) => {
        const video = videoRefs.current[key];
        if (video) {
          if (parseInt(key) === index) {
            video.playAsync().catch(() => {});
          } else {
            video.pauseAsync().catch(() => {});
          }
        }
      });
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50
  }).current;

  const renderMediaItem = ({ item, index }) => {
    const url = item.fileUrl || item.mediaUrl;
    const type = item.messageType || item.type || 'image';
    const isVideo = type === 'video';

    if (isVideo) {
      return (
        <View style={styles.slide}>
          <Video
            ref={ref => { videoRefs.current[index] = ref; }}
            source={{ uri: url }}
            style={styles.fullMedia}
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={index === activeIndex}
            isLooping
            isMuted={muted}
            useNativeControls={true}
          />
          <TouchableOpacity 
            style={styles.muteBtn}
            onPress={() => setMuted(!muted)}
          >
            <Ionicons name={muted ? "volume-mute" : "volume-high"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.slide}>
        <Image
          source={{ uri: url }}
          style={styles.fullMedia}
          resizeMode="contain"
        />
      </View>
    );
  };

  const currentItem = items[activeIndex];
  const senderName = currentItem?.sender?.name || 'Photo';
  const dateStr = currentItem?.createdAt
    ? new Date(currentItem.createdAt).toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '';

  const progress = currentItem ? (downloadProgress[currentItem._id] || 0) : 0;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      {/* ── HEADER ── */}
      <SafeAreaView style={styles.headerContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.senderName}>{senderName}</Text>
            {dateStr ? <Text style={styles.dateText}>{dateStr}</Text> : null}
          </View>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            {currentItem && progress > 0 && progress < 1 && (
              <View style={styles.progressContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.progressText}>{Math.floor(progress * 100)}%</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => currentItem && handleDownload(currentItem)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="download-outline" size={22} color="#fff" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.headerBtn}
              onPress={() => currentItem && handleShare(currentItem)}
              disabled={isSharing}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {isSharing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="share-social-outline" size={22} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── LIST / PAGER ── */}
      <FlatList
        ref={flatListRef}
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        renderItem={renderMediaItem}
        keyExtractor={item => item._id}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(data, index) => (
          { length: SCREEN_W, offset: SCREEN_W * index, index }
        )}
        style={styles.list}
      />

      {/* ── INDICATOR FOOTER ── */}
      {items.length > 1 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>{activeIndex + 1} / {items.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  list: { flex: 1 },
  slide: {
    width: SCREEN_W,
    height: SCREEN_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  fullMedia: {
    width: SCREEN_W,
    height: SCREEN_H * 0.8,
  },
  muteBtn: {
    position: 'absolute',
    bottom: 120,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 10,
    borderRadius: 20,
  },
  
  // Custom header overlay styles
  headerContainer: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    width: '100%',
    position: 'absolute',
    top: 0, left: 0, right: 0,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 8 : 16,
    justifyContent: 'space-between',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerInfo: {
    flex: 1,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  senderName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  dateText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  progressText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
