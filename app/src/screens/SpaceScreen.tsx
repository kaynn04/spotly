/**
 * Space Screen
 *
 * Create Space feature UI
 * - TextInput for space name
 * - Button to create space
 * - FlatList to display all spaces
 *
 * Implementation: UI for Create Space feature
 */

import React, { useState, useRef} from 'react';
import {
  View,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import type { Space } from '../models/Space';
import { SpaceService } from '../services/SpaceService';

export function SpaceScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const createTimeoutRef = useRef<number | null>(null);

  // Load spaces on screen mount and whenever screen comes into focus (including from navigation back)
  useFocusEffect(
    React.useCallback(() => {
      // Reset creation state when screen comes back into focus
      setIsCreating(false);
      setIsLoading(false);
      loadSpaces();

      // Cleanup timeout on unmount
      return () => {
        if (createTimeoutRef.current) {
          clearTimeout(createTimeoutRef.current);
        }
      };
    }, [])
  );

  /**
   * Fetch all spaces from service
   */
  async function loadSpaces() {
    try {
      setIsLoading(true);
      const result = await SpaceService.getAllSpaces();
      setSpaces(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to load spaces');
      console.error('loadSpaces error:', error);
    } finally {
      setIsLoading(false);
    }
  }

  /**
   * Create new space and reload list
   * Includes debouncing to prevent rapid submissions
   */
  async function handleCreateSpace() {
    // Prevent multiple rapid submissions
    if (isCreating) {
      return;
    }

    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a space name');
      return;
    }

    try {
      setIsCreating(true);
      const trimmedName = name.trim();

      // Create space via service
      await SpaceService.createSpace(trimmedName);

      // Clear input immediately for better UX
      setName('');

      // Show brief success message
      setSuccessMessage('Space created!');
      if (createTimeoutRef.current) {
        clearTimeout(createTimeoutRef.current);
      }
      createTimeoutRef.current = setTimeout(() => {
        setSuccessMessage('');
      }, 2000);

      // Reload spaces from database
      await loadSpaces();
    } catch (error: any) {
      // Extract error message from ServiceError
      const message = error?.message || 'Failed to create space. Try again.';
      Alert.alert('Creation Error', message);
      console.error('createSpace error:', error);
    } finally {
      setIsCreating(false);
    }
  }

  /**
   * Render individual space item
   */
  function renderSpaceItem({ item }: { item: Space }) {
    return (
      <Pressable 
        onPress={() => router.push({
          pathname: '/space/[id]' as any,
          params: { id: item.id }
        })}
      >
        <View style={styles.spaceItem}>
          <Text style={styles.spaceName}>{item.name}</Text>
          <Text style={styles.spaceDate}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {/* Input and Create Button */}
      <View style={styles.inputSection}>
        <TextInput
          style={[styles.textInput, isCreating && styles.textInputDisabled]}
          placeholder="Enter space name"
          placeholderTextColor="#999"
          value={name}
          onChangeText={setName}
          editable={!isCreating}
          maxLength={100}
        />

        <View style={styles.createButtonContainer}>
          <Button
            title={isCreating ? 'Creating...' : 'Create'}
            onPress={handleCreateSpace}
            disabled={isCreating}
          />
          {isCreating && (
            <ActivityIndicator
              size="small"
              color="#0000ff"
              style={styles.spinner}
            />
          )}
        </View>

        {/* Success message */}
        {successMessage ? (
          <Text style={styles.successMessage}>{successMessage}</Text>
        ) : null}
      </View>

      {/* Spaces List */}
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        renderItem={renderSpaceItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {isLoading ? 'Loading spaces...' : 'No spaces yet. Create one!'}
          </Text>
        }
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  inputSection: {
    marginBottom: 16,
    gap: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    padding: 8,
    fontSize: 16,
  },
  textInputDisabled: {
    backgroundColor: '#f5f5f5',
    color: '#999',
  },
  createButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  spinner: {
    marginLeft: 8,
  },
  successMessage: {
    color: '#28a745',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 4,
  },
  list: {
    flex: 1,
  },
  spaceItem: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  spaceName: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  spaceDate: {
    fontSize: 12,
    color: '#666',
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    marginTop: 24,
    fontSize: 14,
  },
});
