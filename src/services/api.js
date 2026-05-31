import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// ─────────────────────────────────────────────────────────
// CONFIGURATION
// Backend URL — update this to your local IP for dev testing
// ─────────────────────────────────────────────────────────
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:5000';

let _cachedToken = null;
let _router = null;
let _isRedirecting = false;

// Set router reference for global navigation
export const setApiRouter = (router) => {
  _router = router;
};

// Set in-memory token cache
export const setAuthToken = (token) => {
  _cachedToken = token;
};

export const clearAuthToken = () => {
  _cachedToken = null;
};

// ─────────────────────────────────────────────────────────
// AXIOS INSTANCE
// ─────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─────────────────────────────────────────────────────────
// REQUEST INTERCEPTOR — Inject Bearer Token
// ─────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    try {
      let token = _cachedToken;
      if (!token) {
        token = await SecureStore.getItemAsync('token');
        _cachedToken = token;
      }

      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // FormData: remove Content-Type so native sets multipart boundary
      if (
        config.data instanceof FormData ||
        (config.data && typeof config.data.append === 'function')
      ) {
        delete config.headers['Content-Type'];
        config.timeout = Math.max(config.timeout || 0, 60000);
      }
    } catch (err) {
      console.warn('[API] Token read error:', err.message);
    }

    if (__DEV__) {
      console.log(`▶ ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// ─────────────────────────────────────────────────────────
// RESPONSE INTERCEPTOR — Handle Errors Globally
// ─────────────────────────────────────────────────────────
api.interceptors.response.use(
  (res) => {
    if (__DEV__) console.log(`✅ ${res.status} ${res.config.url}`);
    return res;
  },
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';

    if (__DEV__) {
      console.error(`❌ ${status} ${url}`, error.response?.data);
    }

    // 401 — Session expired, redirect to login
    if (status === 401) {
      const isAuthRoute = url.includes('/auth/login') || url.includes('/auth/register');
      if (!isAuthRoute && !_isRedirecting) {
        _isRedirecting = true;
        _cachedToken = null;
        await SecureStore.deleteItemAsync('token');
        await AsyncStorage.removeItem('user');
        _router?.replace('/(auth)/login');
        setTimeout(() => { _isRedirecting = false; }, 3000);
      }
    }

    const apiError = new Error(
      error.response?.data?.message ||
      error.message ||
      'Something went wrong.'
    );
    apiError.response = error.response;
    apiError.status = status;
    apiError.code = error.code;

    return Promise.reject(apiError);
  }
);

// ─────────────────────────────────────────────────────────
// AUTH ENDPOINTS
// Backend: /api/auth/*
// ─────────────────────────────────────────────────────────
export const authAPI = {
  // POST /api/auth/login
  login: (data) => api.post('/auth/login', data),

  // POST /api/auth/send-registration-otp
  sendRegistrationOtp: (data) => api.post('/auth/send-registration-otp', data),

  // POST /api/auth/verify-registration-otp
  verifyRegistrationOtp: (data) => api.post('/auth/verify-registration-otp', data),

  // POST /api/auth/register
  register: (data) => api.post('/auth/register', data),

  // POST /api/auth/forgot-password
  forgotPassword: (data) => api.post('/auth/forgot-password', data),

  // POST /api/auth/reset-password
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// ─────────────────────────────────────────────────────────
// USER ENDPOINTS
// Backend: /api/users/*
// ─────────────────────────────────────────────────────────
export const userAPI = {
  // GET /api/users/profile
  getProfile: () => api.get('/users/profile'),

  // PUT /api/users/profile (supports FormData for avatar)
  updateProfile: (data) => api.put('/users/profile', data),

  // PUT /api/users/privacy
  updatePrivacy: (data) => api.put('/users/privacy', data),

  // PUT /api/users/password
  updatePassword: (data) => api.put('/users/password', data),

  // POST /api/users/logout-all
  logoutAllDevices: () => api.post('/users/logout-all'),

  // PUT /api/users/block (mobile body-based)
  toggleBlock: (data) => api.put('/users/block', data),

  // GET /api/users/search?q=query
  searchUsers: (q) => api.get('/users/search', { params: { q } }),

  // GET /api/users/status/:id
  getUserStatus: (id) => api.get(`/users/status/${id}`),

  // POST /api/users/fcm-token
  registerFcmToken: (data) => api.post('/users/fcm-token', data),

  // DELETE /api/users/fcm-token
  removeFcmToken: () => api.delete('/users/fcm-token'),

  // GET /api/users/export-data
  exportData: () => api.get('/users/export-data', { timeout: 60000 }),

  // POST /api/users/delete-account/otp
  requestDeleteOtp: () => api.post('/users/delete-account/otp'),

  // DELETE /api/users/delete-account
  deleteAccount: (data) => api.delete('/users/delete-account', { data }),
};

// ─────────────────────────────────────────────────────────
// CHAT ENDPOINTS
// Backend: /api/chat/*
// ─────────────────────────────────────────────────────────
export const chatAPI = {
  // POST /api/chat — Access or create 1-on-1 chat
  accessChat: (data) => api.post('/chat', data),

  // GET /api/chat — Fetch all chats for current user
  fetchChats: () => api.get('/chat'),

  // POST /api/chat/group — Create group chat (supports FormData)
  createGroup: (data) => api.post('/chat/group', data),

  // PUT /api/chat/group/:chatId/details — Update group
  updateGroup: (chatId, data) => api.put(`/chat/group/${chatId}/details`, data),

  // PUT /api/chat/group/add
  addToGroup: (data) => api.put('/chat/group/add', data),

  // PUT /api/chat/group/remove
  removeFromGroup: (data) => api.put('/chat/group/remove', data),

  // PUT /api/chat/group/leave
  leaveGroup: (data) => api.put('/chat/group/leave', data),

  // PUT /api/chat/group/promote
  promoteToAdmin: (data) => api.put('/chat/group/promote', data),

  // DELETE /api/chat/:chatId
  deleteChat: (chatId) => api.delete(`/chat/${chatId}`),
};

// ─────────────────────────────────────────────────────────
// MESSAGE ENDPOINTS
// Backend: /api/message/*
// ─────────────────────────────────────────────────────────
export const messageAPI = {
  // GET /api/message/:chatId — Get messages for a chat
  getMessages: (chatId, params) => api.get(`/message/${chatId}`, { params }),

  // POST /api/message — Send text message
  sendMessage: (data) => api.post('/message', data),

  // POST /api/message/media — Send media message (FormData)
  sendMedia: (data) => api.post('/message/media', data, { timeout: 60000 }),

  // PUT /api/message/read — Mark messages as read
  markRead: (data) => api.put('/message/read', data),

  // PUT /api/message/react — React to message
  reactToMessage: (data) => api.put('/message/react', data),

  // DELETE /api/message/:messageId
  deleteMessage: (messageId) => api.delete(`/message/${messageId}`),

  // GET /api/message/search/:chatId
  searchMessages: (chatId, q) => api.get(`/message/search/${chatId}`, { params: { q } }),

  // GET /api/message/:chatId/context/:messageId
  getContext: (chatId, messageId) => api.get(`/message/${chatId}/context/${messageId}`),

  // PUT /api/message/:messageId/edit — Edit own message
  editMessage: (messageId, data) => api.put(`/message/${messageId}/edit`, data),

  // PUT /api/message/:messageId/pin — Pin/unpin message
  pinMessage: (messageId) => api.put(`/message/${messageId}/pin`),

  // PUT /api/message/:messageId/star — Star/unstar message
  starMessage: (messageId) => api.put(`/message/${messageId}/star`),

  // GET /api/message/starred — Get all starred messages for current user
  getStarredMessages: () => api.get('/message/starred'),
};

// ─────────────────────────────────────────────────────────
// CALL ENDPOINTS
// Backend: /api/call/*
// ─────────────────────────────────────────────────────────
export const callAPI = {
  // GET /api/call/ice-servers — Get WebRTC ICE servers
  getIceServers: () => api.get('/call/ice-servers'),
};

export default api;
