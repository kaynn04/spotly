/**
 * Lending Detail Screen
 *
 * Display detailed information about a single lending and allow marking it as returned.
 *
 * Architecture: UI → Service → Repository → SQLite
 * State: Local (lending, item, loading, error, confirmDialog)
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  useColorScheme,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';
import { Colors } from '@/constants/theme';

interface LendingDetailScreenProps {
  lendingId: string;
}

/**
 * LendingDetailScreen Component
 *
 * Shows:
 * - Lending information (borrower, dates, note, status)
 * - Related item details (name, space, container)
 * - "Mark as Returned" button (only for ACTIVE lendings)
 * - Confirmation dialog for return action
 * - Loading/error states
 *
 * State Management:
 * - lending: Lending record for this ID
 * - item: Related item (if exists)
 * - loading: Loading state for initial fetch
 * - error: Error message if fetch fails
 * - submitting: Loading state for mark-as-returned action
 * - showConfirmDialog: Show/hide confirmation dialog
 */
export default function LendingDetailScreen({ lendingId }: LendingDetailScreenProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];

  // Services - memoized to prevent re-creation on every render
  const itemRepository = useMemo(() => new ItemRepository(), []);
  const lendingService = useMemo(() => {
    const lendingRepository = new LendingRepository();
    return new LendingService(lendingRepository, itemRepository);
  }, [itemRepository]);

  // State
  const [lending, setLending] = useState<Lending | null>(null);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  /**
   * Load Lending Details
   *
   * Fetch lending by ID and related item information.
   * Handle orphaned items (deleted items gracefully).
   */
  const loadLendingDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch lending
      const lendingData = await lendingService.getLendingById(lendingId);
      if (!lendingData) {
        setError('Lending not found');
        setLending(null);
        return;
      }

      setLending(lendingData);

      // Fetch related item (may be orphaned/deleted)
      try {
        const itemData = await itemRepository.getById(lendingData.item_id);
        setItem(itemData);
      } catch {
        // Item was deleted; item will be null (handle gracefully)
        setItem(null);
      }
    } catch (err: any) {
      console.error('Error loading lending:', err);
      setError(err?.message || 'Failed to load lending details');
    } finally {
      setLoading(false);
    }
  }, [lendingId, lendingService]);

  // Load on mount and on screen focus
  useFocusEffect(
    useCallback(() => {
      loadLendingDetails();
    }, [loadLendingDetails])
  );

  /**
   * Handle Mark as Returned Button Press
   *
   * Show confirmation dialog.
   */
  const handleMarkAsReturnedPress = () => {
    setShowConfirmDialog(true);
  };

  /**
   * Handle Confirm Return
   *
   * User confirmed marking as returned.
   * Call service, update state, show feedback, navigate back.
   */
  const handleConfirmReturn = async () => {
    if (!lending) return;

    setShowConfirmDialog(false);
    setSubmitting(true);

    try {
      // Call service to mark as returned
      const updatedLending = await lendingService.markAsReturned(lending.id);

      // Update state
      setLending(updatedLending);

      // Show success message
      Alert.alert('Success', 'Item marked as returned', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate back to lending list
            router.back();
          },
        },
      ]);
    } catch (err: any) {
      console.error('Error marking as returned:', err);

      // Show error message
      const errorMessage = err?.message || 'Failed to mark item as returned';
      Alert.alert('Error', errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle Cancel Return
   *
   * User cancelled the confirmation dialog.
   */
  const handleCancelReturn = () => {
    setShowConfirmDialog(false);
  };

  /**
   * Format Date
   *
   * Display date in readable format.
   */
  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return date instanceof Date
      ? date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : new Date(date).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
  };

  // Render Loading
  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.tint} />
          <Text style={[styles.loadingText, { color: colors.text }]}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render Error
  if (error || !lending) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()}>
            <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Lending Details</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.centerContent}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>
            {error || 'Lending not found'}
          </Text>
          <Pressable
            style={[styles.button, { backgroundColor: colors.tint }]}
            onPress={() => router.back()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = lending.status === 'ACTIVE';
  const statusColor = isActive ? '#4caf50' : '#9e9e9e';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backButton, { color: colors.tint }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Lending Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Item Information Section */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Item</Text>
          {item ? (
            <View>
              <View style={styles.infoRow}>
                <Text style={[styles.label, { color: colors.tabIconDefault }]}>Name</Text>
                <Text style={[styles.value, { color: colors.text }]}>{item.name}</Text>
              </View>
              {item.space_id && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: colors.tabIconDefault }]}>Space</Text>
                  <Text style={[styles.value, { color: colors.text }]}>{item.space?.name || 'Unknown'}</Text>
                </View>
              )}
              {item.container_id && (
                <View style={styles.infoRow}>
                  <Text style={[styles.label, { color: colors.tabIconDefault }]}>Container</Text>
                  <Text style={[styles.value, { color: colors.text }]}>
                    {item.container?.name || 'Unknown'}
                  </Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={[styles.orphanedText, { color: colors.tabIconDefault }]}>
              Item was deleted
            </Text>
          )}
        </View>

        {/* Lending Information Section */}
        <View style={[styles.section, { borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Lending Details</Text>

          {/* Borrower Name */}
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.tabIconDefault }]}>Borrower</Text>
            <Text style={[styles.value, { color: colors.text }]}>{lending.borrower_name}</Text>
          </View>

          {/* Status Badge */}
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.tabIconDefault }]}>Status</Text>
            <View
              style={[
                styles.statusBadge,
                { backgroundColor: statusColor },
              ]}
            >
              <Text style={styles.statusBadgeText}>
                {isActive ? 'ACTIVE' : 'RETURNED'}
              </Text>
            </View>
          </View>

          {/* Lent Date */}
          <View style={styles.infoRow}>
            <Text style={[styles.label, { color: colors.tabIconDefault }]}>Lent Date</Text>
            <Text style={[styles.value, { color: colors.text }]}>
              {formatDate(lending.lent_at)}
            </Text>
          </View>

          {/* Returned Date (if returned) */}
          {!isActive && lending.returned_at && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.tabIconDefault }]}>Returned Date</Text>
              <Text style={[styles.value, { color: colors.text }]}>
                {formatDate(lending.returned_at)}
              </Text>
            </View>
          )}

          {/* Note (if exists) */}
          {lending.note && (
            <View style={styles.infoRow}>
              <Text style={[styles.label, { color: colors.tabIconDefault }]}>Note</Text>
              <Text style={[styles.value, { color: colors.text }]}>{lending.note}</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        {isActive && (
          <Pressable
            style={({ pressed }) => [
              styles.markReturnedButton,
              {
                backgroundColor: colors.tint,
                opacity: pressed || submitting ? 0.7 : 1,
              },
            ]}
            onPress={handleMarkAsReturnedPress}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.markReturnedButtonText}>Mark as Returned</Text>
            )}
          </Pressable>
        )}
      </View>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogContent, { backgroundColor: colors.background }]}>
            <Text style={[styles.dialogTitle, { color: colors.text }]}>Mark as Returned?</Text>
            <Text style={[styles.dialogMessage, { color: colors.tabIconDefault }]}>
              Are you sure you want to mark &quot;{lending.borrower_name}&quot; as returned?
            </Text>
            <View style={styles.dialogButtons}>
              <Pressable
                style={[styles.dialogButton, { borderColor: colors.border }]}
                onPress={handleCancelReturn}
              >
                <Text style={[styles.dialogButtonText, { color: colors.tint }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.dialogButton, styles.dialogButtonConfirm, { backgroundColor: colors.tint }]}
                onPress={handleConfirmReturn}
              >
                <Text style={styles.dialogButtonText}>Yes, Mark as Returned</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  infoRow: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
  },
  orphanedText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  statusBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 16,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  markReturnedButton: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  markReturnedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  dialogOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogContent: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  dialogMessage: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  dialogButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  dialogButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  dialogButtonConfirm: {
    borderWidth: 0,
  },
  dialogButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
