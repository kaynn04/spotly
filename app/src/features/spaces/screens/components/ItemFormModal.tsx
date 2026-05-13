/**
 * ItemFormModal
 *
 * Bottom sheet -- add a new item to a space or container
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  Pressable,
  Keyboard,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faShield, faCalendarAlt, faTimes } from '@fortawesome/free-solid-svg-icons';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import DatePickerSheet from '@/src/features/lending/screens/components/DatePickerSheet';
import { PhotoService } from '@/src/services/PhotoService';
import { Colors } from '@/constants/theme';

const PRIMARY = '#6b7f99';

interface ItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, quantity?: number, photoUri?: string | null, warrantyExpiry?: Date | null) => Promise<void>;
  contextLabel?: string;
  editMode?: boolean;
  initialName?: string;
  initialDescription?: string;
  initialQuantity?: number;
  initialPhotoUri?: string | null;
}

export default function ItemFormModal({ visible, onClose, onSubmit, contextLabel, editMode, initialName, initialDescription, initialQuantity, initialPhotoUri }: ItemFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState<Date | null>(null);
  const [showWarrantyPicker, setShowWarrantyPicker] = useState(false);
  const [warrantyPickerDate, setWarrantyPickerDate] = useState<Date>(new Date());

  useEffect(() => {
    if (visible && editMode) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setQuantity(String(initialQuantity ?? 1));
      setPhotoUri(initialPhotoUri ?? null);
    } else if (visible && !editMode) {
      setName('');
      setDescription('');
      setQuantity('1');
      setPhotoUri(null);
      setWarrantyDate(null);
    }
  }, [visible]);

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
    setPhotoUri(null);
    setWarrantyDate(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter an item name'); return; }
    setLoading(true);
    setError(null);
    try {
      const qty = Math.max(1, parseInt(quantity) || 1);
      await onSubmit(name.trim(), description.trim() || undefined, qty, photoUri, warrantyDate);
      setName('');
      setDescription('');
      setQuantity('1');
      setPhotoUri(null);
      setWarrantyDate(null);
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
      onRequestClose={handleCancel}
    >
      {/* Overlay with backdrop */}
      <View style={styles.overlay}>
        {/* Backdrop tap area */}
        <Pressable style={{ flex: 1 }} onPress={handleCancel} />
        {/* Sheet — let touches through for scrolling */}
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>{editMode ? 'Edit Item' : 'Add Item'}</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                  onScrollBeginDrag={Keyboard.dismiss}
                >
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

                  {error && (
                    <Text style={[styles.errorText, { marginTop: 6 }]}>{error}</Text>
                  )}

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

                  {/* Photo */}
                  <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14 }]}>Photo (optional)</Text>
                  {photoUri ? (
                    <View style={styles.photoPreviewRow}>
                      <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                      <TouchableOpacity onPress={() => setPhotoUri(null)} style={styles.photoRemoveBtn}>
                        <Ionicons name="close-circle" size={22} color="#d32f2f" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.photoAddBtn, { backgroundColor: inputBg, borderColor }]}
                      onPress={() => setShowPhotoPicker(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={20} color={subtleText} />
                      <Text style={[styles.photoAddText, { color: subtleText }]}>Add Photo</Text>
                    </TouchableOpacity>
                  )}

                  {/* Warranty (optional) */}
                  <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14 }]}>Warranty Expiry (optional)</Text>
                  {warrantyDate ? (
                    <View style={[styles.warrantySetRow, { backgroundColor: inputBg, borderColor }]}>
                      <FontAwesomeIcon icon={faShield} size={16} color="#e09b3a" />
                      <Text style={[styles.warrantyDateText, { color: textColor }]}>
                        {warrantyDate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </Text>
                      <TouchableOpacity onPress={() => setWarrantyDate(null)} hitSlop={8}>
                        <FontAwesomeIcon icon={faTimes} size={14} color={subtleText} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.warrantyAddBtn, { backgroundColor: inputBg, borderColor }]}
                      onPress={() => {
                        setWarrantyPickerDate(new Date());
                        setShowWarrantyPicker(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <FontAwesomeIcon icon={faCalendarAlt} size={16} color={subtleText} />
                      <Text style={[styles.warrantyAddText, { color: subtleText }]}>Set Warranty Date</Text>
                    </TouchableOpacity>
                  )}
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
                      styles.createBtn,
                      { backgroundColor: isValid ? PRIMARY : (isDark ? '#3a3a3c' : '#e2e6ea') },
                    ]}
                    onPress={handleSubmit}
                    disabled={loading || !isValid}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.createBtnText, { color: isValid ? '#fff' : subtleText }]}>{editMode ? 'Save' : 'Add Item'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
        </View>
      </View>
      <DatePickerSheet
        visible={showWarrantyPicker}
        onClose={() => setShowWarrantyPicker(false)}
        onConfirm={() => {
          setShowWarrantyPicker(false);
          setWarrantyDate(warrantyPickerDate);
        }}
        onChange={setWarrantyPickerDate}
        value={warrantyPickerDate}
        minimumDate={new Date()}
        textColor={textColor}
        subtleText={subtleText}
        cardBg={cardBg}
        borderColor={borderColor}
        isDark={isDark}
      />
      <PhotoPickerSheet
        visible={showPhotoPicker}
        onClose={() => setShowPhotoPicker(false)}
        onCamera={async () => {
          setShowPhotoPicker(false);
          const uri = await PhotoService.captureFromCamera();
          if (uri) setPhotoUri(uri);
        }}
        onGallery={async () => {
          setShowPhotoPicker(false);
          const uri = await PhotoService.pickFromGallery();
          if (uri) setPhotoUri(uri);
        }}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, maxHeight: '85%' },
  scrollContent: { flexGrow: 0 },
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
  photoPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  photoPreview: { width: 80, height: 80, borderRadius: 10 },
  photoRemoveBtn: { marginTop: 2 },
  photoAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  photoAddText: { fontSize: 15, fontWeight: '500' },
  warrantySetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  warrantyDateText: { flex: 1, fontSize: 15, fontWeight: '500' },
  warrantyAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5 },
  warrantyAddText: { fontSize: 15, fontWeight: '500' },
});
