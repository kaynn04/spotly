/**
 * LendingPhotoSection
 *
 * Renders a grid of before or after photos for a lending record.
 * Shows up to 4 photos per phase; includes an "Add" button when under the limit.
 * Supports delete via long-press confirmation.
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCamera, faPlus, faTimes } from '@fortawesome/free-solid-svg-icons';
import { LendingPhoto, LendingPhotoPhase, MAX_PHOTOS_PER_PHASE } from '../../models/LendingPhoto';
import { PhotoService } from '../../../../services/PhotoService';
import PhotoViewModal from '@/components/PhotoViewModal';

const PHOTO_SIZE = 80;
const GAP = 8;

interface LendingPhotoSectionProps {
  lendingId: string;
  phase: LendingPhotoPhase;
  photos: LendingPhoto[];
  readOnly?: boolean;
  onAdd: (phase: LendingPhotoPhase, tempUri: string) => Promise<void>;
  onDelete: (photo: LendingPhoto) => Promise<void>;
  /** Colors from theme */
  cardBg: string;
  borderColor: string;
  subtleText: string;
  textColor: string;
  isDark: boolean;
}

export default function LendingPhotoSection({
  phase,
  photos,
  readOnly = false,
  onAdd,
  onDelete,
  cardBg,
  borderColor,
  subtleText,
  textColor,
  isDark,
}: LendingPhotoSectionProps) {
  const canAdd = !readOnly && photos.length < MAX_PHOTOS_PER_PHASE;
  const label = phase === 'before' ? 'BEFORE PHOTOS' : 'AFTER PHOTOS';
  const [viewPhotoUri, setViewPhotoUri] = useState<string | null>(null);

  const handleAdd = useCallback(async () => {
    Alert.alert('Add Photo', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const uri = await PhotoService.captureFromCamera();
          if (uri) await onAdd(phase, uri);
        },
      },
      {
        text: 'Photo Library',
        onPress: async () => {
          const uri = await PhotoService.pickFromGallery();
          if (uri) await onAdd(phase, uri);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [phase, onAdd]);

  const handleDelete = useCallback(
    (photo: LendingPhoto) => {
      Alert.alert('Remove Photo', 'Remove this photo?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => onDelete(photo),
        },
      ]);
    },
    [onDelete]
  );

  return (
    <View style={[styles.container, { backgroundColor: cardBg, borderColor }]}>
      <Text style={[styles.label, { color: subtleText }]}>{label}</Text>

      {photos.length === 0 && readOnly ? (
        <Text style={[styles.emptyText, { color: subtleText }]}>No photos</Text>
      ) : (
        <View style={styles.grid}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.photoWrapper}>
              <TouchableOpacity activeOpacity={0.8} onPress={() => setViewPhotoUri(photo.photo_uri)}>
                <Image source={{ uri: photo.photo_uri }} style={styles.photo} />
              </TouchableOpacity>
              {!readOnly && (
                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => handleDelete(photo)}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                >
                  <FontAwesomeIcon icon={faTimes} size={10} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          ))}

          {canAdd && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: isDark ? '#2c2c2e' : '#f0f2f5', borderColor }]}
              onPress={handleAdd}
            >
              <FontAwesomeIcon icon={faCamera} size={18} color={subtleText} />
              <Text style={[styles.addBtnText, { color: subtleText }]}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {!readOnly && (
        <Text style={[styles.hint, { color: subtleText }]}>
          {photos.length}/{MAX_PHOTOS_PER_PHASE} photos
        </Text>
      )}
      <PhotoViewModal
        visible={viewPhotoUri !== null}
        uri={viewPhotoUri}
        title={phase === 'before' ? 'Before photo' : 'After photo'}
        onClose={() => setViewPhotoUri(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyText: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  photoWrapper: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
  },
  deleteBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: 8,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
  },
});
