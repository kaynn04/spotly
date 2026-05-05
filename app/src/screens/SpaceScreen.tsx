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

import React, { useState, useEffect } from 'react';
import {
  View,
  TextInput,
  Button,
  FlatList,
  Text,
  StyleSheet,
  Alert,
} from 'react-native';
import type { Space } from '@/models/Space';
import { SpaceService } from '@/services/SpaceService';

export function SpaceScreen() {
  const [name, setName] = useState('');
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(false);

  // Load spaces on screen mount
  useEffect(() => {
    loadSpaces();
  }, []);

  /**
   * Fetch all spaces from service
   */
  async function loadSpaces() {
    try {
      setLoading(true);
      const result = await SpaceService.getAllSpaces();
      setSpaces(result);
    } catch (error) {
      Alert.alert('Error', 'Failed to load spaces');
      console.error('loadSpaces error:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Create new space and reload list
   */
  async function handleCreateSpace() {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a space name');
      return;
    }

    try {
      setLoading(true);
      await SpaceService.createSpace(name);
      setName('');
      await loadSpaces();
    } catch (error: any) {
      const message = error?.message || 'Failed to create space';
      Alert.alert('Error', message);
      console.error('createSpace error:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Render individual space item
   */
  function renderSpaceItem({ item }: { item: Space }) {
    return (
      <View style={styles.spaceItem}>
        <Text style={styles.spaceName}>{item.name}</Text>
        <Text style={styles.spaceDate}>
          {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Input and Create Button */}
      <View style={styles.inputSection}>
        <TextInput
          style={styles.textInput}
          placeholder="Enter space name"
          value={name}
          onChangeText={setName}
          editable={!loading}
          maxLength={100}
        />
        <Button
          title="Create"
          onPress={handleCreateSpace}
          disabled={loading}
        />
      </View>

      {/* Spaces List */}
      <FlatList
        data={spaces}
        keyExtractor={(item) => item.id}
        renderItem={renderSpaceItem}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading...' : 'No spaces yet. Create one!'}
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
