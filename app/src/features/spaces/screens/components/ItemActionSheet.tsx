/**
 * ItemActionSheet
 *
 * A modern bottom sheet that replaces the native Alert.alert action menu
 * when the user taps an item row.
 *
 * Features:
 *   - Slides up from the bottom with native "slide" animation
 *   - Semi-transparent backdrop — tap anywhere outside to dismiss (cancel)
 *   - Drag handle + item name header
 *   - Action rows with emoji icon, label, and optional description
 *   - Destructive actions styled in red
 *   - Separate "Cancel" pill at the bottom (always visible, always reachable)
 *   - Full dark / light mode support
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { faHandshake, faMapPin } from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Lending } from '@/src/features/lending/models/Lending';

const PRIMARY = '#6b7f99';
const DESTRUCTIVE = '#d32f2f';

export interface ItemAction {
  icon: string | IconDefinition;
  label: string;
  description?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface ItemActionSheetProps {
  visible: boolean;
  itemName: string;
  activeLending?: Lending | null;
  activeOutsideSession?: boolean;
  actions: ItemAction[];
  onClose: () => void;
}

export default function ItemActionSheet({
  visible,
  itemName,
  activeLending,
  activeOutsideSession,
  actions,
  onClose,
}: ItemActionSheetProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sheetBg = isDark ? '#1c1c1e' : '#ffffff';
  const cancelBg = isDark ? '#2c2c2e' : '#f2f2f7';
  const handleColor = isDark ? '#48484a' : '#d1d5db';
  const titleColor = isDark ? '#ffffff' : '#1c1c1e';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#2c2c2e' : '#f2f2f7';
  const rowBg = isDark ? '#2c2c2e' : '#f8f9fa';

  const handleAction = (action: ItemAction) => {
    onClose();
    // Small delay so the sheet can close before the next modal opens
    setTimeout(action.onPress, 50);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop — tap to cancel */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {/* Sheet */}
      <View style={[styles.sheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + 12 }]}>
        {/* Drag handle */}
        <View style={[styles.handle, { backgroundColor: handleColor }]} />

        {/* Item name header */}
        <Text style={[styles.itemName, { color: subtleText }]} numberOfLines={1}>
          {itemName}
        </Text>
        <Text style={[styles.heading, { color: titleColor }]}>What would you like to do?</Text>

        {/* Lent status banner */}
        {activeLending && (
          <View style={[styles.lentBanner, { backgroundColor: `${PRIMARY}12`, borderColor: `${PRIMARY}30` }]}>
            <FontAwesomeIcon icon={faHandshake} size={20} color={PRIMARY} />
            <View style={styles.lentBannerText}>
              <Text style={[styles.lentBannerLabel, { color: PRIMARY }]}>Currently lent out</Text>
              <Text style={[styles.lentBannerMeta, { color: subtleText }]}>
                {activeLending.borrower_name}
                {activeLending.lent_at
                  ? ` · since ${new Date(activeLending.lent_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : ''}
                {activeLending.note ? ` · "${activeLending.note}"` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Outside session banner */}
        {activeOutsideSession && (
          <View style={[styles.lentBanner, { backgroundColor: '#e67e2212', borderColor: '#e67e2230' }]}>
            <FontAwesomeIcon icon={faMapPin} size={20} color="#e67e22" />
            <View style={styles.lentBannerText}>
              <Text style={[styles.lentBannerLabel, { color: '#e67e22' }]}>In active outside session</Text>
              <Text style={[styles.lentBannerMeta, { color: subtleText }]}>
                Complete the session before moving or lending
              </Text>
            </View>
          </View>
        )}

        {/* Action rows */}
        <View style={styles.actionsContainer}>
          {actions.map((action, idx) => (
            <TouchableOpacity
              key={action.label}
              style={[
                styles.actionRow,
                { backgroundColor: rowBg },
                idx === 0 && styles.actionRowFirst,
                idx === actions.length - 1 && styles.actionRowLast,
                idx < actions.length - 1 && { borderBottomWidth: 1, borderBottomColor: borderColor },
              ]}
              onPress={() => handleAction(action)}
              activeOpacity={0.6}
            >
              <View style={[
                styles.iconWrap,
                { backgroundColor: action.destructive ? `${DESTRUCTIVE}15` : `${PRIMARY}15` },
              ]}>
                {typeof action.icon === 'string' ? (
                  <Text style={styles.iconEmoji}>{action.icon}</Text>
                ) : (
                  <FontAwesomeIcon icon={action.icon} size={18} color={action.destructive ? DESTRUCTIVE : PRIMARY} />
                )}
              </View>
              <View style={styles.actionTextWrap}>
                <Text style={[
                  styles.actionLabel,
                  { color: action.destructive ? DESTRUCTIVE : titleColor },
                ]}>
                  {action.label}
                </Text>
                {action.description && (
                  <Text style={[styles.actionDescription, { color: subtleText }]}>
                    {action.description}
                  </Text>
                )}
              </View>
              <Text style={[styles.chevron, { color: subtleText }]}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancel button */}
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: cancelBg }]}
          onPress={onClose}
          activeOpacity={0.6}
        >
          <Text style={[styles.cancelText, { color: titleColor }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    marginBottom: 2,
  },
  heading: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  lentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    gap: 10,
  },
  lentBannerIcon: { fontSize: 18 },
  lentBannerText: { flex: 1 },
  lentBannerLabel: { fontSize: 13, fontWeight: '700', marginBottom: 1 },
  lentBannerMeta: { fontSize: 12 },
  actionsContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  actionRowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  actionRowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconEmoji: {
    fontSize: 20,
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  actionDescription: {
    fontSize: 12,
    fontWeight: '400',
  },
  chevron: {
    fontSize: 22,
    fontWeight: '300',
  },
  cancelButton: {
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
