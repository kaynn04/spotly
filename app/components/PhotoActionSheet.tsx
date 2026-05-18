import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faEye, faImage, faTimes, faTrash } from '@fortawesome/free-solid-svg-icons';
import { useColorScheme } from '@/hooks/use-color-scheme';

const PRIMARY = '#6b7f99';
const DESTRUCTIVE = '#d32f2f';

interface PhotoActionSheetProps {
  visible: boolean;
  title: string;
  onView: () => void;
  onReplace: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export default function PhotoActionSheet({
  visible,
  title,
  onView,
  onReplace,
  onRemove,
  onClose,
}: PhotoActionSheetProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const sheetBg = isDark ? '#1c1c1e' : '#ffffff';
  const rowBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const titleColor = isDark ? '#ffffff' : '#111827';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#343437' : '#eceff3';

  const runAction = (action: () => void) => {
    onClose();
    setTimeout(action, 80);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View style={[styles.sheet, { backgroundColor: sheetBg, paddingBottom: insets.bottom + 12 }]}>
        <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={[styles.eyebrow, { color: subtleText }]}>Photo</Text>
            <Text style={[styles.title, { color: titleColor }]} numberOfLines={1}>{title}</Text>
          </View>
          <TouchableOpacity style={[styles.closeButton, { backgroundColor: rowBg }]} onPress={onClose} accessibilityLabel="Close photo actions">
            <FontAwesomeIcon icon={faTimes} size={14} color={subtleText} />
          </TouchableOpacity>
        </View>

        <View style={styles.actionGroup}>
          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: rowBg, borderBottomColor: borderColor }]}
            onPress={() => runAction(onView)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${PRIMARY}18` }]}>
              <FontAwesomeIcon icon={faEye} size={16} color={PRIMARY} />
            </View>
            <View style={styles.actionText}>
              <Text style={[styles.actionLabel, { color: titleColor }]}>View Photo</Text>
              <Text style={[styles.actionDescription, { color: subtleText }]}>Open the full image</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, { backgroundColor: rowBg, borderBottomColor: borderColor }]}
            onPress={() => runAction(onReplace)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${PRIMARY}18` }]}>
              <FontAwesomeIcon icon={faImage} size={16} color={PRIMARY} />
            </View>
            <View style={styles.actionText}>
              <Text style={[styles.actionLabel, { color: titleColor }]}>Replace Photo</Text>
              <Text style={[styles.actionDescription, { color: subtleText }]}>Choose a new image</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionRow, styles.actionRowLast, { backgroundColor: rowBg }]}
            onPress={() => runAction(onRemove)}
            activeOpacity={0.7}
          >
            <View style={[styles.iconWrap, { backgroundColor: `${DESTRUCTIVE}16` }]}>
              <FontAwesomeIcon icon={faTrash} size={16} color={DESTRUCTIVE} />
            </View>
            <View style={styles.actionText}>
              <Text style={[styles.actionLabel, { color: DESTRUCTIVE }]}>Remove Photo</Text>
              <Text style={[styles.actionDescription, { color: subtleText }]}>Delete this photo from the app</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  headerText: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGroup: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  actionRowLast: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: {
    flex: 1,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
  },
});
