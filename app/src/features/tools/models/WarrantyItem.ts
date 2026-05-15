/**
 * WarrantyItem
 *
 * Derived type for items that have a warranty expiry date.
 * Used exclusively by the Warranty Tracker dashboard.
 */

import type { Item } from '@/src/models/Item';
import { parseDateOnly, startOfLocalDay } from '@/src/utils/dateOnly';

export type WarrantyStatus = 'expiring-soon' | 'active' | 'expired';

export interface WarrantyItem extends Item {
  warrantyExpiry: string;       // guaranteed non-null
  warrantyStatus: WarrantyStatus;
  daysRemaining: number;        // negative if expired
}

/**
 * Classify a warranty expiry date string into a status.
 */
export function classifyWarranty(expiryDateStr: string): WarrantyStatus {
  const today = startOfLocalDay(new Date());
  const expiry = parseDateOnly(expiryDateStr);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
  if (days < 0) return 'expired';
  if (days <= 30) return 'expiring-soon';
  return 'active';
}

/**
 * Compute days remaining for a warranty expiry date.
 * Negative = already expired.
 */
export function daysUntilExpiry(expiryDateStr: string): number {
  const today = startOfLocalDay(new Date());
  const expiry = parseDateOnly(expiryDateStr);
  return Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
}

/**
 * Build a WarrantyItem from an Item that has a warrantyExpiry set.
 */
export function toWarrantyItem(item: Item): WarrantyItem {
  const expiry = item.warrantyExpiry!;
  return {
    ...item,
    warrantyExpiry: expiry,
    warrantyStatus: classifyWarranty(expiry),
    daysRemaining: daysUntilExpiry(expiry),
  };
}
