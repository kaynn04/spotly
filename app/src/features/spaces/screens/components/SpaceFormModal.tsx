/**
 * SpaceFormModal
 *
 * Bottom sheet -- create a new space, uniform with SessionFormModal
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Keyboard,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';

const PRIMARY = '#6b7f99';

interface SpaceFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}

export default function SpaceFormModal({ visible, onClose, onSubmit }: SpaceFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const keyboardHeight = useKeyboardHeight();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const textColor = isDark ? '#ffffff' : '#2c3e50';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const isValid = name.trim().length > 0;

  const handleCancel = () => {
    Keyboard.dismiss();
    setName('');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter a space name'); return; }
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name.trim());
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={handleCancel}
    >
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom + 16, keyboardHeight) }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>New Space</Text>
                <Text style={[styles.sheetSubtitle, { color: subtleText }]}>Give this space a name</Text>

                {/* Input */}
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: error ? '#d32f2f' : borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="e.g., Living Room, Storage Unit"
                    placeholderTextColor={subtleText}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(null); }}
                    maxLength={100}
                    editable={!loading}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSubmit}
                  />
                </View>

                <View style={styles.inputMeta}>
                  {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                  ) : (
                    <Text style={[styles.hint, { color: subtleText }]}>Name your storage space</Text>
                  )}
                  <Text style={[styles.charCount, { color: subtleText }]}>{name.length}/100</Text>
                </View>

                {/* Buttons */}
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
                      styles.createBtn,
                      { backgroundColor: isValid ? PRIMARY : (isDark ? '#3a3a3c' : '#e2e6ea') },
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || !isValid}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.createBtnText, { color: isValid ? '#fff' : subtleText }]}>Create</Text>
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
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  sheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 4 },
  sheetSubtitle: { fontSize: 14, marginBottom: 20 },
  inputWrapper: { borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 2 },
  input: { fontSize: 16, paddingVertical: 12 },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: { fontSize: 12, color: '#d32f2f', flex: 1 },
  hint: { fontSize: 12, flex: 1 },
  charCount: { fontSize: 11 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  createBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '700' },
});
