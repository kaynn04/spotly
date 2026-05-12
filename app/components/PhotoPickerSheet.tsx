/**
 * PhotoPickerSheet
 *
 * Bottom sheet with camera / gallery / cancel options for photo selection.
 * Matches the app's existing modal styling.
 *
 * Feature: 013 - Photo Inventory
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';

const PRIMARY = '#6b7f99';

interface PhotoPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onCamera: () => void;
  onGallery: () => void;
}

export default function PhotoPickerSheet({ visible, onClose, onCamera, onGallery }: PhotoPickerSheetProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#2c3e50';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
              <View style={styles.handle} />
              <Text style={[styles.title, { color: textColor }]}>Add Photo</Text>

              <TouchableOpacity style={styles.option} onPress={onCamera} activeOpacity={0.7}>
                <Ionicons name="camera-outline" size={24} color={PRIMARY} />
                <Text style={[styles.optionText, { color: textColor }]}>Take Photo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.option} onPress={onGallery} activeOpacity={0.7}>
                <Ionicons name="image-outline" size={24} color={PRIMARY} />
                <Text style={[styles.optionText, { color: textColor }]}>Choose from Library</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={[styles.cancelText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
  },
  optionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
