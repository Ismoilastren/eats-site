import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

export const COURIER_AUTH_KEY = 'courier_id_v2';
export const COURIER_SESSION_KEY = 'courier_session_uid_v1';
export const LEGACY_COURIER_AUTH_KEYS = ['courier_auth_id'];

export const getItemAsync = async (key: string) => {
  if (Platform.OS === 'web') {
    return await AsyncStorage.getItem(key);
  } else {
    return await SecureStore.getItemAsync(key);
  }
};

export const setItemAsync = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
};

export const deleteItemAsync = async (key: string) => {
  if (Platform.OS === 'web') {
    await AsyncStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
};

export const getCourierIdAsync = async () => {
  const current = await getItemAsync(COURIER_AUTH_KEY);
  if (current) return current;

  for (const legacyKey of LEGACY_COURIER_AUTH_KEYS) {
    const legacy = await getItemAsync(legacyKey);
    if (legacy) {
      await setItemAsync(COURIER_AUTH_KEY, legacy);
      await deleteItemAsync(legacyKey);
      return legacy;
    }
  }

  return null;
};

export const setCourierIdAsync = async (courierId: string) => {
  await setItemAsync(COURIER_AUTH_KEY, courierId);
};

export const getOrCreateCourierSessionUidAsync = async () => {
  const current = await getItemAsync(COURIER_SESSION_KEY);
  if (current) return current;

  const randomSuffix = Math.random().toString(36).slice(2, 12);
  const timestamp = Date.now().toString(36);
  const sessionUid = `courier_device_${timestamp}_${randomSuffix}`;
  await setItemAsync(COURIER_SESSION_KEY, sessionUid);
  return sessionUid;
};

export const clearCourierIdAsync = async () => {
  await deleteItemAsync(COURIER_AUTH_KEY);
  await Promise.all(LEGACY_COURIER_AUTH_KEYS.map((key) => deleteItemAsync(key)));
};
