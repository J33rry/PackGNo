/**
 * FCM push notifications, delivered through Appwrite Messaging.
 *
 * Flow:
 *   1. Ask the OS for notification permission.
 *   2. Get the native FCM registration token for this device.
 *   3. Register that token with Appwrite as a *push target* on the current
 *      user. Appwrite's FCM provider then delivers any message addressed to
 *      that user straight to this device.
 *
 * The Appwrite target id is persisted locally so a token refresh updates the
 * existing target instead of piling up duplicates (one target per install).
 *
 * Requires a development/production build — Expo Go cannot receive FCM pushes.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { account, ID } from './appwrite';

const TARGET_ID_KEY = 'packngo.push.targetId';
const TOKEN_KEY = 'packngo.push.token';

/** Appwrite provider id for the FCM provider configured in the console. */
const PROVIDER_ID = process.env.EXPO_PUBLIC_APPWRITE_FCM_PROVIDER_ID;

/** Android channel used for every PackNGo notification. */
export const ANDROID_CHANNEL_ID = 'default';

/**
 * Show notifications while the app is foregrounded (otherwise Android silently
 * swallows them when the app is open).
 */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: 'Trip updates',
    importance: Notifications.AndroidImportance.HIGH,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    vibrationPattern: [0, 250, 250, 250],
  });
}

export type PushRegistrationResult =
  | { status: 'registered'; targetId: string }
  | { status: 'skipped'; reason: string };

/**
 * Register this device to receive pushes for the signed-in user. Safe to call
 * on every launch — it no-ops when the token hasn't changed.
 */
export async function registerForPushNotifications(): Promise<PushRegistrationResult> {
  if (!Device.isDevice) {
    return { status: 'skipped', reason: 'Push requires a physical device.' };
  }
  if (!PROVIDER_ID) {
    return {
      status: 'skipped',
      reason: 'EXPO_PUBLIC_APPWRITE_FCM_PROVIDER_ID is not set — see SETUP.md.',
    };
  }

  await ensureAndroidChannel();

  const existing = await Notifications.getPermissionsAsync();
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) {
    return { status: 'skipped', reason: 'Notification permission was denied.' };
  }

  // Native FCM registration token (NOT an Expo push token) — this is what
  // Appwrite's FCM provider sends to.
  const devicePushToken = await Notifications.getDevicePushTokenAsync();
  const token = String(devicePushToken.data);

  const [savedTargetId, savedToken] = await Promise.all([
    AsyncStorage.getItem(TARGET_ID_KEY),
    AsyncStorage.getItem(TOKEN_KEY),
  ]);

  // Unchanged token with a known target — nothing to do.
  if (savedTargetId && savedToken === token) {
    return { status: 'registered', targetId: savedTargetId };
  }

  // Token rotated: update the existing target rather than creating a new one.
  if (savedTargetId) {
    try {
      await account.updatePushTarget(savedTargetId, token);
      await AsyncStorage.setItem(TOKEN_KEY, token);
      return { status: 'registered', targetId: savedTargetId };
    } catch {
      // Target was removed server-side (or belongs to another user) — fall
      // through and create a fresh one.
      await AsyncStorage.removeItem(TARGET_ID_KEY);
    }
  }

  const targetId = ID.unique();
  await account.createPushTarget(targetId, token, PROVIDER_ID);
  await AsyncStorage.multiSet([
    [TARGET_ID_KEY, targetId],
    [TOKEN_KEY, token],
  ]);
  return { status: 'registered', targetId };
}

/**
 * Detach this device from the signed-in user. Call on sign-out so the next
 * person to use the device doesn't receive the previous user's notifications.
 */
export async function unregisterPushTarget(): Promise<void> {
  const targetId = await AsyncStorage.getItem(TARGET_ID_KEY);
  if (!targetId) return;
  try {
    await account.deletePushTarget(targetId);
  } catch {
    // Session may already be gone; clearing local state is what matters.
  }
  await AsyncStorage.multiRemove([TARGET_ID_KEY, TOKEN_KEY]);
}
