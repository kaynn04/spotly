/**
 * Lending Form Modal
 *
 * Bottom sheet redesign — uniform with Outside SessionFormModal
 *
 * Feature: 009 - Lending Tracker
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIMARY = '#6b7f99';

interface LendingFormModalProps {
  visible: boolean;
  item: any | null;
  borrowerName: string;
  onBorrowerNameChange: (text: string) => void;
  note: string;
  onNoteChange: (text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
}

export default function LendingFormModal({
  visible,
  item,
  borrowerName,
  onBorrowerNameChange,
  note,
  onNoteChange,
  onSubmit,
  onCancel,
  loading,
}: LendingFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const textColor = isDark ? '#ecedee' : '#11181c';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const isValid = borrowerName.trim().length > 0;

  const handleCancel = () => {
    Keyboard.dismiss();
    onCancel();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>Lend Item</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                >
                  {item && (
                    <View style={[styles.itemPill, { backgroundColor: inputBg, borderColor }]}>
                      <Text style={[styles.itemPillText, { color: subtleText }]}>Item: </Text>
                      <Text style={[styles.itemPillName, { color: textColor }]} numberOfLines={1}>{item.name}</Text>
                    </View>
                  )}

                  {/* Borrower Name */}
                  <Text style={[styles.fieldLabel, { color: subtleText }]}>Borrower Name *</Text>
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.input, { color: textColor }]}
                      placeholder="Who are you lending to?"
                      placeholderTextColor={subtleText}
                      value={borrowerName}
                      onChangeText={onBorrowerNameChange}
                      maxLength={100}
                      editable={!loading}
                      autoFocus
                      returnKeyType="next"
                    />
                  </View>

                  {/* Note */}
                  <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 12 }]}>Note (optional)</Text>
                  <View style={[styles.inputWrapper, styles.noteWrapper, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.input, styles.noteInput, { color: textColor }]}
                      placeholder="Add any notes about this lending"
                      placeholderTextColor={subtleText}
                      value={note}
                      onChangeText={onNoteChange}
                      multiline
                      numberOfLines={3}
                      editable={!loading}
                      maxLength={500}
                      textAlignVertical="top"
                    />
                  </View>
                  <Text style={[styles.charCount, { color: subtleText }]}>{note.length}/500</Text>
                </ScrollView>

                {/* Buttons - fixed at bottom */}
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor }]}
                    onPress={handleCancel}
                    disabled={loading}
                  >
                    <Text style={[styles.cancelBtnText, { color: subtleText }]}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.submitBtn,
                      { backgroundColor: isValid ? PRIMARY : (isDark ? '#3a3a3c' : '#e2e6ea') },
                    ]}
                    onPress={onSubmit}
                    disabled={!isValid || loading}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.submitBtnText, { color: isValid ? '#fff' : subtleText }]}>
                        Lend Item
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  scrollContent: { flexGrow: 0 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  itemPillText: { fontSize: 13 },
  itemPillName: { fontSize: 13, fontWeight: '600', flex: 1 },

  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  noteWrapper: { paddingVertical: 8 },
  input: { fontSize: 15, paddingVertical: 10 },
  noteInput: { minHeight: 72, paddingTop: 2 },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginBottom: 20 },

  buttonRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  submitBtnText: { fontSize: 15, fontWeight: '600' },
});
