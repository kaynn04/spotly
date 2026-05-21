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
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import { useRouter } from 'expo-router';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBarcode, faBolt, faTimes } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { LabelQrService, type LabelTarget } from '../services/LabelQrService';

const PRIMARY = '#6b7f99';
const QR_PURPLE = '#7b61c9';
const BARCODE_TYPES: BarcodeType[] = [
  'qr',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'code128',
  'code39',
  'code93',
  'codabar',
  'itf14',
];

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
  const [torchEnabled, setTorchEnabled] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      setResolving(false);
      setTorchEnabled(false);
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
      if (result.type !== 'qr') {
        onClose();
        setTimeout(() => {
          router.push({
            pathname: '/tools/barcode-scanner' as any,
            params: {
              barcodeType: result.type,
              barcodeData: result.data,
            },
          });
        }, 150);
        return;
      }

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
            <FontAwesomeIcon icon={faBarcode} size={18} color={PRIMARY} />
            <Text style={[styles.headerTitle, { color: isDark ? '#ffffff' : '#11181c' }]}>
              Scan Code
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
            <FontAwesomeIcon icon={faBarcode} size={48} color={PRIMARY} />
            <Text style={[styles.permissionTitle, { color: isDark ? '#ffffff' : '#11181c' }]}>
              Camera access needed
            </Text>
            <Text style={[styles.permissionText, { color: mutedText }]}>
              Synop needs camera access to scan QR labels and product barcodes.
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
              enableTorch={torchEnabled}
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            >
              <View style={styles.cameraOverlay}>
                <TouchableOpacity
                  style={[styles.torchButton, torchEnabled && styles.torchButtonActive]}
                  onPress={() => setTorchEnabled((enabled) => !enabled)}
                  activeOpacity={0.75}
                  accessibilityLabel={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                >
                  <FontAwesomeIcon icon={faBolt} size={16} color="#ffffff" />
                </TouchableOpacity>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Place a Synop QR label or product barcode inside the frame</Text>
                {resolving && (
                  <View style={styles.resolvingPill}>
                    <ActivityIndicator color="#ffffff" size="small" />
                    <Text style={styles.resolvingText}>Reading code</Text>
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
  torchButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  torchButtonActive: {
    backgroundColor: QR_PURPLE,
    borderColor: 'rgba(255,255,255,0.7)',
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
