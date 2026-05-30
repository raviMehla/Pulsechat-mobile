import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { authAPI, userAPI, setAuthToken, clearAuthToken } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // ─── Load stored auth on app start ───
  useEffect(() => {
    const loadAuth = async () => {
      try {
        const storedToken = await SecureStore.getItemAsync('token');
        const storedUserStr = await AsyncStorage.getItem('user');
        const u = storedUserStr ? JSON.parse(storedUserStr) : null;

        if (storedToken && u) {
          setToken(storedToken);
          setUser(u);
          setAuthToken(storedToken);
          setIsAuthenticated(true);
          await connectSocket(u._id);
        }
      } catch (err) {
        console.warn('[Auth] Load error:', err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadAuth();
  }, []);

  // ─── Login ───
  const login = useCallback(async (credentials) => {
    const res = await authAPI.login(credentials);
    const { token: newToken, ...userData } = res.data;

    setToken(newToken);
    setUser(userData);
    setAuthToken(newToken);
    setIsAuthenticated(true);

    await SecureStore.setItemAsync('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));

    await connectSocket(userData._id);

    return userData;
  }, []);

  // ─── Register ───
  const register = useCallback(async (data) => {
    const res = await authAPI.register(data);
    const { token: newToken, ...userData } = res.data;

    setToken(newToken);
    setUser(userData);
    setAuthToken(newToken);
    setIsAuthenticated(true);

    await SecureStore.setItemAsync('token', newToken);
    await AsyncStorage.setItem('user', JSON.stringify(userData));

    await connectSocket(userData._id);

    return userData;
  }, []);

  // ─── Logout ───
  const logout = useCallback(async () => {
    try {
      disconnectSocket();
    } catch (_) {}

    clearAuthToken();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);

    await SecureStore.deleteItemAsync('token');
    await AsyncStorage.removeItem('user');
  }, []);

  // ─── Update user in context after profile changes ───
  const updateUser = useCallback((updates) => {
    setUser((prev) => {
      const updated = { ...prev, ...updates };
      AsyncStorage.setItem('user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  // ─── Refresh profile from backend ───
  const refreshProfile = useCallback(async () => {
    try {
      const res = await userAPI.getProfile();
      const updatedUser = res.data;
      setUser(updatedUser);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      return updatedUser;
    } catch (err) {
      console.warn('[Auth] Profile refresh error:', err.message);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated,
        login,
        register,
        logout,
        updateUser,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export default AuthContext;
