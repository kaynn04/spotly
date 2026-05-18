/**
 * SessionFormModal
 *
 * Create new outside session — bottom sheet style
 *
 * Implementation: T010
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useOutsideService } from '../../services/OutsideService';

interface SessionFormModalProps {
  visible: boolean;
  onClose: () => void;
}

const PRIMARY = '#6b7f99';

export default function SessionFormModal({ visible, onClose }: SessionFormModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const textColor = isDark ? '#ffffff' : '#2c3e50';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const handleCreateSession = async () => {
    if (!title.trim()) {
      setError('Please enter a checklist title');
      return;
    }
    if (title.length > 100) {
      setError('Title cannot exceed 100 characters');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await outsideService.createSession(title.trim());
      setTitle('');
      onClose();
      router.push(`/outside/${session.id}`);
    } catch (err: any) {
      console.error('Error creating session:', err);
      setError(err.message || 'Failed to create session');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Keyboard.dismiss();
    setTitle('');
    setError(null);
    onClose();
  };

  const isValid = title.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { Keyboard.dismiss(); handleCancel(); }}>
        <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); handleCancel(); }}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 16 }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Title */}
                <Text style={[styles.sheetTitle, { color: textColor }]}>New Checklist</Text>

                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  bounces={false}
                  style={styles.scrollContent}
                >
                  <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
                    Name this temporary outside checklist
                  </Text>

                  {/* Input */}
                  <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: error ? '#d32f2f' : borderColor }]}>
                    <TextInput
                      style={[styles.input, { color: textColor }]}
                      placeholder="e.g., Grocery run, Airport trip"
                      placeholderTextColor={subtleText}
                      value={title}
                      onChangeText={(t) => { setTitle(t); setError(null); }}
                      maxLength={100}
                      editable={!loading}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={handleCreateSession}
                    />
                  </View>

                  <View style={styles.inputMeta}>
                    {error ? (
                      <Text style={styles.errorText}>{error}</Text>
                    ) : (
                      <Text style={[styles.hint, { color: subtleText }]}>Press Create to start checking items</Text>
                    )}
                    <Text style={[styles.charCount, { color: subtleText }]}>{title.length}/100</Text>
                  </View>
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
                    onPress={handleCreateSession}
                    disabled={loading || !isValid}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <Text style={[styles.createBtnText, { color: isValid ? '#fff' : subtleText }]}>
                        Create
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
  },
  scrollContent: { flexGrow: 0 },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 2,
  },
  input: {
    fontSize: 16,
    paddingVertical: 12,
  },
  inputMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    minHeight: 18,
  },
  errorText: {
    fontSize: 13,
    color: '#d32f2f',
    flex: 1,
  },
  hint: {
    fontSize: 13,
    flex: 1,
  },
  charCount: {
    fontSize: 12,
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  createBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
