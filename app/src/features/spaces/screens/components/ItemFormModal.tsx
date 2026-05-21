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
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faShield, faCalendarAlt, faTimes, faChevronRight, faLayerGroup } from '@fortawesome/free-solid-svg-icons';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import DatePickerSheet from '@/src/features/lending/screens/components/DatePickerSheet';
import { PhotoService } from '@/src/services/PhotoService';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import BarcodeScannerModal from '@/src/features/tools/components/BarcodeScannerModal';
import type { ScannedBarcode } from '@/src/features/tools/services/BarcodeScannerService';

const PRIMARY = '#6b7f99';
const PACK_SIZE_PRESETS = [10, 12, 20, 24, 25, 30, 50, 100];

function getItemCount(quantity: number, contentsPerItem?: number | null) {
  const safeQuantity = Math.max(0, Math.floor(quantity) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? Math.ceil(safeQuantity / safeContents) : safeQuantity;
}

function getStoredQuantity(itemCount: number, contentsPerItem?: number | null) {
  const safeItemCount = Math.max(0, Math.floor(itemCount) || 0);
  const safeContents = contentsPerItem ? Math.max(1, Math.floor(contentsPerItem) || 1) : null;
  return safeContents ? safeItemCount * safeContents : safeItemCount;
}

interface ItemFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string, quantity?: number, photoUri?: string | null, warrantyExpiry?: Date | null, barcode?: ScannedBarcode | null, unitsPerPack?: number | null) => Promise<void>;
  contextLabel?: string;
  editMode?: boolean;
  initialName?: string;
  initialDescription?: string;
  initialQuantity?: number;
  initialPhotoUri?: string | null;
  initialBarcode?: ScannedBarcode | null;
  initialUnitsPerPack?: number | null;
}

export default function ItemFormModal({ visible, onClose, onSubmit, contextLabel, editMode, initialName, initialDescription, initialQuantity, initialPhotoUri, initialBarcode, initialUnitsPerPack }: ItemFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitsPerPack, setUnitsPerPack] = useState('');
  const [showContentsTracking, setShowContentsTracking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [warrantyDate, setWarrantyDate] = useState<Date | null>(null);
  const [showWarrantyPicker, setShowWarrantyPicker] = useState(false);
  const [warrantyPickerDate, setWarrantyPickerDate] = useState<Date>(new Date());
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState<ScannedBarcode | null>(null);

  useEffect(() => {
    if (visible) {
      setName(initialName ?? '');
      setDescription(initialDescription ?? '');
      setQuantity(String(getItemCount(initialQuantity ?? 1, initialUnitsPerPack)));
      setUnitsPerPack(initialUnitsPerPack ? String(initialUnitsPerPack) : '');
      setShowContentsTracking(!!initialUnitsPerPack);
      setPhotoUri(initialPhotoUri ?? null);
      setScannedBarcode(initialBarcode ?? null);
      if (!editMode) setWarrantyDate(null);
    }
  }, [editMode, initialBarcode, initialDescription, initialName, initialPhotoUri, initialQuantity, initialUnitsPerPack, visible]);

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
    setUnitsPerPack('');
    setShowContentsTracking(false);
    setError(null);
    setPhotoUri(null);
    setWarrantyDate(null);
    setScannedBarcode(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Please enter an item name'); return; }
    setLoading(true);
    setError(null);
    try {
      const itemCount = Math.max(0, parseInt(quantity) || 0);
      const packSize = unitsPerPack.trim() ? Math.max(1, parseInt(unitsPerPack) || 1) : null;
      const initialItemCount = getItemCount(initialQuantity ?? 0, initialUnitsPerPack);
      const countUnchanged = editMode && itemCount === initialItemCount;
      const contentsUnchanged = editMode && (packSize ?? null) === (initialUnitsPerPack ?? null);
      const qty = countUnchanged && contentsUnchanged
        ? Math.max(0, initialQuantity ?? 0)
        : getStoredQuantity(itemCount, packSize);
      await onSubmit(name.trim(), description.trim() || undefined, qty, photoUri, warrantyDate, scannedBarcode, packSize);
      setName('');
      setDescription('');
      setQuantity('1');
      setUnitsPerPack('');
      setShowContentsTracking(false);
      setPhotoUri(null);
      setWarrantyDate(null);
      setScannedBarcode(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to add item');
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanned = (barcode: { type: string; data: string }) => {
    setShowBarcodeScanner(false);
    setScannedBarcode(barcode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoider}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {/* Overlay with backdrop */}
      <View style={styles.overlay}>
        {/* Backdrop tap area */}
        <Pressable style={{ flex: 1 }} onPress={handleCancel} />
        {/* Sheet — let touches through for scrolling */}
        <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 + keyboardHeight }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>{editMode ? 'Edit Item' : 'Add Item'}</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                  contentContainerStyle={{ paddingBottom: 24 }}
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

                  {!editMode && (
                    <TouchableOpacity
                      style={[styles.barcodeBtn, { backgroundColor: inputBg, borderColor }]}
                      onPress={() => setShowBarcodeScanner(true)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="barcode-outline" size={20} color={subtleText} />
                      <Text style={[styles.barcodeBtnText, { color: subtleText }]} numberOfLines={1}>
                        {scannedBarcode ? `Barcode: ${scannedBarcode.data}` : 'Scan Barcode'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Quantity */}
                  <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14 }]}>Item count</Text>
                  <View style={styles.quantityRow}>
                    <TouchableOpacity
                      style={[styles.quantityBtn, { backgroundColor: inputBg, borderColor }]}
                      onPress={() => setQuantity(String(Math.max(0, (parseInt(quantity) || 0) - 1)))}
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
                      onPress={() => setQuantity(String((parseInt(quantity) || 0) + 1))}
                    >
                      <Text style={[styles.quantityBtnText, { color: textColor }]}>+</Text>
                    </TouchableOpacity>
                  </View>

                  {showContentsTracking ? (
                    <>
                      <View style={styles.labelRow}>
                        <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 14, marginBottom: 0 }]}>Contents per item</Text>
                        <TouchableOpacity
                          onPress={() => {
                            setUnitsPerPack('');
                            setShowContentsTracking(false);
                          }}
                          disabled={loading}
                          hitSlop={8}
                        >
                          <Text style={[styles.inlineActionText, { color: subtleText }]}>Disable</Text>
                        </TouchableOpacity>
                      </View>
                      <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor, marginTop: 6 }]}>
                        <TextInput
                          style={[styles.input, { color: textColor }]}
                          placeholder="e.g., 100 sticks in 1 tub"
                          placeholderTextColor={subtleText}
                          value={unitsPerPack}
                          onChangeText={(t) => setUnitsPerPack(t.replace(/[^0-9]/g, ''))}
                          keyboardType="number-pad"
                          maxLength={5}
                          editable={!loading}
                        />
                      </View>
                      <View style={styles.presetRow}>
                        {PACK_SIZE_PRESETS.map((preset) => {
                          const active = unitsPerPack === String(preset);
                          return (
                            <TouchableOpacity
                              key={preset}
                              style={[styles.presetChip, { backgroundColor: active ? PRIMARY : inputBg, borderColor }]}
                              onPress={() => setUnitsPerPack(String(preset))}
                              activeOpacity={0.75}
                            >
                              <Text style={[styles.presetChipText, { color: active ? '#ffffff' : textColor }]}>{preset}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                      <Text style={[styles.helperText, { color: subtleText }]}>
                        When set, Synop tracks the total contents from item count x contents per item.
                      </Text>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.optionalFeatureBtn, { backgroundColor: `${PRIMARY}12`, borderColor: PRIMARY }]}
                      onPress={() => setShowContentsTracking(true)}
                      activeOpacity={0.8}
                      disabled={loading}
                    >
                      <View style={[styles.optionalFeatureIcon, { backgroundColor: `${PRIMARY}20` }]}>
                        <FontAwesomeIcon icon={faLayerGroup} size={15} color={PRIMARY} />
                      </View>
                      <View style={styles.optionalFeatureBody}>
                        <Text style={[styles.optionalFeatureEyebrow, { color: PRIMARY }]}>Optional setup</Text>
                        <Text style={[styles.optionalFeatureText, { color: textColor }]}>Tap to enable contents tracking</Text>
                        <Text style={[styles.optionalFeatureHint, { color: subtleText }]}>For packs, tubs, boxes, or containers with units inside.</Text>
                      </View>
                      <View style={[styles.optionalFeatureArrow, { backgroundColor: PRIMARY }]}>
                        <FontAwesomeIcon icon={faChevronRight} size={12} color="#ffffff" />
                      </View>
                    </TouchableOpacity>
                  )}

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
      </KeyboardAvoidingView>
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
        purpose="warranty"
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
      <BarcodeScannerModal
        visible={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScanned={handleBarcodeScanned}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: { flex: 1 },
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
  barcodeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, marginTop: 10 },
  barcodeBtnText: { flex: 1, fontSize: 15, fontWeight: '500' },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  errorText: { fontSize: 12, color: '#d32f2f', flex: 1 },
  hint: { fontSize: 12, flex: 1 },
  helperText: { fontSize: 12, lineHeight: 17, marginTop: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  inlineActionText: { fontSize: 12, fontWeight: '800' },
  optionalFeatureBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1.5, padding: 14, marginTop: 14, gap: 12 },
  optionalFeatureIcon: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  optionalFeatureBody: { flex: 1, minWidth: 0, gap: 2 },
  optionalFeatureEyebrow: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  optionalFeatureText: { fontSize: 15, fontWeight: '800' },
  optionalFeatureHint: { fontSize: 12, lineHeight: 17 },
  optionalFeatureArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  charCount: { fontSize: 11 },
  quantityRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  quantityBtn: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quantityBtnText: { fontSize: 20, fontWeight: '600' },
  quantityInputWrap: { width: 60, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  quantityInput: { fontSize: 16, fontWeight: '600', textAlign: 'center', width: '100%', paddingVertical: 0 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  presetChip: { minWidth: 44, minHeight: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  presetChipText: { fontSize: 13, fontWeight: '800' },
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
