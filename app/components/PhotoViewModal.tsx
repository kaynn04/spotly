import React from 'react';
import {
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

interface PhotoViewModalProps {
  visible: boolean;
  uri: string | null;
  title?: string;
  onClose: () => void;
}

export default function PhotoViewModal({ visible, uri, title = 'Photo', onClose }: PhotoViewModalProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose} accessibilityLabel="Close photo viewer">
            <FontAwesomeIcon icon={faTimes} size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.imageWrap} activeOpacity={1} onPress={onClose}>
          {uri && <Image source={{ uri }} style={styles.image} resizeMode="contain" />}
        </TouchableOpacity>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.94)',
  },
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    gap: 12,
  },
  title: {
    flex: 1,
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  imageWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingBottom: 24,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
