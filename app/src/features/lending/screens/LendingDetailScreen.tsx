/**
 * Lending Detail Screen
 *
 * Minimalist redesign â€” uniform with Outside feature
 *
 * Feature: 009 - Lending Tracker
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { LendingService } from '../services/LendingService';
import { LendingRepository } from '../repositories/LendingRepository';
import { ItemRepository } from '../../../repositories/ItemRepository';
import { Lending } from '../models/Lending';
import { LendingPhoto, LendingPhotoPhase, MAX_PHOTOS_PER_PHASE } from '../models/LendingPhoto';
import LendingPhotoSection from './components/LendingPhotoSection';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCamera, faChevronLeft, faTimes } from '@fortawesome/free-solid-svg-icons';
import PhotoPickerSheet from '@/components/PhotoPickerSheet';
import { PhotoService } from '@/src/services/PhotoService';

const PRIMARY = '#6b7f99';
const SUCCESS = '#6b9e7a';

interface LendingDetailScreenProps {
  lendingId: string;
}

export default function LendingDetailScreen({ lendingId }: LendingDetailScreenProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const itemRepository = useMemo(() => new ItemRepository(), []);
  const lendingService = useMemo(() => {
    return new LendingService(new LendingRepository(), itemRepository);
  }, [itemRepository]);

  const [lending, setLending] = useState<Lending | null>(null);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<LendingPhoto[]>([]);
  const [afterPhotos, setAfterPhotos] = useState<LendingPhoto[]>([]);
  const [returnPhotoUris, setReturnPhotoUris] = useState<string[]>([]);
  const [showReturnPhotoPicker, setShowReturnPhotoPicker] = useState(false);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const borderColor = isDark ? '#2c2c2e' : '#e2e6ea';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';

  const loadLendingDetails = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const lendingData = await lendingService.getLendingById(lendingId);
      if (!lendingData) { setError('Lending not found'); return; }
      setLending(lendingData);
      try {
        const itemData = await itemRepository.getById(lendingData.item_id);
        setItem(itemData);
      } catch { setItem(null); }
      // Load photos
      const [before, after] = await Promise.all([
        lendingService.getPhotos(lendingData.id, 'before'),
        lendingService.getPhotos(lendingData.id, 'after'),
      ]);
      setBeforePhotos(before);
      setAfterPhotos(after);
    } catch (err: any) {
      setError(err?.message || 'Failed to load lending details');
    } finally {
      setLoading(false);
    }
  }, [lendingId, lendingService, itemRepository]);

  useFocusEffect(useCallback(() => { loadLendingDetails(); }, [loadLendingDetails]));

  const handleConfirmReturn = async () => {
    if (!lending) return;
    setShowConfirm(false);
    setSubmitting(true);
    try {
      const updated = await lendingService.markAsReturned(lending.id);
      setLending(updated);
      let failedPhotoCount = 0;
      for (const uri of returnPhotoUris) {
        try {
          const photo = await lendingService.addPhoto(updated.id, 'after', uri);
          setAfterPhotos((prev) => [...prev, photo]);
        } catch {
          failedPhotoCount += 1;
        }
      }
      setReturnPhotoUris([]);
      // Show location hint before navigating back
      const spaceName = item?.space?.name;
      const containerName = item?.container?.name;
      const locationHint = containerName
        ? `It belongs in the "${containerName}" container in ${spaceName ?? 'its space'}.`
        : spaceName
        ? `It lives in the "${spaceName}" space.`
        : null;
      if (locationHint) {
        Alert.alert('Returned ✓', `${item?.name ?? 'Item'} has been marked as returned.\n\n${failedPhotoCount > 0 ? `${failedPhotoCount} after photo${failedPhotoCount === 1 ? '' : 's'} could not be saved.\n\n` : ''}${locationHint}`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else if (failedPhotoCount > 0) {
        Alert.alert('Returned ✓', `The item was marked as returned, but ${failedPhotoCount} after photo${failedPhotoCount === 1 ? '' : 's'} could not be saved.`, [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } else {
        router.back();
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to mark as returned');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (date: Date | null): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const handleAddPhoto = useCallback(async (phase: LendingPhotoPhase, tempUri: string) => {
    if (!lending) return;
    try {
      const photo = await lendingService.addPhoto(lending.id, phase, tempUri);
      if (phase === 'before') setBeforePhotos((prev) => [...prev, photo]);
      else setAfterPhotos((prev) => [...prev, photo]);
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to add photo');
    }
  }, [lending, lendingService]);

  const handleDeletePhoto = useCallback(async (photo: LendingPhoto) => {
    try {
      await lendingService.deletePhoto(photo.id, photo.photo_uri);
      if (photo.phase === 'before') setBeforePhotos((prev) => prev.filter((p) => p.id !== photo.id));
      else setAfterPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to delete photo');
    }
  }, [lendingService]);


  const headerBar = (
    <View style={[styles.headerBar, { borderBottomColor: borderColor }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
        <FontAwesomeIcon icon={faChevronLeft} size={18} color={PRIMARY} />
      </TouchableOpacity>
      <Text style={[styles.headerTitle, { color: colors.text }]}>Lending Details</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
        {headerBar}
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={PRIMARY} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !lending) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
        {headerBar}
        <View style={styles.centerContainer}>
          <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error || 'Lending not found'}</Text>
          <TouchableOpacity style={[styles.primaryButton, { backgroundColor: PRIMARY }]} onPress={() => router.back()}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isActive = lending.status === 'ACTIVE';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000000' : '#f8f9fa' }]} edges={['top', 'bottom']}>
      {headerBar}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Status Banner */}
          <View style={[styles.statusBanner, { backgroundColor: isActive ? `${PRIMARY}18` : `${SUCCESS}18`, borderColor: isActive ? `${PRIMARY}30` : `${SUCCESS}30` }]}>
            <View style={[styles.statusDot, { backgroundColor: isActive ? PRIMARY : SUCCESS }]} />
            <Text style={[styles.statusText, { color: isActive ? PRIMARY : SUCCESS }]}>
              {isActive ? 'Active Lending' : 'Returned'}
            </Text>
          </View>

          {/* Item Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            {item?.photoUri && (
              <Image source={{ uri: item.photoUri }} style={styles.itemPhoto} />
            )}
            <Text style={[styles.sectionLabel, { color: subtleText }]}>ITEM</Text>
            {item ? (
              <>
                <Text style={[styles.sectionValue, { color: colors.text }]}>{item.name}</Text>
                {(item.space || item.container) && (
                  <>
                    <View style={[styles.divider, { backgroundColor: borderColor }]} />
                    <Text style={[styles.sectionLabel, { color: subtleText }]}>LOCATION</Text>
                    <Text style={[styles.sectionValue, { color: colors.text }]}>
                      {item.container
                        ? `${item.space?.name ?? 'Unknown Space'} › ${item.container?.name ?? 'Unknown Container'}`
                        : item.space?.name ?? 'Unknown Space'}
                    </Text>
                  </>
                )}
              </>
            ) : (
              <Text style={[styles.sectionValueMuted, { color: subtleText }]}>Item was deleted</Text>
            )}
          </View>

          {/* Lending Info Card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor }]}>
            <Text style={[styles.sectionLabel, { color: subtleText }]}>BORROWER</Text>
            <Text style={[styles.sectionValue, { color: colors.text }]}>{lending.borrower_name}</Text>

            <View style={[styles.divider, { backgroundColor: borderColor }]} />

            <Text style={[styles.sectionLabel, { color: subtleText }]}>LENT ON</Text>
            <Text style={[styles.sectionValue, { color: colors.text }]}>{formatDate(lending.lent_at)}</Text>

            {lending.due_date && (
              <>
                <View style={[styles.divider, { backgroundColor: borderColor }]} />
                <Text style={[styles.sectionLabel, { color: subtleText }]}>DUE DATE</Text>
                <Text style={[
                  styles.sectionValue,
                  {
                    color: isActive && lending.due_date < new Date()
                      ? '#d32f2f'
                      : isActive && lending.due_date.toDateString() === new Date().toDateString()
                      ? '#e67e22'
                      : colors.text,
                  },
                ]}>
                  {formatDate(lending.due_date)}
                  {isActive && lending.due_date < new Date() ? '  ⚠ Overdue' : ''}
                </Text>
              </>
            )}

            {!isActive && lending.returned_at && (
              <>
                <View style={[styles.divider, { backgroundColor: borderColor }]} />
                <Text style={[styles.sectionLabel, { color: subtleText }]}>RETURNED ON</Text>
                <Text style={[styles.sectionValue, { color: colors.text }]}>{formatDate(lending.returned_at)}</Text>
              </>
            )}

            {lending.note && (
              <>
                <View style={[styles.divider, { backgroundColor: borderColor }]} />
                <Text style={[styles.sectionLabel, { color: subtleText }]}>NOTE</Text>
                <Text style={[styles.sectionValue, { color: colors.text }]}>{lending.note}</Text>
              </>
            )}
          </View>

          {/* Before Photos */}
          <LendingPhotoSection
            lendingId={lending.id}
            phase="before"
            photos={beforePhotos}
            readOnly={false}
            onAdd={handleAddPhoto}
            onDelete={handleDeletePhoto}
            cardBg={cardBg}
            borderColor={borderColor}
            subtleText={subtleText}
            textColor={colors.text}
            isDark={isDark}
          />

          {/* After Photos — always visible */}
          <LendingPhotoSection
            lendingId={lending.id}
            phase="after"
            photos={afterPhotos}
            readOnly={isActive}
            onAdd={handleAddPhoto}
            onDelete={handleDeletePhoto}
            cardBg={cardBg}
            borderColor={borderColor}
            subtleText={subtleText}
            textColor={colors.text}
            isDark={isDark}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      {isActive && (
        <View style={[styles.footer, { borderTopColor: borderColor, paddingBottom: insets.bottom || 16 }]}>
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: PRIMARY, opacity: submitting ? 0.6 : 1 }]}
            onPress={() => setShowConfirm(true)}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>Mark as Returned</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Inline Confirm Dialog */}
      {showConfirm && (
        <View style={styles.dialogOverlay}>
          <View style={[styles.dialogCard, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
            <View style={[styles.dialogHandle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
            <Text style={[styles.dialogTitle, { color: colors.text }]}>Mark as Returned?</Text>
            <Text style={[styles.dialogMessage, { color: subtleText }]}>
              Confirm that {lending.borrower_name} has returned the item.
            </Text>
            <Text style={[styles.dialogPhotoLabel, { color: subtleText }]}>After Photo (optional)</Text>
            <View style={styles.returnPhotoGrid}>
              {returnPhotoUris.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.returnPhotoPreviewWrap}>
                  <Image source={{ uri }} style={styles.returnPhotoPreview} />
                  <TouchableOpacity
                    style={styles.returnPhotoRemoveBtn}
                    onPress={() => setReturnPhotoUris((prev) => prev.filter((_, i) => i !== index))}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <FontAwesomeIcon icon={faTimes} size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {returnPhotoUris.length < MAX_PHOTOS_PER_PHASE && (
                <TouchableOpacity
                  style={[styles.dialogPhotoTile, { backgroundColor: isDark ? '#2c2c2e' : '#f8f9fa', borderColor }]}
                  onPress={() => setShowReturnPhotoPicker(true)}
                  activeOpacity={0.7}
                >
                  <FontAwesomeIcon icon={faCamera} size={17} color={subtleText} />
                  <Text style={[styles.dialogPhotoTileText, { color: subtleText }]}>Add</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.dialogPhotoCountText, { color: subtleText }]}>
              {returnPhotoUris.length}/{MAX_PHOTOS_PER_PHASE} photos
            </Text>
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={[styles.dialogCancelBtn, { borderColor }]}
                onPress={() => { setShowConfirm(false); setReturnPhotoUris([]); }}
              >
                <Text style={[styles.dialogCancelText, { color: subtleText }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirmBtn, { backgroundColor: PRIMARY }]}
                onPress={handleConfirmReturn}
              >
                <Text style={styles.primaryButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
      <PhotoPickerSheet
        visible={showReturnPhotoPicker}
        onClose={() => setShowReturnPhotoPicker(false)}
        onCamera={async () => {
          setShowReturnPhotoPicker(false);
          const uri = await PhotoService.captureFromCamera();
          if (uri) setReturnPhotoUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS_PER_PHASE));
        }}
        onGallery={async () => {
          setShowReturnPhotoPicker(false);
          const uri = await PhotoService.pickFromGallery();
          if (uri) setReturnPhotoUris((prev) => [...prev, uri].slice(0, MAX_PHOTOS_PER_PHASE));
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: { paddingVertical: 8, paddingRight: 8 },
  backBtnText: { fontSize: 17, fontWeight: '600' },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  headerSpacer: { width: 60 },

  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },

  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 14, fontWeight: '600' },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  sectionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
  sectionValue: { fontSize: 16, fontWeight: '500' },
  sectionValueMuted: { fontSize: 15, fontStyle: 'italic' },

  divider: { height: 1, marginVertical: 12 },
  itemPhoto: { width: '100%', height: 180, borderRadius: 10, marginBottom: 14, resizeMode: 'cover' },

  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  errorText: { fontSize: 15, marginBottom: 16, textAlign: 'center' },

  dialogOverlay: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    top: 0,
    justifyContent: 'flex-end',
  },
  dialogCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingTop: 12,
  },
  dialogHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  dialogTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  dialogMessage: { fontSize: 14, lineHeight: 20, marginBottom: 18 },
  dialogPhotoLabel: { fontSize: 12, fontWeight: '700', letterSpacing: 0.3, marginBottom: 8 },
  dialogPhotoCountText: { fontSize: 11, marginBottom: 18 },
  returnPhotoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  dialogPhotoTile: {
    width: 76,
    height: 76,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dialogPhotoTileText: { fontSize: 11, fontWeight: '700' },
  returnPhotoPreviewWrap: {
    width: 76,
    height: 76,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  returnPhotoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  returnPhotoRemoveBtn: {
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
  dialogButtons: { flexDirection: 'row', gap: 10 },
  dialogCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, alignItems: 'center',
  },
  dialogCancelText: { fontSize: 15, fontWeight: '600' },
  dialogConfirmBtn: { flex: 2, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
});
