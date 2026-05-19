import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useRouter } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faQrcode, faTimes } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LabelQrService, type LabelTarget } from '../services/LabelQrService';

const PRIMARY = '#6b7f99';

interface QrScannerModalProps {
  visible: boolean;
  onClose: () => void;
}

function routeForTarget(target: LabelTarget) {
  if (target.kind === 'space') return `/space/${target.id}`;
  if (target.kind === 'container') return `/container/${target.id}`;
  return `/item/${target.id}`;
}

export default function QrScannerModal({ visible, onClose }: QrScannerModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setResolving(false);
      return;
    }
    if (!permission?.granted) {
      requestPermission().catch((error) => {
        console.error('[QrScannerModal] camera permission error', error);
      });
    }
  }, [permission?.granted, requestPermission, visible]);

  const handleScan = async (result: BarcodeScanningResult) => {
    if (scanned || resolving) return;
    setScanned(true);
    setResolving(true);

    try {
      const target = await LabelQrService.resolveScannedData(result.data);
      if (!target) {
        Alert.alert(
          'QR not recognized',
          'This does not look like a Synop label, or the linked item no longer exists.',
          [{ text: 'Scan again', onPress: () => setScanned(false) }]
        );
        return;
      }

      onClose();
      setTimeout(() => {
        router.push(routeForTarget(target) as any);
      }, 150);
    } catch (error) {
      console.error('[QrScannerModal] scan error', error);
      Alert.alert('Could not scan label', 'Please try again.', [
        { text: 'Scan again', onPress: () => setScanned(false) },
      ]);
    } finally {
      setResolving(false);
    }
  };

  const hasPermission = permission?.granted;
  const surfaceBg = isDark ? '#111111' : '#ffffff';
  const overlayBg = isDark ? '#000000' : '#f8f9fa';
  const mutedText = isDark ? '#a1a1aa' : '#687076';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: overlayBg }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: surfaceBg }]}>
          <View style={styles.headerTitleWrap}>
            <FontAwesomeIcon icon={faQrcode} size={18} color={PRIMARY} />
            <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#11181c' }]}>
              Scan Synop QR
            </Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <FontAwesomeIcon icon={faTimes} size={17} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color={PRIMARY} />
          </View>
        ) : !hasPermission ? (
          <View style={styles.centered}>
            <FontAwesomeIcon icon={faQrcode} size={48} color={PRIMARY} />
            <Text style={[styles.permissionTitle, { color: isDark ? '#ffffff' : '#11181c' }]}>
              Camera access needed
            </Text>
            <Text style={[styles.permissionText, { color: mutedText }]}>
              Synop needs camera access to scan labels attached to your spaces, containers, and items.
            </Text>
            <TouchableOpacity style={styles.permissionButton} onPress={requestPermission} activeOpacity={0.8}>
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.cameraShell}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Place a Synop QR label inside the frame</Text>
                {resolving && (
                  <View style={styles.resolvingPill}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.resolvingText}>Opening label</Text>
                  </View>
                )}
              </View>
            </CameraView>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 12,
  },
  permissionTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  permissionText: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  permissionButton: {
    marginTop: 8,
    minHeight: 46,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
  cameraShell: { flex: 1, overflow: 'hidden' },
  camera: { flex: 1 },
  cameraOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#ffffff',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scanHint: {
    marginTop: 18,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  resolvingPill: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  resolvingText: { color: '#ffffff', fontSize: 13, fontWeight: '700' },
});
