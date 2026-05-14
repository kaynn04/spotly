/**
 * SpaceFormModal
 *
 * Bottom sheet -- create a new space, uniform with SessionFormModal
 */

import React, { useRef, useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import { PhotoService } from '@/src/services/PhotoService';

const PRIMARY = '#6b7f99';

interface SpaceFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string, photoUri?: string | null) => Promise<void>;
  initialName?: string;
  initialPhotoUri?: string | null;
  editMode?: boolean;
}

export default function SpaceFormModal({ visible, onClose, onSubmit, initialName, initialPhotoUri, editMode }: SpaceFormModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      submittingRef.current = false;
      setName(initialName ?? '');
      setPhotoUri(initialPhotoUri ?? null);
      setError(null);
    } else {
      submittingRef.current = false;
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
    setError(null);
    setPhotoUri(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    if (!name.trim()) { setError('Please enter a space name'); return; }
    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(name.trim(), photoUri);
      setName('');
      setPhotoUri(null);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create space');
      submittingRef.current = false;
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
        <TouchableWithoutFeedback onPress={handleCancel}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>{editMode ? 'Edit Space' : 'New Space'}</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                >
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

                  {/* Photo */}
                  <Text style={[styles.fieldLabel, { color: subtleText }]}>Photo (optional)</Text>
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
                      <Text style={[styles.createBtnText, { color: isValid ? '#fff' : subtleText }]}>{editMode ? 'Save' : 'Create'}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
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
  fieldLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.3, marginBottom: 6 },
  photoPreviewRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 16 },
  photoPreview: { width: 80, height: 80, borderRadius: 10 },
  photoRemoveBtn: { marginTop: 2 },
  photoAddBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1.5, marginBottom: 16 },
  photoAddText: { fontSize: 15, fontWeight: '500' },
});
