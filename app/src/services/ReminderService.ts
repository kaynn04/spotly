/**
 * ReminderService
 *
 * Schedules and cancels local push notifications for lending due dates.
 * Sends a reminder 1 day before and on the day the item is due back.
 *
 * Requires expo-notifications + expo-device (development build).
 */

import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes, AndroidImportance } from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Linking, Platform } from 'react-native';

const CHANNEL_ID = 'spotly-lending-reminders';

// Register the Android notification channel (must be done before scheduling)
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Lending Reminders',
    importance: AndroidImportance.HIGH,   // shows as heads-up popup
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6b7f99',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

// How notifications appear while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export class ReminderService {
  /**
   * Request notification permissions.
   * Returns true if granted, false otherwise.
   */
  static async requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) return false; // no notifications in simulator/emulator

    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Notifications Disabled',
        'Enable notifications in Settings to receive due-date reminders.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    }

    // Only prompt for battery exemption on first-time grant
    ReminderService.requestBatteryOptimizationExemption();
    return true;
  }

  /**
   * On Android, prompt the user to exempt the app from battery optimization
   * so notifications fire even when the app is fully killed on OEM devices
   * (Samsung, Xiaomi, Huawei, etc.).
   */
  static requestBatteryOptimizationExemption(): void {
    if (Platform.OS !== 'android') return;
    // Android 6+ only — check if we can open the battery settings
    Alert.alert(
      'Keep Reminders Reliable',
      'To receive notifications when the app is closed, allow Spotly to run in the background. Tap "Open Settings" → Battery → Unrestricted.',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Open Settings',
          onPress: () =>
            Linking.sendIntent('android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS').catch(() =>
              Linking.openSettings()
            ),
        },
      ],
      { cancelable: true }
    );
  }

  /**
   * Schedule reminders for a lending due date.
   * Schedules:
   *   - 1 day before due (09:00)
   *   - On the due day (09:00)
   *
   * Returns a comma-joined string of notification IDs (store in DB).
   * Returns null if permission denied or due date is in the past.
   */
  static async scheduleDueDateReminders(
    lendingId: string,
    borrowerName: string,
    itemName: string,
    dueDate: Date
  ): Promise<string | null> {
    const granted = await ReminderService.requestPermissions();
    if (!granted) return null;

    const ids: string[] = [];
    const now = new Date();

    // Due-day trigger: 09:00 on due date
    const dueDayTrigger = new Date(dueDate);
    dueDayTrigger.setHours(9, 0, 0, 0);

    // 1-day-before trigger: 09:00 the day before
    const dayBeforeTrigger = new Date(dueDate);
    dayBeforeTrigger.setDate(dayBeforeTrigger.getDate() - 1);
    dayBeforeTrigger.setHours(9, 0, 0, 0);

    if (dayBeforeTrigger > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📦 Lending Due Tomorrow',
          body: `${itemName} lent to ${borrowerName} is due back tomorrow.`,
          data: { lendingId },
          sound: 'default',
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: dayBeforeTrigger, channelId: CHANNEL_ID },
      });
      ids.push(id);
    }

    if (dueDayTrigger > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '📦 Lending Due Today',
          body: `${itemName} lent to ${borrowerName} is due back today.`,
          data: { lendingId },
          sound: 'default',
        },
        trigger: { type: SchedulableTriggerInputTypes.DATE, date: dueDayTrigger, channelId: CHANNEL_ID },
      });
      ids.push(id);
    }

    return ids.length > 0 ? ids.join(',') : null;
  }

  /**
   * Cancel all reminders for a lending (e.g., when marked as returned).
   * @param reminderId - comma-separated notification IDs stored in DB
   */
  static async cancelReminders(reminderId: string): Promise<void> {
    const ids = reminderId.split(',').filter(Boolean);
    await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id)));
  }
}
