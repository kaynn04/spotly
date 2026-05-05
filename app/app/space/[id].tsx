/**
 * Space Detail Screen
 *
 * View details for a single space
 * Accessed via /space/[id] dynamic route
 *
 * Implementation: T005 - Display space details in SpaceDetailScreen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { Space } from '../../src/models/Space';
import { SpaceService } from '../../src/services/SpaceService';

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);

  // Fetch space details on mount
  useEffect(() => {
    loadSpace();
  }, [id]);

  async function loadSpace() {
    if (!id) return;

    try {
      const result = await SpaceService.getSpaceById(id);
      setSpace(result);
    } catch (error) {
      console.error('Failed to load space:', error);
      setSpace(null);
    }
  }

  function handleDeletePress() {
    if (!space) return;

    // Show confirmation dialog
    Alert.alert(
      'Delete Space',
      `Delete '${space.name}'? This cannot be undone.`,
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Delete',
          onPress: () => deleteSpace(),
          style: 'destructive',
        },
      ]
    );
  }

  async function deleteSpace() {
    if (!id) return;

    try {
      await SpaceService.deleteSpace(id);
      // Navigate back to space list after successful deletion
      router.back();
    } catch (error) {
      console.error('Failed to delete space:', error);
      Alert.alert('Error', 'Failed to delete space. Please try again.');
    }
  }

  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <Button title="Back" onPress={() => router.back()} />
        <Text style={styles.title}>Space Detail</Text>
        <View style={{ width: 50 }} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {space ? (
          <>
            <Text style={styles.name}>{space.name}</Text>
            <Text style={styles.label}>Created:</Text>
            <Text style={styles.value}>
              {new Date(space.createdAt).toLocaleDateString()}
            </Text>

            {/* Delete Button */}
            <Pressable
              style={[styles.button, styles.deleteButton]}
              onPress={handleDeletePress}
            >
              <Text style={styles.deleteButtonText}>Delete Space</Text>
            </Pressable>
          </>
        ) : (
          <Text style={styles.notFound}>Space not found</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    padding: 16,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 16,
  },
  notFound: {
    fontSize: 16,
    color: '#999',
    textAlign: 'center',
    marginTop: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
