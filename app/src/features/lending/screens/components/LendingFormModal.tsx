/**
 * Lending Form Modal
 *
 * Bottom sheet redesign — uniform with Outside SessionFormModal
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useRef, useEffect, useState } from 'react';
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
  Animated,
  PanResponder,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCalendar, faCamera, faTimes } from '@fortawesome/free-solid-svg-icons';
import DatePickerSheet from './DatePickerSheet';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import { PhotoService } from '@/src/services/PhotoService';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { MAX_PHOTOS_PER_PHASE } from '../../models/LendingPhoto';

const PRIMARY = '#6b7f99';

interface LendingFormModalProps {
  visible: boolean;
  item: any | null;
  borrowerName: string;
  onBorrowerNameChange: (text: string) => void;
  note: string;
  onNoteChange: (text: string) => void;
  dueDate: Date | null;
  onDueDateChange: (date: Date | null) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  title?: string;
  submitLabel?: string;
  beforePhotoUris?: string[];
  onBeforePhotosChange?: (uris: string[]) => void;
}

export default function LendingFormModal({
  visible,
  item,
  borrowerName,
  onBorrowerNameChange,
  note,
  onNoteChange,
  dueDate,
  onDueDateChange,
  onSubmit,
  onCancel,
  loading,
  title = 'Lend Item',
  submitLabel = 'Lend Item',
  beforePhotoUris = [],
  onBeforePhotosChange,
}: LendingFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const textColor = isDark ? '#ecedee' : '#11181c';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const isValid = borrowerName.trim().length > 0;

  // Show inline picker on Android (shown inline), modal-style on iOS
  const [showPicker, setShowPicker] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [showBeforePhotoPicker, setShowBeforePhotoPicker] = useState(false);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, { dy }) => dy > 5,
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) sheetTranslateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > 80 || vy > 0.5) {
          Animated.timing(sheetTranslateY, { toValue: 600, duration: 200, useNativeDriver: true }).start(() => {
            sheetTranslateY.setValue(0);
            onCancel();
          });
        } else {
          Animated.spring(sheetTranslateY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!visible) sheetTranslateY.setValue(0);
    // sheetTranslateY is a stable Animated.Value ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleCancel = () => {
    Keyboard.dismiss();
    onCancel();
  };
  const showBeforePhoto = Boolean(onBeforePhotosChange);
  const canAddBeforePhoto = beforePhotoUris.length < MAX_PHOTOS_PER_PHASE;

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
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={handleCancel} />
              <Animated.View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 + keyboardHeight, transform: [{ translateY: sheetTranslateY }] }]}>
                {/* Handle */}
                <View style={styles.handleArea} {...panResponder.panHandlers}>
                  <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
                </View>

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>{title}</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  nestedScrollEnabled
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                  contentContainerStyle={{ paddingBottom: 24 }}
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

                  {/* Due Date */}
                  <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 12 }]}>Due Date (optional)</Text>
                  <TouchableOpacity
                    style={[styles.dueDateRow, { backgroundColor: inputBg, borderColor }]}
                    onPress={() => {
                      setTempDate(dueDate ?? new Date());
                      setShowPicker(true);
                    }}
                    disabled={loading}
                  >
                    <FontAwesomeIcon icon={faCalendar} size={14} color={subtleText} />
                    <Text style={[styles.dueDateText, { color: dueDate ? textColor : subtleText }]}>
                      {dueDate
                        ? dueDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : 'No due date'}
                    </Text>
                    {dueDate && (
                      <TouchableOpacity
                        onPress={() => { onDueDateChange(null); setShowPicker(false); }}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <FontAwesomeIcon icon={faTimes} size={12} color={subtleText} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>

                  {/* Before photos */}
                  {showBeforePhoto && (
                    <>
                      <Text style={[styles.fieldLabel, { color: subtleText, marginTop: 12 }]}>Before Photo (optional)</Text>
                      <View style={styles.photoGrid}>
                        {beforePhotoUris.map((uri, index) => (
                          <View key={`${uri}-${index}`} style={styles.photoPreviewRow}>
                            <Image source={{ uri }} style={styles.photoPreview} />
                            <TouchableOpacity
                              style={styles.photoRemoveBtn}
                              onPress={() => onBeforePhotosChange?.(beforePhotoUris.filter((_, i) => i !== index))}
                              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                              <FontAwesomeIcon icon={faTimes} size={14} color="#fff" />
                            </TouchableOpacity>
                          </View>
                        ))}
                        {canAddBeforePhoto && (
                          <TouchableOpacity
                            style={[styles.photoAddTile, { backgroundColor: inputBg, borderColor }]}
                            onPress={() => setShowBeforePhotoPicker(true)}
                            activeOpacity={0.7}
                            disabled={loading}
                          >
                            <FontAwesomeIcon icon={faCamera} size={17} color={subtleText} />
                            <Text style={[styles.photoAddTileText, { color: subtleText }]}>Add</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      <Text style={[styles.photoCountText, { color: subtleText }]}>
                        {beforePhotoUris.length}/{MAX_PHOTOS_PER_PHASE} photos
                      </Text>
                    </>
                  )}

                  {showPicker && (
                    <DatePickerSheet
                      visible={showPicker}
                      value={tempDate}
                      minimumDate={new Date()}
                      purpose="due"
                      onChange={setTempDate}
                      onConfirm={() => {
                        onDueDateChange(tempDate);
                        setShowPicker(false);
                      }}
                      onClose={() => setShowPicker(false)}
                      cardBg={cardBg}
                      borderColor={borderColor}
                      textColor={textColor}
                      subtleText={subtleText}
                      isDark={isDark}
                    />
                  )}
                  <View style={{ height: 16 }} />
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
                        {submitLabel}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </Animated.View>
        </View>
      </KeyboardAvoidingView>
      {showBeforePhoto && (
        <PhotoPickerSheet
          visible={showBeforePhotoPicker}
          onClose={() => setShowBeforePhotoPicker(false)}
          onCamera={async () => {
            setShowBeforePhotoPicker(false);
            const uri = await PhotoService.captureFromCamera();
            if (uri) onBeforePhotosChange?.([...beforePhotoUris, uri].slice(0, MAX_PHOTOS_PER_PHASE));
          }}
          onGallery={async () => {
            setShowBeforePhotoPicker(false);
            const uri = await PhotoService.pickFromGallery();
            if (uri) onBeforePhotosChange?.([...beforePhotoUris, uri].slice(0, MAX_PHOTOS_PER_PHASE));
          }}
        />
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoider: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdrop: { flex: 1 },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  scrollContent: { flexGrow: 0 },
  handleArea: { paddingVertical: 12, alignItems: 'center' },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
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
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4, marginBottom: 8 },

  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dueDateText: { flex: 1, fontSize: 15 },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  photoPreviewRow: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  photoRemoveBtn: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAddTile: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoAddTileText: { fontSize: 11, fontWeight: '700' },
  photoCountText: { fontSize: 11, marginTop: 6 },

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
