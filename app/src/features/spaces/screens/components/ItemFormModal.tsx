/**
 * ItemFormModal
 *
 * Bottom sheet -- add a new item to a space or container
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

interface ItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, quantity?: number) => Promise<void>;
  contextLabel?: string;
}

export default function ItemFormModal({ visible, onClose, onSubmit, contextLabel }: ItemFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';
  const keyboardHeight = useKeyboardHeight();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
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
    setDescription('');
    setQuantity('1');
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter an item name'); return; }
    setLoading(true);
    setError(null);
    try {
      const qty = Math.max(1, parseInt(quantity) || 1);
      await onSubmit(name.trim(), description.trim() || undefined, qty);
      setName('');
      setDescription('');
      setQuantity('1');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
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
                <Text style={[styles.sheetTitle, { color: textColor }]}>Add Item</Text>
                {contextLabel && (
                  <View style={[styles.contextPill, { backgroundColor: inputBg, borderColor }]}>
                    <Text style={[styles.contextPillText, { color: subtleText }]}>In: </Text>
                    <Text style={[styles.contextPillName, { color: textColor }]} numberOfLines={1}>
                      {contextLabel}
                    </Text>
                  </View>
                )}

                {/* Input */}
                <Text style={[styles.fieldLabel, { color: subtleText }]}>Item Name *</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: error ? '#d32f2f' : borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="e.g., Passport, Charger, Keys"
                    placeholderTextColor={subtleText}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(null); }}
                    maxLength={100}
                    editable={!loading}
                    autoFocus
                    returnKeyType="next"
                  />
                </View>

                {/* Description */}
                <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14 }]}>Description (optional)</Text>
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: textColor, minHeight: 60 }]}
                    placeholder="Notes, serial number, details..."
                    placeholderTextColor={subtleText}
                    value={description}
                    onChangeText={setDescription}
                    maxLength={500}
                    editable={!loading}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                {/* Quantity */}
                <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14 }]}>Quantity</Text>
                <View style={styles.quantityRow}>
                  <TouchableOpacity
                    style={[styles.quantityBtn, { backgroundColor: inputBg, borderColor }]}
                    onPress={() => setQuantity(String(Math.max(1, (parseInt(quantity) || 1) - 1)))}
                  >
                    <Text style={[styles.quantityBtnText, { color: textColor }]}>−</Text>
                  </TouchableOpacity>
                  <View style={[styles.quantityInputWrap, { backgroundColor: inputBg, borderColor }]}>
                    <TextInput
                      style={[styles.quantityInput, { color: textColor }]}
                      value={quantity}
                      onChangeText={(t) => setQuantity(t.replace(/[^0-9]/g, ''))}
                      keyboardType="number-pad"
                      maxLength={4}
                      editable={!loading}
                    />
                  </View>
                  <TouchableOpacity
                    style={[styles.quantityBtn, { backgroundColor: inputBg, borderColor }]}
                    onPress={() => setQuantity(String((parseInt(quantity) || 1) + 1))}
                  >
                    <Text style={[styles.quantityBtnText, { color: textColor }]}>+</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.inputMeta}>
                  {error ? (
                    <Text style={styles.errorText}>{error}</Text>
                  ) : (
                    <Text style={[styles.hint, { color: subtleText }]}>Long-press items later to manage</Text>
                  )}
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
                      <Text style={[styles.createBtnText, { color: isValid ? '#fff' : subtleText }]}>Add Item</Text>
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
  sheetTitle: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 },
  contextPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  contextPillText: { fontSize: 13 },
  contextPillName: { fontSize: 13, fontWeight: '600', flex: 1 },
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
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
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quantityBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quantityBtnText: { fontSize: 20, fontWeight: '600' },
  quantityInputWrap: { width: 60, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quantityInput: { fontSize: 16, fontWeight: '600', textAlign: 'center', width: '100%', paddingVertical: 0 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1.5, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  cancelBtnText: { fontSize: 15, fontWeight: '600' },
  createBtn: { flex: 2, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  createBtnText: { fontSize: 15, fontWeight: '700' },
});
