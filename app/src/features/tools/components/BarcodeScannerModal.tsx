import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult, type BarcodeType } from 'expo-camera';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faBarcode, faTimes } from '@fortawesome/free-solid-svg-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIMARY = '#6b7f99';
const BARCODE_ORANGE = '#e07b54';

const BARCODE_TYPES: BarcodeType[] = [
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

interface BarcodeScannerModalProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (result: { type: string; data: string }) => void;
}

export default function BarcodeScannerModal({ visible, onClose, onScanned }: BarcodeScannerModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (!visible) {
      setScanned(false);
      return;
    }
    if (!permission?.granted) {
      requestPermission().catch((error) => {
        console.error('[BarcodeScannerModal] camera permission error', error);
      });
    }
  }, [permission?.granted, requestPermission, visible]);

  const handleScan = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(true);
    onScanned({ type: result.type, data: result.data });
  };

  const hasPermission = permission?.granted;
  const surfaceBg = isDark ? '#111111' : '#ffffff';
  const overlayBg = isDark ? '#000000' : '#f8f9fa';
  const textColor = isDark ? '#ffffff' : '#11181c';
  const mutedText = isDark ? '#a1a1aa' : '#687076';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={[styles.container, { backgroundColor: overlayBg }]} edges={['top', 'bottom']}>
        <View style={[styles.header, { backgroundColor: surfaceBg }]}>
          <View style={styles.headerTitleWrap}>
            <FontAwesomeIcon icon={faBarcode} size={18} color={BARCODE_ORANGE} />
            <Text style={[styles.headerTitle, { color: textColor }]}>Scan Barcode</Text>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.7}>
            <FontAwesomeIcon icon={faTimes} size={17} color={PRIMARY} />
          </TouchableOpacity>
        </View>

        {!permission ? (
          <View style={styles.centered}>
            <ActivityIndicator color={BARCODE_ORANGE} />
          </View>
        ) : !hasPermission ? (
          <View style={styles.centered}>
            <FontAwesomeIcon icon={faBarcode} size={48} color={BARCODE_ORANGE} />
            <Text style={[styles.permissionTitle, { color: textColor }]}>Camera access needed</Text>
            <Text style={[styles.permissionText, { color: mutedText }]}>
              Synop needs camera access to scan product barcodes for item details.
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
              barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
              onBarcodeScanned={scanned ? undefined : handleScan}
            >
              <View style={styles.cameraOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>Align the product barcode inside the frame</Text>
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
    width: 280,
    height: 130,
    borderRadius: 18,
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
});
