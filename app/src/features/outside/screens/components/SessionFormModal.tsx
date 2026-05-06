/**
 * SessionFormModal
 * 
 * Create new outside session modal
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
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Colors } from '@/constants/theme';
import { useOutsideService } from '../../services/OutsideService';

interface SessionFormModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function SessionFormModal({ visible, onClose }: SessionFormModalProps) {
  const router = useRouter();
  const colorScheme = useColorScheme();
  const outsideService = useOutsideService();
  const colors = Colors[colorScheme ?? 'light'];
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateSession = async () => {
    if (!title.trim()) {
      setError('Session title cannot be empty');
      return;
    }

    if (title.length > 100) {
      setError('Session title cannot exceed 100 characters');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const session = await outsideService.createSession(title);
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
    setTitle('');
    setError(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.content}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} disabled={loading}>
              <Text style={[styles.cancelButton, { color: '#0a84ff', opacity: loading ? 0.5 : 1 }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>New Session</Text>
            <TouchableOpacity onPress={handleCreateSession} disabled={loading}>
              <Text style={[styles.createButton, { color: '#0a84ff', opacity: loading ? 0.5 : 1 }]}>
                {loading ? '...' : 'Create'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <Text style={[styles.label, { color: colors.text }]}>Session Title</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: colors.text,
                  backgroundColor: colors.background === '#fff' ? '#f5f5f5' : '#2a2a2a',
                  borderColor: error ? '#d32f2f' : '#0a84ff',
                },
              ]}
              placeholder="e.g., Grocery run, Airport trip"
              placeholderTextColor={colors.icon}
              value={title}
              onChangeText={setTitle}
              maxLength={100}
              editable={!loading}
            />
            <Text style={[styles.characterCount, { color: colors.icon }]}>
              {title.length}/100
            </Text>

            {error && <Text style={[styles.errorText, { color: '#d32f2f' }]}>{error}</Text>}

            <TouchableOpacity
              style={[
                styles.createButtonFull,
                {
                  backgroundColor: '#0a84ff',
                  opacity: loading ? 0.5 : 1,
                },
              ]}
              onPress={handleCreateSession}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.createButtonFullText}>Create Session</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  cancelButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  createButton: {
    fontSize: 16,
    fontWeight: '600',
  },
  form: {
    gap: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  characterCount: {
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    marginVertical: 8,
  },
  createButtonFull: {
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  createButtonFullText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
