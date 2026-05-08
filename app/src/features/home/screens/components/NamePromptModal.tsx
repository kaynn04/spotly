/**
 * NamePromptModal
 *
 * First-launch bottom sheet asking the user for their name.
 * Uniform with SessionFormModal / SpaceFormModal design pattern.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { UserService } from '@/src/services/UserService';

const PRIMARY = '#6b7f99';

interface NamePromptModalProps {
  visible: boolean;
  onDone: (name: string) => void;
}

export default function NamePromptModal({ visible, onDone }: NamePromptModalProps) {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const isDark = colorScheme === 'dark';

  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cardBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f8f9fa';
  const textColor = isDark ? '#ffffff' : '#2c3e50';
  const subtleText = isDark ? '#8e8e93' : '#a0aec0';
  const borderColor = isDark ? '#3a3a3c' : '#e2e6ea';

  const isValid = name.trim().length > 0;

  const handleSave = async () => {
    if (!name.trim()) { setError("Please enter your name"); return; }
    await UserService.setName(name.trim());
    Keyboard.dismiss();
    onDone(name.trim());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.overlay}>
            <TouchableWithoutFeedback onPress={() => {}}>
              <View style={[styles.sheet, { backgroundColor: cardBg, paddingBottom: insets.bottom + 20 }]}>
                {/* Handle */}
                <View style={[styles.handle, { backgroundColor: isDark ? '#48484a' : '#d1d5db' }]} />

                {/* Greeting */}
                <Text style={styles.emoji}>{'👋'}</Text>
                <Text style={[styles.sheetTitle, { color: textColor }]}>Welcome to Spotly!</Text>
                <Text style={[styles.sheetSubtitle, { color: subtleText }]}>
                  What should we call you?
                </Text>

                {/* Input */}
                <View style={[styles.inputWrapper, { backgroundColor: inputBg, borderColor: error ? '#d32f2f' : borderColor }]}>
                  <TextInput
                    style={[styles.input, { color: textColor }]}
                    placeholder="Your first name"
                    placeholderTextColor={subtleText}
                    value={name}
                    onChangeText={(t) => { setName(t); setError(null); }}
                    maxLength={40}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleSave}
                  />
                </View>
                {error && <Text style={styles.errorText}>{error}</Text>}

                {/* Button */}
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: isValid ? PRIMARY : (isDark ? '#3a3a3c' : '#e2e6ea') }]}
                  onPress={handleSave}
                  disabled={!isValid}
                >
                  <Text style={[styles.saveBtnText, { color: isValid ? '#fff' : subtleText }]}>
                    {"Let's go"}
                  </Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 24, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, textAlign: 'center', marginBottom: 6 },
  sheetSubtitle: { fontSize: 15, textAlign: 'center', marginBottom: 28 },
  inputWrapper: { borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 2, marginBottom: 8 },
  input: { fontSize: 18, paddingVertical: 14 },
  errorText: { fontSize: 12, color: '#d32f2f', marginBottom: 12 },
  saveBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 },
  saveBtnText: { fontSize: 17, fontWeight: '700' },
});
