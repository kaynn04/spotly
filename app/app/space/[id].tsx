/**
 * Space Detail Screen
 *
 * View details for a single space
 * Accessed via /space/[id] dynamic route
 *
 * Implementation: T005 - Display space details in SpaceDetailScreen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert, Pressable, FlatList, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import type { Space } from '../../src/models/Space';
import type { Item } from '../../src/models/Item';
import { SpaceService } from '../../src/services/SpaceService';
import { ItemService } from '../../src/services/ItemService';

export default function SpaceDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [space, setSpace] = useState<Space | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [itemName, setItemName] = useState<string>('');

  // Fetch space details on mount
  useEffect(() => {
    loadSpace();
  }, [id]);

  // Refresh items when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (space?.id) {
        loadItems();
      }
    }, [space?.id])
  );

  async function loadSpace() {
    if (!id) return;

    try {
      const result = await SpaceService.getSpaceById(id);
      setSpace(result);
      if (result?.id) {
        loadItems();
      }
    } catch (error) {
      console.error('Failed to load space:', error);
      setSpace(null);
    }
  }

  async function loadItems() {
    if (!id) return;

    try {
      const result = await ItemService.getItemsBySpaceId(id);
      setItems(result);
    } catch (error) {
      console.error('Failed to load items:', error);
      setItems([]);
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

  async function handleAddItem() {
    if (!id) return;

    if (!itemName.trim()) {
      Alert.alert('Error', 'Item name cannot be empty.');
      return;
    }

    try {
      await ItemService.createItem(id, itemName);
      setItemName('');
      await loadItems();
    } catch (error) {
      console.error('Failed to add item:', error);
      Alert.alert('Error', 'Failed to add item. Please try again.');
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

            {/* Items List */}
            <Text style={styles.itemsHeader}>Items:</Text>
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Text style={styles.itemName}>{item.name}</Text>
              )}
              scrollEnabled={false}
              ListEmptyComponent={
                <Text style={styles.noItems}>No items yet</Text>
              }
            />

            {/* Add Item Input */}
            <View style={styles.addItemContainer}>
              <TextInput
                style={styles.itemInput}
                placeholder="Enter item name"
                value={itemName}
                onChangeText={setItemName}
                placeholderTextColor="#999"
              />
              <Pressable
                style={[styles.button, styles.addButton]}
                onPress={handleAddItem}
              >
                <Text style={styles.addButtonText}>Add Item</Text>
              </Pressable>
            </View>
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
  itemsHeader: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 12,
  },
  itemName: {
    fontSize: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 4,
    marginBottom: 8,
  },
  noItems: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  addItemContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    alignItems: 'center',
  },
  itemInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#4444ff',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
