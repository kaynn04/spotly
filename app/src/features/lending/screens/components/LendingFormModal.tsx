/**
 * Lending Form Modal
 *
 * Modal dialog for entering lending details.
 * User enters:
 * - Borrower name (required)
 * - Note (optional)
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
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';

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

/**
 * LendingFormModal Component
 *
 * Form for entering lending details (borrower name and optional note).
 * Item is pre-selected from previous screen.
 *
 * Props:
 * - visible: Show/hide modal
 * - item: Selected item (displayed as context)
 * - borrowerName: Current borrower name value
 * - onBorrowerNameChange: Callback for borrower name changes
 * - note: Current note value
 * - onNoteChange: Callback for note changes
 * - onSubmit: Submit handler
 * - onCancel: Cancel handler
 * - loading: Loading state during submission
 */
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
  const isValid = borrowerName.trim().length > 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onCancel}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <View style={styles.overlay}>
          {/* Background tap to close */}
          <Pressable
            style={styles.backdrop}
            onPress={onCancel}
          />

          {/* Modal card */}
          <View style={styles.modal}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.headerTitle}>Lend Item</Text>
              <Pressable
                style={styles.closeButton}
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>

            {/* Content */}
            <View style={styles.content}>
              {/* Item display */}
              {item && (
                <View style={styles.itemSection}>
                  <Text style={styles.itemLabel}>Item</Text>
                  <View style={styles.itemBox}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                  </View>
                </View>
              )}

              {/* Borrower name field */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Borrower Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter borrower name"
                  placeholderTextColor="#ccc"
                  value={borrowerName}
                  onChangeText={onBorrowerNameChange}
                  editable={!loading}
                  maxLength={100}
                />
              </View>

              {/* Note field */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Note (optional)</Text>
                <TextInput
                  style={[styles.input, styles.noteInput]}
                  placeholder="Add any notes about this lending"
                  placeholderTextColor="#ccc"
                  value={note}
                  onChangeText={onNoteChange}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                  maxLength={500}
                  textAlignVertical="top"
                />
              </View>

              {/* Character count for note */}
              <Text style={styles.charCount}>
                {note.length}/500
              </Text>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={[styles.button, styles.cancelButton]}
                onPress={onCancel}
                disabled={loading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.button,
                  styles.submitButton,
                  !isValid && styles.submitButtonDisabled,
                ]}
                onPress={onSubmit}
                disabled={!isValid || loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Lend Item</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#999',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemSection: {
    marginBottom: 16,
  },
  itemLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  itemBox: {
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#fafafa',
  },
  noteInput: {
    minHeight: 80,
    paddingTop: 10,
  },
  charCount: {
    fontSize: 11,
    color: '#ccc',
    textAlign: 'right',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#000',
  },
  submitButton: {
    backgroundColor: '#0a7ea4',
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
