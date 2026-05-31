/**
 * PulseChat - Real-Time Encrypted Messaging System (Mobile Client)
 * 
 * Cryptographic Signature & Verification Hash
 * --------------------------------------------------
 * Developer Name : Ravi Mehla
 * Roll Number    : 19590
 * College Name   : SKD University
 * Signature Hash : 69f1589e1eeb95b42956e3f21cae32c0a9f79cd3db1b4adf7e78ca1e08a16491
 * --------------------------------------------------
 * Verification command: node verify-owner.js
 */

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { showLocalNotification } from './notifications';

const rawUrl = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000';
const BASE_URL = rawUrl.replace(/\/api\/?$/, '').replace(/\/$/, '');

let socket = null;

export const getSocket = () => socket;

export const connectSocket = async (userId) => {
  if (socket?.connected) return socket;

  const token = await SecureStore.getItemAsync('token');
  if (!token) return null;

  socket = io(BASE_URL, {
    transports: ['websocket'],
    auth: { token },
    query: { userId },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    if (__DEV__) console.log('[Socket] Connected:', socket.id);
  });

  socket.on('offline_missed_calls', (missedCalls) => {
    if (__DEV__) console.log('[Socket] Received offline missed calls:', missedCalls);
    try {
      missedCalls.forEach(call => {
        const callTime = new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const callDate = new Date(call.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
        showLocalNotification(
          'Missed Call',
          `You missed a ${call.type} call from ${call.callerName} at ${callTime} on ${callDate}.`,
          { chatId: call.chatId }
        );
      });
    } catch (err) {
      if (__DEV__) console.error('[Socket] Error triggering missed call local notification:', err);
    }
  });

  socket.on('disconnect', (reason) => {
    if (__DEV__) console.log('[Socket] Disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    if (__DEV__) console.error('[Socket] Connection error:', err.message);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinRoom = (chatId) => {
  socket?.emit('join chat', chatId);
};

export const leaveRoom = (chatId) => {
  socket?.emit('leave chat', chatId);
};

export const sendTyping = (chatId, userId) => {
  socket?.emit('typing', { chatId, userId });
};

export const sendStopTyping = (chatId, userId) => {
  socket?.emit('stop typing', { chatId, userId });
};

export default {
  getSocket,
  connectSocket,
  disconnectSocket,
  joinRoom,
  leaveRoom,
  sendTyping,
  sendStopTyping,
};
