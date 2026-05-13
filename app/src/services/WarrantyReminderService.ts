/**
 * WarrantyReminderService
 *
 * Schedules and cancels local push notifications for item warranty expiry dates.
 * Sends a reminder 30 days before and on the day the warranty expires.
 *
 * Notification body includes item name + location so users know exactly
 * which item and where it is without opening the app.
 *
 * Reuses expo-notifications (same channel infrastructure as ReminderService).
 */

import * as Notifications from 'expo-notifications';
import { SchedulableTriggerInputTypes, AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';
import { ReminderService } from './ReminderService';

const CHANNEL_ID = 'spotly-warranty-reminders';
const DAYS_BEFORE = 30;
const NOTIFICATION_HOUR = 9;

if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Warranty Reminders',
    importance: AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#e09b3a',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
  });
}

export class WarrantyReminderService {
  /**
   * Schedule warranty expiry notifications for an item.
   *
   * Schedules:
   *   - 30 days before expiry at 09:00 (if still in future)
   *   - On the expiry day at 09:00 (if still in future)
   *
   * If existingReminderId is provided, those notifications are cancelled first
   * (supports rescheduling when the warranty date is changed).
   *
   * @param itemId - Item ID stored in notification data for deep-linking
   * @param itemName - Item name shown in notification body
   * @param locationName - Space or container name shown in notification body
   * @param expiryDate - The warranty expiry date
   * @param existingReminderId - Comma-separated IDs to cancel before scheduling (optional)
   * @returns Comma-joined notification IDs to store in DB, or null if none scheduled
   */
  static async scheduleWarrantyReminders(
    itemId: string,
    itemName: string,
    locationName: string,
    expiryDate: Date,
    existingReminderId?: string | null
  ): Promise<string | null> {
    // Cancel any existing reminders before scheduling new ones
    if (existingReminderId) {
      await WarrantyReminderService.cancelWarrantyReminders(existingReminderId);
    }

    const granted = await ReminderService.requestPermissions();
    if (!granted) return null;

    const ids: string[] = [];
    const now = new Date();

    // Expiry-day trigger: 09:00 on expiry date
    const expiryDayTrigger = new Date(expiryDate);
    expiryDayTrigger.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    // 30-day-before trigger: 09:00, 30 days before expiry
    const thirtyDayTrigger = new Date(expiryDate);
    thirtyDayTrigger.setDate(thirtyDayTrigger.getDate() - DAYS_BEFORE);
    thirtyDayTrigger.setHours(NOTIFICATION_HOUR, 0, 0, 0);

    if (thirtyDayTrigger > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🛡️ Warranty Expiring Soon',
          body: `${itemName} (${locationName}) warranty expires in ${DAYS_BEFORE} days.`,
          data: { itemId },
          sound: 'default',
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: thirtyDayTrigger,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    }

    if (expiryDayTrigger > now) {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🛡️ Warranty Expires Today',
          body: `${itemName} (${locationName}) warranty expires today.`,
          data: { itemId },
          sound: 'default',
        },
        trigger: {
          type: SchedulableTriggerInputTypes.DATE,
          date: expiryDayTrigger,
          channelId: CHANNEL_ID,
        },
      });
      ids.push(id);
    }

    return ids.length > 0 ? ids.join(',') : null;
  }

  /**
   * Cancel all warranty notifications for an item.
   *
   * @param reminderId - Comma-separated notification IDs stored in DB
   */
  static async cancelWarrantyReminders(reminderId: string): Promise<void> {
    await ReminderService.cancelReminders(reminderId);
  }
}
